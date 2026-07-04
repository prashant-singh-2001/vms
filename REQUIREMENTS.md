# Requirements Document: Real-Time Camera Surveillance Dashboard

## Executive Summary

A web-based Video Management System (VMS) that enables users to register and monitor multiple RTSP camera feeds in real-time, with automated person detection alerts and a responsive, multi-viewer dashboard. The system prioritizes reliability, scalability, and minimal latency for live video streaming and alert delivery.

---

## 1. Functional Requirements

### 1.1 Authentication & Authorization

- **FR-1.1.1** Users must authenticate with username and password.
- **FR-1.1.2** System shall issue JWT tokens on successful login; tokens must expire after a configurable duration (default 12 hours).
- **FR-1.1.3** All protected endpoints (camera management, alerts, WebSocket, WebRTC signaling) shall require valid JWT.
- **FR-1.1.4** Users shall only be able to access and manage their own cameras and alerts.
- **FR-1.1.5** System shall support user registration (signup) with validation of username uniqueness and password strength.

### 1.2 Camera Management (CRUD)

- **FR-1.2.1** Users shall be able to create cameras by providing: name, RTSP URL, location (optional), and enabled status.
- **FR-1.2.2** Users shall be able to read (list) all their cameras with full metadata.
- **FR-1.2.3** Users shall be able to update camera properties (name, location, enabled status, RTSP URL).
- **FR-1.2.4** Users shall be able to delete cameras; deletion shall cascade-delete associated alerts.
- **FR-1.2.5** Each camera shall have a runtime state: `connecting`, `live`, `stopped`, `error`.
- **FR-1.2.6** System shall display the current runtime state on each camera tile in the dashboard.

### 1.3 Camera Lifecycle Control

- **FR-1.3.1** Users shall be able to start a camera stream via a "Start" button.
- **FR-1.3.2** Starting a camera shall:
  - Set runtime state to `connecting`.
  - Queue a start command on the message queue.
  - Trigger the worker to establish RTSP connection, begin WebRTC streaming, and activate detection.
- **FR-1.3.3** Users shall be able to stop a camera stream via a "Stop" button.
- **FR-1.3.4** Stopping a camera shall:
  - Set runtime state to `stopped`.
  - Queue a stop command on the message queue.
  - Trigger the worker to tear down the pipeline, close all connections, and stop detection.
- **FR-1.3.5** Stopping one camera shall not affect other cameras.
- **FR-1.3.6** Camera state transitions (connecting → live, live → error, etc.) shall be reflected in real-time on the dashboard via WebSocket.

### 1.4 Live Video Streaming (WebRTC)

- **FR-1.4.1** Each camera tile in the dashboard shall display live video from the camera's RTSP source.
- **FR-1.4.2** Video streaming shall use WebRTC (WHEP - WebRTC-HTTP Egress Protocol) for low-latency delivery.
- **FR-1.4.3** WebRTC signaling (SDP offer/answer exchange) shall be proxied through the API and remain behind JWT authentication.
- **FR-1.4.4** Multiple concurrent viewers shall be able to watch the same camera simultaneously (same WebRTC track broadcast to all).
- **FR-1.4.5** Video playback shall begin within 3 seconds of clicking "Start" on typical network conditions.
- **FR-1.4.6** The video player shall be responsive and scale to fit the camera tile.
- **FR-1.4.7** If WebRTC negotiation fails or stream is unavailable, the tile shall display a clear error message.

### 1.5 Person Detection

- **FR-1.5.1** For each active camera, the system shall sample video frames at ~5 fps and run real-time person detection.
- **FR-1.5.2** Detection shall use a lightweight, open-source model capable of running on CPU without GPU.
- **FR-1.5.3** Only detections labeled "person" (COCO class 0) shall be considered; other object classes shall be ignored.
- **FR-1.5.4** Each detection shall include: label, confidence score (0.0–1.0), and normalized bounding box (x, y, width, height in [0, 1] range).
- **FR-1.5.5** Detection shall be independent per camera; failures in one camera's detection shall not block others.
- **FR-1.5.6** The system shall maintain configurable confidence threshold (default 0.5); detections below threshold shall be discarded.

### 1.6 Alert Management

- **FR-1.6.1** When person(s) are detected in a frame, the system shall generate an alert event.
- **FR-1.6.2** Each alert shall include: event ID (UUID), camera ID, timestamp, confidence score, list of detections with boxes, and frame dimensions.
- **FR-1.6.3** Alerts shall be persisted to the database with indexed retrieval by camera and timestamp.
- **FR-1.6.4** Users shall be able to query alerts via a REST endpoint with filtering by:
  - Camera ID
  - Time range (from/to)
  - Limit (pagination)
