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
