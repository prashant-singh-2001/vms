import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../auth/password";
import { signToken } from "../auth/jwt";
import { db } from "../db/client";
import { users } from "../db/schema";

export const authRoutes = new Hono();

const CredsSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(6).max(128),
});

authRoutes.post("/signup", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = CredsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }
  const { username, password } = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.username, username));
  if (existing) return c.json({ error: "Username already taken" }, 409);

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ username, passwordHash }).returning();
  const token = await signToken(user.id, user.username);
  return c.json({ token, user: { id: user.id, username: user.username } }, 201);
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = CredsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input" }, 400);
  const { username, password } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user) return c.json({ error: "Invalid credentials" }, 401);

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return c.json({ error: "Invalid credentials" }, 401);

  const token = await signToken(user.id, user.username);
  return c.json({ token, user: { id: user.id, username: user.username } });
});
