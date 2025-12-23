# MCP Tools Catalog - Sanity Tests

Sanity tests to verify the health and correctness of the deployed MCP Tools Catalog system.

## Quick Start

```bash
# Fast health check (< 30 seconds)
./quick-check.sh

# Full test suite
./run-sanity-tests.sh

# Full test suite with verbose output
./run-sanity-tests.sh --verbose
```

## Prerequisites

- `oc` CLI installed and logged into your OpenShift cluster
- `curl` available
- `jq` available (for JSON parsing)

## Test Scripts

### `quick-check.sh`

A fast (< 30 seconds) health check that verifies:
- OpenShift login
- Pod status (Backstage, Plugin, Console)
- Plugin registration
- Basic API connectivity

Use this for quick status checks.

### `run-sanity-tests.sh`

Comprehensive test suite covering:

| Category | Tests | Description |
|----------|-------|-------------|
| Infrastructure | INF-001 to INF-004 | Pod and service health |
| Backstage Backend | BST-001 to BST-006 | API and entity checks |
| Relationships | REL-001 to REL-006 | partOf/hasPart relations |
| Plugin Service | PLG-001 to PLG-004 | Manifest and assets |
| Console Integration | CON-001 to CON-003 | Plugin registration |
| Data Integrity | DAT-001 to DAT-005 | Schema and orphan checks |

### `test-rbac.sh`

Automated RBAC (Role-Based Access Control) integration test for the MCP Entity Management API.

**Usage:**
```bash
# Run RBAC tests (admin user)
./test-rbac.sh

# Run with verbose output
./test-rbac.sh --verbose

# For non-admin users, set BACKSTAGE_URL
export BACKSTAGE_URL=https://backstage.apps.your-cluster.example.com
./test-rbac.sh
```

**What it tests:**
- Permission detection via `oc auth can-i`
- Role-based authorization (mcp-admin, mcp-user)
- Public read access (no auth required)
- Unauthenticated write protection (401 errors)
- Cascade delete behavior (server deletion removes tools)
- Automatic cleanup of test entities

**Options:**
- `--skip-cleanup`: Don't delete test entities after tests
- `--verbose` or `-v`: Show detailed output
- `--help` or `-h`: Show usage information

For detailed information, see [RBAC Testing](../TESTING.md#-rbac-integration-testing) and [RBAC Deployment](../../DEPLOYMENT.md#-part-e-configure-mcp-rbac-entity-management-api).

### `test-quickstart-validation.sh`

Validates all scenarios from the Entity Management API quickstart guide.

**Usage:**
```bash
# Run quickstart validation (requires mcp-admin role)
./test-quickstart-validation.sh

# Run with verbose output
./test-quickstart-validation.sh --verbose

# For non-admin users, set BACKSTAGE_URL
export BACKSTAGE_URL=https://backstage.apps.your-cluster.example.com
./test-quickstart-validation.sh
```

**What it tests:**
- Create Server, Tool, and Workload entities
- List all entity types
- Get specific entity by name
- Update entity properties
- Delete entities (including cascade delete behavior)
- Validates response structures match expected format

**Options:**
- `--skip-cleanup`: Don't delete test entities after tests
- `--verbose` or `-v`: Show detailed output including response bodies
- `--help` or `-h`: Show usage information

**Note:** This script requires `mcp-admin` role and will exit early with clear instructions if the role is missing.

### `test-performance-security-visibility.sh`

Validates non-functional requirements: performance, security, and catalog visibility.

**Usage:**
```bash
# Run performance, security, and visibility tests
./test-performance-security-visibility.sh

# Run with verbose output
./test-performance-security-visibility.sh --verbose

# For non-admin users, set BACKSTAGE_URL
export BACKSTAGE_URL=https://backstage.apps.your-cluster.example.com
./test-performance-security-visibility.sh
```

**What it tests:**
- **Performance (SC-001)**: Measures p50, p95, p99 response times for 50 requests, verifies p95 < 500ms
- **Security (SC-002)**: Tests unauthorized requests (no token, invalid token) and verifies 100% are blocked
- **Visibility (SC-003)**: Creates entity and verifies it appears in catalog list within 5 seconds

**Options:**
- `--verbose` or `-v`: Show detailed output including individual request timings
- `--help` or `-h`: Show usage information

**Note:** The visibility test requires `mcp-admin` role to create test entities. Performance and security tests work with any authenticated user.

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `BACKSTAGE_NAMESPACE` | Backstage deployment namespace | `backstage` |
| `PLUGIN_NAMESPACE` | Plugin deployment namespace | `mcp-tools-catalog` |
| `BACKSTAGE_PORT` | Local port for Backstage port-forward | `7007` |
| `PLUGIN_PORT` | Local port for plugin port-forward | `9443` |
| `VERBOSE` | Show detailed output | `false` |

Example:
```bash
BACKSTAGE_NAMESPACE=my-backstage VERBOSE=true ./run-sanity-tests.sh
```

## Output

### Quick Check
```
MCP Tools Catalog - Quick Health Check
========================================

1. OpenShift login... OK
2. Backstage pods... OK (2 running)
3. Plugin pods... OK (2 running)
4. Console pods... OK (2 running)
5. Plugin registered... OK
6. ConsolePlugin CR... OK
7. Backstage API... OK (6 entities)

========================================
✅ System appears healthy
```

### Full Test Suite
```
════════════════════════════════════════════════════════════
  MCP Tools Catalog - Sanity Test Suite
════════════════════════════════════════════════════════════

  Timestamp: 2025-12-16 15:30:00
  Cluster:   https://api.example.com:6443
  User:      admin
  Verbose:   false

── Checking Prerequisites ──
  [PRE-001] oc CLI available ... ✅ PASS
  [PRE-002] oc logged in ... ✅ PASS
  ...

── Test Summary ──

  Passed:  25
  Failed:  0
  Skipped: 2
  Total:   27

══════════════════════════════════════════════════════════════
  ✅ ALL TESTS PASSED - System is healthy
══════════════════════════════════════════════════════════════
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed (or only skipped) |
| 1 | One or more tests failed |

## Troubleshooting

### Port forward fails
```
Could not establish port forward
```
- Check that the service exists: `oc get svc -n backstage`
- Check that pods are running: `oc get pods -n backstage`
- Try manually: `oc port-forward -n backstage svc/backstage 7007:7007`

### No entities found
```
No MCP servers found
```
- Check Backstage logs: `oc logs deployment/backstage -n backstage`
- Verify GitHub sync is configured
- Manually trigger refresh: `oc rollout restart deployment/backstage -n backstage`

### Plugin not registered
```
mcp-catalog not in spec.plugins
```
- Re-enable the plugin:
  ```bash
  oc patch consoles.operator.openshift.io cluster \
    --type=json \
    -p='[{"op": "add", "path": "/spec/plugins", "value": ["mcp-catalog"]}]'
  ```
- Restart console: `oc delete pods -n openshift-console -l app=console`

### Relations missing
```
Tool has no partOf relation
```
- Verify entities use `subcomponentOf` field
- Restart Backstage to regenerate relations
- Check entity YAML format matches data model

## See Also

- [TEST-PLAN.md](./TEST-PLAN.md) - Detailed test specifications
- [DEPLOYMENT.md](../../DEPLOYMENT.md) - Deployment guide
- [data-model.md](../../specs/001-mcp-tools-catalog/data-model.md) - Entity relationships
