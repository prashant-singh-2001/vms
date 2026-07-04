import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { cameras } from "../db/schema";

export interface CameraInput {
  name: string;
  rtspUrl: string;
  location?: string;
  enabled?: boolean;
}

export async function listCameras(userId: string) {
  return db.select().from(cameras).where(eq(cameras.userId, userId)).orderBy(cameras.createdAt);
}

export async function createCamera(userId: string, input: CameraInput) {
  const [row] = await db
    .insert(cameras)
    .values({
      userId,
      name: input.name,
      rtspUrl: input.rtspUrl,
      location: input.location,
      enabled: input.enabled ?? true,
    })
    .returning();
  return row;
}

export async function getCameraForUser(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(cameras)
    .where(and(eq(cameras.id, id), eq(cameras.userId, userId)));
  return row;
}

export async function updateCamera(
  userId: string,
  id: string,
  patch: Partial<CameraInput>,
) {
  const [row] = await db
    .update(cameras)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(cameras.id, id), eq(cameras.userId, userId)))
    .returning();
  return row;
}

export async function deleteCamera(userId: string, id: string) {
  const [row] = await db
    .delete(cameras)
    .where(and(eq(cameras.id, id), eq(cameras.userId, userId)))
    .returning();
  return row;
}

/** Unscoped lookup for internal use (redis consumer resolving an event's owner). */
export async function getCameraById(id: string) {
  const [row] = await db.select().from(cameras).where(eq(cameras.id, id));
  return row;
}

export async function setCameraStatus(id: string, status: string) {
  const [row] = await db
    .update(cameras)
    .set({ status, updatedAt: new Date() })
    .where(eq(cameras.id, id))
    .returning();
  return row;
}
