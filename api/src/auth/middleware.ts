import type { Context, Next } from "hono";
import { verifyToken } from "./jwt";

export type AppVariables = {
  userId: string;
  username: string;
};

export async function requireAuth(c: Context<{ Variables: AppVariables }>, next: Next) {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }
  try {
    const payload = await verifyToken(token);
    c.set("userId", payload.sub);
    c.set("username", payload.username);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}
