package events

import "time"

// Deduper decides whether a person-detection frame should turn into an emitted
// person_detected event. It suppresses repeated alerts for the same ongoing
// presence, but lets a growing crowd size cut the cooldown short, and enforces
// a hard cap on events per rolling minute regardless of the above.
//
// Not safe for concurrent use; each camera pipeline owns its own instance.
type Deduper struct {
	cooldown        time.Duration
	maxPerMinute    int
	lastEmittedAt   time.Time
	lastPersonCount int
	emittedAt       []time.Time
}

func NewDeduper(cooldown time.Duration, maxPerMinute int) *Deduper {
	return &Deduper{cooldown: cooldown, maxPerMinute: maxPerMinute}
}

// ShouldEmit reports whether a new event should be emitted for a frame that
// contained personCount detected people, and updates internal state when it
// returns true. now is passed in explicitly so this stays a pure, deterministic
// function that's easy to unit test.
func (d *Deduper) ShouldEmit(personCount int, now time.Time) bool {
	if personCount == 0 {
		d.lastPersonCount = 0
		return false
	}

	cooldownElapsed := d.lastEmittedAt.IsZero() || now.Sub(d.lastEmittedAt) >= d.cooldown
	countIncreased := personCount > d.lastPersonCount

	if !cooldownElapsed && !countIncreased {
		return false
	}

	d.pruneOldEmissions(now)
	if d.maxPerMinute > 0 && len(d.emittedAt) >= d.maxPerMinute {
		return false
	}

	d.lastEmittedAt = now
	d.lastPersonCount = personCount
	d.emittedAt = append(d.emittedAt, now)
	return true
}

func (d *Deduper) pruneOldEmissions(now time.Time) {
	cutoff := now.Add(-time.Minute)
	idx := 0
	for _, t := range d.emittedAt {
		if t.After(cutoff) {
			break
		}
		idx++
	}
	d.emittedAt = d.emittedAt[idx:]
}
