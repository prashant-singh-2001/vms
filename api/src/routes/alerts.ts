import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "../auth/middleware";
import { requireAuth } from "../auth/middleware";
import { verifyToken } from "../auth/jwt";
import * as repo from "../repositories/alerts";
import * as cameraRepo from "../repositories/cameras";
import { redisPub } from "../redis/client";

export const alertRoutes = new Hono<{ Variables: AppVariables }>();

// Registered BEFORE the requireAuth middleware so it authenticates via a ?token=
// query param instead: browsers load this via a plain <img src> and can't set the
// Authorization header. Same pattern as the WebSocket route.
alertRoutes.get("/images/:imageId", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: "Missing token" }, 401);
  }
  try {
    await verifyToken(token);
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  const imageId = c.req.param("imageId");
  // getBuffer (not get): the PNG is binary; ioredis get() UTF-8-decodes and corrupts it.
  // redisPub (not redisSub): redisSub is pinned to the blocking XREADGROUP consumer.
  const image = await redisPub.getBuffer(`annotated:image:${imageId}`);
  if (!image) {
    return c.json({ error: "Image not found" }, 404);
  }

  return c.body(image, 200, { "Content-Type": "image/png" });
});

alertRoutes.use("*", requireAuth);

const QuerySchema = z.object({
  cameraId: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
});

function encodeCursor(ts: Date, id: string): string {
  return Buffer.from(JSON.stringify({ ts: ts.toISOString(), id })).toString("base64url");
}

function decodeCursor(cursor: string): { ts: Date; id: string } | undefined {
  try {
    const obj = JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
    return { ts: new Date(obj.ts), id: obj.id };
  } catch {
    return undefined;
  }
}

alertRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const parsed = QuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "Invalid query", details: parsed.error.flatten() }, 400);
  }
  const { cameraId, from, to, limit = 50, cursor } = parsed.data;

  if (cameraId) {
    const camera = await cameraRepo.getCameraForUser(userId, cameraId);
    if (!camera) return c.json({ error: "Camera not found" }, 404);
  }

  const rows = await repo.listAlerts({
    userId,
    cameraId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    limit,
    cursor: cursor ? decodeCursor(cursor) : undefined,
  });

  const last = rows[rows.length - 1];
  const nextCursor = rows.length === limit && last ? encodeCursor(last.ts, last.id) : null;
  return c.json({ alerts: rows, nextCursor });
});
