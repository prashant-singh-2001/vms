import { Hono } from "hono";
import type { AppVariables } from "../auth/middleware";
import { requireAuth } from "../auth/middleware";
import * as repo from "../repositories/cameras";
import { config } from "../config";

/**
 * Proxies browser WHEP (WebRTC-HTTP Egress Protocol) offers to the worker so the
 * video signaling stays behind the same JWT auth as everything else. The worker
 * does the actual SDP negotiation (pion).
 */
export const whepRoutes = new Hono<{ Variables: AppVariables }>();
whepRoutes.use("*", requireAuth);

whepRoutes.post("/:id/whep", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const camera = await repo.getCameraForUser(userId, id);
  if (!camera) return c.json({ error: "Not found" }, 404);

  const offer = await c.req.text();
  let workerRes: Response;
  try {
    workerRes = await fetch(`${config.workerInternalUrl}/whep/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer,
    });
  } catch (err) {
    return c.json({ error: "Worker unreachable", details: String(err) }, 502);
  }

  if (!workerRes.ok) {
    const text = await workerRes.text().catch(() => "");
    return c.json({ error: "Worker rejected WHEP offer", details: text }, 502);
  }

  const answer = await workerRes.text();
  return c.body(answer, 200, { "Content-Type": "application/sdp" });
});
