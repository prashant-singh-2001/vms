# API Reference

## Overview

The VMS API is built with Bun + Hono and provides REST endpoints for camera management, alerts, and WebRTC signaling. All endpoints are authenticated with JWT tokens except for signup and login.

**Base URL:** `http://localhost:3000` (or configured `API_PORT`)

## Authentication

### JWT Token Format

Tokens are signed with `HS256` and issued with configurable expiry (default 12 hours).

**Header:**
```
Authorization: Bearer <token>
```

### Login

**POST /auth/login**

Authenticate with username/password to receive a JWT token.

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo1234"}'
```

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "12h"
}
```

**Errors:**
- `401 Unauthorized` - Invalid credentials

### Signup

**POST /auth/signup**

Register a new user account.

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","password":"secure123"}'
```

**Request:**
```json
{
  "username": "string (3-32 chars, alphanumeric + underscore)",
  "password": "string (8+ chars)"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "username": "newuser",
  "createdAt": "2026-07-12T10:30:45Z"
}
```

**Errors:**
- `400 Bad Request` - Invalid input
- `409 Conflict` - Username already exists

---

## Cameras

### List Cameras

**GET /cameras**

Get all cameras owned by the authenticated user.

```bash
curl http://localhost:3000/cameras \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{
  "cameras": [
    {
      "id": "uuid",
      "userId": "uuid",
      "name": "Front Door",
      "rtspUrl": "rtsp://192.168.1.100:554/stream",
      "location": "Entrance",
      "enabled": true,
      "status": "live",
      "createdAt": "2026-07-01T10:00:00Z",
      "updatedAt": "2026-07-12T10:30:45Z"
    }
  ]
}
```

### Get Camera

**GET /cameras/:id**

Get details of a specific camera.

```bash
curl http://localhost:3000/cameras/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Front Door",
  "rtspUrl": "rtsp://192.168.1.100:554/stream",
  "location": "Entrance",
  "enabled": true,
  "status": "live",
  "createdAt": "2026-07-01T10:00:00Z",
  "updatedAt": "2026-07-12T10:30:45Z"
}
```

**Errors:**
- `404 Not Found` - Camera doesn't exist or belongs to another user

### Create Camera

**POST /cameras**

Create a new camera.

```bash
curl -X POST http://localhost:3000/cameras \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Front Door",
    "rtspUrl": "rtsp://192.168.1.100:554/stream",
    "location": "Entrance",
    "enabled": true
  }'
```

**Request:**
```json
{
  "name": "string (required)",
  "rtspUrl": "string (required, must be valid RTSP URL)",
  "location": "string (optional)",
  "enabled": "boolean (default: true)"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Front Door",
  "rtspUrl": "rtsp://192.168.1.100:554/stream",
  "location": "Entrance",
  "enabled": true,
  "status": "stopped",
  "createdAt": "2026-07-12T10:30:45Z",
  "updatedAt": "2026-07-12T10:30:45Z"
}
```

**Errors:**
- `400 Bad Request` - Invalid input
- `422 Unprocessable Entity` - Invalid RTSP URL

### Update Camera

**PATCH /cameras/:id**

Update camera properties.

```bash
curl -X PATCH http://localhost:3000/cameras/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Back Door",
    "enabled": false
  }'
```

**Request:** (all fields optional)
```json
{
  "name": "string",
  "rtspUrl": "string",
  "location": "string",
  "enabled": "boolean"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Back Door",
  "rtspUrl": "rtsp://192.168.1.100:554/stream",
  "location": "Entrance",
  "enabled": false,
  "status": "stopped",
  "createdAt": "2026-07-01T10:00:00Z",
  "updatedAt": "2026-07-12T10:31:00Z"
}
```

**Errors:**
- `404 Not Found` - Camera doesn't exist
- `400 Bad Request` - Invalid input

### Delete Camera

**DELETE /cameras/:id**

Delete a camera and all associated alerts.

```bash
curl -X DELETE http://localhost:3000/cameras/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $TOKEN"
```

**Response (204):** No content

**Errors:**
- `404 Not Found` - Camera doesn't exist

### Start Camera

**POST /cameras/:id/start**

Start streaming from a camera (transitions status to `connecting`).

```bash
curl -X POST http://localhost:3000/cameras/550e8400-e29b-41d4-a716-446655440000/start \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "connecting"
}
```

**Errors:**
- `404 Not Found` - Camera doesn't exist
- `400 Bad Request` - Camera is disabled

### Stop Camera

**POST /cameras/:id/stop**

Stop streaming from a camera.

```bash
curl -X POST http://localhost:3000/cameras/550e8400-e29b-41d4-a716-446655440000/stop \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "stopped"
}
```

**Errors:**
- `404 Not Found` - Camera doesn't exist

---

## Alerts

### List Alerts

**GET /alerts**

Get alerts with optional filtering and pagination.

```bash
curl "http://localhost:3000/alerts?cameraId=550e8400-e29b-41d4-a716-446655440000&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

**Query Parameters:**
- `cameraId` (optional, UUID) - Filter by camera
- `from` (optional, ISO-8601) - Start time
- `to` (optional, ISO-8601) - End time
- `limit` (optional, 1-200, default 50) - Results per page
- `cursor` (optional, string) - Pagination cursor

