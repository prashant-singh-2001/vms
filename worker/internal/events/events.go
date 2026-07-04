// Package events defines the canonical event/payload shapes. Mirrors
// docs/EVENT_FORMAT.md exactly - keep the two in sync, and keep this in sync
// with api/src/events.ts and detector/model.py.
package events

import "time"

type Box struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	W float64 `json:"w"`
	H float64 `json:"h"`
}

type Detection struct {
	Label      string  `json:"label"`
	Confidence float64 `json:"confidence"`
	Box        Box     `json:"box"`
}

type Frame struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

type PersonDetectedEvent struct {
	ID         string      `json:"id"`
	CameraID   string      `json:"cameraId"`
	Type       string      `json:"type"`
	Timestamp  string      `json:"timestamp"`
	Confidence float64     `json:"confidence"`
	Detections []Detection `json:"detections"`
	Frame      Frame       `json:"frame"`
}

func NewPersonDetectedEvent(id, cameraID string, detections []Detection, frame Frame, ts time.Time) PersonDetectedEvent {
	maxConf := 0.0
	for _, d := range detections {
		if d.Confidence > maxConf {
			maxConf = d.Confidence
		}
	}
	if detections == nil {
		detections = []Detection{}
	}
	return PersonDetectedEvent{
		ID:         id,
		CameraID:   cameraID,
		Type:       "person_detected",
		Timestamp:  ts.UTC().Format(time.RFC3339Nano),
		Confidence: maxConf,
		Detections: detections,
		Frame:      frame,
	}
}

type CameraState string

const (
	StateConnecting CameraState = "connecting"
	StateLive       CameraState = "live"
	StateStopped    CameraState = "stopped"
	StateError      CameraState = "error"
)

type StatsPayload struct {
	CameraID            string      `json:"cameraId"`
	FPS                 float64     `json:"fps"`
	DetectionsPerMinute float64     `json:"detectionsPerMinute"`
	State               CameraState `json:"state"`
	Timestamp           string      `json:"timestamp"`
}

type CameraCommand struct {
	Action   string `json:"action"`
	CameraID string `json:"cameraId"`
	RtspURL  string `json:"rtspUrl"`
}
