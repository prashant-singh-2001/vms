// Package pipeline runs one isolated camera end to end: RTSP in, WebRTC out,
// and a sampled detection loop that publishes person_detected events. Each
// camera gets its own goroutines and ffmpeg subprocesses so a failure or a
// Stop() on one camera can never affect another.
package pipeline

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"

	"vms-worker/internal/config"
	"vms-worker/internal/detectorclient"
	"vms-worker/internal/events"
	"vms-worker/internal/webrtcsvc"
)

type Deps struct {
	Redis    *redis.Client
	Detector *detectorclient.Client
	WebRTC   *webrtcsvc.Manager
	Config   config.Config
}

type Pipeline struct {
	cameraID string
	rtspURL  string
	cancel   context.CancelFunc
	done     chan struct{}
}

// Start launches a camera pipeline in the background and returns immediately;
// it keeps running (with restart/backoff on failure) until Stop is called or
// parentCtx is cancelled.
func Start(parentCtx context.Context, cameraID, rtspURL string, deps Deps) *Pipeline {
	ctx, cancel := context.WithCancel(parentCtx)
	p := &Pipeline{cameraID: cameraID, rtspURL: rtspURL, cancel: cancel, done: make(chan struct{})}
	go p.run(ctx, deps)
	return p
}

// Stop signals the pipeline to shut down and blocks until its resources
// (ffmpeg processes, WebRTC track) are fully torn down.
func (p *Pipeline) Stop() {
	p.cancel()
	<-p.done
}

func (p *Pipeline) run(ctx context.Context, deps Deps) {
	defer close(p.done)
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[pipeline %s] recovered from panic: %v", p.cameraID, r)
			publishState(context.Background(), deps, p.cameraID, events.StateError)
		}
	}()

	publishState(ctx, deps, p.cameraID, events.StateConnecting)

	backoff := time.Second
	const maxBackoff = 30 * time.Second

	for {
		if ctx.Err() != nil {
			publishState(context.Background(), deps, p.cameraID, events.StateStopped)
			return
		}

		err := p.runOnce(ctx, deps)

		if ctx.Err() != nil {
			publishState(context.Background(), deps, p.cameraID, events.StateStopped)
			return
		}

		if err != nil {
			log.Printf("[pipeline %s] error: %v (retrying in %s)", p.cameraID, err, backoff)
			publishState(ctx, deps, p.cameraID, events.StateError)

			select {
			case <-ctx.Done():
				publishState(context.Background(), deps, p.cameraID, events.StateStopped)
				return
			case <-time.After(backoff):
			}

			backoff *= 2
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
			continue
		}

		backoff = time.Second
	}
}

// runOnce sets up one "generation" of ffmpeg processes + goroutines for this
// camera and blocks until either ctx is done (clean shutdown, returns nil) or
// something fails (returns the error so run() can back off and retry).
func (p *Pipeline) runOnce(ctx context.Context, deps Deps) error {
	runCtx, cancelRun := context.WithCancel(ctx)
	defer cancelRun()

	udpConn, port, err := allocateUDPListener()
	if err != nil {
		return fmt.Errorf("allocate udp listener: %w", err)
	}
	defer udpConn.Close()

	track, err := deps.WebRTC.RegisterTrack(p.cameraID)
	if err != nil {
		return fmt.Errorf("register webrtc track: %w", err)
	}
	defer deps.WebRTC.UnregisterTrack(p.cameraID, track)

	errCh := make(chan error, 4)

	webrtcCmd := buildWebRTCFfmpegCmd(runCtx, p.rtspURL, port)
	if err := webrtcCmd.Start(); err != nil {
		return fmt.Errorf("start webrtc ffmpeg: %w", err)
	}
	go func() {
		if werr := webrtcCmd.Wait(); werr != nil {
			errCh <- fmt.Errorf("webrtc ffmpeg exited: %w", werr)
		} else {
			errCh <- fmt.Errorf("webrtc ffmpeg exited unexpectedly")
		}
	}()

	stats := newStatsTracker()
	go relayRTP(runCtx, udpConn, track, stats, errCh)

	detectCmd, stdout, err := buildDetectionFfmpegCmd(runCtx, p.rtspURL, deps.Config.DetectionSampleFPS)
	if err != nil {
		_ = webrtcCmd.Process.Kill()
		return fmt.Errorf("build detection ffmpeg: %w", err)
	}
	if err := detectCmd.Start(); err != nil {
		_ = webrtcCmd.Process.Kill()
		return fmt.Errorf("start detection ffmpeg: %w", err)
	}
	go func() {
		if derr := detectCmd.Wait(); derr != nil {
			errCh <- fmt.Errorf("detection ffmpeg exited: %w", derr)
		} else {
			errCh <- fmt.Errorf("detection ffmpeg exited unexpectedly")
		}
	}()

	dedup := events.NewDeduper(
		time.Duration(deps.Config.DedupCooldownSec)*time.Second,
		deps.Config.MaxEventsPerMin,
	)
	go runDetectionLoop(runCtx, stdout, deps, p.cameraID, dedup, stats, errCh)
	go publishStatsLoop(runCtx, deps, p.cameraID, stats)

	publishState(runCtx, deps, p.cameraID, events.StateLive)

	var runErr error
	select {
	case <-ctx.Done():
		runErr = nil
	case runErr = <-errCh:
	}

	cancelRun()
	_ = webrtcCmd.Process.Kill()
	_ = detectCmd.Process.Kill()
	return runErr
}
