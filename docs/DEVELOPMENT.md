# Development Guide

This guide helps you set up a local development environment for VMS and provides tips for working with each service.

## Prerequisites

- **Docker & Docker Compose** - For containerized services
- **Git** - For version control
- **Node.js 18+** - For frontend and API (optional, for local development)
- **Go 1.21+** - For worker (optional)
- **Python 3.11+** - For detector (optional)

## Quick Start

```bash
git clone https://github.com/yourorg/vms.git
cd vms
cp .env.example .env
docker compose up --build
```

Access the app at **http://localhost:5173**

---

## Local Development (Without Docker)

For faster iteration, run services locally instead of in containers.

### Setup: Database & Redis

```bash
# Start only Postgres and Redis in Docker
docker compose up -d postgres redis

# Wait for them to be ready
docker compose exec postgres pg_isready -U vms
docker compose exec redis redis-cli ping
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

Visit **http://localhost:5173** (Vite dev server)

### API Development

```bash
cd api
npm install

# Run migrations
npm run db:generate  # If schema changed

# Start dev server
npm run dev
```

The API runs on **http://localhost:3000** with hot reload.

### Worker Development

```bash
cd worker
go mod download
go run ./cmd/worker/main.go
```

Set environment variables:

```bash
export REDIS_URL=redis://localhost:6379
export DETECTOR_URL=http://localhost:8000
export WORKER_HTTP_ADDR=:8080
```

### Detector Development

```bash
cd detector
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run the server
python -m uvicorn app:app --reload --port 8000
```

---

## Project Structure

```
vms/
├── frontend/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── api/          # API client functions
│   │   ├── types/        # TypeScript types
│   │   └── ws/           # WebSocket utilities
│   └── package.json
├── api/               # Bun + Hono + Postgres
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── auth/         # JWT/auth logic
│   │   ├── db/           # Database schema/client
│   │   ├── repositories/ # Data access layer
│   │   ├── redis/        # Redis client
│   │   └── ws/           # WebSocket handler
│   ├── tests/            # Integration tests
│   ├── drizzle.config.ts # ORM config
│   └── package.json
├── worker/            # Go orchestrator
│   ├── cmd/
│   │   └── worker/       # Main entry point
│   ├── internal/
│   │   ├── detectorclient/  # Detector HTTP client
│   │   ├── events/          # Event types & dedup
│   │   ├── pipeline/        # Camera pipeline logic
│   │   ├── webrtcsvc/       # WebRTC manager
│   │   └── redisq/          # Redis queue client
│   ├── tests/
│   └── go.mod
├── detector/          # Python + FastAPI + YOLOv8
│   ├── app.py         # FastAPI server
│   ├── model.py       # Detection logic
│   ├── tests/         # Pytest tests
│   └── requirements.txt
├── docs/              # Documentation
├── docker-compose.yml # Service orchestration
└── .env.example       # Environment template
```

---

## Code Style & Formatting

### TypeScript/JavaScript

```bash
cd frontend
npm run lint   # ESLint
npm run format # Prettier

cd api
npm run lint
npm run format
```

### Go

```bash
cd worker
gofmt -w ./...  # Format
golangci-lint run ./...  # Lint
```

### Python

```bash
cd detector
black .         # Format
flake8 .        # Lint
mypy .          # Type check
```

---

## Testing

### API (TypeScript)

```bash
cd api
npm test
npm test -- --watch  # Watch mode
```

**Test structure:**
- Unit tests in `src/` next to code (`.test.ts`)
- Integration tests in `tests/`

### Worker (Go)

```bash
cd worker
go test ./...
go test -v -race ./...  # Verbose + race detector

# Coverage
go test -cover ./...
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

**Test structure:**
- Tests in `*_test.go` next to code
- Use table-driven tests

### Detector (Python)

```bash
cd detector
pytest
pytest -v           # Verbose
pytest --cov=.     # Coverage

# Run specific test
pytest tests/test_detect.py::test_detects_person
```

---

## Database & Migrations

### Generate Migration

After updating `api/src/db/schema.ts`:

```bash
cd api
npm run db:generate
```

This creates a migration in `api/drizzle/`.

### Apply Migrations

Migrations run automatically on API startup, or manually:

```bash
cd api
npm run db:migrate
```

### Reset Database

```bash
docker compose down -v  # Remove volumes
docker compose up -d postgres
```

---

## Running Tests with Docker

```bash
# API tests
docker compose run --rm api bun test

# Worker tests
docker build --target build -t vms-worker-build ./worker
docker run --rm vms-worker-build go test -v ./...

# Detector tests
docker compose run --rm detector pytest -v
```

---

## Debugging

### API (TypeScript/Bun)

```bash
# Add debugger statements
debugger;

# Run with inspector
bun --inspect-brk src/index.ts

# Connect Chrome DevTools to chrome://inspect
```

