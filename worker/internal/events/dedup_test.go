package events

import (
	"testing"
	"time"
)

func TestDeduper_FirstDetectionEmitsImmediately(t *testing.T) {
	d := NewDeduper(10*time.Second, 6)
	if !d.ShouldEmit(1, time.Now()) {
		t.Fatal("expected first detection to emit")
	}
}

func TestDeduper_NoPersonsNeverEmits(t *testing.T) {
	d := NewDeduper(10*time.Second, 6)
	if d.ShouldEmit(0, time.Now()) {
		t.Fatal("expected zero persons to never emit")
	}
}

func TestDeduper_SuppressesWithinCooldown(t *testing.T) {
	d := NewDeduper(10*time.Second, 6)
	now := time.Now()
	if !d.ShouldEmit(1, now) {
		t.Fatal("expected first emit")
	}
	if d.ShouldEmit(1, now.Add(5*time.Second)) {
		t.Fatal("expected suppression within cooldown at the same person count")
	}
}

func TestDeduper_EmitsAgainAfterCooldown(t *testing.T) {
	d := NewDeduper(10*time.Second, 6)
	now := time.Now()
	d.ShouldEmit(1, now)
	if !d.ShouldEmit(1, now.Add(11*time.Second)) {
		t.Fatal("expected emit after cooldown elapses")
	}
}

func TestDeduper_EmitsEarlyWhenPersonCountIncreases(t *testing.T) {
	d := NewDeduper(10*time.Second, 6)
	now := time.Now()
	d.ShouldEmit(1, now)
	if !d.ShouldEmit(2, now.Add(1*time.Second)) {
		t.Fatal("expected emit when person count increases, even within cooldown")
	}
}

func TestDeduper_ResetsPersonCountWhenPersonsLeaveFrame(t *testing.T) {
	d := NewDeduper(10*time.Second, 6)
	now := time.Now()
	d.ShouldEmit(2, now)
	d.ShouldEmit(0, now.Add(1*time.Second))
	if !d.ShouldEmit(1, now.Add(2*time.Second)) {
		t.Fatal("expected emit after re-entry even with a lower count than before people left")
	}
}

func TestDeduper_HardCapPreventsExceedingMaxPerMinute(t *testing.T) {
	d := NewDeduper(1*time.Second, 3)
	now := time.Now()
	emitted := 0
	for i := 0; i < 10; i++ {
		if d.ShouldEmit(1, now.Add(time.Duration(i)*2*time.Second)) {
			emitted++
		}
	}
	if emitted > 3 {
		t.Fatalf("expected at most 3 emits per rolling minute, got %d", emitted)
	}
}

func TestDeduper_CapResetsAsOldEmissionsAgeOutOfWindow(t *testing.T) {
	d := NewDeduper(1*time.Second, 2)
	now := time.Now()
	if !d.ShouldEmit(1, now) {
		t.Fatal("expected emit 1")
	}
	if !d.ShouldEmit(1, now.Add(2*time.Second)) {
		t.Fatal("expected emit 2")
	}
	if d.ShouldEmit(1, now.Add(4*time.Second)) {
		t.Fatal("expected cap to block emit 3 within the same minute")
	}
	if !d.ShouldEmit(1, now.Add(61*time.Second)) {
		t.Fatal("expected emit to succeed once earlier emissions age out of the 1-minute window")
	}
}
