# MCP Tools Catalog - Sanity Test Plan

**Purpose**: Verify the health and correctness of the deployed MCP Tools Catalog system
**Execution**: Run from local environment against deployed OpenShift cluster
**Prerequisites**: `oc` CLI configured and logged in, `curl` and `jq` available

## Test Categories

### 1. Infrastructure Health Tests

| Test ID | Test Name | Description | Expected Result |
|---------|-----------|-------------|-----------------|
| INF-001 | Backstage Pod Health | Check Backstage deployment is running | All pods Ready |
| INF-002 | Plugin Pod Health | Check MCP Catalog plugin deployment | All pods Ready |
| INF-003 | Console Pod Health | Check OpenShift Console pods | All pods Ready |
| INF-004 | Service Endpoints | Verify services have endpoints | Endpoints exist |

### 2. Backstage Backend Tests

| Test ID | Test Name | Description | Expected Result |
|---------|-----------|-------------|-----------------|
| BST-001 | Backstage Health Endpoint | GET /api/health | 200 OK |
| BST-002 | Catalog API Available | GET /api/catalog/entities | 200 OK, JSON array |
| BST-003 | MCP Servers Exist | Filter entities by spec.type=mcp-server | At least 1 server |
| BST-004 | MCP Tools Exist | Filter entities by spec.type=mcp-tool | At least 1 tool |
| BST-005 | MCP Workloads Exist | Filter entities by spec.type=service/workflow | At least 1 workload |
| BST-006 | Entity Count | Count total entities | > 0 entities |

### 3. Entity Relationship Tests

| Test ID | Test Name | Description | Expected Result |
|---------|-----------|-------------|-----------------|
| REL-001 | Tool Has partOf Relation | Tools should have partOf relation to server | partOf relation present |
| REL-002 | Server Has hasPart Relation | Servers should have hasPart relation to tools | hasPart relation present |
| REL-003 | Tool subcomponentOf Set | Tools have spec.subcomponentOf field | Field is set |
| REL-004 | Workload dependsOn Set | Workloads have spec.dependsOn field | Field is set |
| REL-005 | Bidirectional Relations | partOf ↔ hasPart are consistent | Relations match |
| REL-006 | Relation Target Exists | Relation targets exist in catalog | All targets valid |

### 4. Plugin Service Tests

| Test ID | Test Name | Description | Expected Result |
|---------|-----------|-------------|-----------------|
| PLG-001 | Plugin Manifest | GET /plugin-manifest.json | Valid JSON, name=mcp-catalog |
| PLG-002 | Plugin Entry Script | GET plugin entry JS file | 200 OK |
| PLG-003 | Locale File | GET /locales/en/plugin__mcp-catalog.json | 200 OK |
| PLG-004 | NGINX Health | Plugin responds to requests | No 5xx errors |

### 5. Console Integration Tests

| Test ID | Test Name | Description | Expected Result |
|---------|-----------|-------------|-----------------|
| CON-001 | Plugin Registered | Check consoles.operator.openshift.io | mcp-catalog in spec.plugins |
| CON-002 | ConsolePlugin CR | Check ConsolePlugin resource exists | CR present |
| CON-003 | Proxy Endpoint | Console can reach plugin service | Proxy configured |

### 6. Data Integrity Tests

| Test ID | Test Name | Description | Expected Result |
|---------|-----------|-------------|-----------------|
| DAT-001 | Server Schema Valid | MCP servers have required fields | All fields present |
| DAT-002 | Tool Schema Valid | MCP tools have required fields | All fields present |
| DAT-003 | Workload Schema Valid | Workloads have required fields | All fields present |
| DAT-004 | No Orphan Tools | All tools reference existing servers | No orphans |
| DAT-005 | No Orphan Workloads | All workload tool refs exist | No orphans |

## Test Execution Order

1. **Infrastructure Health** (INF-*) - Must pass before continuing
2. **Backstage Backend** (BST-*) - Verify backend connectivity
3. **Entity Relationship** (REL-*) - Verify data model
4. **Plugin Service** (PLG-*) - Verify plugin deployment
5. **Console Integration** (CON-*) - Verify console integration
6. **Data Integrity** (DAT-*) - Verify data quality

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 1 | Infrastructure tests failed |
| 2 | Backend tests failed |
| 3 | Relationship tests failed |
| 4 | Plugin tests failed |
| 5 | Console tests failed |
| 6 | Data integrity tests failed |

## Output Format

The test script will output:
- Summary header with timestamp and cluster info
- Per-test results with ✅ PASS or ❌ FAIL
- Details on failures
- Final summary with pass/fail counts
- Overall status

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BACKSTAGE_NAMESPACE` | Backstage deployment namespace | `backstage` |
| `PLUGIN_NAMESPACE` | Plugin deployment namespace | `mcp-tools-catalog` |
| `BACKSTAGE_PORT` | Local port for port-forward | `7007` |
| `PLUGIN_PORT` | Local port for port-forward | `9443` |
| `VERBOSE` | Show detailed output | `false` |