### Worker (Go)

```bash
# Use Delve debugger
go install github.com/go-delve/delve/cmd/dlv@latest

dlv debug ./cmd/worker
(dlv) break main.main
(dlv) continue
```

### Detector (Python)

```bash
# Add breakpoints
import pdb; pdb.set_trace()

# Run with debugger
python -m pdb app.py
```

---

## Common Development Tasks

### Add a New API Endpoint

1. Define route in `api/src/routes/`
2. Implement handler and validation
3. Add tests in `api/tests/`
4. Update `docs/API.md`

Example:

```typescript
// api/src/routes/example.ts
import { Hono } from "hono";

const routes = new Hono();

routes.get("/example/:id", async (c) => {
  const id = c.req.param("id");
  // Handler logic
  return c.json({ id, data: "example" });
});

export default routes;
```

### Add a New WebSocket Message

1. Update event schema in `api/src/events.ts`
2. Update `frontend/src/types/events.ts`
3. Update `worker/internal/events/events.go`
4. Send message from API consumer
5. Handle in frontend RealtimeContext

### Modify Detection Model

1. Update `detector/model.py`
2. Regenerate bounding box drawing if needed
3. Update tests
4. Rebuild detector image

### Update Dependencies

```bash
# Frontend
cd frontend
npm outdated
npm update

# API
cd api
npm outdated
npm update

# Worker
cd worker
go get -u ./...

# Detector
cd detector
pip list --outdated
pip install --upgrade package-name
```

---

## Performance Profiling

### API (Node.js)

```bash
# Generate flamegraph
node --prof src/index.ts
node --prof-process isolate-*.log | tail -20
```

### Worker (Go)

```bash
# CPU profile
go test -cpuprofile=cpu.prof ./...
go tool pprof cpu.prof

# Memory profile
go test -memprofile=mem.prof ./...
go tool pprof mem.prof
```

### Detector (Python)

```bash
# Profile with cProfile
python -m cProfile -s cumtime app.py

# Profile with line_profiler
pip install line_profiler
kernprof -l -v app.py
```

---

## Environment Variables for Development

Create `.env.dev`:

```bash
# Verbose logging
DEBUG=*

# Detector
CONFIDENCE_THRESHOLD=0.3  # Lower for testing
YOLO_MODEL=yolov8n.pt

# Worker
DETECTION_SAMPLE_FPS=10  # Higher for testing
DEDUP_COOLDOWN_SEC=0     # Disable dedup for testing
MAX_EVENTS_PER_MIN=999

# API
JWT_SECRET=dev-secret-key-not-for-production
JWT_EXPIRES_IN=24h

# Redis/DB
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgres://vms:vms_dev_password@localhost:5432/vms
```

---

## Useful Docker Compose Commands

```bash
# Rebuild specific service
docker compose build --no-cache api

# View logs
docker compose logs api
docker compose logs -f api  # Follow

# Execute command in container
docker compose exec api bun test
docker compose exec postgres psql -U vms -d vms -c "SELECT * FROM alerts;"

# Remove everything and start fresh
docker compose down -v
docker compose up --build

# Stop all services without removing
docker compose stop
docker compose start
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes
git add .
git commit -m "feat(scope): description"

# Push and open PR
git push origin feature/my-feature

# After review, squash and merge
git checkout main
git pull origin main
git merge --squash feature/my-feature
git commit -m "feat(scope): description"
git push origin main
```

---

## IDE Setup

### VS Code

**Extensions:**
- ESLint
- Prettier
- Go
- Python
- Remote - Containers

**Workspace settings** (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[go]": {
    "editor.defaultFormatter": "golang.go",
    "editor.gotoDefinitionSmartBackspace": true
  },
  "[python]": {
    "editor.defaultFormatter": "ms-python.python"
  }
}
```

### GoLand / IntelliJ

- Configure Go SDK
- Enable Go Modules
- Set up test runner

### PyCharm

- Configure Python interpreter
- Install requirements in project venv
- Enable pytest as test runner

---

## Troubleshooting

### Port already in use

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Database connection refused

```bash
# Check if Postgres is running
docker compose exec postgres pg_isready -U vms

# Restart Postgres
docker compose restart postgres
```

### Hot reload not working

```bash
# Restart the service
docker compose restart api

# Or run locally without container
cd api && npm run dev
```

### Tests fail locally but pass in CI

- Check Node/Go/Python versions match CI
- Clear cache: `rm -rf node_modules && npm install`
- Check environment variables
- Run with same commands as CI

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on:
- Code style
- Commit messages
- Pull request process
- Adding new features

---

## Resources

- [VMS README](../README.md)
- [API Reference](./API.md)
- [Event Format](./EVENT_FORMAT.md)
- [Deployment Guide](./DEPLOYMENT.md)
