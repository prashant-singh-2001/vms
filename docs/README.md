# VMS Documentation

Complete documentation for the Video Management System project.

## Getting Started

New to VMS? Start here:

1. **[README.md](../README.md)** - Project overview, features, and architecture
2. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Common commands and configurations
3. **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Set up local development environment

## For Developers

### Working with VMS

- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Local development setup, testing, debugging
- **[API.md](./API.md)** - REST API reference with examples
- **[EVENT_FORMAT.md](./EVENT_FORMAT.md)** - Event schemas and data formats
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Code style, workflow, contribution guidelines

### Architecture & Design

- **[README.md](../README.md)** - System architecture diagram and design decisions
- **[EVENT_FORMAT.md](./EVENT_FORMAT.md)** - Data flow and event schemas
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Performance monitoring tips

## For DevOps & Operations

### Deployment & Infrastructure

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deploy to Docker Compose, Kubernetes, AWS, etc.
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Docker commands and troubleshooting

### Maintenance

- Database backups - See [DEPLOYMENT.md](./DEPLOYMENT.md#maintenance)
- Monitoring setup - See [DEPLOYMENT.md](./DEPLOYMENT.md#monitoring--logging)
- Upgrading - See [CHANGELOG.md](../CHANGELOG.md)

## For Project Managers

- **[README.md](../README.md)** - Feature overview and system capabilities
- **[CHANGELOG.md](../CHANGELOG.md)** - Release notes and roadmap
- **[REQUIREMENTS.md](../REQUIREMENTS.md)** - Functional and non-functional requirements

## Document Overview

### Root-Level Files

| File | Audience | Purpose |
|------|----------|---------|
| [README.md](../README.md) | Everyone | Project overview, quick start, architecture |
| [REQUIREMENTS.md](../REQUIREMENTS.md) | PM, Architects | Functional and non-functional requirements |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Developers | How to contribute, code style, workflow |
| [CHANGELOG.md](../CHANGELOG.md) | Everyone | Release notes, version history, roadmap |
| [LICENSE](../LICENSE) | Everyone | MIT license |

### Documentation Files (docs/)

| File | Audience | Purpose |
|------|----------|---------|
| [API.md](./API.md) | Backend developers | REST API reference, endpoints, examples |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | DevOps, Backend | Deployment guides, infrastructure setup |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Developers | Local setup, testing, debugging |
| [EVENT_FORMAT.md](./EVENT_FORMAT.md) | All developers | Event schemas, data formats, validation |
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) | Everyone | Quick lookup for commands, configs, errors |
| [README.md](./README.md) | Everyone | Documentation index (this file) |

## Key Sections by Topic

### Authentication & Security

- API authentication: [API.md#authentication](./API.md#authentication)
- Security considerations: [CONTRIBUTING.md#security-considerations](../CONTRIBUTING.md#security-considerations)
- Production security: [DEPLOYMENT.md#security-checklist](./DEPLOYMENT.md#security-checklist)

### Working with Events

- Event schema: [EVENT_FORMAT.md](./EVENT_FORMAT.md)
- Database alerts: [API.md#alerts](./API.md#alerts)
- WebSocket messages: [EVENT_FORMAT.md#websocket-message-format](./EVENT_FORMAT.md#websocket-message-format)

### Camera Management

- CRUD operations: [API.md#cameras](./API.md#cameras)
- Starting/stopping: [README.md](../README.md#starting-a-camera)
- Pipeline architecture: [README.md](../README.md#architecture)

### WebRTC Streaming

- WHEP signaling: [API.md#webrtc-signaling-whep](./API.md#webrtc-signaling-whep)
- Technical details: [README.md](../README.md#watching-a-camera-webrtc-via-whep)

### Person Detection

- Detection model: [README.md](../README.md#detection-model-yolov8n)
- Annotated images: [README.md](../README.md#annotated-images)
- Detector API: [EVENT_FORMAT.md#detector-http-contract](./EVENT_FORMAT.md#detector-http-contract)

### Deployment

- Docker Compose: [DEPLOYMENT.md#docker-compose-deployment](./DEPLOYMENT.md#docker-compose-deployment)
- Kubernetes: [DEPLOYMENT.md#kubernetes-deployment](./DEPLOYMENT.md#kubernetes-deployment)
- AWS: [DEPLOYMENT.md#aws-deployment](./DEPLOYMENT.md#aws-deployment)

### Testing

- Test coverage: [CONTRIBUTING.md#testing](../CONTRIBUTING.md#testing)
- Running tests: [DEVELOPMENT.md#testing](./DEVELOPMENT.md#testing)
- Test structure: [README.md](../README.md#tests-bonus)

### Troubleshooting

- Common errors: [QUICK_REFERENCE.md#common-errors](./QUICK_REFERENCE.md#common-errors)
- Debugging tips: [DEVELOPMENT.md#debugging](./DEVELOPMENT.md#debugging)
- Logs and monitoring: [DEPLOYMENT.md#monitoring--logging](./DEPLOYMENT.md#monitoring--logging)

## Quick Links

### Commands

**Start development:**
```bash
docker compose up --build
# Then open http://localhost:5173
```

**Run tests:**
```bash
docker compose run --rm api bun test
docker compose run --rm detector pytest
docker build --target build -t vms-worker-build ./worker && docker run --rm vms-worker-build go test ./...
```

**See more:** [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#running-the-application)

### Common Questions

**Q: How do I add a new API endpoint?**  
A: See [DEVELOPMENT.md#add-a-new-api-endpoint](./DEVELOPMENT.md#add-a-new-api-endpoint)

**Q: How do I deploy to Kubernetes?**  
A: See [DEPLOYMENT.md#kubernetes-deployment](./DEPLOYMENT.md#kubernetes-deployment)

**Q: How do I debug a failing test?**  
A: See [DEVELOPMENT.md#debugging](./DEVELOPMENT.md#debugging)

**Q: What's the event format?**  
A: See [EVENT_FORMAT.md](./EVENT_FORMAT.md)

**Q: How do I contribute?**  
A: See [CONTRIBUTING.md](../CONTRIBUTING.md)

## Version History

See [CHANGELOG.md](../CHANGELOG.md) for:
- Release notes
- Breaking changes
- Upgrade guides
- Roadmap

## Contributing to Docs

- Use Markdown format
- Keep language clear and concise
- Include code examples where helpful
- Link to related sections
- Update this README when adding new docs

## Support

- **Issues & Bugs**: [GitHub Issues](https://github.com/yourorg/vms/issues)
- **Questions**: [GitHub Discussions](https://github.com/yourorg/vms/discussions)
- **Security Issues**: Email security@example.com

---

**Last Updated:** 2026-07-12  
**Documentation Version:** 1.0
