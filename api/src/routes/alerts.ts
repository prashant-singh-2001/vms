import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "../auth/middleware";
import { requireAuth } from "../auth/middleware";
import * as repo from "../repositories/alerts";
import * as cameraRepo from "../repositories/cameras";

export const alertRoutes = new Hono<{ Variables: AppVariables }>();
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
