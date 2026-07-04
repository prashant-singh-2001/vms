# Real-Time Camera Surveillance Dashboard (WebRTC + Person Detection)

A small Video Management System: register cameras by RTSP URL, watch them live in the
browser over WebRTC, and get real-time alerts when a person appears in frame.

Four services, one `docker compose up`:

- **frontend** — React + TypeScript (Vite), JWT auth, camera CRUD, live dashboard.
- **api** — Bun + Hono + Postgres, JWT auth, camera/alert REST API, WebSocket fan-out.
- **worker** — Go. Owns one isolated pipeline per camera: RTSP ingest, WebRTC restream
  (pion), and a sampled detection loop.
- **detector** — Python + FastAPI + YOLOv8n (ultralytics). Stateless person detection
  over HTTP.

Plus Postgres, Redis (the message queue), and a `mediamtx` + `rtsp-source` pair that
loops a synthetic test pattern over RTSP so the whole stack works with **no real camera**.

## Architecture

```
                 REST (JWT) + WHEP signaling + WS
  ┌──────────┐  ───────────────────────────────►  ┌──────────────┐
  │ frontend │                                     │  api (Bun +  │
  │ (React)  │  ◄─── WebSocket (alerts, stats) ──  │  Hono)       │
  └────┬─────┘                                     └───┬──────┬───┘
       │ WebRTC media (WHEP, proxied through api)       │      │
       │                                            Postgres  Redis Streams
       ▼                                                       │ commands
  ┌──────────────┐   JPEG frames (HTTP)   ┌──────────────┐     │ events
  │ worker (Go)  │ ─────────────────────► │ detector     │     │ stats
  │ per-camera   │ ◄───── detections ──── │ (Python/YOLO)│     │
  │ pipelines    │                        └──────────────┘     │
  └──────┬───────┘ ◄─────── camera commands / events / stats ──┘ (Redis)
         │ RTSP in
         ▼
  ┌──────────────┐
  │  mediamtx    │  rtsp://mediamtx:8554/test, fed by a looping ffmpeg publisher
  │ (test source)│  (so no real camera is needed to run or demo this)
  └──────────────┘
```

**Starting a camera:**
1. Frontend `POST /cameras/:id/start` → api sets `status=connecting` in Postgres and
   `XADD`s a `start` command onto the `camera:commands` Redis stream.
2. The worker (a Redis consumer group member) claims the command and spins up an
   isolated pipeline for that camera: its own goroutines and `ffmpeg` subprocesses.
3. That pipeline forks two `ffmpeg` reads of the same RTSP source:
   - one transcodes to H264/RTP for the WebRTC branch (pion),
   - one samples ~5 fps of JPEG frames for detection.
4. Each sampled frame is POSTed to the detector; person detections are deduplicated
   and rate-limited, then `XADD`ed to `detection:events`. Stats (FPS, detections/min,
   runtime state) are `XADD`ed to `camera:stats` every ~2s.
5. The api consumes both streams via a consumer group, persists alerts to Postgres, and
   pushes `alert` / `stats` / `camera_state` messages over the WebSocket to that camera
   owner's connected browser tabs.

**Watching a camera (WebRTC via WHEP):** the browser creates a `recvonly` SDP offer and
`POST`s it to `/cameras/:id/whep`. The api proxies that to the worker's internal
`/whep/:cameraId` (keeping WebRTC signaling behind the same JWT as everything else); pion
answers and starts sending RTP directly to the browser. Multiple viewers can attach to the
same camera's track concurrently.

**Failure isolation:** every camera is its own goroutine group + pair of `ffmpeg`
subprocesses, wrapped in `recover()` with an exponential-backoff restart loop. Stopping,
crashing, or restarting one camera never touches another — see
[`worker/internal/pipeline/registry_test.go`](worker/internal/pipeline/registry_test.go)
for the test that pins this down.

## Detection model: YOLOv8n

[`detector/model.py`](detector/model.py) uses **Ultralytics YOLOv8n**, filtered to COCO
class `0` ("person"). Reasons:

