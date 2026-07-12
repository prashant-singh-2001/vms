# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Annotated Images**: Person detections now include PNG images with red bounding boxes
  - New `annotatedImageId` field in detection events
  - New `GET /alerts/images/:imageId` endpoint to retrieve stored PNG images
  - Images stored in Redis with 24-hour retention
  - Frontend click-to-expand UI for alert images
  - Bounding boxes drawn by detector with confidence scores

- **Comprehensive Documentation**:
  - `CONTRIBUTING.md` - Contributing guidelines and workflow
  - `docs/DEVELOPMENT.md` - Local development setup and tips
  - `docs/API.md` - Complete API reference with examples
  - `docs/DEPLOYMENT.md` - Deployment guides for Docker, Kubernetes, and cloud
  - Updated `README.md` with annotated images feature

### Changed
- Event schema updated to include `annotatedImageId` field
- Database `alerts` table now includes `annotated_image_id` column
- Frontend alerts now show images on click instead of just text

### Technical Changes
- Worker calls `DetectWithAnnotation()` to get annotated PNG images
- Images stored in Redis with key prefix `annotated:image:` and 24-hour TTL
- API consumer saves `annotatedImageId` reference in database
- Python detector `/detect` endpoint now supports `?annotate=true` query parameter

## [1.0.0] - 2026-07-12

### Added
- Initial release of Video Management System
- Real-time camera monitoring with WebRTC (WHEP)
- Person detection with YOLOv8n model
- Alert management with filtering and pagination
- WebSocket real-time notifications
- Alert deduplication and rate limiting
- Multi-camera support with failure isolation
- PostgreSQL persistence
- Redis message queue (Redis Streams)
- JWT authentication
- User account management (signup/login)

### Features
- **Frontend**: React + TypeScript + Vite SPA
- **API**: Bun + Hono REST + WebSocket server
- **Worker**: Go orchestrator for RTSP/WebRTC/detection
- **Detector**: Python + FastAPI + YOLOv8n inference
- **Database**: PostgreSQL for users, cameras, alerts
- **Message Queue**: Redis Streams for commands/events/stats

### Non-Functional
- Live video startup: ~3 seconds
- Alert latency: <2 seconds
- Detection inference: <200ms per frame
- Support for multiple concurrent cameras
- Horizontal scaling via Redis Streams consumer groups

### Known Limitations
- Single worker instance (no camera affinity yet)
- RTSP over TCP only (no UDP)
- Non-trickle ICE (small negotiation delay)
- No TURN server for cross-NAT WebRTC
- Synthetic test pattern as default RTSP source
- 24-hour retention of event data

---

## Versioning

- **1.x.x**: Stable API and production-ready
- **0.x.x**: Pre-release, unstable (not used)

Breaking changes will trigger a minor version bump (e.g., 1.0 → 1.1) with migration guide.

---

## Upgrade Guide

### v1.0 → v1.1 (Unreleased, Annotated Images)

**Database Migration Required:**

The `alerts` table gains a new nullable column:

```sql
ALTER TABLE alerts ADD COLUMN annotated_image_id TEXT;
```

Or via Drizzle ORM:
```bash
cd api && npm run db:generate
```

**Breaking Changes:** None. The `annotatedImageId` field is optional.

**Migration Steps:**

1. Back up your database
2. Run migrations: `npm run db:generate && docker compose exec api npm run db:migrate`
3. Rebuild and deploy services
4. Old alerts without images will show `annotatedImageId: null`

---

## Future Roadmap

### Short Term
- [ ] Snapshot thumbnails stored to S3/GCS for persistent alerts
- [ ] Email notifications on alert
- [ ] Mobile app (React Native)

### Medium Term
- [ ] Kubernetes deployment guide
- [ ] GPU-accelerated detector (CUDA/TensorRT)
- [ ] Multiple detection models (vehicles, faces, etc.)
- [ ] TURN server integration for NAT traversal
- [ ] Role-based access control (RBAC)
- [ ] Alert rules engine (filter, group, aggregate)

### Long Term
- [ ] Server-side box overlay on WebRTC stream
- [ ] RTSP re-broadcast with annotations
- [ ] Computer vision analytics (crowd density, heat maps)
- [ ] Integration with external alarm systems
- [ ] Mobile push notifications
- [ ] Multi-region federation

---

## Support

- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Ask questions via GitHub Discussions
- **Security**: Email security@example.com for vulnerabilities

---

**Latest Release:** v1.0.0 (2026-07-12)
