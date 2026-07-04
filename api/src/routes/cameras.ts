import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "../auth/middleware";
import { requireAuth } from "../auth/middleware";
import * as repo from "../repositories/cameras";
import { publishCameraCommand } from "../redis/commands";
import { sendToUser } from "../ws/manager";

export const cameraRoutes = new Hono<{ Variables: AppVariables }>();
cameraRoutes.use("*", requireAuth);

const CameraInputSchema = z.object({
  name: z.string().min(1).max(128),
  rtspUrl: z.string().min(1),
  location: z.string().max(256).optional(),
  enabled: z.boolean().optional(),
});

cameraRoutes.get("/", async (c) => {
  const rows = await repo.listCameras(c.get("userId"));
  return c.json({ cameras: rows });
});

cameraRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = CameraInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }
  const row = await repo.createCamera(c.get("userId"), parsed.data);
  return c.json({ camera: row }, 201);
});

cameraRoutes.get("/:id", async (c) => {
  const row = await repo.getCameraForUser(c.get("userId"), c.req.param("id"));
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ camera: row });
});

cameraRoutes.patch("/:id", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = CameraInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }
  const row = await repo.updateCamera(c.get("userId"), c.req.param("id"), parsed.data);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ camera: row });
});

cameraRoutes.delete("/:id", async (c) => {
  const row = await repo.deleteCamera(c.get("userId"), c.req.param("id"));
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.body(null, 204);
});

cameraRoutes.post("/:id/start", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const camera = await repo.getCameraForUser(userId, id);
  if (!camera) return c.json({ error: "Not found" }, 404);
  if (!camera.enabled) return c.json({ error: "Camera is disabled" }, 400);

  const updated = await repo.setCameraStatus(id, "connecting");
  await publishCameraCommand({ action: "start", cameraId: id, rtspUrl: camera.rtspUrl });
  sendToUser(userId, { type: "camera_state", data: { cameraId: id, state: "connecting" } });
  return c.json({ camera: updated });
});

cameraRoutes.post("/:id/stop", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const camera = await repo.getCameraForUser(userId, id);
  if (!camera) return c.json({ error: "Not found" }, 404);

  const updated = await repo.setCameraStatus(id, "stopped");
  await publishCameraCommand({ action: "stop", cameraId: id });
  sendToUser(userId, { type: "camera_state", data: { cameraId: id, state: "stopped" } });
  return c.json({ camera: updated });
});