- **Open source** and trivial to use via the `ultralytics` Python package.
- **Fast enough on CPU** for a multi-camera demo without needing a GPU in the container
  (`yolov8n` is the smallest/fastest variant in the YOLOv8 family) — a real deployment
  handling many concurrent cameras would want a GPU detector and a bigger model
  (`yolov8s`/`yolov8m`) traded off against accuracy needs.
- Ships with a bundled sample image (`bus.jpg`, several pedestrians) that the detector's
  own test suite uses to verify real detections with **no network dependency** at test
  time — see [`detector/tests/test_detect.py`](detector/tests/test_detect.py).
- Weights are baked into the Docker image at build time (`docker/Dockerfile`'s warm-up
  `RUN`), so the container works offline at runtime too.

## Event format

One JSON shape is used everywhere: the worker's output, the `detection:events` Redis
stream, the Postgres `alerts` row, and the WebSocket `alert` payload. Full spec, field
notes, and the Redis stream/WS envelope layouts are in
**[`docs/EVENT_FORMAT.md`](docs/EVENT_FORMAT.md)**. Summary:

```json
{
  "id": "uuid",
  "cameraId": "uuid",
  "type": "person_detected",
  "timestamp": "2026-07-03T12:34:56.789Z",
  "confidence": 0.91,
  "detections": [{ "label": "person", "confidence": 0.91, "box": { "x": 0.12, "y": 0.30, "w": 0.10, "h": 0.25 } }],
  "frame": { "width": 1280, "height": 720 }
}
```

Boxes are normalized to `[0, 1]` so any consumer can scale them to whatever size it
renders video at. The TypeScript types ([`api/src/events.ts`](api/src/events.ts),
[`frontend/src/types/events.ts`](frontend/src/types/events.ts)), Go structs
([`worker/internal/events/events.go`](worker/internal/events/events.go)), and Python
model ([`detector/model.py`](detector/model.py)) are all written to match this exactly —
enforced by tests on both the Go and TS sides.

## Message queue (bonus)

Redis Streams, with consumer groups on both ends (`docs/EVENT_FORMAT.md` has the full
table):

- `camera:commands` (api → worker, group `workers`) — durable start/stop commands.
- `detection:events` (worker → api, group `api`) — durable alerts.
- `camera:stats` (worker → api, group `api`) — FPS/detections-per-minute/state, trimmed
  with `MAXLEN`.

This decouples api and worker (either can restart without losing in-flight commands/
events) and is the scale-out path: consumer groups let commands shard across multiple
worker replicas and events shard across multiple api replicas.

## Alert dedup & rate limiting (bonus)

[`worker/internal/events/dedup.go`](worker/internal/events/dedup.go) — a small,
dependency-free, unit-tested `Deduper` per camera:

- Suppresses repeated alerts for an ongoing presence within a cooldown window
  (`DEDUP_COOLDOWN_SEC`, default 10s).
- Cuts the cooldown short if the number of detected people **increases** (a growing
  crowd is worth a fresh alert even mid-cooldown).
- Enforces a hard cap on events per rolling minute (`MAX_EVENTS_PER_MIN`, default 6)
  regardless of the above, so a flickering detector can't flood the feed.

See [`worker/internal/events/dedup_test.go`](worker/internal/events/dedup_test.go) for
the table-driven tests covering each rule.

## Tests (bonus)

- **api** — `bun test` (JWT/password unit tests; camera CRUD ownership-scoping
  integration tests across two users; alert filtering/pagination integration tests) —
  see [`api/tests/`](api/tests/).
- **worker** — `go test ./...` (dedup/rate-limit table tests; event JSON-shape tests;
  registry start/stop dispatch tests using a fake pipeline so no real ffmpeg/Redis is
  needed) — see `*_test.go` next to the code they test.
- **detector** — `pytest` (health check; rejects invalid images; finds real people in a
  bundled sample image using the actual YOLO model) — see
  [`detector/tests/test_detect.py`](detector/tests/test_detect.py).

## How to run it

Requires Docker + Docker Compose. Nothing else — no real camera, no GPU, no external
services.

```bash
cp .env.example .env
docker compose up --build
```

