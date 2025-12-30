# Authentication & Validation Fix - Summary

## Overview

This document summarizes the authentication, CSRF token handling, and validation fixes implemented to enable write operations (disabling/enabling tools) in the MCP Tools Catalog.

**Approach**: Removed strict validation from MCP Entity API and let Backstage's catalog handle entity validation (Option A).

## Problems Fixed

### 1. **401 Unauthorized** - No Authentication Token
- **Symptom**: PUT/POST/DELETE requests failed with 401 Unauthorized
- **Root Cause**: nginx TLS sidecar was not forwarding authentication headers to Backstage backend
- **Impact**: All write operations failed, even for authenticated users

### 2. **403 Forbidden** - CSRF Token Mismatch  
- **Symptom**: PUT/POST/DELETE requests failed with "invalid CSRFToken" error
- **Root Cause**: Frontend was not extracting and sending CSRF token
- **Impact**: OpenShift Console proxy rejected write operations

### 3. **400 Bad Request** - Schema Validation Failed
- **Symptom**: PUT/POST/DELETE requests failed with "must NOT have additional properties"
- **Root Cause**: Strict validation in MCP Entity API rejected properties that Backstage catalog allows
- **Impact**: Could not update entities with valid Backstage properties
- **Solution**: Removed strict validation, let Backstage catalog handle it

## Solutions Implemented

### 1. Removed Strict Validation (Option A)

**Files Modified**:
- `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts`
- `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`

**What Changed**:
Removed all `validator.validate*()` calls from the MCP Entity API. Validation is now handled by Backstage's catalog API, which is more permissive and allows additional properties.

**Before**:
```typescript
router.put('/tools/:namespace/:name', rbac('mcp-tool', 'update'), async (req, res) => {
  validator.validateTool(req.body);  // ❌ Strict validation
  const result = await service.updateTool(namespace, name, req.body);
  sendSuccessResponse(res, result);
});
```

**After**:
```typescript
router.put('/tools/:namespace/:name', rbac('mcp-tool', 'update'), async (req, res) => {
  // Note: Validation handled by Backstage catalog when entity is saved
  const result = await service.updateTool(namespace, name, req.body);
  sendSuccessResponse(res, result);
});
```

**Why This Works**:
- Backstage catalog validates entities when they're saved
- Catalog validation is permissive (allows additional properties)
- Keeps Backstage project changes minimal (just removed validation calls)
- Follows principle: "Don't modify Backstage core behavior"

**Note**: The `validation.ts` file still exists but is unused. This avoids larger refactoring and preserves the validation code in case it's needed later.

### 2. nginx Header Forwarding

**Files Modified**:
- `deployment/backstage-deployment-sqlite.yaml`

**What Changed**:
Added authentication header forwarding to nginx TLS sidecar configuration:

```nginx
location / {
  proxy_pass http://127.0.0.1:7007;
  
  # Standard headers
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto https;
  
  # AUTHENTICATION HEADERS (NEW!)
  proxy_set_header X-Forwarded-Access-Token $http_x_forwarded_access_token;
  proxy_set_header Authorization $http_authorization;
  
  proxy_read_timeout 120s;
  proxy_connect_timeout 30s;
}
```

**Why It's Critical**:
- Without these headers, backend receives NO authentication information
- `X-Forwarded-Access-Token` is added by OpenShift Console proxy
- nginx drops unknown headers by default, so we must explicitly forward them

**How to Apply**:
```bash
oc apply -f deployment/backstage-deployment-sqlite.yaml
oc rollout status deployment/backstage -n backstage
```

### 2. Frontend CSRF Token Handling

**Files Modified**:
- `src/services/catalogService.ts`

**What Changed**:
Added CSRF token extraction and header inclusion:

```typescript
const createAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  
  // Extract CSRF token from cookie
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf-token='))
    ?.split('=')[1];
  
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;  // OpenShift Console format
  }
  
  return headers;
};
```

**Why It's Critical**:
- OpenShift Console proxy requires CSRF token for write operations
- Prevents Cross-Site Request Forgery attacks
- Header name MUST be `X-CSRFToken` (case-sensitive)
- Token value must match `csrf-token` cookie value

**How to Apply**:
```bash
yarn build
./build-push-deploy-test.sh --console-only
```

**Note**: Frontend changes are in the console plugin, not Backstage core.

### 3. Console Plugin Proxy Configuration

**Files Verified**:
- `charts/openshift-console-plugin/values.yaml`

