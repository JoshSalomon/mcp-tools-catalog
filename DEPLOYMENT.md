# MCP Tools Catalog - Deployment Guide

This guide provides step-by-step instructions for deploying the MCP Tools Catalog to an OpenShift cluster.

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Architecture Overview](#-architecture-overview)
3. [Part A: Build and Deploy the Console Plugin](#-part-a-build-and-deploy-the-console-plugin)
4. [Part B: Deploy Backstage on OpenShift](#-part-b-deploy-backstage-on-openshift)
5. [Part C: Configure GitHub Catalog Integration](#-part-c-configure-github-catalog-integration)
6. [Part D: Create MCP Entities](#-part-d-create-mcp-entities)
7. [Part E: Configure MCP RBAC](#-part-e-configure-mcp-rbac-entity-management-api)
   - [E8: Automated RBAC Testing](#e8-automated-rbac-testing)
   - [E9: Quickstart Validation Testing](#e9-quickstart-validation-testing)
   - [E10: Performance, Security, and Visibility Testing](#e10-performance-security-and-visibility-testing)
8. [Verification](#-verification)
9. [Operations](#-operations)
10. [Troubleshooting](#-troubleshooting)
11. [Reference](#-reference)

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
- **Backstage**: Backend catalog service that stores and serves entity data (HTTP on port 7007)
- **nginx TLS Sidecar**: Provides HTTPS on port 7443 for console plugin proxy (required)
- **Database**: PostgreSQL (production) or SQLite with PVC (PoC)
- **GitHub**: Source of truth for MCP entity YAML definitions

**Deployment Options:**
- **Production**: PostgreSQL database, full HA support
- **PoC (Proof of Concept)**: SQLite with PersistentVolumeClaim, single replica

---

## 🏛️ Architectural Decisions

### Decision: nginx TLS Sidecar for HTTPS Termination

**Problem Statement:**
The OpenShift Console Plugin proxy **requires HTTPS** to communicate with backend services. However, the Backstage backend container serves HTTP only on port 7007 and does not natively support HTTPS/TLS termination.

**Decision:**
Use an **nginx TLS-terminating sidecar container** that:
- Listens on HTTPS port 7443 using OpenShift Service Serving Certificates
- Proxies requests to the Backstage container on HTTP port 7007 (localhost)
- Handles TLS termination and certificate management

**Architecture Flow:**
```
OpenShift Console Plugin (HTTPS)
    ↓
ConsolePlugin Proxy (requires HTTPS)
    ↓
Service: backstage (port 7443 - HTTPS)
    ↓
nginx-tls sidecar container (terminates TLS, proxies to localhost:7007)
    ↓
Backstage container (HTTP on port 7007)
```

**Why This Approach:**

1. **OpenShift Console Plugin Requirement**: The ConsolePlugin CustomResource requires HTTPS endpoints. The console proxy will not connect to HTTP-only services.

2. **Backstage HTTP-Only**: The Backstage backend container is configured to serve HTTP only. While Backstage *can* be configured for HTTPS, it requires:
   - Additional certificate management
   - More complex configuration
   - Potential conflicts with OpenShift's certificate management

3. **OpenShift Service Certificates**: OpenShift automatically generates TLS certificates via the `service.beta.openshift.io/serving-cert-secret-name` annotation, providing:
   - Automatic certificate generation and rotation
   - No manual certificate management
   - Integration with OpenShift's security model

4. **Separation of Concerns**: The sidecar pattern allows:
   - Backstage to focus on application logic (HTTP)
   - nginx to handle TLS termination and proxying
   - Independent scaling and configuration of TLS layer

5. **Red Hat Registry Compliance**: Uses `registry.access.redhat.com/ubi9/nginx-122:latest` (Principle X - Red Hat Registry First)

**Configuration Details:**

- **Backstage Container**: Serves HTTP on port 7007 (internal)
- **nginx Sidecar**: Listens on HTTPS port 7443, proxies to `http://127.0.0.1:7007`
- **Service**: Exposes both ports:
  - Port 7007 (HTTP) - for external Route with edge TLS termination
  - Port 7443 (HTTPS) - for ConsolePlugin proxy
- **TLS Certificates**: Auto-generated by OpenShift in `backstage-tls` secret

**Alternative Approaches Considered:**

1. **Backstage Native HTTPS**: 
   - ❌ Requires manual certificate management
   - ❌ More complex configuration
   - ❌ Potential conflicts with OpenShift cert management

2. **OpenShift Route with Edge Termination**:
   - ✅ Works for external access (used for Route)
   - ❌ ConsolePlugin proxy requires direct service access, not Route

3. **Istio Service Mesh**:
   - ✅ Could provide TLS termination
   - ❌ Adds significant complexity and dependencies
   - ❌ May not be available in all OpenShift clusters

**When This Might Change:**

- If Backstage adds native support for OpenShift Service Serving Certificates
- If OpenShift ConsolePlugin adds support for HTTP endpoints
- If migrating to a service mesh that handles TLS termination

**Related Files:**
- `deployment/backstage-deployment-sqlite.yaml` - Deployment with nginx sidecar
- `deployment/backstage-service.yaml` - Service exposing both HTTP and HTTPS ports
- `deployment/backstage-route.yaml` - External Route (uses edge TLS termination on port 7007)

---

## 🔐 Authentication & Authorization Architecture

### Authentication Flow

The MCP Tools Catalog implements a multi-layered authentication flow for write operations:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Authentication Flow                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Browser                                                             │
│     ├─ User session cookies (HttpOnly)                                 │
│     ├─ csrf-token cookie                                               │
│     └─ Sends requests with credentials: 'include'                      │
│           │                                                             │
│           ▼                                                             │
│  2. OpenShift Console Proxy                                            │
│     ├─ Extracts user token from HttpOnly cookie                        │
│     ├─ Adds X-Forwarded-Access-Token header                            │
│     ├─ Validates CSRF token (X-CSRFToken header vs csrf-token cookie)  │
│     └─ Forwards to backend service                                     │
│           │                                                             │
│           ▼                                                             │
│  3. nginx TLS Sidecar (port 7443)                                      │
│     ├─ Terminates TLS                                                  │
│     ├─ Forwards X-Forwarded-Access-Token header                        │
│     ├─ Forwards Authorization header (if present)                      │
│     └─ Proxies to Backstage (http://127.0.0.1:7007)                    │
│           │                                                             │
│           ▼                                                             │
│  4. MCP Entity API (Backstage plugin)                                  │
│     ├─ Extracts token from X-Forwarded-Access-Token or Authorization   │
│     ├─ Validates token via OpenShift SubjectAccessReview API           │
│     ├─ Checks MCP RBAC permissions (mcp-admin/mcp-user)                │
│     └─ Allows or denies operation                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. Frontend (Console Plugin)

**Location**: `src/services/catalogService.ts`

The frontend handles authentication tokens automatically:

```typescript
// CSRF Token Handling
const createAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  
  // Extract CSRF token from cookie for write operations
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf-token='))
    ?.split('=')[1];
  
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;  // Required by OpenShift Console proxy
  }
  
  return headers;
};

// All requests include credentials: 'include' to send cookies
fetch(url, {
  headers: createAuthHeaders(),
  credentials: 'include',  // Send HttpOnly session cookies
});
```

**Important**:
- ✅ User authentication token is in an HttpOnly cookie (not accessible to JavaScript)
- ✅ Console proxy automatically extracts it and adds `X-Forwarded-Access-Token` header
- ✅ Frontend only needs to include CSRF token for write operations (PUT/POST/DELETE)
- ❌ Frontend does NOT manually extract or send authentication tokens

#### 2. OpenShift Console Proxy

**Configuration**: `charts/openshift-console-plugin/values.yaml`

```yaml
plugin:
  backstage:
    enabled: true
    serviceName: backstage
    namespace: backstage
    port: 7443  # HTTPS port with TLS sidecar
    # UserToken: Console proxy forwards user's auth token as X-Forwarded-Access-Token
    authorization: UserToken
```

**What it does**:
1. Extracts user's authentication token from HttpOnly session cookie
2. Adds `X-Forwarded-Access-Token: <token>` header to all requests
3. Validates CSRF token for write operations (PUT/POST/DELETE)
   - Compares `X-CSRFToken` header with `csrf-token` cookie
   - Returns `403 Forbidden` if mismatch or missing
4. Forwards requests to backend service (backstage.backstage.svc:7443)

#### 3. nginx TLS Sidecar

**Configuration**: `deployment/backstage-deployment-sqlite.yaml`

The nginx sidecar MUST forward authentication headers to the Backstage backend:

```nginx
location / {
  proxy_pass http://127.0.0.1:7007;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto https;
  
  # CRITICAL: Forward authentication headers
  proxy_set_header X-Forwarded-Access-Token $http_x_forwarded_access_token;
  proxy_set_header Authorization $http_authorization;
  
  proxy_read_timeout 120s;
  proxy_connect_timeout 30s;
}
```

**Why this is required**:
- Without these headers, the backend receives no authentication information
- `$http_x_forwarded_access_token` maps to incoming `X-Forwarded-Access-Token` header
- `$http_authorization` maps to incoming `Authorization` header
- Nginx drops unknown headers by default, so we must explicitly forward them

**Common Issue**: If you deploy Backstage without these headers, write operations will fail with `401 Unauthorized` or `403 Forbidden`.

#### 4. MCP Entity API (Backend)

**Location**: `backstage-app/packages/backend/src/plugins/mcp-entity-api/auth.ts`

```typescript
// Extract token from headers
const token = 
  req.headers['x-forwarded-access-token'] ||  // From console proxy
  req.headers['authorization']?.replace('Bearer ', '');  // Direct API access

// Validate token and check permissions
const hasPermission = await validateOCPToken(token, entityType, operation);
if (!hasPermission) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

**RBAC Rules** (configured in `deployment/mcp-rbac.yaml`):

| Role | MCP Servers | MCP Tools | MCP Workloads |
|------|-------------|-----------|---------------|
| `mcp-admin` | Full CRUD | Full CRUD | Read-only |
| `mcp-user` | Read-only | Read-only | Full CRUD |
| `mcp-viewer` | Read-only | Read-only | Read-only |

### CSRF Protection

**Purpose**: Prevent Cross-Site Request Forgery attacks

**How it works**:
1. OpenShift Console sets a `csrf-token` cookie (HttpOnly, Secure, SameSite)
2. Frontend extracts the token and includes it as `X-CSRFToken` header
3. Console proxy validates: header value must match cookie value
4. If mismatch or missing: `403 Forbidden` with "invalid CSRFToken" error

**Frontend Implementation**:
```typescript
// Extract from cookie
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('csrf-token='))
  ?.split('=')[1];

// Include in request headers (write operations only)
headers['X-CSRFToken'] = csrfToken;
```

**When it's required**:
- ✅ PUT, POST, DELETE requests
- ❌ GET requests (not required)

### Testing Authentication

#### Test with curl (Direct Access)
```bash
# Get your OpenShift token
TOKEN=$(oc whoami -t)

# Get Backstage route
BACKSTAGE_URL=$(oc get route backstage -n backstage -o jsonpath='{.spec.host}')

# Test read (no auth required)
curl -k "https://${BACKSTAGE_URL}/api/mcp-entity-api/servers"

# Test write (requires auth + RBAC)
curl -k -X POST "https://${BACKSTAGE_URL}/api/mcp-entity-api/servers" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {"name": "test-server", "namespace": "default"},
    "spec": {
      "lifecycle": "experimental",
      "owner": "user:default/admin",
      "mcp": {
        "connectionType": "stdio",
        "command": "node server.js",
        "version": "1.0.0"
      }
    }
  }'
```

#### Test via Console Plugin

1. Open OpenShift Console → MCP Catalog
2. Navigate to a server detail page
3. Try to disable a tool
4. Expected result:
   - ✅ If you have `mcp-admin` role: Tool disabled successfully
   - ❌ If you lack `mcp-admin`: `403 Forbidden` error

### Troubleshooting Authentication

**Error: "401 Unauthorized"**
- Cause: No authentication token provided
- Check: nginx sidecar forwards `X-Forwarded-Access-Token` and `Authorization` headers
- Fix: Ensure nginx config includes `proxy_set_header` directives (see above)

**Error: "403 Forbidden" with "User lacks required role"**
- Cause: User authenticated but lacks MCP RBAC permissions
- Check: `oc auth can-i create mcpservers.mcp-catalog.io`
- Fix: Add user to appropriate ClusterRoleBinding (see RBAC section)

**Error: "403 Forbidden" with "invalid CSRFToken"**
- Cause: CSRF token mismatch or missing
- Check: Browser console for `X-CSRFToken` header in request
- Fix: Ensure frontend extracts `csrf-token` cookie and includes it in headers

**Error: "502 Bad Gateway"**
- Cause: nginx sidecar not running or misconfigured
- Check: `oc get pods -n backstage` (should show 2/2 Ready)
- Fix: Redeploy with `oc apply -f deployment/backstage-deployment-sqlite.yaml`

### Security Best Practices

1. **Never log tokens**: Tokens are sensitive credentials
2. **Use HTTPS only**: All communication encrypted via TLS
3. **HttpOnly cookies**: Prevents JavaScript access to session tokens
4. **CSRF protection**: Validates CSRF token for all write operations
5. **Least privilege**: Assign users minimal required roles
6. **Audit logs**: Monitor API access via Backstage backend logs

---

## 🚀 Part A: Build and Deploy the Console Plugin

### A1. One-Command Deployment (Recommended)

Use the unified deployment script to build, push, deploy, and test in a single command:

```bash
# Full pipeline: build, push to registry, deploy to OpenShift, run sanity tests
./build-push-deploy-test.sh

# Common options:
./build-push-deploy-test.sh --skip-build    # Redeploy existing image
./build-push-deploy-test.sh --skip-tests    # Skip sanity tests after deployment
./build-push-deploy-test.sh --build-only    # Just build the container image
./build-push-deploy-test.sh --verbose       # Show detailed output

# Target specific components:
./build-push-deploy-test.sh --console-only   # Build/push/deploy console plugin only (default)
./build-push-deploy-test.sh --backstage-only # Build/push/deploy backstage only
```

**Configure your environment** by creating `.image-config.sh`:

```bash
IMAGE_REGISTRY="quay.io"
IMAGE_ORG="your-org"
CONSOLE_IMAGE_NAME="mcp-tools-catalog"
BACKSTAGE_IMAGE_NAME="backstage"
IMAGE_TAG="latest"
OPENSHIFT_NAMESPACE="mcp-tools-catalog"
DEPLOYMENT_NAME="mcp-catalog"
BACKSTAGE_NAMESPACE="backstage"
BACKSTAGE_DEPLOYMENT_NAME="backstage"
```

The script automatically:
- Builds the console plugin (or backstage if using --backstage-only)
- Pushes the container image to your registry
- Updates the OpenShift deployment and forces a rollout
- Restarts console pods for immediate effect
- Runs sanity tests to verify the deployment

### A2. Manual Build (Alternative)

If you prefer manual control over each step:

```bash
# Install dependencies and build
yarn install
yarn build

# Run tests (optional)
yarn test
```

### A3. Manual Container Build

**Option 1: Use the build script**

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

### A4. Manual Helm Deployment

```bash
# Create namespace
oc new-project mcp-tools-catalog

# Install the plugin
helm install mcp-catalog charts/openshift-console-plugin \
  --set plugin.image=quay.io/your-org/mcp-tools-catalog:latest \
  --set plugin.imagePullPolicy=Always \
  --namespace mcp-tools-catalog
```

### A6. Enable the Plugin

```bash
# Enable the plugin in OpenShift Console
oc patch consoles.operator.openshift.io cluster \
  --patch '{"spec":{"plugins":["mcp-catalog"]}}' \
  --type=merge
```

### A7. Verify Plugin Deployment

```bash
# Check pod status
oc get pods -n mcp-tools-catalog

# Check plugin registration
oc get consoleplugin mcp-catalog

# Verify plugin manifest is accessible
oc port-forward -n mcp-tools-catalog svc/mcp-catalog 9443:9443 &
curl -k https://localhost:9443/plugin-manifest.json
kill %1

# Or run the quick sanity check
./tests/sanity/quick-check.sh
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

### B5. Update Backstage Image (Optional)

If you need to rebuild and redeploy Backstage with code changes, use the unified script:

```bash
# Build, push, and deploy backstage only
./build-push-deploy-test.sh --backstage-only

# Skip tests for faster deployment
./build-push-deploy-test.sh --backstage-only --skip-tests

# Just rebuild without deploying
./build-push-deploy-test.sh --backstage-only --build-only
```

**Note**: Configure backstage image settings in `.image-config.sh`:
```bash
BACKSTAGE_IMAGE_NAME="backstage"
BACKSTAGE_NAMESPACE="backstage"
BACKSTAGE_DEPLOYMENT_NAME="backstage"
```

### B6. Add nginx TLS Sidecar (Required for Console Plugin)

The OpenShift console plugin proxy **requires HTTPS**. Add an nginx TLS-terminating sidecar:

```bash
# Annotate service for auto-generated TLS certificates
oc annotate service backstage -n backstage \
  service.beta.openshift.io/serving-cert-secret-name=backstage-tls --overwrite

# Patch deployment to add nginx TLS sidecar
oc patch deployment backstage -n backstage --type='strategic' -p='{
  "spec": {
    "template": {
      "spec": {
        "volumes": [
          {"name": "tls-certs", "secret": {"secretName": "backstage-tls"}}
        ],
        "containers": [
          {
            "name": "nginx-tls",
            "image": "registry.access.redhat.com/ubi9/nginx-122:latest",
            "command": ["/bin/sh", "-c"],
            "args": ["cat > /tmp/nginx.conf << EOF\nworker_processes auto;\nerror_log /dev/stderr;\npid /tmp/nginx.pid;\nevents { worker_connections 1024; }\nhttp {\n  access_log /dev/stdout;\n  client_body_temp_path /tmp/client_body;\n  proxy_temp_path /tmp/proxy;\n  fastcgi_temp_path /tmp/fastcgi;\n  uwsgi_temp_path /tmp/uwsgi;\n  scgi_temp_path /tmp/scgi;\n  server {\n    listen 7443 ssl;\n    ssl_certificate /etc/tls/tls.crt;\n    ssl_certificate_key /etc/tls/tls.key;\n    ssl_protocols TLSv1.2 TLSv1.3;\n    location / {\n      proxy_pass http://127.0.0.1:7007;\n      proxy_set_header Host \\$host;\n      proxy_set_header X-Real-IP \\$remote_addr;\n      proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;\n      proxy_set_header X-Forwarded-Proto https;\n      proxy_read_timeout 120s;\n      proxy_connect_timeout 30s;\n    }\n  }\n}\nEOF\nexec nginx -c /tmp/nginx.conf -g \"daemon off;\""],
            "ports": [{"containerPort": 7443, "name": "https"}],
            "volumeMounts": [
              {"name": "tls-certs", "mountPath": "/etc/tls", "readOnly": true}
            ],
            "resources": {
              "requests": {"cpu": "50m", "memory": "64Mi"},
              "limits": {"cpu": "100m", "memory": "128Mi"}
            }
          }
        ]
      }
    }
  }
}'
```

**Note:** The nginx sidecar:
- Listens on HTTPS port 7443 using OpenShift-generated certificates
- Proxies requests to Backstage on HTTP port 7007
- Uses Red Hat UBI9 nginx image (compliant with registry policies)

### B7. Create Backstage Service with HTTPS Port

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

### B8. Expose Backstage Route

```bash
oc expose svc/backstage --port=7007 -n backstage
oc patch route backstage -n backstage --type='merge' \
  -p='{"spec":{"tls":{"termination":"edge"}}}'
```

### B9. Update Console Plugin to Use HTTPS Port

```bash
oc patch consoleplugin mcp-catalog --type='json' -p='[
  {"op": "replace", "path": "/spec/proxy/0/endpoint/service/port", "value": 7443}
]'

# Restart console to apply changes
oc delete pods -n openshift-console -l app=console
```

---

## 🚀 Part B-Alt: Deploy Backstage with SQLite (PoC)

For Proof of Concept deployments, you can use SQLite instead of PostgreSQL. This simplifies deployment but **only supports single replica**.

### B-Alt-1. Create Namespace and Secrets

```bash
# Create namespace
oc new-project backstage

# Create GitHub token secret (for catalog integration)
oc create secret generic backstage-github-token \
  --from-literal=GITHUB_TOKEN=ghp_your_token_here \
  -n backstage

# Create GitHub config
oc apply -f deployment/backstage-github-config.yaml
```

### B-Alt-2. Deploy All Resources

Use the pre-configured deployment files:

```bash
# Create PVC for SQLite storage
oc apply -f deployment/backstage-sqlite-pvc.yaml

# Create ConfigMap from production config
oc create configmap backstage-app-config \
  --from-file=app-config.production.yaml=deployment/app-config.production.yaml \
  -n backstage

# Create Service (with both HTTP and HTTPS ports)
oc apply -f deployment/backstage-service.yaml

# Create Route (edge TLS termination)
oc apply -f deployment/backstage-route.yaml

# Deploy Backstage with nginx TLS sidecar
oc apply -f deployment/backstage-deployment-sqlite.yaml

# Wait for deployment
oc rollout status deployment/backstage -n backstage
```

### B-Alt-3. Verify Deployment

```bash
# Check pods (should show 2/2 Ready - backstage + nginx-tls)
oc get pods -n backstage -l app=backstage

# Test HTTP endpoint (via route)
curl -k https://backstage.apps.<your-cluster-domain>/api/mcp-entity-api/servers

# Test HTTPS endpoint (via nginx sidecar, from within pod)
oc exec -n backstage deploy/backstage -c nginx-tls -- \
  curl -k -s https://localhost:7443/api/mcp-entity-api/servers | jq '.totalCount'
```

### B-Alt-4. Update Console Plugin Proxy

```bash
oc patch consoleplugin mcp-catalog --type='json' -p='[
  {"op": "replace", "path": "/spec/proxy/0/endpoint/service/port", "value": 7443}
]'

# Restart console to apply changes
oc delete pods -n openshift-console -l app=console
```

### SQLite Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Backstage Pod (Single Replica)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐      ┌─────────────────────┐          │
│  │  backstage          │      │  nginx-tls          │          │
│  │  container          │◄────►│  sidecar            │          │
│  │  (HTTP :7007)       │      │  (HTTPS :7443)      │          │
│  └──────────┬──────────┘      └──────────┬──────────┘          │
│             │                            │                      │
│             ▼                            ▼                      │
│  ┌─────────────────────┐      ┌─────────────────────┐          │
│  │  SQLite Database    │      │  TLS Certs          │          │
│  │  (PVC mounted)      │      │  (auto-generated)   │          │
│  └─────────────────────┘      └─────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         ▲                              ▲
         │ HTTP (edge TLS)              │ HTTPS (passthrough)
         │                              │
    Route (7007)               ConsolePlugin Proxy (7443)
```

**Key Points:**
- Backstage serves HTTP on port 7007 (internal)
- nginx sidecar terminates TLS on port 7443 for console plugin
- Route uses edge TLS termination (external HTTPS → internal HTTP)
- SQLite database persisted on PVC (survives pod restarts)
- Single replica only (SQLite limitation)

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

## 🔐 Part E: Configure MCP RBAC (Entity Management API)

The MCP Entity Management API enforces role-based access control using OpenShift RBAC. This section configures the required ClusterRoles and CustomResourceDefinitions.

### E1. Customize RBAC Bindings

Before deploying, edit `deployment/mcp-rbac.yaml` to customize the ClusterRoleBindings for your environment:

```bash
# Open the file and customize the group/user names
vi deployment/mcp-rbac.yaml
```

**Key sections to customize:**

```yaml
# mcp-admins binding - change the group name to match your identity provider
subjects:
  - kind: Group
    name: mcp-admins  # CHANGE THIS to your admin group (e.g., 'platform-admins')

# mcp-users binding - change from system:authenticated if needed
subjects:
  - kind: Group
    name: system:authenticated  # Or change to a specific group like 'developers'
```

### E2. Deploy RBAC Resources

```bash
# Apply CRDs, ClusterRoles, and ClusterRoleBindings
oc apply -f deployment/mcp-rbac.yaml
```

This creates:
- **CustomResourceDefinitions**: `mcpservers`, `mcptools`, `mcpworkloads` in the `mcp-catalog.io` API group
- **ClusterRoles**: `mcp-admin`, `mcp-user`, `mcp-viewer`
- **ClusterRoleBindings**: `mcp-admins`, `mcp-users`, `mcp-viewers`

### E3. Role Permissions

| Role | MCP Servers | MCP Tools | MCP Workloads |
|------|-------------|-----------|---------------|
| `mcp-admin` | Full CRUD | Full CRUD | Read-only |
| `mcp-user` | Read-only | Read-only | Full CRUD |
| `mcp-viewer` | Read-only | Read-only | Read-only |

**Note**: Read operations via the API are public (no role required per FR-012).

### E4. Alternative: Create Bindings via CLI

If you prefer not to edit the YAML file, you can create bindings via CLI:

```bash
# First, apply only CRDs and ClusterRoles (skip the bindings in the file)
oc apply -f deployment/mcp-rbac.yaml -l app.kubernetes.io/component=rbac

# Then create bindings manually:

# Bind mcp-admin to a specific group
oc create clusterrolebinding mcp-admins \
  --clusterrole=mcp-admin \
  --group=your-admin-group

# Bind mcp-user to all authenticated users
oc create clusterrolebinding mcp-users \
  --clusterrole=mcp-user \
  --group=system:authenticated

# Bind to a specific user
oc create clusterrolebinding mcp-admin-john \
  --clusterrole=mcp-admin \
  --user=john@example.com
```

### E5. Verify RBAC Configuration

```bash
# Check ClusterRoles exist
oc get clusterrole | grep mcp

# Check ClusterRoleBindings exist
oc get clusterrolebinding | grep mcp

# Check CRDs exist
oc get crd | grep mcp-catalog.io

# Test authorization (replace with your user)
oc auth can-i create mcpservers.mcp-catalog.io --as=john@example.com

# Verify your current user's permissions
oc auth can-i create mcpservers.mcp-catalog.io
oc auth can-i create mcpworkloads.mcp-catalog.io
```

### E6. Test Entity Management API

```bash
# Get the Backstage route
BACKSTAGE_URL=$(oc get route backstage -n backstage -o jsonpath='{.spec.host}')

# Get your OCP token
TOKEN=$(oc whoami -t)

# List servers (no auth required)
curl -k "https://${BACKSTAGE_URL}/api/mcp-entity-api/servers"

# Create a server (requires mcp-admin role)
curl -k -X POST "https://${BACKSTAGE_URL}/api/mcp-entity-api/servers" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "name": "test-server",
      "namespace": "default",
      "title": "Test MCP Server"
    },
    "spec": {
      "lifecycle": "experimental",
      "owner": "user:default/admin",
      "mcp": {
        "connectionType": "stdio",
        "command": "node server.js",
        "version": "1.0.0"
      }
    }
  }'

# Create a workload (requires mcp-user role)
curl -k -X POST "https://${BACKSTAGE_URL}/api/mcp-entity-api/workloads" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "name": "test-workload",
      "namespace": "default"
    },
    "spec": {
      "lifecycle": "experimental",
      "owner": "user:default/admin"
    }
  }'
```

### E7. API Error Responses

| Status Code | Meaning |
|-------------|---------|
| 200/201 | Success |
| 400 | Validation error (check request body) |
| 401 | No authentication token provided |
| 403 | User lacks required role |
| 404 | Entity not found |
| 503 | OCP auth service unavailable (fail-closed) |

### E8. Automated RBAC Testing

The project includes an automated test script that validates RBAC enforcement end-to-end:

```bash
# Run RBAC tests (admin user)
./tests/sanity/test-rbac.sh

# Run with verbose output
./tests/sanity/test-rbac.sh --verbose

# For non-admin users, set BACKSTAGE_URL environment variable
export BACKSTAGE_URL=https://backstage.apps.your-cluster.example.com
./tests/sanity/test-rbac.sh

# Or pass it inline
BACKSTAGE_URL=https://backstage.apps.your-cluster.example.com ./tests/sanity/test-rbac.sh --verbose
```

**What the test script does:**

1. **Permission Check**: Uses `oc auth can-i` to verify your current user's permissions for MCP resources
2. **Role Detection**: Automatically detects if you have `mcp-admin` or `mcp-user` roles
3. **Public Read Tests**: Verifies GET endpoints work without authentication (200 OK)
4. **Unauthenticated Write Tests**: Verifies POST endpoints reject requests without tokens (401 Unauthorized)
5. **Authorized Write Tests**: Tests creating servers, tools, and workloads with proper authentication:
   - Expects `201 Created` if you have the required role
   - Expects `403 Forbidden` if you lack the required role
6. **Cascade Delete Tests**: Tests deletion behavior:
   - Deletes tool 1 (expects 204)
   - Deletes server (expects 204, cascades to tool 2)
   - Attempts to delete tool 2 (expects 404 if cascade deleted, or 403 if never created)
   - Deletes workload (expects 204 or 403 based on permissions)
7. **Cleanup**: Automatically deletes all test entities created during testing

**Test Output:**

The script provides color-coded output:
- ✅ **Green [PASS]**: Test passed
- ❌ **Red [FAIL]**: Test failed
- ⚠️ **Yellow [WARN]**: Warning message
- ℹ️ **Blue [INFO]**: Informational message
- 🔵 **Cyan [SKIP]**: Test skipped

**Example Output:**

```
═══════════════════════════════════════════════════════════════
  Step 2: Permission Check (oc auth can-i)
═══════════════════════════════════════════════════════════════

MCP Servers (mcpservers.mcp-catalog.io):
  ✓ can-i create mcpservers.mcp-catalog.io: yes
  ✓ can-i update mcpservers.mcp-catalog.io: yes
  ✓ can-i delete mcpservers.mcp-catalog.io: yes
  ✓ can-i get mcpservers.mcp-catalog.io: yes

  ✓ You have mcp-admin role (can manage servers and tools)
  ✓ You have mcp-user role (can manage workloads)

═══════════════════════════════════════════════════════════════
  Test Summary
═══════════════════════════════════════════════════════════════

  Passed:  11
  Failed:  0
  Skipped: 0

╔═══════════════════════════════════════════════════════════════╗
║  ALL TESTS PASSED                                             ║
╚═══════════════════════════════════════════════════════════════╝
```

**Options:**

- `--skip-cleanup`: Don't delete test entities after tests (useful for debugging)
- `--verbose` or `-v`: Show detailed output including response bodies
- `--help` or `-h`: Show usage information

**Troubleshooting:**

If tests fail with 503 errors, verify:
1. RBAC resources are deployed: `oc get clusterrole mcp-auth-delegator`
2. Backstage service account has permissions: `oc get clusterrolebinding backstage-auth-delegator`
3. Backstage pod has been restarted after RBAC deployment
4. Backstage container includes the latest RBAC code (check image tag)

If you're a non-admin user and get "Could not find Backstage route", set the `BACKSTAGE_URL` environment variable as shown above.

### E9. Quickstart Validation Testing

Validate all scenarios from the Entity Management API quickstart guide:

```bash
# Run quickstart validation (requires mcp-admin role)
BACKSTAGE_URL=https://backstage.apps.your-cluster.example.com ./tests/sanity/test-quickstart-validation.sh --verbose
```

**What it validates:**
- Create Server, Tool, and Workload entities
- List all entity types
- Get specific entity by name
- Update entity properties
- Delete entities (including cascade delete)

The script automatically checks for `mcp-admin` role and provides clear instructions if missing.

### E10. Performance, Security, and Visibility Testing

Validate non-functional requirements:

```bash
# Run performance, security, and visibility tests
BACKSTAGE_URL=https://backstage.apps.your-cluster.example.com ./tests/sanity/test-performance-security-visibility.sh --verbose
```

**What it validates:**
- **Performance (SC-001)**: p95 response time < 500ms (runs 50 requests)
- **Security (SC-002)**: 100% unauthorized requests blocked
- **Visibility (SC-003)**: Entities visible in catalog within 5 seconds

**Requirements:**
- Performance and security tests work with any authenticated user
- Visibility test requires `mcp-admin` role to create test entities

For detailed information, see [Performance, Security, and Visibility Testing](../TESTING.md#-performance-security-and-visibility-testing).

### Configuration Override

Role mappings can be customized in `app-config.yaml`:

```yaml
mcpEntityApi:
  roles:
    server: custom-admin-role    # Default: mcp-admin
    tool: custom-admin-role      # Default: mcp-admin
    workload: custom-user-role   # Default: mcp-user
```

---

## ✅ Verification

### Quick Verification (Recommended)

Run the automated sanity tests to verify the entire system:

```bash
# Quick health check (~30 seconds)
./tests/sanity/quick-check.sh

# Full diagnostic suite with detailed output
./tests/sanity/run-sanity-tests.sh --verbose

# RBAC validation (requires appropriate roles)
BACKSTAGE_URL=https://backstage.apps.your-cluster.example.com ./tests/sanity/test-rbac.sh --verbose

# Quickstart scenario validation (requires mcp-admin role)
BACKSTAGE_URL=https://backstage.apps.your-cluster.example.com ./tests/sanity/test-quickstart-validation.sh --verbose

# Performance, security, and visibility tests
BACKSTAGE_URL=https://backstage.apps.your-cluster.example.com ./tests/sanity/test-performance-security-visibility.sh --verbose
```

### Manual Verification

#### Verify Backstage Catalog

```bash
# Port-forward to Backstage
oc port-forward deployment/backstage -n backstage 7007:7007 &
sleep 3

# List all entities
curl -s http://localhost:7007/api/catalog/entities | jq '.[] | {kind, type: .spec.type, name: .metadata.name}'

# Stop port-forward
kill %1
```

#### Verify Console Plugin

1. Open OpenShift Console in your browser
2. Look for "MCP Catalog" in the left navigation
3. Navigate to `/mcp-catalog` to see the plugin
4. Verify servers, tools, and workloads appear

#### Check for Errors

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

**Option 1: Use the unified script (recommended)**

```bash
# Full update: build, push, deploy, test (console plugin)
./build-push-deploy-test.sh

# Update backstage only
./build-push-deploy-test.sh --backstage-only

# Skip tests for faster deployment
./build-push-deploy-test.sh --skip-tests

# Redeploy without rebuilding (uses existing image)
./build-push-deploy-test.sh --skip-build

# Update backstage without tests
./build-push-deploy-test.sh --backstage-only --skip-tests
```

**Option 2: Manual update**

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

### Health Checks

Run sanity tests to verify system health:

```bash
# Quick health check (~30 seconds)
./tests/sanity/quick-check.sh

# Full diagnostic suite
./tests/sanity/run-sanity-tests.sh --verbose
```

---

## 🔧 Troubleshooting

### Quick Diagnostics

Start by running the sanity test scripts to identify issues:

```bash
# Quick health check - identifies common problems
./tests/sanity/quick-check.sh

# Full diagnostic suite with detailed output
./tests/sanity/run-sanity-tests.sh --verbose
```

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

**Cause:** Console plugin proxy requires HTTPS, but either:
1. TLS sidecar is not deployed, or
2. ConsolePlugin is pointing to wrong port, or
3. Service doesn't expose HTTPS port 7443

**Solution:** Verify the TLS sidecar and configuration:

```bash
# Verify nginx-tls sidecar is running (should show 2/2 Ready)
oc get pods -n backstage -l app=backstage
# NAME                         READY   STATUS
# backstage-xxxxx              2/2     Running

# Verify both containers exist
oc get pods -n backstage -o jsonpath='{.items[*].spec.containers[*].name}'
# Should show: backstage nginx-tls

# Verify port 7443 is in service
oc get svc backstage -n backstage -o jsonpath='{.spec.ports[*].port}'
# Should include: 7007 7443

# Verify ConsolePlugin points to port 7443
oc get consoleplugin mcp-catalog -o jsonpath='{.spec.proxy[0].endpoint.service.port}'
# Should show: 7443

# Test HTTPS endpoint from within the cluster
oc exec -n backstage deploy/backstage -c nginx-tls -- \
  curl -k -s https://localhost:7443/api/mcp-entity-api/health
```

If any of these fail, redeploy using the SQLite deployment files:
```bash
oc apply -f deployment/backstage-service.yaml
oc apply -f deployment/backstage-deployment-sqlite.yaml
oc patch consoleplugin mcp-catalog --type='json' \
  -p='[{"op": "replace", "path": "/spec/proxy/0/endpoint/service/port", "value": 7443}]'
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
- [tests/sanity/README.md](tests/sanity/README.md) - Sanity test documentation
- [Backstage Documentation](https://backstage.io/docs)
