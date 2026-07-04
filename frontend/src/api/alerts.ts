import type { Alert } from "../types/camera";
import { apiFetch } from "./client";

export interface AlertQuery {
  cameraId?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string | null;
}

export interface AlertPage {
  alerts: Alert[];
  nextCursor: string | null;
}

export function listAlerts(query: AlertQuery = {}): Promise<AlertPage> {
  const params = new URLSearchParams();
  if (query.cameraId) params.set("cameraId", query.cameraId);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.cursor) params.set("cursor", query.cursor);

  const qs = params.toString();
  return apiFetch(`/alerts${qs ? `?${qs}` : ""}`);
}