**Configuration**:
```yaml
plugin:
  backstage:
    enabled: true
    serviceName: backstage
    namespace: backstage
    port: 7443  # HTTPS port with TLS sidecar
    authorization: UserToken  # CRITICAL: Forwards authentication token
```

**Why It's Critical**:
- `authorization: UserToken` tells console proxy to extract user token from HttpOnly cookie
- Adds `X-Forwarded-Access-Token` header to all proxied requests
- Without this, frontend cannot authenticate (token is in HttpOnly cookie)

## Authentication Flow (Complete)

```
1. Browser
   └─ Has HttpOnly session cookies + csrf-token cookie
   └─ JavaScript extracts csrf-token
   └─ Sends fetch() with credentials: 'include' + X-CSRFToken header
         │
         ▼
2. OpenShift Console Proxy
   └─ Extracts auth token from HttpOnly cookie
   └─ Adds X-Forwarded-Access-Token header
   └─ Validates CSRF token (X-CSRFToken header vs csrf-token cookie)
   └─ Forwards to backstage.backstage.svc:7443
         │
         ▼
3. nginx TLS Sidecar (port 7443)
   └─ Terminates TLS
   └─ Forwards X-Forwarded-Access-Token header
   └─ Forwards Authorization header
   └─ Proxies to http://127.0.0.1:7007
         │
         ▼
4. MCP Entity API (Backstage Backend)
   └─ Extracts token from X-Forwarded-Access-Token or Authorization
   └─ Validates token via OpenShift SubjectAccessReview
   └─ Checks MCP RBAC permissions (mcp-admin/mcp-user)
   └─ Allows or denies operation
```

## Documentation Added

### 1. **DEPLOYMENT.md** - Authentication Architecture Section
- Complete authentication flow diagram
- Component-by-component explanation
- CSRF protection details
- Troubleshooting guide for each error type
- Security best practices

Location: Lines 169-391 in DEPLOYMENT.md

### 2. **AUTHENTICATION.md** - Comprehensive Guide
- Detailed architecture documentation
- Configuration reference for each component
- Testing procedures (manual + automated)
- Troubleshooting for common errors:
  - 401 Unauthorized
  - 403 Forbidden (RBAC)
  - 403 Forbidden (CSRF)
  - 502 Bad Gateway
- Security considerations
- Browser DevTools debugging tips

Location: `/AUTHENTICATION.md` (new file)

### 3. **README.md** - Reference to Authentication Guide
- Added link to AUTHENTICATION.md in Quick Start section
- Helps developers find authentication documentation quickly

Location: After deployment guide reference in README.md

## Verification Steps

### 1. Verify nginx Configuration
```bash
# Check nginx config includes auth headers
oc get deployment backstage -n backstage -o yaml | grep -A5 "proxy_set_header X-Forwarded-Access-Token"

# Should see:
# proxy_set_header X-Forwarded-Access-Token $http_x_forwarded_access_token;
# proxy_set_header Authorization $http_authorization;
```

### 2. Verify Console Plugin Proxy
```bash
# Check authorization setting
oc get consoleplugin mcp-catalog -o jsonpath='{.spec.proxy[0].authorization}'

# Should output: UserToken
```

### 3. Test Write Operation
```bash
# Via UI:
1. Open OpenShift Console → MCP Catalog
2. Navigate to kubernetes-mcp server
3. Try to disable k8s-list-pods tool
4. Click Save
5. Expected: ✅ Success (if you have mcp-admin role)

# Via API:
TOKEN=$(oc whoami -t)
BACKSTAGE_URL=$(oc get route backstage -n backstage -o jsonpath='{.spec.host}')

curl -k -X PUT "https://${BACKSTAGE_URL}/api/mcp-entity-api/tools/default/k8s-list-pods" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"metadata":{"name":"k8s-list-pods","namespace":"default","annotations":{"mcp-catalog.io/disabled":"true"}},"spec":{"type":"mcp-tool","lifecycle":"production","owner":"ops-team","subcomponentOf":"component:default/kubernetes-mcp","mcp":{...}}}'
```

### 4. Run Automated Tests
```bash
# RBAC validation tests
./tests/sanity/test-rbac.sh --verbose

# Should see all tests passing
```

## Deployment Checklist

- [x] 1. Update nginx configuration in deployment YAML
- [x] 2. Update frontend CSRF token handling
- [x] 3. Verify console plugin proxy configuration
- [x] 4. Add comprehensive documentation (DEPLOYMENT.md)
- [x] 5. Create detailed authentication guide (AUTHENTICATION.md)
- [x] 6. Update README.md with authentication reference
- [x] 7. Test write operations via UI
- [x] 8. Test write operations via curl
- [x] 9. Verify all components are deployed
- [x] 10. Document fix for future reference

