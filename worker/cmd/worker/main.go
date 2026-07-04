package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"vms-worker/internal/config"
	"vms-worker/internal/detectorclient"
	"vms-worker/internal/events"
	"vms-worker/internal/httpapi"
	"vms-worker/internal/pipeline"
	"vms-worker/internal/redisq"
	"vms-worker/internal/webrtcsvc"
)

func main() {
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	redisClient, err := redisq.NewClient(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis client: %v", err)
	}

	webrtcManager, err := webrtcsvc.NewManager(cfg.WebRTCPublicIP, uint16(cfg.WebRTCUDPPortMin), uint16(cfg.WebRTCUDPPortMax))
	if err != nil {
		log.Fatalf("webrtc manager: %v", err)
	}

	deps := pipeline.Deps{
		Redis:    redisClient,
		Detector: detectorclient.New(cfg.DetectorURL),
		WebRTC:   webrtcManager,
		Config:   cfg,
	}
	registry := pipeline.NewRegistry(ctx, deps)

	// Each start/stop command is dispatched onto its own goroutine so a slow
	// teardown for one camera never delays commands for any other camera.
	go func() {
		err := redisq.ConsumeCommands(ctx, redisClient, "worker-1", func(cmd events.CameraCommand) {
			switch cmd.Action {
			case "start":
				go registry.StartCamera(cmd.CameraID, cmd.RtspURL)
			case "stop":
				go registry.StopCamera(cmd.CameraID)
			default:
				log.Printf("[worker] unknown command action: %q", cmd.Action)
			}
		})
		if err != nil && ctx.Err() == nil {
			log.Fatalf("command consumer stopped unexpectedly: %v", err)
		}
	}()

	server := &http.Server{Addr: cfg.HTTPAddr, Handler: httpapi.NewMux(webrtcManager)}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	log.Printf("[worker] http listening on %s", cfg.HTTPAddr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("http server: %v", err)
	}
}
