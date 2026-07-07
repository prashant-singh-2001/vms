import type { CameraRuntimeState } from "./events";

export interface Camera {
  id: string;
  userId: string;
  name: string;
  rtspUrl: string;
  location: string | null;
  enabled: boolean;
  status: CameraRuntimeState;
  createdAt: string;
  updatedAt: string;
}

export interface CameraInput {
  name: string;
  rtspUrl: string;
  location?: string;
  enabled?: boolean;
}

export interface Alert {
  id: string;
  cameraId: string;
  type: string;
  confidence: number;
  detections: Array<{ label: string; confidence: number; box: { x: number; y: number; w: number; h: number } }>;
  frameWidth: number;
  frameHeight: number;
  annotatedImageId?: string;
  ts: string;
}