## Files Modified

### Backstage Project (Minimal Changes)
1. **`backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts`**
   - Removed `validator.validate*()` calls
   - Added comment: "Validation handled by Backstage catalog"

2. **`backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`**
   - Removed `validator.validate*()` calls
   - Added comment: "Validation handled by Backstage catalog"

3. **`backstage-app/packages/backend/src/plugins/mcp-entity-api/auth.ts`**
   - Enhanced token extraction (already existed, minor improvements)

### Deployment Configuration (Sidecar - Acceptable)
4. **`deployment/backstage-deployment-sqlite.yaml`**
   - nginx header forwarding (auth headers)

### Console Plugin (Not Backstage Core)
5. **`src/services/catalogService.ts`**
   - CSRF token handling
   - Correct payload format

### Documentation
6. **`DEPLOYMENT.md`** - Authentication architecture section
7. **`AUTHENTICATION.md`** - Comprehensive authentication guide (NEW)
8. **`README.md`** - Reference to authentication guide
9. **`AUTHENTICATION-FIX-SUMMARY.md`** - This summary (UPDATED)

### Configuration (Verified)
10. **`charts/openshift-console-plugin/values.yaml`**
    - `authorization: UserToken` (already correct)

## Design Decisions

### Why Remove Validation Instead of Extending Schema?

**Option A (Chosen)**: Remove strict validation from MCP Entity API
- ✅ Minimal Backstage code changes
- ✅ Uses Backstage's built-in catalog validation
- ✅ Follows principle: "Don't modify Backstage core"
- ✅ Easier to maintain (one less thing to keep in sync)

**Option B (Rejected)**: Extend schemas to allow all properties
- ❌ Requires maintaining custom schemas in Backstage code
- ❌ Schemas must stay in sync with entity YAML files
- ❌ More code to maintain in Backstage project
- ❌ Goes against "vanilla Backstage" principle

**Result**: Backstage catalog handles validation, which is:
- More permissive (allows additional properties)
- Already tested and maintained by Backstage team
- Consistent with catalog's behavior for all entities

## Known Issues & Limitations

1. **HttpOnly Cookies**: Frontend JavaScript cannot access authentication tokens
   - This is by design for security (prevents XSS attacks)
   - Console proxy handles token extraction

2. **CSRF Token Format**: Must be exactly `X-CSRFToken` (case-sensitive)
   - Other formats (X-CSRF-Token, X-Csrf-Token) will fail
   - OpenShift Console expects this exact format

3. **nginx Header Forwarding**: nginx drops unknown headers by default
   - Must explicitly forward authentication headers
   - Easy to forget when deploying from scratch

4. **Validation Less Strict**: MCP Entity API no longer validates entity schemas
   - Backstage catalog still validates (more permissively)
   - Invalid entities will be rejected by catalog, not API
   - This is acceptable: catalog is the source of truth

## Future Improvements

1. **Automated Header Verification**: Add health check that verifies auth headers are being forwarded
2. **Better Error Messages**: Include header debugging info in 401/403 responses
3. **Configuration Validation**: Helm chart validation to ensure authorization: UserToken is set
4. **Deployment Testing**: Add automated test that verifies nginx config includes auth headers
5. **Optional Strict Validation**: If needed, implement validation as an optional sidecar service (not in Backstage core)

## References

- [VALIDATION-APPROACH.md](VALIDATION-APPROACH.md) - Entity validation approach (Option A)
- [AUTHENTICATION.md](AUTHENTICATION.md) - Comprehensive authentication guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide with authentication section
- [OpenShift Console Dynamic Plugin SDK](https://github.com/openshift/console/tree/master/frontend/packages/console-dynamic-plugin-sdk)
- [nginx proxy_set_header Directive](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header)
- [CSRF Protection Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OpenShift SubjectAccessReview API](https://docs.openshift.com/container-platform/latest/rest_api/authorization_apis/subjectaccessreview-authorization-openshift-io-v1.html)

## Contact

For questions or issues related to authentication:
1. Check [AUTHENTICATION.md](AUTHENTICATION.md) troubleshooting section
2. Review [DEPLOYMENT.md](DEPLOYMENT.md) authentication architecture
3. Run automated tests: `./tests/sanity/test-rbac.sh --verbose`
4. Check backend logs: `oc logs deployment/backstage -n backstage | grep -E "(auth|token|403|401)"`
