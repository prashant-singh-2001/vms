# Deployment Guide

This guide covers deploying VMS to various environments, from local development to production Kubernetes clusters.

## Quick Start (Local)

For local development and testing:

```bash
# Clone and setup
git clone https://github.com/yourorg/vms.git
cd vms
cp .env.example .env

# Start all services
docker compose up --build

# Access
# Frontend: http://localhost:5173
# API: http://localhost:3000
# Detector: http://localhost:8000
```

**Default credentials:**
- Username: `demo`
- Password: `demo1234`

---

## Environment Configuration

### .env File Variables

```bash
# Frontend
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000

# Database
POSTGRES_USER=vms
POSTGRES_PASSWORD=vms_dev_password
POSTGRES_DB=vms
DATABASE_URL=postgres://vms:vms_dev_password@postgres:5432/vms

# Redis
REDIS_URL=redis://redis:6379

# API
API_PORT=3000
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=12h
WORKER_INTERNAL_URL=http://worker:8080

# Worker
WORKER_HTTP_ADDR=:8080
DETECTOR_URL=http://detector:8000
DETECTION_SAMPLE_FPS=5
DEDUP_COOLDOWN_SEC=10
MAX_EVENTS_PER_MIN=6
WEBRTC_PUBLIC_IP=127.0.0.1
WEBRTC_UDP_PORT_MIN=40000
WEBRTC_UDP_PORT_MAX=40100

# Detector
CONFIDENCE_THRESHOLD=0.5
YOLO_MODEL=yolov8n.pt

# Optional: RTSP Source
SAMPLE_VIDEO_URL=  # Leave empty for synthetic test pattern
MEDIAMTX_RTSP_PORT=8554

# Seeding
SEED_USERNAME=demo
SEED_PASSWORD=demo1234
```

### Production Secrets

**NEVER commit `.env` files with secrets.** Use secure secret management:

- **Docker Swarm**: Use `docker secret` with `.env.prod` file
- **Kubernetes**: Use `kubectl create secret` with mounted files
- **CI/CD**: Use platform secrets (GitHub Secrets, GitLab CI/CD Variables)

```bash
# Never store secrets in git
echo ".env.prod" >> .gitignore
```

---

## Docker Compose Deployment

Suitable for small-to-medium deployments on a single host.

### Prepare Environment

```bash
cp .env.example .env
# Edit .env with production values
nano .env
```

### Build and Deploy

```bash
docker compose up -d --build
```

### Monitor Services

```bash
# View logs
docker compose logs -f

# Service status
docker compose ps

# Health checks
docker compose run --rm postgres pg_isready -h postgres -U vms
docker compose run --rm redis redis-cli ping
```

### Database Migrations

Migrations run automatically on API startup. To manually generate new migrations:

```bash
cd api
npm run db:generate
```

### Backups

```bash
# Backup PostgreSQL
docker compose exec postgres pg_dump -U vms vms > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup Redis
docker compose exec redis redis-cli BGSAVE
docker compose cp redis:/data/dump.rdb ./redis_backup.rdb
```

### Scaling

Docker Compose doesn't support service replication, but you can scale individual services:

```bash
# Scale detector to 3 instances (with load balancer needed)
docker compose up -d --build --scale detector=3
```

**Note:** This works for stateless services (detector, api). Worker must run as single instance per deployment or use affinity rules.

---

## Kubernetes Deployment

For production with high availability and scaling.

### Prerequisites

- Kubernetes 1.20+
- kubectl configured
- A container registry (Docker Hub, ECR, GCR)
- PersistentVolume provisioner (for Postgres/Redis)

### Build and Push Images

```bash
# Build images
docker build -t myregistry/vms-api:1.0 ./api
docker build -t myregistry/vms-worker:1.0 ./worker
docker build -t myregistry/vms-detector:1.0 ./detector
docker build -t myregistry/vms-frontend:1.0 ./frontend

# Push to registry
docker push myregistry/vms-api:1.0
docker push myregistry/vms-worker:1.0
docker push myregistry/vms-detector:1.0
docker push myregistry/vms-frontend:1.0
```

### Create Namespaces

```bash
kubectl create namespace vms
kubectl create namespace vms-system  # For databases
```

### Create Secrets

```bash
kubectl create secret generic vms-secrets \
  --from-literal=jwt-secret="$(openssl rand -base64 32)" \
  --from-literal=db-password="$(openssl rand -base64 16)" \
  -n vms
```

### Deploy PostgreSQL

```yaml
# postgres-deployment.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: vms-system
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: vms-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        env:
        - name: POSTGRES_DB
          value: vms
        - name: POSTGRES_USER
          value: vms
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: vms-secrets
              key: db-password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: vms-system
spec:
  ports:
  - port: 5432
  selector:
    app: postgres
```

### Deploy Redis

```yaml
# redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: vms-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-storage
          mountPath: /data
      volumes:
      - name: redis-storage
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: vms-system
spec:
  ports:
  - port: 6379
  selector:
    app: redis
```

### Deploy API

```yaml
# api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: vms
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: myregistry/vms-api:1.0
        env:
        - name: API_PORT
          value: "3000"
        - name: DATABASE_URL
          value: "postgres://vms:$(DB_PASSWORD)@postgres.vms-system:5432/vms"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: vms-secrets
              key: db-password
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: vms-secrets
              key: jwt-secret
        - name: REDIS_URL
          value: "redis://redis.vms-system:6379"
        - name: WORKER_INTERNAL_URL
          value: "http://worker:8080"
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: vms
spec:
  type: ClusterIP
  ports:
  - port: 3000
    targetPort: 3000
  selector:
    app: api
```

