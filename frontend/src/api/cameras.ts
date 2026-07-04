import type { Camera, CameraInput } from "../types/camera";
import { apiFetch } from "./client";

export function listCameras(): Promise<{ cameras: Camera[] }> {
  return apiFetch("/cameras");
}

export function createCamera(input: CameraInput): Promise<{ camera: Camera }> {
  return apiFetch("/cameras", { method: "POST", body: JSON.stringify(input) });
}

export function updateCamera(id: string, input: Partial<CameraInput>): Promise<{ camera: Camera }> {
  return apiFetch(`/cameras/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteCamera(id: string): Promise<void> {
  return apiFetch(`/cameras/${id}`, { method: "DELETE" });
}

export function startCamera(id: string): Promise<{ camera: Camera }> {
  return apiFetch(`/cameras/${id}/start`, { method: "POST" });
}

export function stopCamera(id: string): Promise<{ camera: Camera }> {
  return apiFetch(`/cameras/${id}/stop`, { method: "POST" });
}
