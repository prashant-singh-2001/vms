# Quick Reference

Fast lookup for common commands and configurations.

## Running the Application

```bash
# Full stack with Docker
docker compose up --build

# Only databases
docker compose up -d postgres redis

# Specific service
docker compose up -d api
docker compose up -d worker
docker compose up -d detector

# View logs
docker compose logs -f api
docker compose logs -f worker

# Stop all
docker compose down

# Clean everything
docker compose down -v
```

## Development

```bash
# Frontend (hot reload)
cd frontend && npm run dev

# API (hot reload)
cd api && npm run dev

# Worker (no hot reload)
cd worker && go run ./cmd/worker

# Detector (hot reload)
cd detector && python -m uvicorn app:app --reload

# Run tests
docker compose run --rm api bun test
docker compose run --rm detector pytest
docker build --target build -t vms-worker-build ./worker && docker run --rm vms-worker-build go test ./...
```

## Database

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U vms -d vms

# Useful queries
SELECT * FROM users;
SELECT * FROM cameras WHERE user_id = '...';
SELECT * FROM alerts WHERE camera_id = '...' ORDER BY ts DESC LIMIT 10;

# Generate migrations (after schema changes)
cd api && npm run db:generate

# Apply migrations
docker compose exec api npm run db:migrate

# Backup database
docker compose exec postgres pg_dump -U vms vms > backup.sql

# Restore database
docker compose exec -T postgres psql -U vms vms < backup.sql
```

## Redis

```bash
# Connect to Redis
docker compose exec redis redis-cli

# Useful commands
KEYS *
XLEN detection:events
XLEN camera:commands
XRANGE detection:events - + (latest 10 entries)
XRANGE detection:events - + COUNT 10
DEL annotated:image:*  (clear all images)

# Monitor commands in real-time
MONITOR
```

## API Requests

```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo1234"}'

# List cameras
curl http://localhost:3000/cameras \
  -H "Authorization: Bearer $TOKEN"

# Create camera
curl -X POST http://localhost:3000/cameras \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"My Camera",
    "rtspUrl":"rtsp://192.168.1.100:554/stream"
  }'

# Start camera
curl -X POST http://localhost:3000/cameras/{id}/start \
  -H "Authorization: Bearer $TOKEN"

# Get alerts
curl "http://localhost:3000/alerts?limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Get annotated image
curl http://localhost:3000/alerts/images/{imageId} \
  -H "Authorization: Bearer $TOKEN" \
  -o image.png
```

## Environment Variables

### Critical (must change in production)

```bash
JWT_SECRET                 # Signing key for tokens
POSTGRES_PASSWORD          # Database password
```

### Configuration

```bash
API_PORT=3000
DETECTOR_PORT=8000
FRONTEND_PORT=5173
MEDIAMTX_RTSP_PORT=8554

CONFIDENCE_THRESHOLD=0.5   # Detection threshold (0.0-1.0)
DETECTION_SAMPLE_FPS=5     # Frames per second for detection
DEDUP_COOLDOWN_SEC=10      # Alert suppression window
MAX_EVENTS_PER_MIN=6       # Rate limit
JWT_EXPIRES_IN=12h         # Token expiry
```

### URLs

```bash
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
WORKER_INTERNAL_URL=http://worker:8080
DETECTOR_URL=http://detector:8000
REDIS_URL=redis://redis:6379
DATABASE_URL=postgres://vms:password@postgres:5432/vms
```

## Testing

```bash
# API (TypeScript/Bun)
cd api
npm test                    # Run all tests
npm test -- --watch       # Watch mode

# Worker (Go)
cd worker
go test ./...              # Run all tests
go test -v ./...           # Verbose
go test -race ./...        # Race detector
go test -cover ./...       # Coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Detector (Python)
cd detector
pytest                     # Run all tests
pytest -v                  # Verbose
pytest --cov              # Coverage
pytest -k test_name       # Specific test
```

## Troubleshooting

```bash
# Check service health
docker compose exec api curl http://localhost:3000/health
docker compose exec detector curl http://localhost:8000/health

