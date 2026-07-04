import { beforeAll, describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { runMigrations } from "../src/db/migrate";

const app = createApp();

async function signup(username: string) {
  const res = await app.request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password123" }),
  });
  const body = (await res.json()) as { token: string };
  return body.token;
}

function authed(token: string, init: RequestInit = {}) {
  return {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  };
}

beforeAll(async () => {
  await runMigrations();
});

describe("camera CRUD, scoped per user", () => {
  test("a user can create, list, update and delete their own camera", async () => {
    const token = await signup(`alice-${crypto.randomUUID()}`);

    const createRes = await app.request(
      "/cameras",
      authed(token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Front door", rtspUrl: "rtsp://example/1", location: "Porch" }),
      }),
    );
    expect(createRes.status).toBe(201);
    const { camera } = (await createRes.json()) as { camera: { id: string; status: string } };
    expect(camera.status).toBe("stopped");

    const listRes = await app.request("/cameras", authed(token));
    const { cameras } = (await listRes.json()) as { cameras: unknown[] };
    expect(cameras.length).toBeGreaterThanOrEqual(1);

    const patchRes = await app.request(
      `/cameras/${camera.id}`,
      authed(token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Front door (renamed)" }),
      }),
    );
    expect(patchRes.status).toBe(200);

    const deleteRes = await app.request(`/cameras/${camera.id}`, authed(token, { method: "DELETE" }));
    expect(deleteRes.status).toBe(204);

    const getAfterDelete = await app.request(`/cameras/${camera.id}`, authed(token));
    expect(getAfterDelete.status).toBe(404);
  });

  test("a user cannot read, update or delete another user's camera", async () => {
    const tokenA = await signup(`bob-${crypto.randomUUID()}`);
    const tokenB = await signup(`carol-${crypto.randomUUID()}`);

    const createRes = await app.request(
      "/cameras",
      authed(tokenA, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Backyard", rtspUrl: "rtsp://example/2" }),
      }),
    );
    const { camera } = (await createRes.json()) as { camera: { id: string } };

    const getAsB = await app.request(`/cameras/${camera.id}`, authed(tokenB));
    expect(getAsB.status).toBe(404);

    const patchAsB = await app.request(
      `/cameras/${camera.id}`,
      authed(tokenB, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "hijacked" }),
      }),
    );
    expect(patchAsB.status).toBe(404);

    const deleteAsB = await app.request(`/cameras/${camera.id}`, authed(tokenB, { method: "DELETE" }));
    expect(deleteAsB.status).toBe(404);

    const listAsB = await app.request("/cameras", authed(tokenB));
    const { cameras } = (await listAsB.json()) as { cameras: Array<{ id: string }> };
    expect(cameras.find((c) => c.id === camera.id)).toBeUndefined();
  });

  test("requests without a token are rejected", async () => {
    const res = await app.request("/cameras");
    expect(res.status).toBe(401);
  });
});
