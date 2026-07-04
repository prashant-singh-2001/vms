package pipeline

import (
	"context"
	"log"
	"sync"
)

// camPipeline is the minimal surface Registry needs from a running pipeline.
// It exists (rather than using *Pipeline directly) so tests can swap in a
// fake that doesn't spawn real ffmpeg processes.
type camPipeline interface {
	Stop()
}

type Registry struct {
	mu      sync.Mutex
	items   map[string]camPipeline
	ctx     context.Context
	deps    Deps
	startFn func(ctx context.Context, cameraID, rtspURL string, deps Deps) camPipeline
}

func NewRegistry(ctx context.Context, deps Deps) *Registry {
	return &Registry{
		items: make(map[string]camPipeline),
		ctx:   ctx,
		deps:  deps,
		startFn: func(ctx context.Context, cameraID, rtspURL string, deps Deps) camPipeline {
			return Start(ctx, cameraID, rtspURL, deps)
		},
	}
}

// StartCamera stops any existing pipeline for this camera (waiting for it to
// fully tear down) and starts a fresh one. Only this camera is affected -
// other cameras' pipelines keep running untouched.
func (r *Registry) StartCamera(cameraID, rtspURL string) {
	r.mu.Lock()
	existing, ok := r.items[cameraID]
	delete(r.items, cameraID)
	r.mu.Unlock()

	if ok {
		existing.Stop()
	}

	log.Printf("[registry] starting camera %s", cameraID)
	p := r.startFn(r.ctx, cameraID, rtspURL, r.deps)

	r.mu.Lock()
	r.items[cameraID] = p
	r.mu.Unlock()
}

func (r *Registry) StopCamera(cameraID string) {
	r.mu.Lock()
	existing, ok := r.items[cameraID]
	delete(r.items, cameraID)
	r.mu.Unlock()

	if !ok {
		return
	}
	log.Printf("[registry] stopping camera %s", cameraID)
	existing.Stop()
}
