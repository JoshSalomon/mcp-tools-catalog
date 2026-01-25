# Quickstart: Server Tools View Consolidation

**Feature Branch**: `007-server-tools-view`
**Created**: 2026-01-08

## Prerequisites

- Backstage backend running with mcp-entity-api plugin
- OpenShift Console with MCP Catalog plugin deployed
- At least one MCP Server with associated tools in the catalog
- mcp-admin role for testing alternative description editing

## Feature Validation Steps

### US1: Browse Tools Within Servers (P1)

#### 1.1 Expand Server to View Tools

```bash
# Navigate to MCP Catalog → Servers tab
# Click the expand control (▶) on any server row
# Expected: Tools belonging to that server are displayed
```

**Verify**:
- [ ] Expand control appears on each server row
- [ ] Clicking expand shows tools in alphabetical order (A-Z)
- [ ] Each tool displays: name (as link), description, disabled status
- [ ] Namespace, type, and server columns are NOT shown (redundant)
- [ ] Clicking tool name navigates to tool detail page

#### 1.2 Collapse Server Tools

```bash
# With a server expanded, click the expand control again
# Expected: Tools list collapses
```

**Verify**:
- [ ] Tools list collapses when clicking expand control again
- [ ] Only server row is visible after collapse

#### 1.3 Empty Server (No Tools)

```bash
# Find or create a server with no tools
# Expand that server
# Expected: "No tools available for this server" message
```

**Verify**:
- [ ] Empty state message displays for servers without tools

### US2: Edit Alternative Tool Description (P2)

#### 2.1 Backend API Test

```bash
# Set alternative description
curl -X PUT "${API_URL}/tools/default/my-tool/alternative-description" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{"alternativeDescription": "Custom description for this tool"}'

# Expected: 200 OK with updated tool entity
```

**Verify**:
- [ ] Response includes `alternativeDescription` field
- [ ] GET /tools/default/my-tool now returns the alternative description

#### 2.2 Clear Alternative Description

```bash
# Clear alternative description
curl -X PUT "${API_URL}/tools/default/my-tool/alternative-description" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{"alternativeDescription": ""}'

# Expected: 200 OK, alternativeDescription is null/empty
```

**Verify**:
- [ ] Tool now shows original catalog description

#### 2.3 Validation - Max Length

```bash
# Try to set description exceeding 2000 characters
LONG_DESC=$(python3 -c "print('x' * 2001)")
curl -X PUT "${API_URL}/tools/default/my-tool/alternative-description" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d "{\"alternativeDescription\": \"${LONG_DESC}\"}"

# Expected: 400 Bad Request with validation error
```

**Verify**:
- [ ] Returns 400 with error message about max length

#### 2.4 Authorization Check

```bash
# Try without mcp-admin role
curl -X PUT "${API_URL}/tools/default/my-tool/alternative-description" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -d '{"alternativeDescription": "Should fail"}'

# Expected: 403 Forbidden
```

**Verify**:
- [ ] Returns 403 for non-admin users

#### 2.5 UI Edit Test

```bash
# As mcp-admin:
# 1. Navigate to tool detail page
# 2. Find "Alternative Description" section
# 3. Click edit button
# 4. Enter new description
# 5. Click save
# Expected: Description updates, shows in all views
```

**Verify**:
- [ ] Edit button visible for mcp-admin users
- [ ] Edit button NOT visible for regular users
- [ ] Save persists the alternative description
- [ ] Alternative description shows in server tools list
- [ ] Error message shows inline on save failure (keeps text)

### US3: Remove Tools Navigation Elements (P3)

#### 3.1 Tools Tab Removed

```bash
# Navigate to MCP Catalog page
# Look at the tabs (Servers, Workloads, Guardrails)
```

**Verify**:
- [ ] "Tools" tab is NOT present
- [ ] Servers, Workloads, Guardrails tabs are present

#### 3.2 Entity Filter Updated

```bash
# Look at the entity type filter buttons
```

**Verify**:
- [ ] "Tools" button is NOT present
- [ ] "Guardrails" button IS present
- [ ] "Servers" and "Workloads" buttons are present

#### 3.3 Legacy URL Redirect

```bash
# Navigate directly to old Tools tab URL
# e.g., /mcp-catalog?tab=tools or /mcp-catalog/tools
```

**Verify**:
- [ ] Redirects to Servers tab
- [ ] No 404 or error page

### Performance Validation

#### Load Time Check

```bash
# Measure time to load Servers tab with expandable tools
# Compare to previous implementation
```

**Verify**:
- [ ] Page load time increase ≤ 500ms compared to baseline

### Sanity Test Script

Run the automated sanity tests:

```bash
./tests/sanity/server-tools-view.sh
```

**Expected**: All tests pass

## Test Data Setup

If needed, create test data:

```yaml
# entities/test-server-with-tools.yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: test-server-1
  namespace: default
  description: Test server for 007 feature
spec:
  type: mcp-server
  lifecycle: experimental
  owner: team-a
  mcp:
    connectionType: stdio
    version: "1.0"
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: test-tool-alpha
  namespace: default
  description: First test tool (should appear first alphabetically)
spec:
  type: mcp-tool
  lifecycle: experimental
  owner: team-a
  subcomponentOf: component:default/test-server-1
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: test-tool-zeta
  namespace: default
  description: Last test tool (should appear last alphabetically)
spec:
  type: mcp-tool
  lifecycle: experimental
  owner: team-a
  subcomponentOf: component:default/test-server-1
```

## Rollback

If issues are found:

1. Revert frontend changes (ServersTab, McpCatalogPage)
2. Keep backend API changes (backward compatible)
3. Re-enable Tools tab if needed

The alternative_description column is additive and does not affect existing functionality.