# View container logs
docker compose logs --tail 50 api
docker compose logs --follow worker

# Exec into container
docker compose exec postgres bash
docker compose exec api bash
docker compose exec worker bash

# Restart service
docker compose restart api
docker compose down && docker compose up -d api

# Reset database
docker compose down -v
docker compose up -d postgres redis
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/description

# Make changes and commit
git add .
git commit -m "feat(scope): description"

# Push and open PR
git push origin feature/description

# Merge after review
git checkout main
git pull origin main
git merge --squash feature/description
git commit -m "feat(scope): description"
git push origin main
```

## Code Style

```bash
# Format code
cd frontend && npm run format
cd api && npm run format
cd worker && gofmt -w ./...
cd detector && black .

# Lint code
cd frontend && npm run lint
cd api && npm run lint
cd worker && golangci-lint run ./...
cd detector && flake8 .
```

## Docker Compose Useful Flags

```bash
# Build without cache
docker compose build --no-cache

# Up with build
docker compose up --build

# Remove everything including volumes
docker compose down -v

# Scale service (stateless only)
docker compose up --scale detector=3

# Run one-off command
docker compose run --rm api npm test
docker compose exec service_name command
```

## Performance Monitoring

```bash
# Check resource usage
docker stats

# View logs with timestamps
docker compose logs --timestamps

# Monitor Docker system
docker system df

# Inspect container
docker inspect container_name

# View resource limits
docker stats --no-stream
```

## Deployment Checklist

- [ ] Update `.env` with production values
- [ ] Change `JWT_SECRET` to strong random value
- [ ] Change database password
- [ ] Verify all environment variables set
- [ ] Run database migrations
- [ ] Test with sample video
- [ ] Verify logs for errors
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Enable HTTPS
- [ ] Security audit (see CONTRIBUTING.md)

## Common Errors

| Error | Solution |
|-------|----------|
| `Connection refused` on port 3000 | API not running; check `docker compose ps` and logs |
| `Database connection refused` | PostgreSQL not started; run `docker compose up -d postgres` |
| `Permission denied` opening volumes | Check file permissions on mounted volumes |
| `RTSP connection timeout` | Check RTSP URL is valid and reachable |
| `Detector not found` | Detector service not running; check `docker compose ps` |
| `WebRTC not negotiating` | Check `WEBRTC_PUBLIC_IP` is reachable; verify UDP ports open |
| `Tests timeout` | Increase timeout or check if services running; see CI config |

## Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview and features |
| `CONTRIBUTING.md` | How to contribute |
| `CHANGELOG.md` | Version history and releases |
| `docs/DEVELOPMENT.md` | Local development setup |
| `docs/API.md` | API reference with examples |
| `docs/DEPLOYMENT.md` | Deployment guides |
| `docs/EVENT_FORMAT.md` | Event schemas and formats |
| `docs/QUICK_REFERENCE.md` | This file |

## Links

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3000
- **Detector**: http://localhost:8000
- **RTSP Source**: rtsp://localhost:8554/test
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **GitHub**: https://github.com/yourorg/vms
- **Issues**: https://github.com/yourorg/vms/issues

## SSH/Remote Access

```bash
# Copy files to container
docker cp file container_name:/path

# Copy from container
docker cp container_name:/path file

# SSH into container
docker compose exec service_name bash
```

## Performance Tips

- Set `DETECTION_SAMPLE_FPS=2` for lower CPU usage
- Increase `DEDUP_COOLDOWN_SEC=30` to reduce alerts
- Use smaller YOLO model (`yolov8n` vs `yolov8s`)
- Scale detector to 3+ replicas for better throughput
- Enable GPU in detector for faster inference
- Use connection pooling (configured in API)

## Security Reminders

- Never commit `.env` files
- Rotate `JWT_SECRET` regularly
- Keep container images updated
- Use HTTPS in production (reverse proxy)
- Restrict database access
- Enable audit logging
- Use strong passwords
- Set up intrusion detection
