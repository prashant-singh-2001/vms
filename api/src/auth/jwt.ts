import { sign, verify } from "hono/jwt";
import { config } from "../config";

export interface JwtPayload {
  sub: string; // user id
  username: string;
  exp: number;
  [key: string]: unknown;
}

const DURATION_RE = /^(\d+)(s|m|h|d)$/;
const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

function durationToSeconds(input: string): number {
  const match = DURATION_RE.exec(input.trim());
  if (!match) return 12 * 3600;
  const [, amount, unit] = match;
  return Number(amount) * UNIT_SECONDS[unit];
}

export async function signToken(userId: string, username: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + durationToSeconds(config.jwtExpiresIn);
  const payload: JwtPayload = { sub: userId, username, exp };
  return sign(payload, config.jwtSecret, "HS256");
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  return (await verify(token, config.jwtSecret, "HS256")) as JwtPayload;
}
