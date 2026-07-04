package pipeline

import (
	"sync"
	"time"
)

// statsTracker accumulates raw counters between periodic snapshots: decoded
// video FPS (from RTP marker bits) and a rolling one-minute detection count.
type statsTracker struct {
	mu               sync.Mutex
	frameCount       int
	frameWindowStart time.Time
	detectionTimes   []time.Time
}

func newStatsTracker() *statsTracker {
	return &statsTracker{frameWindowStart: time.Now()}
}

func (s *statsTracker) recordFrame() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.frameCount++
}

func (s *statsTracker) recordDetection() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.detectionTimes = append(s.detectionTimes, time.Now())
}

func (s *statsTracker) snapshot() (fps float64, detectionsPerMinute float64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	if elapsed := now.Sub(s.frameWindowStart).Seconds(); elapsed > 0 {
		fps = float64(s.frameCount) / elapsed
	}
	s.frameCount = 0
	s.frameWindowStart = now

	cutoff := now.Add(-time.Minute)
	idx := 0
	for _, t := range s.detectionTimes {
		if t.After(cutoff) {
			break
		}
		idx++
	}
	s.detectionTimes = s.detectionTimes[idx:]
	detectionsPerMinute = float64(len(s.detectionTimes))
	return fps, detectionsPerMinute
}
