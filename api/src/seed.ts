import { eq } from "drizzle-orm";
import { hashPassword } from "./auth/password";
import { config } from "./config";
import { db } from "./db/client";
import { cameras, users } from "./db/schema";

export async function seedDemoData(): Promise<void> {
  const { username, password, rtspUrl } = config.seed;
  if (!username || !password) return;

  let [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user) {
    const passwordHash = await hashPassword(password);
    [user] = await db.insert(users).values({ username, passwordHash }).returning();
    console.log(`[seed] created demo user "${username}" (password: ${password})`);
  }

  const existingCameras = await db.select().from(cameras).where(eq(cameras.userId, user.id));
  if (existingCameras.length === 0 && rtspUrl) {
    await db.insert(cameras).values({
      userId: user.id,
      name: "Test Camera",
      rtspUrl,
      location: "Demo",
      enabled: true,
    });
    console.log(`[seed] created demo camera pointing at ${rtspUrl}`);
  }
}