- **FR-1.6.5** Alert query results shall support keyset (cursor-based) pagination to avoid offset inefficiency on large result sets.
- **FR-1.6.6** Recent alerts (up to 25) for each camera shall be displayed in real-time on the camera tile without requiring a manual refresh.

### 1.7 Alert Deduplication & Rate Limiting

- **FR-1.7.1** The system shall suppress repeated alerts for the same ongoing presence within a configurable cooldown window (default 10 seconds).
- **FR-1.7.2** If the number of detected persons increases (e.g., 1 → 2), an alert shall be emitted immediately, bypassing the cooldown.
- **FR-1.7.3** A hard cap on events per camera shall be enforced: maximum configurable events per rolling minute (default 6).
- **FR-1.7.4** Deduplication shall prevent alert spam while preserving notification of significant changes (new people, growing crowds).

### 1.8 Real-Time Notifications (WebSocket)

- **FR-1.8.1** The dashboard shall maintain a WebSocket connection to the API.
- **FR-1.8.2** The WebSocket shall remain authenticated using the same JWT token used for REST requests.
- **FR-1.8.3** Over the WebSocket, the system shall push the following message types (in real-time, without requiring manual refresh):
  - **Alert**: when a new person-detected event is generated.
  - **Stats**: periodic updates (every ~2 seconds) with camera FPS, detections per minute, and current runtime state.
  - **Camera State**: whenever runtime state changes (connecting → live, live → error, etc.).
- **FR-1.8.4** If the WebSocket connection drops, the client shall attempt to reconnect with exponential backoff (1s, 2s, 4s, ..., max 15s).
- **FR-1.8.5** The connection status (connecting, open, closed) shall be displayed in the UI.

### 1.9 Dashboard UI

- **FR-1.9.1** The dashboard shall display all cameras belonging to the logged-in user in a responsive grid layout.
- **FR-1.9.2** Each camera tile shall show:
  - Camera name and location.
  - Live video (WebRTC player).
  - Runtime state badge (connecting/live/stopped/error) with color coding.
  - Start/Stop button (toggles camera stream).
  - Edit and Delete buttons.
  - Real-time FPS and detections-per-minute stats.
  - Recent alerts list (most recent first, up to 25).
- **FR-1.9.3** The dashboard header shall display:
  - Logged-in username.
  - WebSocket connection status.
  - "Add Camera" button.
  - "Log out" button.
- **FR-1.9.4** Users shall be able to create a new camera via a modal form with fields for name, RTSP URL, location, and enabled status.
- **FR-1.9.5** Users shall be able to edit an existing camera via the same modal form.
- **FR-1.9.6** Deleting a camera shall require confirmation to prevent accidental loss.
- **FR-1.9.7** The UI shall be responsive and usable on desktop, tablet, and mobile viewports.
- **FR-1.9.8** All timestamps shall be displayed in ISO-8601 format in UTC.

---

## 2. Non-Functional Requirements

### 2.1 Performance

- **NFR-2.1.1** Live video startup time: ≤ 3 seconds from clicking "Start" to first frame on screen.
- **NFR-2.1.2** Alert delivery latency: ≤ 2 seconds from detection to WebSocket push.
- **NFR-2.1.3** WebRTC stats updates: every ~2 seconds per camera.
- **NFR-2.1.4** API response time for camera CRUD and alert queries: ≤ 500 ms (p95).
- **NFR-2.1.5** Detection inference time: ≤ 200 ms per frame (on CPU, for real-time 5 fps sampling).

### 2.2 Scalability

- **NFR-2.2.1** System architecture shall support horizontal scaling:
  - Multiple worker instances (each claims camera start/stop commands from the queue).
  - Multiple API instances (each consumes detection events and stats).
  - Multiple detector instances (stateless HTTP service, load-balanced).
- **NFR-2.2.2** Message queue (Redis Streams, NATS, or Kafka) shall enable decoupled scaling of worker and API.
- **NFR-2.2.3** A single database instance shall handle up to 10,000 alerts per hour with indexed queries remaining responsive.

### 2.3 Reliability & Resilience

- **NFR-2.3.1** Failure of one camera's pipeline shall not affect other cameras.
- **NFR-2.3.2** Worker shall implement automatic restart with exponential backoff if a camera stream fails.
- **NFR-2.3.3** If the detector service is temporarily unavailable, the worker shall retry requests; a missing detection is acceptable, but the stream shall continue.
- **NFR-2.3.4** If the API or database is temporarily unavailable, the worker shall queue events in the message queue; events shall be persisted eventually once the API recovers.
- **NFR-2.3.5** The system shall gracefully handle RTSP streams that go offline or become unresponsive.

### 2.4 Security

