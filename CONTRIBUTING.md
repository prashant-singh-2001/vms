# Contributing to VMS

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the Video Management System project.

## Code of Conduct

- Be respectful and inclusive
- Assume good faith in discussions
- Report issues professionally
- Contribute to a welcoming environment

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Git
- For local development: Node.js (frontend/api), Go 1.21+ (worker), Python 3.11+ (detector)

### Local Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/yourusername/vms.git
   cd vms
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   ```

3. **Start services:**
   ```bash
   docker compose up --build
   ```

4. **Run tests:**
   ```bash
   # API tests
   docker compose run --rm api bun test
   
   # Worker tests
   docker build --target build -t vms-worker-build ./worker
   docker run --rm vms-worker-build go test ./...
   
   # Detector tests
   docker compose run --rm detector pytest
   ```

## Development Workflow

### Branch Naming

- Feature: `feature/short-description`
- Bug fix: `fix/short-description`
- Documentation: `docs/short-description`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): brief description

Optional detailed explanation.

- Bullet points for changes
- More details if needed
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(detector): add annotated image output`
- `fix(worker): handle rtsp connection timeouts`
- `docs(api): update endpoint documentation`

### Pull Request Process

1. **Create a feature branch** from `main`
2. **Write tests** for new functionality
3. **Update documentation** if needed
4. **Keep commits clean** - squash fixup commits
5. **Open a PR** with:
   - Clear description of changes
   - Link to related issues
   - Screenshots/videos for UI changes
   - Test coverage information
6. **Respond to review feedback** promptly

## Architecture Guidelines

### Key Principles

- **Separation of Concerns**: Each service has a single responsibility
- **Stateless Design**: Services should be horizontally scalable
- **Event-Driven**: Redis Streams for decoupled communication
- **Fail-Safe**: Failures in one camera don't affect others
- **Type Safety**: Use TypeScript, Go, and Python type hints

### Service Boundaries

- **Frontend**: React UI, never calls worker directly
- **API**: REST/WebSocket, camera/alert management
- **Worker**: Camera pipeline orchestration, detection sampling
- **Detector**: Stateless inference HTTP service

### Adding New Features

If adding a major feature:

1. **Plan it first** - open an issue to discuss
2. **Update types** - keep all `events.*` files in sync:
   - `api/src/events.ts`
   - `worker/internal/events/events.go`
   - `frontend/src/types/events.ts`
   - `detector/model.py` (if model-related)
3. **Update docs** - especially `docs/EVENT_FORMAT.md`
4. **Test thoroughly** - unit, integration, and end-to-end
5. **Update migrations** - if database schema changes:
   ```bash
   cd api && npm run db:generate
   ```

## Code Style

### TypeScript/JavaScript

- Use ESLint and Prettier (configured)
- No `any` types without justification
- Prefer const/let over var
- Use meaningful variable names

### Go

- Run `gofmt` before committing
- Follow Go conventions from [Effective Go](https://go.dev/doc/effective_go)
- Write table-driven tests
- Add documentation to exported functions

### Python

- Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/)
- Use type hints
- Add docstrings to functions

## Testing

### Test Coverage Expectations

- **New features**: 80%+ coverage
- **Bug fixes**: Add regression test
- **Refactors**: Maintain existing coverage

### Running Tests

```bash
# API (TypeScript)
docker compose run --rm api bun test

# Worker (Go)
docker build --target build -t vms-worker-build ./worker
docker run --rm vms-worker-build go test -v ./...

# Detector (Python)
docker compose run --rm detector pytest -v
```

### Writing Tests

- Use descriptive test names
- Include setup/teardown
- Test both happy path and error cases
- Use fixtures/factories where appropriate

## Documentation

### When to Update Docs

- New API endpoints
- Changed behavior
- New environment variables
- Updated architecture decisions

### Documentation Files

- `README.md` - Project overview, quick start
- `docs/ARCHITECTURE.md` - System design
- `docs/API.md` - API reference
- `docs/DEPLOYMENT.md` - Deployment guide
- `docs/EVENT_FORMAT.md` - Event schemas
- Code comments - Why, not what

## Reporting Issues

### Bug Reports

Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots/logs if applicable
- Environment (OS, Docker version)

### Feature Requests

Include:
- Use case/motivation
- Proposed solution (if any)
- Alternative approaches
- Related issues/PRs

## Performance Considerations

- Detection inference: target ≤ 200ms per frame
- Alert latency: ≤ 2 seconds end-to-end
- Video startup: ≤ 3 seconds
- API response time: ≤ 500ms (p95)

## Security Considerations

- Never commit `.env` files with secrets
- Review RTSP URL handling for SSRF attacks
- Validate JWT tokens on all protected endpoints
- Use parameterized queries (ORM handles this)
- Sanitize file paths in storage operations
- Keep dependencies updated

## Release Process

1. **Version Bump**: Update version in relevant `package.json` / `go.mod`
2. **Changelog**: Add entry to `CHANGELOG.md`
3. **Tag**: Create git tag `v1.0.0`
4. **Push**: Push tag to trigger CI/release

## Getting Help

- **Questions**: Open a discussion issue
- **Bugs**: Open a bug report issue
- **Features**: Open a feature request issue
- **Security**: Email security@example.com (don't open public issues)

## Acknowledgments

Thank you for contributing to make VMS better! All contributors are recognized in our project history.

## License

By contributing, you agree that your contributions will be licensed under the project's license.