Then open **http://localhost:5173**. A demo user and a demo camera are seeded
automatically on first boot (see `.env`'s `SEED_USERNAME`/`SEED_PASSWORD`, default
`demo` / `demo1234`), pointing at the built-in synthetic RTSP test source — click
**Start** on it and you should see live video within a few seconds.

The seeded test source is a synthetic ffmpeg test pattern by default (no external
dependency, so the stack always comes up standalone). To see real person-detection
alerts, point a camera at something with people in it — either:
- add a camera in the UI with a real/public RTSP URL, or
- drop an `.mp4` with people into the `rtsp-assets` volume as `/assets/sample.mp4` for
  the `rtsp-source` container to loop instead of the synthetic pattern (or set
  `SAMPLE_VIDEO_URL` in `.env` to have it download one on first boot).

### Running the test suites

```bash
docker compose up -d postgres redis
docker compose run --rm api bun test

docker build --target build -t vms-worker-build ./worker
docker run --rm vms-worker-build go test ./...

docker compose run --rm detector pytest
```

## Architecture / design decisions

- **Worker split: Go orchestrator + Python detector sidecar.** RTSP/WebRTC/process
  orchestration plays to Go's strengths (goroutines, `pion/webrtc`, cheap subprocess
  management); person detection plays to Python's (mature, one-line `ultralytics`
  inference). The two talk over a tiny stateless HTTP contract, so either can be scaled
  or swapped independently.
- **WHEP over full custom signaling.** WHEP (WebRTC-HTTP Egress Protocol) is a simple
  POST-offer/get-answer contract, so the browser needs no signaling server or
  socket.io-style protocol — just `fetch()`. It also let the api proxy WebRTC signaling
  behind the same JWT middleware as every other route.
- **Non-trickle ICE.** Both the browser client and the pion server wait for full ICE
  gathering before exchanging SDP. Simpler to reason about and implement correctly than
  trickle ICE; the tradeoff is a small (sub-second, typically) added negotiation delay,
  acceptable for this use case.
- **Hand-rolled SQL bootstrap instead of a migration tool at runtime.** `api/src/db/init.sql`
  is applied idempotently on api startup. `drizzle-orm` is still used for all typed
  queries/schema definitions; `drizzle-kit` is wired up (`api/drizzle.config.ts`,
  `bun run db:generate`) for anyone who wants proper generated migrations going forward.
- **Camera state lives in Postgres, not just in memory.** The worker reports state via
  the same `camera:stats` stream as FPS stats; the api compares against the camera's
  last known DB status to decide whether to also emit a `camera_state` WS message. This
  keeps state consistent even if the api restarts or runs multiple replicas.
- **JPEG frame splitting via JFIF marker scanning**
  ([`worker/internal/pipeline/ffmpeg.go`](worker/internal/pipeline/ffmpeg.go)) rather than
  a heavier MJPEG-over-HTTP parser — JPEG's entropy coding byte-stuffs any literal
  `0xFF` byte, so a raw `0xFFD9` (EOI) marker can only ever be a genuine frame boundary,
  making this both simple and correct.

## Future improvements

- **Kubernetes.** Not built for this submission; the natural next step is one Deployment
  per service (worker as a `StatefulSet` or with sticky camera-affinity if scaled),
  `HorizontalPodAutoscaler` on `worker`/`detector`, and a `Service` per camera-facing
  WHEP endpoint or a shared ingress with SNI/path routing.
- **TURN server** for WebRTC across real (non-local) NATs, and per-viewer WHEP session
  tokens/expiry instead of one shared track per camera.
- Swap Redis Streams for NATS/Kafka at real scale; today's consumer-group design already
  supports horizontal scaling of both api and worker without a protocol change.
- GPU-backed detector image + batched inference for higher camera counts.
- Server-side box overlay burned into the WebRTC stream (today the frontend can overlay
  boxes client-side from the latest alert, but doesn't burn them into the video itself).
- Alert snapshot thumbnails persisted to object storage alongside each alert row.

## Deliverables checklist

- [x] Source for all four services + infra, in this repo.
- [x] `docker compose up` brings up the whole stack with a working demo path.
- [x] README: architecture, decisions, run steps, detection model + rationale, event
      format.
- [ ] Demo video / deployment URL — optional per the assignment; not included here.
