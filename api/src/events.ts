import { z } from "zod";

/**
 * Canonical event/payload shapes. Mirrors docs/EVENT_FORMAT.md exactly — keep the two
 * in sync, and keep this in sync with worker/internal/events/events.go and
 * detector/model.py.
 */

export const DetectionBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const DetectionSchema = z.object({
  label: z.string(),
  confidence: z.number(),
  box: DetectionBoxSchema,
});

export const PersonDetectedEventSchema = z.object({
  id: z.string().uuid(),
  cameraId: z.string().uuid(),
  type: z.literal("person_detected"),
  timestamp: z.string(),
  confidence: z.number(),
  detections: z.array(DetectionSchema),
  frame: z.object({ width: z.number(), height: z.number() }),
});
export type PersonDetectedEvent = z.infer<typeof PersonDetectedEventSchema>;

export const CameraStateSchema = z.enum(["connecting", "live", "stopped", "error"]);
export type CameraState = z.infer<typeof CameraStateSchema>;

export const StatsPayloadSchema = z.object({
  cameraId: z.string().uuid(),
  fps: z.number(),
  detectionsPerMinute: z.number(),
  state: CameraStateSchema,
  timestamp: z.string(),
});
export type StatsPayload = z.infer<typeof StatsPayloadSchema>;

export const CameraStatePayloadSchema = z.object({
  cameraId: z.string().uuid(),
  state: CameraStateSchema,
  message: z.string().nullable().optional(),
});
export type CameraStatePayload = z.infer<typeof CameraStatePayloadSchema>;

export type WsMessage =
  | { type: "alert"; data: PersonDetectedEvent }
  | { type: "stats"; data: StatsPayload }
  | { type: "camera_state"; data: CameraStatePayload };

export const CameraCommandSchema = z.object({
  action: z.enum(["start", "stop"]),
  cameraId: z.string().uuid(),
  rtspUrl: z.string().optional(),
});
export type CameraCommand = z.infer<typeof CameraCommandSchema>;
