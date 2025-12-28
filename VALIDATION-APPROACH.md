# Entity Validation Approach

## Overview

This document explains how entity validation works in the MCP Tools Catalog and why we chose to rely on Backstage's catalog validation instead of custom strict validation.

## Current Approach: Option A (Backstage Catalog Validation)

### What Validates Entities?

**Backstage Catalog API** handles all entity validation when entities are saved. The MCP Entity API acts as a pass-through:

```
Frontend → MCP Entity API → Backstage Catalog API → Validation + Save
                          (no validation)        (validates here)
```

### What Was Removed?

From `backstage-app/packages/backend/src/plugins/mcp-entity-api/`:
- ❌ Removed `validator.validateServer()` calls from `router.ts`
- ❌ Removed `validator.validateTool()` calls from `router.ts`
- ❌ Removed `validator.validateWorkload()` calls from `router.ts`
- ❌ Removed `validator.validate*()` calls from `service.ts`

**Note**: The `validation.ts` file still exists but is unused. This avoids larger refactoring.

### Why This Approach?

**Advantages**:
- ✅ **Minimal Backstage Changes**: Only removed validation calls, no schema maintenance
- ✅ **Vanilla Backstage**: Uses Backstage's built-in catalog validation
- ✅ **Less Maintenance**: Don't need to keep custom schemas in sync with entity YAML files
- ✅ **Permissive Validation**: Backstage allows additional properties (more flexible)
- ✅ **Consistency**: Same validation rules as Backstage uses for all entities

**Trade-offs**:
- ⚠️ **Less Strict**: MCP Entity API doesn't validate before forwarding to catalog
- ⚠️ **Later Errors**: Invalid entities rejected by catalog, not API (still acceptable)

## Alternative Approaches (Not Chosen)

### Option B: Custom Strict Validation in MCP Entity API

Would require maintaining JSON schemas in Backstage code:
- ❌ More Backstage code changes
- ❌ Schemas must stay in sync with entity YAML files
- ❌ Goes against "vanilla Backstage" principle
- ❌ More maintenance burden

### Option C: Frontend Validation Only

Would validate in console plugin before sending to backend:
- ❌ Can be bypassed via curl/API
- ❌ Duplicate validation logic
- ❌ Doesn't prevent invalid entities

### Option D: Validation Sidecar Service

Separate microservice for validation:
- ❌ Adds architectural complexity
- ❌ Adds latency
- ❌ Overkill for this use case

## How Backstage Validates Entities

When the MCP Entity API calls `catalogApi.addEntity()`, Backstage:

1. **Schema Validation**: Checks entity matches Backstage's entity schema
   - Required fields: `apiVersion`, `kind`, `metadata.name`
   - Validates `spec` structure for Component kind
   - **Allows additional properties** (permissive)

2. **Reference Validation**: Checks entity references are valid
   - Example: `spec.subcomponentOf` must reference existing entity

3. **Processor Validation**: Runs entity through catalog processors
   - Can add warnings or reject entity

4. **Saves Entity**: If validation passes, saves to catalog database

## What Properties Are Allowed?

Backstage's catalog validation **allows** (among others):
- `spec.type` - Custom entity types (like `mcp-server`, `mcp-tool`)
- `spec.mcp` - Custom properties under spec
- `metadata.annotations` - Any annotations (including `mcp-catalog.io/disabled`)
- Additional properties in `spec.mcp` (like `toolType`, `outputSchema`, `capabilities`)

This is why our entities work without custom validation!

## Error Handling

### Frontend Error (400/500 from MCP Entity API)

```typescript
// src/services/catalogService.ts
const response = await fetch(url, { method: 'PUT', ... });
if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message || 'Update failed');
}
```

User sees error message in UI.

### Backend Error (from Backstage Catalog)

```typescript
// backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts
try {
  await this.entityProvider.applyMutation({ ... });
} catch (error) {
  this.logger.error('Failed to update entity', { error });
  throw new Error(`Failed to update entity: ${error.message}`);
}
```

Error propagated to frontend as 500 error.

## Validation Examples

### Valid Entity (Passes Validation)

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-tool
  namespace: default
  annotations:
    mcp-catalog.io/disabled: "true"  # Custom annotation ✅
spec:
  type: mcp-tool  # Custom type ✅
  lifecycle: production
  owner: ops-team
  subcomponentOf: component:default/my-server
  mcp:  # Custom properties ✅
    toolType: query
    outputSchema: { ... }
    capabilities: ["read", "list"]
```

**Why it passes**: Backstage allows custom properties.

### Invalid Entity (Fails Validation)

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  # Missing required 'name' field ❌
spec:
  type: mcp-tool
  # Missing required 'lifecycle' field ❌
  # Missing required 'owner' field ❌
```

**Why it fails**: Missing required Backstage fields.

## Testing Validation

### Test Valid Entity

```bash
TOKEN=$(oc whoami -t)
BACKSTAGE_URL=$(oc get route backstage -n backstage -o jsonpath='{.spec.host}')

curl -k -X PUT "https://${BACKSTAGE_URL}/api/mcp-entity-api/tools/default/my-tool" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "name": "my-tool",
      "namespace": "default",
      "annotations": {
        "mcp-catalog.io/disabled": "true"
      }
    },
    "spec": {
      "type": "mcp-tool",
      "lifecycle": "production",
      "owner": "ops-team",
      "subcomponentOf": "component:default/my-server",
      "mcp": {
        "toolType": "query",
        "capabilities": ["read"]
      }
    }
  }'
```

Expected: `200 OK` with updated entity.

### Test Invalid Entity

```bash
curl -k -X PUT "https://${BACKSTAGE_URL}/api/mcp-entity-api/tools/default/my-tool" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "name": "my-tool"
      // Missing namespace, etc.
    },
    "spec": {
      // Missing required fields
    }
  }'
```

Expected: `400 Bad Request` or `500 Internal Server Error` with validation error message.

## Future Considerations

### When Might We Need Custom Validation?

If we need to:
1. **Enforce MCP-specific rules** that Backstage doesn't check
2. **Provide better error messages** for MCP entities
3. **Validate before saving** to give faster feedback

### How to Add Custom Validation (Without Modifying Backstage)

**Option: Validation Sidecar**

```
Frontend → MCP Entity API → Validation Sidecar → Backstage Catalog
                              (validates)
```

Implementation:
1. Create separate validation service
2. MCP Entity API calls validation service before catalog
3. Validation service returns errors or approves
4. No Backstage code changes needed!

This is the recommended approach if custom validation becomes necessary.

## References

- [Backstage Entity Schema](https://backstage.io/docs/features/software-catalog/descriptor-format)
- [AUTHENTICATION-FIX-SUMMARY.md](AUTHENTICATION-FIX-SUMMARY.md) - Overall fix summary
- [AUTHENTICATION.md](AUTHENTICATION.md) - Authentication architecture
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide

## Summary

**Current State**: MCP Entity API doesn't validate, Backstage catalog does.

**Why**: Keeps Backstage vanilla, uses built-in validation, less maintenance.

**Result**: Entities with additional properties (like `toolType`, `outputSchema`, `capabilities`) work correctly because Backstage allows them.

**Future**: If custom validation needed, implement as external sidecar service (not in Backstage core).