### Deploy Worker

```yaml
# worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
  namespace: vms
spec:
  replicas: 1  # Single instance for now
  selector:
    matchLabels:
      app: worker
  template:
    metadata:
      labels:
        app: worker
    spec:
      containers:
      - name: worker
        image: myregistry/vms-worker:1.0
        env:
        - name: REDIS_URL
          value: "redis://redis.vms-system:6379"
        - name: DETECTOR_URL
          value: "http://detector:8000"
        - name: WORKER_HTTP_ADDR
          value: ":8080"
        - name: WEBRTC_PUBLIC_IP
          value: "worker.example.com"  # External IP/domain
        ports:
        - containerPort: 8080
          protocol: TCP
        - containerPort: 40000
          protocol: UDP
          name: webrtc-udp-min
        - containerPort: 40100
          protocol: UDP
          name: webrtc-udp-max
---
apiVersion: v1
kind: Service
metadata:
  name: worker
  namespace: vms
spec:
  type: ClusterIP
  ports:
  - port: 8080
    targetPort: 8080
  selector:
    app: worker
```

### Deploy Detector

```yaml
# detector-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: detector
  namespace: vms
spec:
  replicas: 3
  selector:
    matchLabels:
      app: detector
  template:
    metadata:
      labels:
        app: detector
    spec:
      containers:
      - name: detector
        image: myregistry/vms-detector:1.0
        env:
        - name: PORT
          value: "8000"
        - name: CONFIDENCE_THRESHOLD
          value: "0.5"
        ports:
        - containerPort: 8000
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 60
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: detector
  namespace: vms
spec:
  type: ClusterIP
  ports:
  - port: 8000
    targetPort: 8000
  selector:
    app: detector
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: detector-hpa
  namespace: vms
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: detector
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Deploy Frontend

```yaml
# frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: vms
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: myregistry/vms-frontend:1.0
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: vms
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 80
  selector:
    app: frontend
```

### Apply Deployments

```bash
# Create system deployments
kubectl apply -f postgres-deployment.yaml
kubectl apply -f redis-deployment.yaml

# Wait for databases
kubectl wait --for=condition=ready pod -l app=postgres -n vms-system --timeout=300s

# Create app deployments
kubectl apply -f api-deployment.yaml
kubectl apply -f detector-deployment.yaml
kubectl apply -f worker-deployment.yaml
kubectl apply -f frontend-deployment.yaml

# Check status
kubectl get pods -n vms
kubectl get svc -n vms
```

### Ingress Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vms-ingress
  namespace: vms
spec:
  ingressClassName: nginx
  rules:
  - host: vms.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api
            port:
              number: 3000
```

---

## AWS Deployment

### With ECS

1. Push images to ECR
2. Create ECS task definitions for each service
3. Create ECS services with auto-scaling
4. Use RDS for PostgreSQL
5. Use ElastiCache for Redis
6. Use ALB for load balancing

### With EKS

Same as Kubernetes deployment above, but:
- Use AWS Load Balancer Controller for Ingress
- Use EBS for persistent volumes
- Use IAM roles for service credentials

---

## Monitoring & Logging

### Health Checks

```bash
# API
curl http://api-service:3000/health

# Detector
curl http://detector-service:8000/health
```

### Logging

Collect logs via:

```bash
# Docker Compose
docker compose logs -f api

# Kubernetes
kubectl logs -f deployment/api -n vms

# Use ELK/Splunk/CloudWatch for aggregation
```

### Metrics

Expose Prometheus metrics (implementation-specific):

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: vms
  namespace: vms
spec:
  selector:
    matchLabels:
      app: api
  endpoints:
  - port: metrics
```

---

## Troubleshooting

### API can't connect to database

```bash
# Check connection string
echo $DATABASE_URL

# Test connection
docker compose run --rm api psql $DATABASE_URL -c "SELECT 1"
```

### Worker not picking up cameras

```bash
# Check Redis connection
docker compose run --rm redis redis-cli -u $REDIS_URL ping

# Check camera:commands stream
docker compose run --rm redis redis-cli -u $REDIS_URL XRANGE camera:commands - +
```

### Detector timeouts

Increase timeout or add more replicas:

```bash
# In worker: DETECTOR_TIMEOUT=10s
# In Kubernetes: scale detector replicas up
kubectl scale deployment detector --replicas=5 -n vms
```

### WebRTC not connecting

- Check `WEBRTC_PUBLIC_IP` is reachable
- Verify UDP ports 40000-40100 are open
- Check firewall rules
- Use TURN server for NAT traversal (future enhancement)

---

## Security Checklist

- [ ] Change `JWT_SECRET` to strong random value
- [ ] Change `POSTGRES_PASSWORD` to strong random value
- [ ] Use HTTPS in production (reverse proxy or TLS termination)
- [ ] Restrict database access to API only
- [ ] Restrict Redis access to internal network
- [ ] Keep container images up-to-date
- [ ] Use network policies to isolate pods
- [ ] Enable audit logging for Kubernetes
- [ ] Rotate secrets regularly
- [ ] Use external TURN server for WebRTC

---

## Maintenance

### Database Backups

```bash
# Automated backups (daily)
0 2 * * * docker compose exec postgres pg_dump -U vms vms | gzip > /backups/vms_$(date +\%Y\%m\%d).sql.gz
```

### Updates

```bash
# Pull latest images
docker compose pull

# Recreate services
docker compose up -d --build

# Check migrations ran
docker compose logs api | grep "migration"
```

---

For more details, see [README.md](../README.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).
