import { beforeAll, describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { runMigrations } from "../src/db/migrate";
import { insertAlert } from "../src/repositories/alerts";

const app = createApp();

function authed(token: string, init: RequestInit = {}) {
  return {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  };
}

async function signup(username: string) {
  const res = await app.request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password123" }),
  });
  const body = (await res.json()) as { token: string };
  return body.token;
}

async function createCamera(token: string, name: string) {
  const res = await app.request(
    "/cameras",
    authed(token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, rtspUrl: "rtsp://example/alerts-test" }),
    }),
  );
  const { camera } = (await res.json()) as { camera: { id: string } };
  return camera.id;
}

function makeDetectionPayload() {
  return [{ label: "person", confidence: 0.9, box: { x: 0.1, y: 0.1, w: 0.2, h: 0.4 } }];
}

beforeAll(async () => {
  await runMigrations();
});

describe("GET /alerts", () => {
  test("filters by camera, time range, and paginates with a cursor", async () => {
    const token = await signup(`dana-${crypto.randomUUID()}`);
    const cameraId = await createCamera(token, "Alerts camera");
    const otherCameraId = await createCamera(token, "Other camera");

    const base = Date.now();
    // 5 alerts on cameraId, spaced 1 minute apart, oldest first.
    for (let i = 0; i < 5; i++) {
      await insertAlert({
        id: crypto.randomUUID(),
        cameraId,
        type: "person_detected",
        confidence: 0.9,
        detections: makeDetectionPayload(),
        frameWidth: 1280,
        frameHeight: 720,
        ts: new Date(base + i * 60_000),
      });
    }
    // one alert on a different camera, should never show up in cameraId-filtered queries
    await insertAlert({
      id: crypto.randomUUID(),
      cameraId: otherCameraId,
      type: "person_detected",
      confidence: 0.9,
      detections: makeDetectionPayload(),
      frameWidth: 1280,
      frameHeight: 720,
      ts: new Date(base),
    });

    const allForCamera = await app.request(`/alerts?cameraId=${cameraId}&limit=50`, authed(token));
    const { alerts: allAlerts } = (await allForCamera.json()) as { alerts: Array<{ id: string }> };
    expect(allAlerts.length).toBe(5);

    const fromMid = new Date(base + 2 * 60_000).toISOString();
    const rangeRes = await app.request(
      `/alerts?cameraId=${cameraId}&from=${encodeURIComponent(fromMid)}&limit=50`,
      authed(token),
    );
    const { alerts: rangeAlerts } = (await rangeRes.json()) as { alerts: unknown[] };
    expect(rangeAlerts.length).toBe(3);

    // paginate two at a time, newest first, and make sure we see all 5 exactly once
    const seen = new Set<string>();
    let cursor: string | null = null;
    for (let page = 0; page < 10 && seen.size < 5; page++) {
      const url = cursor
        ? `/alerts?cameraId=${cameraId}&limit=2&cursor=${encodeURIComponent(cursor)}`
        : `/alerts?cameraId=${cameraId}&limit=2`;
      const res = await app.request(url, authed(token));
      const body = (await res.json()) as { alerts: Array<{ id: string }>; nextCursor: string | null };
      for (const a of body.alerts) seen.add(a.id);
      cursor = body.nextCursor;
      if (!cursor) break;
    }
    expect(seen.size).toBe(5);
  });

  test("rejects a cameraId that does not belong to the caller", async () => {
    const tokenA = await signup(`erin-${crypto.randomUUID()}`);
    const tokenB = await signup(`frank-${crypto.randomUUID()}`);
    const cameraId = await createCamera(tokenA, "Erin's camera");

    const res = await app.request(`/alerts?cameraId=${cameraId}`, authed(tokenB));
    expect(res.status).toBe(404);
  });
});
