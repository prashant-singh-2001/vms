import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppVariables } from "./auth/middleware";
import { alertRoutes } from "./routes/alerts";
import { authRoutes } from "./routes/auth";
import { cameraRoutes } from "./routes/cameras";
import { whepRoutes } from "./routes/whep";
import { wsRoute } from "./ws/route";

export function createApp() {
  const app = new Hono<{ Variables: AppVariables }>();

  app.use("*", cors());
  app.get("/health", (c) => c.json({ ok: true }));

  app.route("/auth", authRoutes);
  app.route("/cameras", cameraRoutes);
  app.route("/cameras", whepRoutes);
  app.route("/alerts", alertRoutes);
  app.route("/", wsRoute);

  return app;
}
