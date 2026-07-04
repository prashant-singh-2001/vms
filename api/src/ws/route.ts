import { Hono } from "hono";
import { verifyToken } from "../auth/jwt";
import { upgradeWebSocket } from "./bun";
import { registerSocket, unregisterSocket } from "./manager";

export const wsRoute = new Hono();

wsRoute.get(
  "/ws",
  upgradeWebSocket((c) => {
    let userId: string | undefined;
    return {
      onOpen: async (_event, ws) => {
        const token = c.req.query("token");
        if (!token) {
          ws.close(4001, "missing token");
          return;
        }
        try {
          const payload = await verifyToken(token);
          userId = payload.sub;
          registerSocket(userId, ws);
        } catch {
          ws.close(4001, "invalid token");
        }
      },
      onClose: (_event, ws) => {
        if (userId) unregisterSocket(userId, ws);
      },
      onError: (_event, ws) => {
        if (userId) unregisterSocket(userId, ws);
      },
    };
  }),
);
