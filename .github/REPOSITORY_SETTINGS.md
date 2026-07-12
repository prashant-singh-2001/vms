# GitHub Repository Settings

This document describes the recommended GitHub repository settings for VMS.

## Repository Description

**Short Description (Public Profile):**
```
Real-time camera surveillance dashboard with WebRTC streaming and AI-powered person detection
```

**Full Description (About section):**
```
A complete Video Management System (VMS) for real-time camera monitoring with live WebRTC 
streaming, AI-powered person detection with annotated images, alert management, and scalable 
microservices architecture.
```

## Repository Topics

Add the following topics to improve discoverability:

```
camera-surveillance
video-management
webrtc
person-detection
yolov8
real-time-streaming
dashboard
docker
kubernetes
typescript
go
python
fastapi
hono
postgresql
redis
ai
computer-vision
iot
monitoring
```

## Repository Settings

### General

- **Template repository**: No
- **Discussions**: Enable
- **Projects**: Enable
- **Private vulnerability reporting**: Enable

### Branches

- **Default branch**: `main`
- **Require a pull request before merging**: Yes
  - Require approvals: 1
  - Dismiss stale pull request approvals: Yes
  - Require status checks to pass: Yes
  - Require branches to be up to date before merging: Yes

### Protection Rules

Apply to branch: `main`

- **Require status checks to pass before merging**: Yes
  - Required status checks:
    - `API Tests`
    - `Worker Tests`
    - `Detector Tests`
    - `Frontend Tests & Lint`
    - `Code Quality Checks`
    - `Docker Build`
  - Require branches to be up to date: Yes

- **Require code reviews before merging**: Yes
  - Number of approvals: 1
  - Dismiss stale pull request approvals: Yes
  - Restrict who can dismiss pull requests: No

- **Require conversation resolution before merging**: Yes

- **Require status checks to pass before merging**: Yes

### Security & Analysis

- **Dependabot alerts**: Enable
- **Dependabot security updates**: Enable
- **Dependabot version updates**: Enable
- **Secret scanning**: Enable (if private)
- **Secret scanning push protection**: Enable (if available)

### Pages

- **Source**: Deploy from a branch
- **Branch**: `gh-pages`
- **Directory**: `/ (root)`

## Labels

Recommended labels for issues:

```
bug              - Something isn't working (red)
enhancement      - New feature or request (blue)
documentation    - Improvements or additions to documentation (purple)
good first issue - Good for newcomers (green)
help wanted      - Extra attention is needed (red)
question         - Further information is requested (light blue)
wontfix          - This will not be worked on (gray)
duplicate        - This issue or PR already exists (gray)
invalid          - This doesn't seem right (gray)
security         - Security-related issue (dark red)
performance      - Performance improvement (orange)
refactor         - Code refactoring (yellow)
test             - Testing related (light purple)
dependencies     - Dependency updates (blue)
```

## Milestones

Create milestones for releases:

- **v1.0** - Initial release
- **v1.1** - Annotated images + improvements
- **v1.2** - Next release
- **v2.0** - Major features (GPU support, K8s native, etc.)

## Code Owners

The `.github/CODEOWNERS` file specifies code owners for automatic review requests:
- Owners get automatically assigned to review PRs
- Owners are notified of changes to their code areas

Update the file with your team structure.

## Branch Naming Convention

Enforce naming conventions via branch protection rules or documented standards:

```
feature/description      - New features
fix/description          - Bug fixes
refactor/description     - Refactoring
docs/description         - Documentation
chore/description        - Maintenance
test/description         - Test additions
perf/description         - Performance improvements
```

## Commit Message Convention

Follow Conventional Commits:

```
type(scope): subject

body

footer
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`

Example:
```
feat(detector): add annotated image output

Detector now returns PNG images with bounding boxes when annotate=true.

Closes #123
```

## Release Process

1. **Version Bump**
   - Update version in relevant package.json/go.mod/pyproject.toml
   - Update CHANGELOG.md

2. **Create Release**
   - Tag: `v1.0.0`
   - Release notes from CHANGELOG.md
   - Binary releases (if applicable)

3. **Publish**
   - Push tag
   - Publish release on GitHub

## How to Apply Settings

### Via GitHub UI

1. Go to **Settings** > **General**
2. Update repository description and topics
3. Go to **Settings** > **Branches**
4. Add branch protection rules for `main`
5. Go to **Settings** > **Security & analysis**
6. Enable desired security features
7. Go to **Issues** > **Labels**
8. Add recommended labels
9. Go to **Projects** > **Milestones**
10. Create milestones

### Via GitHub CLI

```bash
# Set description and topics
gh repo edit \
  --description "Real-time camera surveillance dashboard with WebRTC and AI detection" \
  --enable-discussions \
  --enable-projects \
  --enable-issues

# Add topics
gh repo edit --add-topic camera-surveillance
gh repo edit --add-topic video-management
gh repo edit --add-topic webrtc
gh repo edit --add-topic person-detection
gh repo edit --add-topic yolov8
# ... (add remaining topics)
```

### Via GitOps (IaC)

Use [Terraform GitHub Provider](https://registry.terraform.io/providers/integrations/github/latest/docs/resources/repository) or similar to manage settings as code.

## Additional Files

- `.github/CODEOWNERS` - Code ownership
- `.github/ISSUE_TEMPLATE/` - Issue templates
- `.github/pull_request_template.md` - PR template
- `.github/workflows/` - CI/CD workflows
- `CONTRIBUTING.md` - Contributing guidelines
- `CODE_OF_CONDUCT.md` - Code of conduct (if applicable)

## Recommended Integrations

### CI/CD

- **GitHub Actions** - Built-in CI/CD (already configured in `.github/workflows/`)
- **Codecov** - Code coverage tracking
- **Dependabot** - Dependency updates

### Monitoring & Analytics

- **GitHub Insights** - Repository insights
- **Dependabot alerts** - Security updates

### Community

- **All Contributors** - Recognize contributors
- **Gitpod** - One-click dev environments

## Documentation

- **README.md** - Main documentation
- **docs/** - Additional guides
- **CONTRIBUTING.md** - Contribution guidelines
- **CHANGELOG.md** - Version history

---

**Last Updated:** 2026-07-12
