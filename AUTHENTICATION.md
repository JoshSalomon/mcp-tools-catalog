# MCP Tools Catalog - Authentication & Authorization Guide

## Overview

This document provides detailed information about authentication and authorization in the MCP Tools Catalog, including architecture, configuration, and troubleshooting.

## Table of Contents

1. [Architecture](#architecture)
2. [Configuration](#configuration)
3. [Component Details](#component-details)
4. [Testing](#testing)
5. [Troubleshooting](#troubleshooting)
6. [Security Considerations](#security-considerations)

---

## Architecture

### Complete Authentication Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                 Authentication & Authorization Flow              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User Browser                                                 │
│     └─ Session cookies (HttpOnly, Secure, SameSite)             │
│     └─ csrf-token cookie                                         │
│     └─ JavaScript: fetch() with credentials: 'include'           │
│           │                                                      │
│           │ All cookies sent automatically                       │
│           ▼                                                      │
│                                                                  │
│  2. OpenShift Console (frontend)                                │
│     └─ Dynamic plugin loaded in console                         │
│     └─ JavaScript extracts csrf-token from cookie               │
│     └─ Adds X-CSRFToken header to write requests                │
│           │                                                      │
│           │ fetch('/api/proxy/plugin/mcp-catalog/backstage/...' │
│           ▼                                                      │
│                                                                  │
│  3. OpenShift Console Proxy                                     │
│     ├─ Extracts auth token from HttpOnly cookie                 │
│     ├─ Adds X-Forwarded-Access-Token: <token>                   │
│     ├─ Validates CSRF token (for PUT/POST/DELETE)               │
│     │  ├─ Compares X-CSRFToken header vs csrf-token cookie      │
│     │  └─ Returns 403 if mismatch                               │
│     └─ Proxies to backend: backstage.backstage.svc:7443         │
│           │                                                      │
│           │ HTTPS with X-Forwarded-Access-Token header           │
│           ▼                                                      │
│                                                                  │
│  4. nginx TLS Sidecar (port 7443)                               │
│     ├─ Terminates TLS                                           │
│     ├─ Forwards X-Forwarded-Access-Token header                 │
│     ├─ Forwards Authorization header                            │
│     └─ Proxies to http://127.0.0.1:7007                         │
│           │                                                      │
│           │ HTTP with auth headers                               │
│           ▼                                                      │
│                                                                  │
│  5. Backstage Backend (port 7007)                               │
│     └─ MCP Entity API plugin                                    │
│        ├─ Extracts token from headers                           │
│        ├─ Validates via OpenShift SubjectAccessReview           │
│        ├─ Checks MCP RBAC permissions                           │
│        └─ Allows/denies operation                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Read vs Write Operations

| Operation | Authentication Required | CSRF Token Required | RBAC Check |
|-----------|------------------------|---------------------|------------|
| GET (list/read) | ❌ No | ❌ No | ❌ No |
| POST (create) | ✅ Yes | ✅ Yes | ✅ Yes |
| PUT (update) | ✅ Yes | ✅ Yes | ✅ Yes |
| DELETE (delete) | ✅ Yes | ✅ Yes | ✅ Yes |

**Design Rationale**:
- Read operations are public (FR-012) to enable discovery and browsing
- Write operations require authentication + authorization for security
- CSRF protection prevents cross-site attacks on write operations

---

## Configuration

### 1. Console Plugin Proxy

**File**: `charts/openshift-console-plugin/values.yaml`

```yaml
plugin:
  backstage:
    enabled: true
    serviceName: backstage
    namespace: backstage
    port: 7443
    authorization: UserToken  # CRITICAL: Forwards X-Forwarded-Access-Token
```

**What `authorization: UserToken` does**:
1. Extracts user's authentication token from HttpOnly session cookie
2. Adds `X-Forwarded-Access-Token` header to all proxied requests
3. Backend receives the token without frontend JavaScript involvement

**Alternatives** (NOT used):
- `None`: No token forwarding (write operations would fail)
- `Bearer`: Expects token in `Authorization` header (not available in HttpOnly cookie)

### 2. nginx TLS Sidecar

**File**: `deployment/backstage-deployment-sqlite.yaml`

**Critical Configuration**:
```nginx
location / {
  proxy_pass http://127.0.0.1:7007;
  
  # Standard proxy headers
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto https;
  
  # AUTHENTICATION HEADERS (REQUIRED!)
  proxy_set_header X-Forwarded-Access-Token $http_x_forwarded_access_token;
  proxy_set_header Authorization $http_authorization;
  
  proxy_read_timeout 120s;
  proxy_connect_timeout 30s;
}
```

**Why these headers are required**:
- `X-Forwarded-Access-Token`: Primary authentication header from console proxy
- `Authorization`: Fallback for direct API access (e.g., curl)
- Without these, backend receives NO authentication information

**How nginx variable mapping works**:
- `$http_x_forwarded_access_token` → incoming `X-Forwarded-Access-Token` header
- `$http_authorization` → incoming `Authorization` header
- nginx drops unknown headers by default, so we must explicitly forward them

### 3. Frontend CSRF Handling

**File**: `src/services/catalogService.ts`

```typescript
const createAuthHeaders = (additionalHeaders = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...additionalHeaders,
  };
  
  // Extract CSRF token from cookie
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf-token='))
    ?.split('=')[1];
  
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;  // OpenShift console format
  }
  
  return headers;
};

// Usage
fetch(url, {
  method: 'PUT',
  headers: createAuthHeaders(),
  credentials: 'include',  // Send HttpOnly cookies
  body: JSON.stringify(payload),
});
```

**Important**:
- ✅ Frontend extracts CSRF token from cookie
- ✅ Frontend includes it as `X-CSRFToken` header (write operations only)
- ❌ Frontend does NOT handle authentication tokens (HttpOnly prevents access)
- ✅ Console proxy handles authentication token extraction and forwarding

### 4. Backend Token Validation

**File**: `backstage-app/packages/backend/src/plugins/mcp-entity-api/auth.ts`

```typescript
// Token extraction
function extractOCPToken(req: Request): string | null {
  return (
    req.headers['x-forwarded-access-token'] ||  // From console proxy
    req.headers['authorization']?.replace('Bearer ', '') ||  // Direct API
    null
  );
}

// RBAC middleware
function createRBACMiddleware(entityType: string, operation: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = extractOCPToken(req);
    
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }
    
    const hasPermission = await validateOCPToken(token, entityType, operation);
    
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'User lacks required role',
      });
    }
    
    next();
  };
}
```

### 5. RBAC Configuration

**File**: `deployment/mcp-rbac.yaml`

Creates CustomResourceDefinitions and RBAC rules:

```yaml
# ClusterRoles
- mcp-admin: Full CRUD on servers/tools, read-only on workloads
- mcp-user: Read-only on servers/tools, full CRUD on workloads
- mcp-viewer: Read-only on all entities

# ClusterRoleBindings
- mcp-admins: Bind mcp-admin to admin group
- mcp-users: Bind mcp-user to authenticated users
- mcp-viewers: Bind mcp-viewer to viewer group
```

**Customize for your organization**:
```bash
# Edit the bindings before deploying
vi deployment/mcp-rbac.yaml

# Change group names to match your identity provider
subjects:
  - kind: Group
    name: platform-admins  # Change this
    apiGroup: rbac.authorization.k8s.io
```

---

## Component Details

### Frontend (Console Plugin)

**Responsibilities**:
- Extract `csrf-token` cookie
- Include `X-CSRFToken` header for write operations
- Use `credentials: 'include'` to send HttpOnly cookies
- Display error messages for 401/403 responses

**Does NOT**:
- Extract or handle authentication tokens (HttpOnly prevents access)
- Implement token refresh logic (console handles this)
- Validate tokens (backend responsibility)

### OpenShift Console Proxy

**Responsibilities**:
- Extract user authentication token from HttpOnly session cookie
- Add `X-Forwarded-Access-Token` header to all proxied requests
- Validate CSRF token for write operations
- Proxy requests to backend service

**Configuration**:
- ConsolePlugin CR defines proxy endpoints
- `authorization: UserToken` enables token forwarding
- Automatic CSRF validation (no configuration needed)

### nginx TLS Sidecar

**Responsibilities**:
- Terminate TLS (using OpenShift Service Serving Certificates)
- Forward authentication headers to Backstage
- Proxy requests from HTTPS (7443) to HTTP (7007)

**Critical Headers**:
```nginx
proxy_set_header X-Forwarded-Access-Token $http_x_forwarded_access_token;
proxy_set_header Authorization $http_authorization;
```

**Why it's needed**:
- OpenShift Console Plugin proxy requires HTTPS endpoints
- Backstage backend serves HTTP only
- nginx provides TLS termination without modifying Backstage

### MCP Entity API (Backend)

**Responsibilities**:
- Extract tokens from headers
- Validate tokens via OpenShift SubjectAccessReview API
- Check MCP RBAC permissions
- Allow or deny operations

**Token Sources** (in order of precedence):
1. `X-Forwarded-Access-Token` header (from console proxy)
2. `Authorization: Bearer <token>` header (direct API access)

**RBAC Validation**:
```bash
# Example SubjectAccessReview check
oc create --raw /apis/authorization.k8s.io/v1/subjectaccessreviews \
  -H "Authorization: Bearer ${TOKEN}" \
  --data '{
    "apiVersion": "authorization.k8s.io/v1",
    "kind": "SubjectAccessReview",
    "spec": {
      "resourceAttributes": {
        "group": "mcp-catalog.io",
        "resource": "mcpservers",
        "verb": "create"
      }
    }
  }'
```

---

## Testing

### 1. Manual Testing via Console UI

```bash
# Prerequisites
1. Deploy all components (see DEPLOYMENT.md)
2. Ensure you have appropriate RBAC role

# Test Steps
1. Open OpenShift Console → MCP Catalog
2. Navigate to a server (e.g., kubernetes-mcp)
3. Try to disable a tool
4. Expected results:
   - ✅ mcp-admin: Success
   - ❌ No role: 403 Forbidden
```

### 2. Automated RBAC Tests

```bash
# Run comprehensive RBAC test suite
./tests/sanity/test-rbac.sh --verbose

# Test specific scenarios
BACKSTAGE_URL=https://backstage.apps.your-cluster.example.com \
  ./tests/sanity/test-rbac.sh --verbose
```

### 3. Direct API Testing with curl

**Get your token**:
```bash
TOKEN=$(oc whoami -t)
BACKSTAGE_URL=$(oc get route backstage -n backstage -o jsonpath='{.spec.host}')
```

**Test read (no auth required)**:
```bash
curl -k "https://${BACKSTAGE_URL}/api/mcp-entity-api/servers"
```

**Test write (requires auth)**:
```bash
curl -k -X POST "https://${BACKSTAGE_URL}/api/mcp-entity-api/servers" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "name": "test-server",
      "namespace": "default"
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
```

**Expected responses**:
- `201 Created`: Success (you have mcp-admin role)
- `401 Unauthorized`: No token provided
- `403 Forbidden`: Token valid but user lacks mcp-admin role

### 4. Browser DevTools Debugging

**Check authentication flow**:
1. Open Browser DevTools → Network tab
2. Filter by "mcp" or "backstage"
3. Find a PUT/POST request
4. Inspect headers:
   - Request should include `X-CSRFToken`
   - Request should include `Cookie` (credentials: 'include')
   - Response should be 200/201 (success) or 403 (no permissions)

**Common issues**:
- Missing `X-CSRFToken` header → CSRF token not extracted
- `403 Forbidden` → User lacks required RBAC role
- `502 Bad Gateway` → nginx sidecar not forwarding auth headers

---

## Troubleshooting

### Error: "401 Unauthorized"

**Symptoms**:
- API returns `401 Unauthorized`
- Error message: "No authentication token provided"

**Causes**:
1. nginx sidecar not forwarding authentication headers
2. Console proxy not adding `X-Forwarded-Access-Token` header
3. Console plugin proxy misconfigured

**Diagnosis**:
```bash
# Check nginx config includes auth headers
oc get deployment backstage -n backstage -o yaml | grep -A5 proxy_set_header

# Check console plugin proxy config
oc get consoleplugin mcp-catalog -o yaml | grep -A5 authorization

# Check if token is being sent
# (In browser DevTools → Network → Request Headers)
```

**Fix**:
```bash
# Option 1: Redeploy with correct nginx config
oc apply -f deployment/backstage-deployment-sqlite.yaml
oc rollout status deployment/backstage -n backstage

# Option 2: Patch existing deployment
oc patch deployment backstage -n backstage --type='json' -p='[
  {
    "op": "replace",
    "path": "/spec/template/spec/containers/1/args/0",
    "value": "cat > /tmp/nginx.conf << '\''NGINXCONF'\''\n...[full config with auth headers]...\nNGINXCONF\nexec nginx -c /tmp/nginx.conf -g '\''daemon off;'\''"
  }
]'
```

### Error: "403 Forbidden" (RBAC)

**Symptoms**:
- API returns `403 Forbidden`
- Error message: "User lacks required role"

**Causes**:
- User authenticated but lacks MCP RBAC permissions
- ClusterRoleBindings not configured correctly

**Diagnosis**:
```bash
# Check your current permissions
oc auth can-i create mcpservers.mcp-catalog.io
oc auth can-i create mcpworkloads.mcp-catalog.io

# Check if ClusterRoles exist
oc get clusterrole | grep mcp

# Check if ClusterRoleBindings exist
oc get clusterrolebinding | grep mcp
```

**Fix**:
```bash
# Deploy RBAC resources
oc apply -f deployment/mcp-rbac.yaml

# Add user to mcp-admin role
oc create clusterrolebinding mcp-admin-myuser \
  --clusterrole=mcp-admin \
  --user=myuser@example.com

# Or add group
oc create clusterrolebinding mcp-admins \
  --clusterrole=mcp-admin \
  --group=platform-admins
```

### Error: "403 Forbidden" (CSRF)

**Symptoms**:
- API returns `403 Forbidden`
- Error message: "invalid CSRFToken: CSRF token does not match CSRF cookie"
- Happens only for PUT/POST/DELETE requests

**Causes**:
- Frontend not sending `X-CSRFToken` header
- CSRF token mismatch between cookie and header
- Token format incorrect

**Diagnosis**:
```bash
# Check browser DevTools → Network → Request Headers
# Should see:
X-CSRFToken: <token-value>
Cookie: csrf-token=<same-token-value>

# Check frontend code extracts token correctly
grep -A10 "csrf-token" src/services/catalogService.ts
```

**Fix**:
```bash
# Frontend fix: Ensure CSRF token extraction is correct
# File: src/services/catalogService.ts

const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('csrf-token='))
  ?.split('=')[1];

if (csrfToken) {
  headers['X-CSRFToken'] = csrfToken;  // Exact format required
}

# Rebuild and redeploy
yarn build
./build-push-deploy-test.sh --console-only
```

### Error: "502 Bad Gateway"

**Symptoms**:
- Console shows "502 Bad Gateway"
- Backstage logs show no requests arriving

**Causes**:
1. nginx TLS sidecar not running
2. nginx misconfigured
3. Service not exposing port 7443
4. ConsolePlugin pointing to wrong port

**Diagnosis**:
```bash
# Check nginx sidecar is running (should show 2/2 Ready)
oc get pods -n backstage -l app=backstage

# Check both containers exist
oc get pods -n backstage -o jsonpath='{.items[*].spec.containers[*].name}'

# Check service exposes port 7443
oc get svc backstage -n backstage -o jsonpath='{.spec.ports[*].port}'

# Check ConsolePlugin points to 7443
oc get consoleplugin mcp-catalog -o jsonpath='{.spec.proxy[0].endpoint.service.port}'

# Test HTTPS endpoint from within cluster
oc exec -n backstage deploy/backstage -c nginx-tls -- \
  curl -k -s https://localhost:7443/api/mcp-entity-api/health
```

**Fix**:
```bash
# Redeploy with correct configuration
oc apply -f deployment/backstage-service.yaml
oc apply -f deployment/backstage-deployment-sqlite.yaml

# Update ConsolePlugin to use port 7443
oc patch consoleplugin mcp-catalog --type='json' -p='[
  {"op": "replace", "path": "/spec/proxy/0/endpoint/service/port", "value": 7443}
]'

# Restart console
oc delete pods -n openshift-console -l app=console
```

### Debugging Tips

**Enable verbose logging**:
```bash
# Backend logs
oc logs -f deployment/backstage -n backstage | grep -E "(auth|token|rbac|403|401)"

# Frontend console logs
# Open browser DevTools → Console tab
# Look for authentication-related errors

# nginx sidecar logs
oc logs -f deployment/backstage -n backstage -c nginx-tls
```

**Test auth headers are being forwarded**:
```bash
# Add debug logging to nginx config
error_log /dev/stderr debug;

# Check headers in backend
# File: backstage-app/packages/backend/src/plugins/mcp-entity-api/auth.ts
logger.debug('Request headers:', {
  xForwardedAccessToken: req.headers['x-forwarded-access-token'],
  authorization: req.headers['authorization'],
});
```

---

## Security Considerations

### 1. Token Storage

**✅ Secure**:
- User authentication token stored in HttpOnly cookie
- JavaScript cannot access the token
- Prevents XSS attacks from stealing tokens

**❌ Insecure (NOT used)**:
- Storing token in localStorage
- Storing token in sessionStorage
- Exposing token to JavaScript

### 2. CSRF Protection

**Why it's needed**:
- Prevents malicious sites from making authenticated requests
- Validates request originates from trusted source

**How it works**:
1. Server sets `csrf-token` cookie (HttpOnly, Secure, SameSite)
2. Frontend reads cookie and includes value as `X-CSRFToken` header
3. Server validates: header value must match cookie value
4. Malicious site cannot read cookie (same-origin policy)

### 3. TLS Encryption

**All communication encrypted**:
- Browser → Console: HTTPS
- Console → Plugin: HTTPS (dynamic plugin loaded over HTTPS)
- Plugin → Backend: HTTPS via console proxy
- Console Proxy → Backend: HTTPS (nginx TLS sidecar)

**Certificate Management**:
- OpenShift Service Serving Certificates (automatic)
- No manual certificate generation or rotation
- Certificates auto-renewed before expiration

### 4. Least Privilege

**RBAC Roles**:
- `mcp-admin`: Only for platform administrators
- `mcp-user`: For application developers
- `mcp-viewer`: For read-only access

**Best Practices**:
- Assign minimum required role to each user
- Use group-based bindings (not individual users)
- Review ClusterRoleBindings regularly
- Audit API access via backend logs

### 5. Token Validation

**Every write operation validated**:
1. Extract token from headers
2. Validate token via OpenShift SubjectAccessReview API
3. Check MCP RBAC permissions
4. Deny if any step fails

**Fail-closed behavior**:
- If auth service unavailable: deny operation (503)
- If token invalid: deny operation (401)
- If permissions insufficient: deny operation (403)
- Better to deny legitimate request than allow malicious one

### 6. Audit Logging

**Log all authentication events**:
```bash
# View authentication logs
oc logs deployment/backstage -n backstage | grep -E "(auth|token|rbac|401|403)"

# Look for patterns:
# - Failed authentication attempts
# - Unauthorized access attempts
# - Suspicious activity patterns
```

**Recommended monitoring**:
- Alert on high rate of 401/403 errors
- Monitor for privilege escalation attempts
- Track successful write operations
- Review unusual access patterns

---

## Additional Resources

- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [RBAC Configuration](deployment/mcp-rbac.yaml) - RBAC resources
- [Test Scripts](tests/sanity/) - Automated testing
- [OpenShift Console Plugin SDK](https://github.com/openshift/console/tree/master/frontend/packages/console-dynamic-plugin-sdk) - SDK documentation
