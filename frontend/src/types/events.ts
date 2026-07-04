// Mirrors docs/EVENT_FORMAT.md exactly - keep in sync with api/src/events.ts,
// worker/internal/events/events.go, and detector/model.py.

export interface DetectionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Detection {
  label: string;
  confidence: number;
  box: DetectionBox;
}

export interface PersonDetectedEvent {
  id: string;
  cameraId: string;
  type: "person_detected";
  timestamp: string;
  confidence: number;
  detections: Detection[];
  frame: { width: number; height: number };
}

export type CameraRuntimeState = "connecting" | "live" | "stopped" | "error";

export interface StatsPayload {
  cameraId: string;
  fps: number;
  detectionsPerMinute: number;
  state: CameraRuntimeState;
  timestamp: string;
}

export interface CameraStatePayload {
  cameraId: string;
  state: CameraRuntimeState;
  message?: string | null;
}

export type WsMessage =
  | { type: "alert"; data: PersonDetectedEvent }
  | { type: "stats"; data: StatsPayload }
  | { type: "camera_state"; data: CameraStatePayload };