- **NFR-2.4.1** All user passwords shall be hashed using bcrypt (or equivalent) before storage.
- **NFR-2.4.2** JWT tokens shall be signed with a strong secret; secret shall be kept secure and not hardcoded in source.
- **NFR-2.4.3** All API endpoints shall be protected by JWT authentication except for `/auth/signup` and `/auth/login`.
- **NFR-2.4.4** Users shall only be able to access their own cameras and alerts; access control shall be enforced at the database query level.
- **NFR-2.4.5** WebRTC signaling shall be proxied through the authenticated API; direct worker endpoints shall not be exposed to the browser.
- **NFR-2.4.6** RTSP connections to external camera URLs shall validate hostname resolution and timeouts to prevent SSRF attacks.

### 2.5 Data Consistency

- **NFR-2.5.1** Camera state in the database (connecting/live/stopped/error) shall reflect the worker's runtime state within 2 seconds.
- **NFR-2.5.2** Alerts shall be logged with consistent timestamps and timezone (UTC).
- **NFR-2.5.3** Deletion of a camera shall atomically delete all associated alerts.
- **NFR-2.5.4** Alert events shall be idempotent; if the same event is received twice from the queue, only one alert shall be persisted.

### 2.6 Availability

- **NFR-2.6.1** System shall target 99.0% uptime (allowing ~7 hours downtime per month) during normal operation.
- **NFR-2.6.2** Planned maintenance windows may take services offline; at least 24 hours' notice shall be given to users where practical.

---

## 3. Technical Requirements

### 3.1 Architecture

- **TR-3.1.1** System shall be composed of four independent microservices:
  - **Frontend**: Single-Page Application (SPA) for user interaction.
  - **API**: REST + WebSocket server for camera/alert management and real-time push.
  - **Worker**: Long-running daemon that owns per-camera RTSP ingest, WebRTC streaming, and detection sampling.
  - **Detector**: Stateless HTTP service for person detection inference.
- **TR-3.1.2** All services shall communicate via well-defined APIs (REST, WebSocket, HTTP, message queue).
- **TR-3.1.3** Services shall be independently deployable, scalable, and restartable without affecting each other (except graceful degradation for missing services).

### 3.2 Frontend

- **TR-3.2.1** Technology stack: React 18+, TypeScript, Vite.
- **TR-3.2.2** State management: React Context + TanStack Query for REST caching.
- **TR-3.2.3** WebSocket: Native browser WebSocket API.
- **TR-3.2.4** WebRTC: Native browser `RTCPeerConnection` API for WHEP.
- **TR-3.2.5** Routing: React Router v6+.
- **TR-3.2.6** Deployment: static HTML + CSS + JS, served by nginx or equivalent.
- **TR-3.2.7** Browser support: Chrome/Edge 90+, Firefox 88+, Safari 14+.

### 3.3 API Server

- **TR-3.3.1** Technology stack: Node.js (Bun or Node 20+), Hono framework, PostgreSQL 14+.
- **TR-3.3.2** Authentication: JWT (HS256 signing).
- **TR-3.3.3** ORM: Drizzle ORM for type-safe database queries.
- **TR-3.3.4** Database schema:
  - `users` table: id (UUID), username (unique), password_hash, created_at.
  - `cameras` table: id (UUID), user_id (FK), name, rtsp_url, location, enabled, status, created_at, updated_at.
  - `alerts` table: id (UUID), camera_id (FK), type, confidence, detections (JSONB), frame_width, frame_height, ts, created_at.
  - Index on `(camera_id, ts DESC)` for efficient alert queries.
- **TR-3.3.5** WebSocket: Bun's native WebSocket API or hono/ws middleware.
- **TR-3.3.6** Message Queue Integration: Redis Streams (or NATS/Kafka for scale).
  - Streams: `camera:commands` (api → worker), `detection:events` (worker → api), `camera:stats` (worker → api).
  - Consumer groups: `workers`, `api`.

### 3.4 Worker

- **TR-3.4.1** Technology: Go 1.21+.
- **TR-3.4.2** RTSP ingest: FFmpeg (subprocess), with TCP transport.
- **TR-3.4.3** WebRTC: pion/webrtc library for RTP/SDP handling.
- **TR-3.4.4** Detection sampling: FFmpeg MJPEG pipe to extract JPEG frames.
- **TR-3.4.5** Per-camera isolation: each camera pipeline runs in its own goroutine group with separate FFmpeg processes; failures are contained.
- **TR-3.4.6** Message queue consumer: Redis Streams consumer group.
- **TR-3.4.7** HTTP API: Go's net/http or chi/gorilla/mux, endpoint POST `/whep/:cameraId` for WHEP signaling.
- **TR-3.4.8** Resilience: exponential backoff restart on stream failure; graceful shutdown on stop command.

