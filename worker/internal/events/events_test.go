package events

import (
	"encoding/json"
	"testing"
	"time"
)

func TestPersonDetectedEvent_JSONShapeMatchesEventFormatSpec(t *testing.T) {
	ts := time.Date(2026, 7, 3, 12, 34, 56, 789000000, time.UTC)
	event := NewPersonDetectedEvent(
		"b0c1e2d3-0000-4000-8000-000000000000",
		"a1b2c3d4-0000-4000-8000-000000000000",
		[]Detection{{Label: "person", Confidence: 0.91, Box: Box{X: 0.12, Y: 0.30, W: 0.10, H: 0.25}}},
		Frame{Width: 1280, Height: 720},
		ts,
	)

	raw, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	for _, field := range []string{"id", "cameraId", "type", "timestamp", "confidence", "detections", "frame"} {
		if _, ok := decoded[field]; !ok {
			t.Errorf("expected field %q in serialized event, got %s", field, raw)
		}
	}

	if decoded["type"] != "person_detected" {
		t.Errorf("expected type=person_detected, got %v", decoded["type"])
	}
	if decoded["confidence"] != 0.91 {
		t.Errorf("expected confidence to be the max across detections, got %v", decoded["confidence"])
	}

	detections, ok := decoded["detections"].([]any)
	if !ok || len(detections) != 1 {
		t.Fatalf("expected exactly one detection, got %v", decoded["detections"])
	}
	det, ok := detections[0].(map[string]any)
	if !ok {
		t.Fatalf("expected detection to be an object")
	}
	box, ok := det["box"].(map[string]any)
	if !ok {
		t.Fatalf("expected detection.box to be an object")
	}
	for _, field := range []string{"x", "y", "w", "h"} {
		if _, ok := box[field]; !ok {
			t.Errorf("expected box field %q", field)
		}
	}

	frame, ok := decoded["frame"].(map[string]any)
	if !ok || frame["width"] != float64(1280) || frame["height"] != float64(720) {
		t.Errorf("unexpected frame dims: %v", decoded["frame"])
	}
}

func TestPersonDetectedEvent_EmptyDetectionsSerializeAsEmptyArrayNotNull(t *testing.T) {
	event := NewPersonDetectedEvent("id", "cam", nil, Frame{Width: 1, Height: 1}, time.Now())
	raw, _ := json.Marshal(event)
	var decoded map[string]any
	_ = json.Unmarshal(raw, &decoded)
	if _, isSlice := decoded["detections"].([]any); !isSlice {
		t.Errorf("expected detections to serialize as [], got %s", raw)
	}
}

func TestCameraCommand_JSONFieldNamesMatchSpec(t *testing.T) {
	cmd := CameraCommand{Action: "start", CameraID: "cam-1", RtspURL: "rtsp://x"}
	raw, err := json.Marshal(cmd)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if decoded["action"] != "start" || decoded["cameraId"] != "cam-1" || decoded["rtspUrl"] != "rtsp://x" {
		t.Errorf("unexpected field names in command JSON: %s", raw)
	}
}

func TestStatsPayload_JSONFieldNamesMatchSpec(t *testing.T) {
	stats := StatsPayload{CameraID: "cam-1", FPS: 14.8, DetectionsPerMinute: 3.5, State: StateLive, Timestamp: "2026-07-03T12:34:58.000Z"}
	raw, err := json.Marshal(stats)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if decoded["cameraId"] != "cam-1" || decoded["detectionsPerMinute"] != 3.5 || decoded["state"] != "live" {
		t.Errorf("unexpected field names/values in stats JSON: %s", raw)
	}
}