**Response (200):**
```json
{
  "alerts": [
    {
      "id": "uuid",
      "cameraId": "uuid",
      "type": "person_detected",
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
      "frameWidth": 1280,
      "frameHeight": 720,
      "annotatedImageId": "event-uuid.png",
      "ts": "2026-07-12T10:30:45Z"
    }
  ],
  "nextCursor": "eyJ0cyI6IjIwMjYtMDctMTJUMTA6MzA6NDVaIiwiaWQiOiIi..."
}
```

**Pagination:**

Use `nextCursor` from response to get next page:

```bash
curl "http://localhost:3000/alerts?cursor=eyJ0cyI6I..." \
  -H "Authorization: Bearer $TOKEN"
```

**Errors:**
- `400 Bad Request` - Invalid query parameters
- `404 Not Found` - Camera doesn't exist or belongs to another user

---

## Annotated Images

### Get Annotated Image

**GET /alerts/images/:imageId**

Retrieve a PNG image with bounding boxes annotating detected people.

```bash
curl http://localhost:3000/alerts/images/event-uuid.png \
  -H "Authorization: Bearer $TOKEN" \
  --output detection.png
```

**Response (200):**
- Content-Type: `image/png`
- Body: PNG binary data

**Features:**
- Red bounding boxes around detected persons
- Confidence scores labeled on each box
- Full resolution of original frame
- 24-hour retention in Redis

**Errors:**
- `404 Not Found` - Image expired or doesn't exist

---

## WebRTC Signaling (WHEP)

### Initiate WHEP Session

**POST /cameras/:id/whep**

Exchange SDP offer/answer for WebRTC video streaming.

```bash
curl -X POST http://localhost:3000/cameras/550e8400-e29b-41d4-a716-446655440000/whep \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sdp": "v=0\no=- ... m=video ..."
  }'
```

**Request:**
```json
{
  "sdp": "string (SDP offer from browser)"
}
```

**Response (201):**
```json
{
  "sdp": "string (SDP answer from server)"
}
```

**WebRTC Details:**
- **Codec:** H.264 (video), no audio
- **Transport:** RTP over UDP (or TCP fallback)
- **Multiple Viewers:** Multiple offers can connect to same camera
- **Session:** Closes when browser disconnects

**Errors:**
- `404 Not Found` - Camera doesn't exist or not in `live` state
- `400 Bad Request` - Invalid SDP

---

## WebSocket (Real-Time)

### Connect WebSocket

**GET /ws?token=<jwt>**

Establish WebSocket connection for real-time alerts and stats.

```javascript
const ws = new WebSocket(`ws://localhost:3000/ws?token=${token}`);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(message.type, message.data);
};
```

### Message Types

#### Alert

Sent when a person detection event occurs.

```json
{
  "type": "alert",
  "data": {
    "id": "uuid",
    "cameraId": "uuid",
    "type": "person_detected",
    "timestamp": "2026-07-12T10:30:45Z",
    "confidence": 0.91,
    "detections": [
      {
        "label": "person",
        "confidence": 0.91,
        "box": { "x": 0.12, "y": 0.30, "w": 0.10, "h": 0.25 }
      }
    ],
    "frame": { "width": 1280, "height": 720 },
    "annotatedImageId": "event-uuid.png"
  }
}
```

#### Stats

Sent every ~2 seconds with camera performance metrics.

```json
{
  "type": "stats",
  "data": {
    "cameraId": "uuid",
    "fps": 5.2,
    "detectionsPerMinute": 12.3,
    "state": "live",
    "timestamp": "2026-07-12T10:30:45Z"
  }
}
```

#### Camera State

Sent when camera runtime state changes.

```json
{
  "type": "camera_state",
  "data": {
    "cameraId": "uuid",
    "state": "live",
    "message": null
  }
}
```

**States:** `connecting`, `live`, `stopped`, `error`

### Reconnection

- Auto-reconnect with exponential backoff (1s, 2s, 4s, ..., max 15s)
- Connection status visible in UI
- Messages queued until reconnection on network interruption (frontend responsibility)

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "string",
  "details": "optional detailed message",
  "statusCode": 400
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Unprocessable Entity |
| 500 | Internal Server Error |

---

## Rate Limiting

Currently not implemented. Future versions may include:
- Rate limit headers (X-RateLimit-*)
- 429 Too Many Requests status

---

## Pagination

### Cursor-Based Pagination

Keyset pagination using timestamps and IDs:

```bash
# First page
curl http://localhost:3000/alerts?limit=50

# Next page using cursor
curl "http://localhost:3000/alerts?limit=50&cursor=<nextCursor>"
```

- **Advantages:** Efficient for large datasets, no offset skipping
- **Format:** Base64-encoded JSON with timestamp and ID

---

## Environment Variables

Configure API via environment:

- `API_PORT` - HTTP port (default: 3000)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Token signing secret
- `JWT_EXPIRES_IN` - Token expiry (default: 12h)
- `WORKER_INTERNAL_URL` - Worker internal endpoint for WHEP proxying

---

## Versioning

API version in use: `1.0`

Future versions will use `/api/v2` prefix if breaking changes occur.