### 3.5 Detector

- **TR-3.5.1** Technology: Python 3.11+, FastAPI, ultralytics (YOLOv8n).
- **TR-3.5.2** Inference: ONNX Runtime or PyTorch CPU inference.
- **TR-3.5.3** Model: YOLOv8n (smallest/fastest variant, ~6M parameters).
- **TR-3.5.4** HTTP API:
  - POST `/detect` — multipart JPEG input, JSON response with detected persons.
  - GET `/health` — liveness probe.
- **TR-3.5.5** Stateless design: model loaded once at startup, no session state across requests.
- **TR-3.5.6** Deployment: Docker container with model weights baked in.

### 3.6 Database

- **TR-3.6.1** DBMS: PostgreSQL 14+ (open-source, ACID, JSON support).
- **TR-3.6.2** Backup: automated daily backups (implementation-specific).
- **TR-3.6.3** Connection pooling: min 5, max 20 connections per api instance.
- **TR-3.6.4** Query timeout: 30 seconds per query; queries exceeding this shall be canceled.

### 3.7 Message Queue

- **TR-3.7.1** Primary: Redis 6+ with Streams API.
- **TR-3.7.2** Alternative: NATS, Kafka (for large-scale deployments).
- **TR-3.7.3** Consumer groups: enable horizontal scaling and at-least-once delivery semantics.
- **TR-3.7.4** Retention: streams trimmed with MAXLEN to prevent unbounded growth.

### 3.8 Infrastructure & Deployment

- **TR-3.8.1** Containerization: Docker for all services.
- **TR-3.8.2** Orchestration: Docker Compose (single-node) or Kubernetes (production).
- **TR-3.8.3** Network: all services on a single Docker network or VPC; internal communication only.
- **TR-3.8.4** Volumes: persistent PostgreSQL and Redis data volumes.
- **TR-3.8.5** Health checks: all services expose a health endpoint; orchestration monitors.

---

## 4. Event Format Specification

All detection events shall follow a canonical JSON schema used uniformly across the worker, message queue, database, and WebSocket:

```json
{
  "id": "uuid",
  "cameraId": "uuid",
  "type": "person_detected",
  "timestamp": "2026-07-03T12:34:56.789Z",
  "confidence": 0.91,
  "detections": [
    {
      "label": "person",
      "confidence": 0.91,
      "box": {
        "x": 0.12,
        "y": 0.30,
        "w": 0.10,
        "h": 0.25
      }
    }
  ],
  "frame": {
    "width": 1280,
    "height": 720
  }
}
```

**Notes:**
- `box` coordinates are normalized to [0, 1] (independent of frame resolution) so any consumer can scale them.
- `confidence` is the max confidence among detections.
- Timestamp is ISO-8601 UTC.

---

## 5. API Specification (Summary)

### Authentication

- `POST /auth/signup` — register a new user.
- `POST /auth/login` — issue JWT token.

### Camera Management

- `GET /cameras` — list all cameras for the authenticated user.
- `POST /cameras` — create a camera.
- `GET /cameras/:id` — get a camera.
- `PATCH /cameras/:id` — update a camera.
- `DELETE /cameras/:id` — delete a camera.
- `POST /cameras/:id/start` — start the camera stream.
- `POST /cameras/:id/stop` — stop the camera stream.

### Alerts

- `GET /alerts` — list alerts with optional filtering (cameraId, from, to, limit, cursor).

### WebRTC Signaling

- `POST /cameras/:id/whep` — proxy WHEP offer to worker, return answer.

### Real-Time

- `GET /ws?token=<jwt>` — WebSocket upgrade for real-time stats, alerts, and state changes.

---

## 6. Testing Requirements

- **Unit tests:** auth (password hashing, JWT), alert deduplication logic, event serialization.
- **Integration tests:** camera CRUD with ownership scoping, alert filtering and pagination, WebSocket message delivery.
- **End-to-end tests:** full pipeline from RTSP ingest to detection to alert persisting and WebSocket delivery.
- **Performance tests:** detection inference time, API query latency, WebRTC setup time.
- **Resilience tests:** camera pipeline failure isolation, graceful degradation when detector is unavailable.

---

## 7. Future Enhancements (Out of Scope)

- Kubernetes deployment with HPA.
- GPU-accelerated detection.
- TURN server for NAT traversal.
- Multi-model detection (face, vehicle, etc.).
- Alert deduplication by spatial clustering (same person across frames).
- Server-side bounding-box overlay on WebRTC stream.
- Snapshot thumbnails in alerts.
- Role-based access control (admin, viewer, operator).
- Mobile native apps.
- RTSP server (re-broadcast processed/annotated streams).

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-04  
**Status:** Final
