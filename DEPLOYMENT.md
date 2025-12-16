# MCP Tools Catalog - Deployment Guide

This guide provides step-by-step instructions for deploying the MCP Tools Catalog to an OpenShift cluster.

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Architecture Overview](#-architecture-overview)
3. [Part A: Build and Deploy the Console Plugin](#-part-a-build-and-deploy-the-console-plugin)
4. [Part B: Deploy Backstage on OpenShift](#-part-b-deploy-backstage-on-openshift)
5. [Part C: Configure GitHub Catalog Integration](#-part-c-configure-github-catalog-integration)
6. [Part D: Create MCP Entities](#-part-d-create-mcp-entities)
7. [Verification](#-verification)
8. [Operations](#-operations)
9. [Troubleshooting](#-troubleshooting)
10. [Reference](#-reference)

---

## 📋 Prerequisites

Before deploying, ensure you have:

- OpenShift cluster access (4.12+)
- `oc` CLI tool installed and configured
- Docker or Podman for building images
- Helm 3+ installed
- Access to a container registry (e.g., Quay.io)
- A GitHub repository for storing MCP entity definitions
- A GitHub Personal Access Token (for private repos)

### Self-Signed Certificates

If your OpenShift cluster uses self-signed certificates, all `curl` commands in this guide include the `-k` flag to bypass certificate verification.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OpenShift Cluster                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐   │
│  │  OpenShift       │      │  MCP Catalog     │      │  Backstage       │   │
│  │  Console         │─────►│  Plugin          │─────►│  (with TLS       │   │
│  │                  │      │  (namespace:     │      │   sidecar)       │   │
│  │                  │      │   mcp-tools-     │      │  (namespace:     │   │
│  │                  │      │   catalog)       │      │   backstage)     │   │
│  └──────────────────┘      └──────────────────┘      └────────┬─────────┘   │
│                                                               │             │
│                                                               ▼             │
│                                                       ┌──────────────────┐  │
│                                                       │  PostgreSQL      │  │
│                                                       │  Database        │  │
│                                                       └──────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                            ┌──────────────────┐
                            │  GitHub          │
                            │  Repository      │
                            │  (MCP Entities)  │
                            └──────────────────┘
```

**Components:**
- **Console Plugin**: Frontend UI for browsing MCP servers, tools, and workloads
- **Backstage**: Backend catalog service that stores and serves entity data
- **TLS Sidecar**: Provides HTTPS for console plugin proxy (required)
- **PostgreSQL**: Database for Backstage catalog
- **GitHub**: Source of truth for MCP entity YAML definitions

---

## 🚀 Part A: Build and Deploy the Console Plugin

### A1. Build the Plugin

```bash
# Install dependencies and build
yarn install
yarn build

# Run tests (optional)
yarn test
```

### A2. Build and Push Container Image

**Option 1: Use the build script (recommended)**

```bash
./build-container.sh
```

**Option 2: Manual build**

```bash
# Build the image
podman build -f Dockerfile.local -t quay.io/your-org/mcp-tools-catalog:latest .

# Push to registry
podman push quay.io/your-org/mcp-tools-catalog:latest
```

### A3. Deploy with Helm

```bash
# Create namespace
oc new-project mcp-tools-catalog

# Install the plugin
helm install mcp-catalog charts/openshift-console-plugin \
  --set plugin.image=quay.io/your-org/mcp-tools-catalog:latest \
  --set plugin.imagePullPolicy=Always \
  --namespace mcp-tools-catalog
```

### A4. Enable the Plugin

```bash
# Enable the plugin in OpenShift Console
oc patch consoles.operator.openshift.io cluster \
  --patch '{"spec":{"plugins":["mcp-catalog"]}}' \
  --type=merge
```

### A5. Verify Plugin Deployment

```bash
# Check pod status
oc get pods -n mcp-tools-catalog

# Check plugin registration
oc get consoleplugin mcp-catalog

# Verify plugin manifest is accessible
oc port-forward -n mcp-tools-catalog svc/mcp-catalog 9443:9443 &
curl -k https://localhost:9443/plugin-manifest.json
kill %1
```

---

## 🚀 Part B: Deploy Backstage on OpenShift

Skip this section if you already have Backstage or Red Hat Developer Hub running.

### B1. Create Namespace and Secrets

```bash
# Create namespace
oc new-project backstage

# Create database password secret
oc create secret generic backstage-db \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -base64 24) \
  -n backstage

# Create GitHub token secret (for catalog integration)
oc create secret generic backstage-github-token \
  --from-literal=GITHUB_TOKEN=ghp_your_token_here \
  -n backstage
```

### B2. Deploy PostgreSQL

```bash
oc apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backstage-postgres
  namespace: backstage
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backstage-postgres
  template:
    metadata:
      labels:
        app: backstage-postgres
    spec:
      containers:
        - name: postgres
          image: registry.redhat.io/rhel8/postgresql-13:latest
          env:
            - name: POSTGRESQL_USER
              value: backstage
            - name: POSTGRESQL_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: backstage-db
                  key: POSTGRES_PASSWORD
            - name: POSTGRESQL_DATABASE
              value: backstage
          ports:
            - containerPort: 5432
          readinessProbe:
            tcpSocket:
              port: 5432
            initialDelaySeconds: 10
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: backstage-postgres
  namespace: backstage
spec:
  selector:
    app: backstage-postgres
  ports:
    - port: 5432
      targetPort: 5432
EOF

# Wait for PostgreSQL to be ready
oc rollout status deployment/backstage-postgres -n backstage
```

### B3. Create Backstage Configuration

Create or use the provided configuration file:

```bash
# Create ConfigMap from the deployment config file
oc create configmap backstage-app-config \
  --from-file=app-config.production.yaml=deployment/app-config.production.yaml \
  -n backstage
```

### B4. Deploy Backstage

```bash
oc apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backstage
  namespace: backstage
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backstage
  template:
    metadata:
      labels:
        app: backstage
    spec:
      containers:
        - name: backstage
          image: quay.io/your-org/backstage:latest
          imagePullPolicy: Always
          env:
            - name: POSTGRES_HOST
              value: backstage-postgres.backstage.svc.cluster.local
            - name: POSTGRES_PORT
              value: "5432"
            - name: POSTGRES_USER
              value: backstage
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: backstage-db
                  key: POSTGRES_PASSWORD
            - name: POSTGRES_DB
              value: backstage
          ports:
            - containerPort: 7007
          volumeMounts:
            - name: app-config
              mountPath: /app/app-config.production.yaml
              subPath: app-config.production.yaml
          readinessProbe:
            httpGet:
              path: /healthcheck
              port: 7007
            initialDelaySeconds: 15
            periodSeconds: 10
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: 500m
              memory: 1Gi
      volumes:
        - name: app-config
          configMap:
            name: backstage-app-config
EOF
```

### B5. Add TLS Sidecar (Required for Console Plugin)

The OpenShift console plugin proxy **requires HTTPS**. Add a TLS-terminating sidecar:

```bash
# Annotate service for auto-generated TLS certificates
oc annotate service backstage -n backstage \
  service.beta.openshift.io/serving-cert-secret-name=backstage-tls --overwrite

# Patch deployment to add TLS sidecar
oc patch deployment backstage -n backstage --type='strategic' -p='{
  "spec": {
    "template": {
      "spec": {
        "volumes": [
          {"name": "tls-certs", "secret": {"secretName": "backstage-tls"}}
        ],
        "containers": [
          {
            "name": "tls-proxy",
            "image": "registry.redhat.io/openshift4/ose-tools-rhel9:latest",
            "command": ["/bin/bash", "-c"],
            "args": ["exec socat -d OPENSSL-LISTEN:7443,fork,cert=/etc/tls/tls.crt,key=/etc/tls/tls.key,verify=0,reuseaddr TCP:127.0.0.1:7007"],
            "ports": [{"containerPort": 7443, "name": "https"}],
            "volumeMounts": [
              {"name": "tls-certs", "mountPath": "/etc/tls", "readOnly": true}
            ],
            "securityContext": {
              "allowPrivilegeEscalation": false,
              "runAsNonRoot": true,
              "capabilities": {"drop": ["ALL"]}
            },
            "resources": {
              "requests": {"cpu": "10m", "memory": "64Mi"},
              "limits": {"cpu": "100m", "memory": "256Mi"}
            },
            "readinessProbe": {
              "tcpSocket": {"port": 7443},
              "initialDelaySeconds": 5,
              "periodSeconds": 10
            }
          }
        ]
      }
    }
  }
}'
```

### B6. Create Backstage Service with HTTPS Port

```bash
oc apply -f - <<'EOF'
apiVersion: v1
kind: Service
metadata:
  name: backstage
  namespace: backstage
  annotations:
    service.beta.openshift.io/serving-cert-secret-name: backstage-tls
spec:
  selector:
    app: backstage
  ports:
  - name: http
    port: 7007
    targetPort: 7007
  - name: https
    port: 7443
    targetPort: 7443
  type: ClusterIP
EOF
```

### B7. Expose Backstage Route

```bash
oc expose svc/backstage --port=7007 -n backstage
oc patch route backstage -n backstage --type='merge' \
  -p='{"spec":{"tls":{"termination":"edge"}}}'
```

### B8. Update Console Plugin to Use HTTPS Port

```bash
oc patch consoleplugin mcp-catalog --type='json' -p='[
  {"op": "replace", "path": "/spec/proxy/0/endpoint/service/port", "value": 7443}
]'

# Restart console to apply changes
oc delete pods -n openshift-console -l app=console
```

---

## 🚀 Part C: Configure GitHub Catalog Integration

This configures Backstage to automatically load MCP entities from a GitHub repository.

### C1. Create GitHub Settings ConfigMap

```bash
oc apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: backstage-github-config
  namespace: backstage
data:
  GITHUB_ORG: "your-organization"
  GITHUB_REPO: "your-repo-name"
  GITHUB_BRANCH: "main"
EOF
```

### C2. Inject Environment Variables

```bash
oc patch deployment backstage -n backstage --type='strategic' -p='{
  "spec": {
    "template": {
      "spec": {
        "containers": [
          {
            "name": "backstage",
            "envFrom": [
              {"configMapRef": {"name": "backstage-github-config"}},
              {"secretRef": {"name": "backstage-github-token"}}
            ]
          }
        ]
      }
    }
  }
}'
```

### C3. Verify Configuration

```bash
# Wait for rollout
oc rollout status deployment/backstage -n backstage

# Verify environment variables
oc exec deployment/backstage -n backstage -- env | grep -E "GITHUB_(ORG|REPO|BRANCH)"

# Check logs for catalog processing
oc logs deployment/backstage -n backstage | grep -E "(catalog|github|processing)"
```

### C4. Change GitHub Branch (Optional)

```bash
oc patch configmap backstage-github-config -n backstage --type='merge' \
  -p='{"data": {"GITHUB_BRANCH": "develop"}}'

oc rollout restart deployment/backstage -n backstage
```

---

## 🚀 Part D: Create MCP Entities

MCP entities are defined as Backstage Component entities with specific `spec.type` values.

### Entity Types

| Entity Type | `spec.type` | Purpose |
|-------------|-------------|---------|
| MCP Server | `mcp-server` | AI capability providers |
| MCP Tool | `mcp-tool` | Individual AI functions |
| MCP Workload | `mcp-workload` | Composed workflows |

### Example: MCP Server Entity

```yaml
# entities/my-server.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-mcp-server
  namespace: default
  description: "My MCP server"
  labels:
    mcp-catalog.io/type: server
spec:
  type: mcp-server
  lifecycle: production
  owner: platform-team
  mcp:
    serverType: stdio
    endpoint: "docker run -i --rm my-mcp-server:latest"
    capabilities:
      - tools
      - resources
```

### Example: MCP Tool Entity

```yaml
# entities/my-tool.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-tool
  namespace: default
  description: "My MCP tool"
  labels:
    mcp-catalog.io/type: tool
    mcp-catalog.io/server: my-mcp-server
spec:
  type: mcp-tool
  lifecycle: production
  owner: platform-team
  # subcomponentOf creates partOf/hasPart relations (Component to Component)
  subcomponentOf: component:default/my-mcp-server
  mcp:
    toolType: query
    inputSchema:
      type: object
      properties:
        query:
          type: string
```

### Push Entities to GitHub

```bash
# Add entities to your repository
git add entities/
git commit -m "Add MCP entities"
git push

# Backstage will sync within 5 minutes, or restart to force sync
oc rollout restart deployment/backstage -n backstage
```

---

## ✅ Verification

### Verify Backstage Catalog

```bash
# Port-forward to Backstage
oc port-forward deployment/backstage -n backstage 7007:7007 &
sleep 3

# List all entities
curl -s http://localhost:7007/api/catalog/entities | jq '.[] | {kind, type: .spec.type, name: .metadata.name}'

# Stop port-forward
kill %1
```

### Verify Console Plugin

1. Open OpenShift Console in your browser
2. Look for "MCP Catalog" in the left navigation
3. Navigate to `/mcp-catalog` to see the plugin
4. Verify servers, tools, and workloads appear

### Check for Errors

```bash
# Backstage logs
oc logs deployment/backstage -n backstage | grep -iE "(error|failed)"

# Plugin logs
oc logs deployment/mcp-catalog -n mcp-tools-catalog

# Console logs
oc logs -n openshift-console -l app=console | grep -i mcp
```

---

## 🔄 Operations

### Update Plugin Image

```bash
# Rebuild and push
yarn build
podman build -f Dockerfile.local -t quay.io/your-org/mcp-tools-catalog:v2 .
podman push quay.io/your-org/mcp-tools-catalog:v2

# Update deployment
helm upgrade mcp-catalog charts/openshift-console-plugin \
  --set plugin.image=quay.io/your-org/mcp-tools-catalog:v2 \
  --namespace mcp-tools-catalog

# Restart console
oc delete pods -n openshift-console -l app=console
```

### Rollback Plugin

```bash
helm rollback mcp-catalog 1 -n mcp-tools-catalog
```

### Force Backstage Catalog Resync

```bash
oc rollout restart deployment/backstage -n backstage
```

---

## 🔧 Troubleshooting

### Plugin Shows "No MCP Servers Found"

1. **Check Backstage has entities:**
   ```bash
   oc port-forward deployment/backstage -n backstage 7007:7007 &
   curl -s http://localhost:7007/api/catalog/entities | jq '.[] | .spec.type'
   kill %1
   ```

2. **Verify entity types match:** Entities must have `spec.type: mcp-server` (not just `server`)

3. **Check console plugin proxy:** Open browser DevTools → Network tab → look for errors on `/api/proxy/plugin/mcp-catalog/backstage/`

### Console Plugin Shows "502 Bad Gateway"

**Cause:** Console plugin proxy requires HTTPS, but Backstage serves HTTP.

**Solution:** Ensure TLS sidecar is deployed (see Part B, Step 5).

```bash
# Verify TLS sidecar is running
oc get pods -n backstage -o jsonpath='{.items[*].spec.containers[*].name}'
# Should show: backstage tls-proxy

# Verify port 7443 is in service
oc get svc backstage -n backstage -o jsonpath='{.spec.ports[*].port}'
# Should include: 7443
```

### Entities Not Appearing in Backstage

1. **Check GitHub sync:**
   ```bash
   oc logs deployment/backstage -n backstage | grep -E "(github|location|processing)"
   ```

2. **Check for YAML errors:**
   ```bash
   oc logs deployment/backstage -n backstage | grep -iE "(error|failed|validation)"
   ```

3. **Common YAML issues:**
   - Don't use top-level `relations` field (Backstage generates these)
   - For tool→server: use `spec.subcomponentOf: component:ns/server`
   - For workload→tool: use `spec.dependsOn: [component:ns/tool]`
   - Ensure `apiVersion: backstage.io/v1alpha1`
   - Ensure `kind: Component`
   - Required spec fields: `type`, `lifecycle`, `owner`

### Plugin Detail Page Shows "undefined"

**Cause:** OpenShift Console dynamic plugins don't populate `useParams()` correctly.

**Solution:** This is fixed in the latest plugin version. Rebuild and redeploy:
```bash
yarn build
podman build -f Dockerfile.local -t quay.io/your-org/mcp-tools-catalog:latest .
podman push quay.io/your-org/mcp-tools-catalog:latest
oc rollout restart deployment/mcp-catalog -n mcp-tools-catalog
oc delete pods -n openshift-console -l app=console
```

---

## 📚 Reference

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | Yes (private repos) |
| `GITHUB_ORG` | GitHub organization or user | Yes |
| `GITHUB_REPO` | Repository name | Yes |
| `GITHUB_BRANCH` | Branch name | No (default: main) |

### Entity Reference Format

| Entity Type | Reference Format | Example |
|-------------|------------------|---------|
| MCP Server | `component:namespace/name` | `component:default/my-server` |
| MCP Tool | `component:namespace/name` | `component:default/my-tool` |

### Helm Values

Key values in `charts/openshift-console-plugin/values.yaml`:

```yaml
plugin:
  image: "quay.io/your-org/mcp-tools-catalog:latest"
  backstage:
    enabled: true
    serviceName: backstage
    namespace: backstage
    port: 7443  # HTTPS port with TLS sidecar
```

### Security Notice

The default configuration uses `dangerouslyDisableDefaultAuthPolicy: true` in Backstage to allow unauthenticated API access. This is for development only. See the TODO section at the end of this document for production authentication setup.

---

## 📝 TODO: Production Authentication

> ⚠️ **Security Notice**: The current deployment disables Backstage authentication for development convenience. Configure proper authentication before production use.

See the full authentication setup guide in the [Authentication TODO](#todo-authentication) section.

---

## 📚 Additional Resources

- [BUILD-FIXES.md](BUILD-FIXES.md) - Container build troubleshooting
- [specs/001-mcp-tools-catalog/quickstart.md](specs/001-mcp-tools-catalog/quickstart.md) - Quick start guide
- [Backstage Documentation](https://backstage.io/docs)
