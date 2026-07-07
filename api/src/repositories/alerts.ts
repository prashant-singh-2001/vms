import { and, desc, eq, gte, lt, lte, or } from "drizzle-orm";
import { db } from "../db/client";
import { alerts, cameras } from "../db/schema";

export interface AlertFilters {
  userId: string;
  cameraId?: string;
  from?: Date;
  to?: Date;
  limit: number;
  cursor?: { ts: Date; id: string };
}

export async function listAlerts(filters: AlertFilters) {
  const conditions = [eq(cameras.userId, filters.userId)];
  if (filters.cameraId) conditions.push(eq(alerts.cameraId, filters.cameraId));
  if (filters.from) conditions.push(gte(alerts.ts, filters.from));
  if (filters.to) conditions.push(lte(alerts.ts, filters.to));
  if (filters.cursor) {
    const { ts, id } = filters.cursor;
    conditions.push(or(lt(alerts.ts, ts), and(eq(alerts.ts, ts), lt(alerts.id, id)))!);
  }

  return db
    .select({
      id: alerts.id,
      cameraId: alerts.cameraId,
      type: alerts.type,
      confidence: alerts.confidence,
      detections: alerts.detections,
      frameWidth: alerts.frameWidth,
      frameHeight: alerts.frameHeight,
      annotatedImageId: alerts.annotatedImageId,
      ts: alerts.ts,
    })
    .from(alerts)
    .innerJoin(cameras, eq(alerts.cameraId, cameras.id))
    .where(and(...conditions))
    .orderBy(desc(alerts.ts), desc(alerts.id))
    .limit(filters.limit);
}

export interface NewAlert {
  id: string;
  cameraId: string;
  type: string;
  confidence: number;
  detections: unknown;
  frameWidth: number;
  frameHeight: number;
  annotatedImageId?: string;
  ts: Date;
}

export async function insertAlert(row: NewAlert) {
  const [inserted] = await db
    .insert(alerts)
    .values(row)
    .onConflictDoNothing({ target: alerts.id })
    .returning();
  return inserted;
}
