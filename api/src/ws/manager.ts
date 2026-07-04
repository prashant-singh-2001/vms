import type { WSContext } from "hono/ws";
import type { WsMessage } from "../events";

const socketsByUser = new Map<string, Set<WSContext>>();

export function registerSocket(userId: string, ws: WSContext): void {
  let set = socketsByUser.get(userId);
  if (!set) {
    set = new Set();
    socketsByUser.set(userId, set);
  }
  set.add(ws);
}

export function unregisterSocket(userId: string, ws: WSContext): void {
  const set = socketsByUser.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) socketsByUser.delete(userId);
}

export function sendToUser(userId: string, message: WsMessage): void {
  const set = socketsByUser.get(userId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify(message);
  for (const ws of set) {
    try {
      ws.send(payload);
    } catch (err) {
      console.error("[ws] send failed", err);
    }
  }
}
