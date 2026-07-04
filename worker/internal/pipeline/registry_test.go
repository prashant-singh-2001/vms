package pipeline

import (
	"context"
	"sync"
	"testing"
)

type fakePipeline struct {
	mu      sync.Mutex
	stopped bool
}

func newFakePipeline() *fakePipeline {
	return &fakePipeline{}
}

func (f *fakePipeline) Stop() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.stopped = true
}

func (f *fakePipeline) isStopped() bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.stopped
}

// newTestRegistry builds a Registry whose startFn never touches ffmpeg/redis/
// webrtc - it just hands back a fakePipeline so we can assert on start/stop
// dispatch in isolation.
func newTestRegistry() (*Registry, map[string]*fakePipeline) {
	created := make(map[string]*fakePipeline)
	var mu sync.Mutex

	r := &Registry{
		items: make(map[string]camPipeline),
		ctx:   context.Background(),
		startFn: func(_ context.Context, cameraID, _ string, _ Deps) camPipeline {
			fp := newFakePipeline()
			mu.Lock()
			created[cameraID] = fp
			mu.Unlock()
			return fp
		},
	}
	return r, created
}

func TestRegistry_StartCamera_CreatesAndTracksPipeline(t *testing.T) {
	r, created := newTestRegistry()
	r.StartCamera("cam-1", "rtsp://example/1")

	if _, ok := created["cam-1"]; !ok {
		t.Fatalf("expected a pipeline to be created for cam-1")
	}
}

func TestRegistry_StartCamera_StopsPreviousPipelineForSameCamera(t *testing.T) {
	r, created := newTestRegistry()
	r.StartCamera("cam-1", "rtsp://example/1")
	first := created["cam-1"]

	r.StartCamera("cam-1", "rtsp://example/1-v2")
	second := created["cam-1"]

	if first == second {
		t.Fatalf("expected a new pipeline instance on restart")
	}
	if !first.isStopped() {
		t.Fatalf("expected the previous pipeline to have been stopped")
	}
}

func TestRegistry_StopCamera_StopsOnlyThatCamerasPipeline(t *testing.T) {
	r, created := newTestRegistry()
	r.StartCamera("cam-1", "rtsp://example/1")
	r.StartCamera("cam-2", "rtsp://example/2")

	r.StopCamera("cam-1")

	if !created["cam-1"].isStopped() {
		t.Fatalf("expected cam-1's pipeline to be stopped")
	}
	if created["cam-2"].isStopped() {
		t.Fatalf("expected cam-2's pipeline to keep running - one camera stopping must not affect others")
	}
}

func TestRegistry_StopCamera_UnknownCameraIsANoop(t *testing.T) {
	r, _ := newTestRegistry()
	r.StopCamera("does-not-exist")
}
