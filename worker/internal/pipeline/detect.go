package pipeline

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg" // registers the JPEG decoder used by image.DecodeConfig
	"io"
	"log"
	"net"
	"time"

	"github.com/google/uuid"
	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"

	"vms-worker/internal/events"
	"vms-worker/internal/redisq"
)

// relayRTP forwards RTP packets from ffmpeg's local UDP socket into the
// camera's WebRTC track, and counts frame boundaries (RTP marker bit) for the
// FPS stat.
func relayRTP(ctx context.Context, conn *net.UDPConn, track *webrtc.TrackLocalStaticRTP, stats *statsTracker, errCh chan<- error) {
	go func() {
		<-ctx.Done()
		_ = conn.Close()
	}()

	buf := make([]byte, 1500)
	for {
		n, err := conn.Read(buf)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			errCh <- fmt.Errorf("rtp relay read: %w", err)
			return
		}

		pkt := &rtp.Packet{}
		if err := pkt.Unmarshal(buf[:n]); err != nil {
			continue
		}
		if pkt.Marker {
			stats.recordFrame()
		}
		if err := track.WriteRTP(pkt); err != nil && !errors.Is(err, io.ErrClosedPipe) {
			log.Printf("[pipeline] write rtp: %v", err)
		}
	}
}

// runDetectionLoop reads back-to-back JPEG frames from ffmpeg's stdout, sends
// each to the detector, applies dedup/rate-limiting, and publishes events.
func runDetectionLoop(
	ctx context.Context,
	stdout io.Reader,
	deps Deps,
	cameraID string,
	dedup *events.Deduper,
	stats *statsTracker,
	errCh chan<- error,
) {
	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 0, 64*1024), 16*1024*1024)
	scanner.Split(jpegSplitFunc)

	for scanner.Scan() {
		if ctx.Err() != nil {
			return
		}
		frame := scanner.Bytes()
		frameCopy := make([]byte, len(frame))
		copy(frameCopy, frame)
		processFrame(ctx, deps, cameraID, dedup, stats, frameCopy)
	}

	if err := scanner.Err(); err != nil && ctx.Err() == nil {
		errCh <- fmt.Errorf("detection stdout scan: %w", err)
	}
}

func processFrame(ctx context.Context, deps Deps, cameraID string, dedup *events.Deduper, stats *statsTracker, frame []byte) {
	width, height := 0, 0
	if cfg, _, err := image.DecodeConfig(bytes.NewReader(frame)); err == nil {
		width, height = cfg.Width, cfg.Height
	}

	detectCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	detections, err := deps.Detector.Detect(detectCtx, frame)
	if err != nil {
		if ctx.Err() == nil {
			log.Printf("[pipeline %s] detector error: %v", cameraID, err)
		}
		return
	}

	now := time.Now()
	if !dedup.ShouldEmit(len(detections), now) {
		return
	}
	stats.recordDetection()

	event := events.NewPersonDetectedEvent(uuid.NewString(), cameraID, detections, events.Frame{Width: width, Height: height}, now)
	if err := redisq.PublishEvent(ctx, deps.Redis, event); err != nil {
		log.Printf("[pipeline %s] failed to publish event: %v", cameraID, err)
	}
}

func publishStatsLoop(ctx context.Context, deps Deps, cameraID string, stats *statsTracker) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			fps, dpm := stats.snapshot()
			payload := events.StatsPayload{
				CameraID:            cameraID,
				FPS:                 fps,
				DetectionsPerMinute: dpm,
				State:               events.StateLive,
				Timestamp:           time.Now().UTC().Format(time.RFC3339Nano),
			}
			if err := redisq.PublishStats(ctx, deps.Redis, payload); err != nil {
				log.Printf("[pipeline %s] failed to publish stats: %v", cameraID, err)
			}
		}
	}
}

func publishState(ctx context.Context, deps Deps, cameraID string, state events.CameraState) {
	payload := events.StatsPayload{
		CameraID:  cameraID,
		State:     state,
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
	}
	if err := redisq.PublishStats(ctx, deps.Redis, payload); err != nil {
		log.Printf("[pipeline %s] failed to publish state %s: %v", cameraID, state, err)
	}
}
