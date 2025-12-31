# Merge Architecture - Catalog + Database

## Overview

The MCP Entity API uses a **merge architecture** for **Servers and Tools** to combine:
- **Backstage Catalog** - Entity definitions (source of truth from YAML/GitHub)
- **SQLite Database** - Runtime state (disabled flags, user modifications)

This allows runtime state to persist without modifying Backstage core or YAML files.

> **Note**: **Workloads use database-only storage** (no catalog merge). This simplifies
> CRUD operations, enables workload renaming, and eliminates soft-delete complexity.
> See [Implementation Details](#workloads-database-only) section.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│ Frontend (Console Plugin)                           │
│  - Displays tools, servers, workloads               │
│  - Shows disabled state                             │
└─────────────────────┬───────────────────────────────┘
                      │
                      │ GET /api/mcp-entity-api/tools/default/k8s-list-pods
                      │ PUT /api/mcp-entity-api/tools/default/k8s-list-pods
                      ↓
┌─────────────────────────────────────────────────────┐
│ MCP Entity API (OUR MERGE LAYER)                    │  ← MERGE HAPPENS HERE
│  backstage-app/packages/backend/src/plugins/        │
│    mcp-entity-api/service.ts                        │
│                                                      │
│  GET getTool(namespace, name):                      │
│    1. catalogEntity = catalog.getEntityByRef()      │
│    2. dbEntity = database.getEntity()               │
│    3. return merge(catalogEntity, dbEntity)         │
│                                                      │
│  PUT updateTool(namespace, name, input):            │
│    1. Verify exists in catalog                      │
│    2. database.upsertEntity(input)                  │
│    3. return updated entity                         │
└──────────────┬──────────────────┬───────────────────┘
               │                  │
               ↓                  ↓
┌──────────────────────┐  ┌──────────────────┐
│ Backstage Catalog    │  │ SQLite Database  │
│ (READ-ONLY for us)   │  │ (OUR STORAGE)    │
│                      │  │                  │
│ - Entity definitions │  │ - Disabled state │
│ - From YAML files    │  │ - User overrides │
│ - GitHub provider    │  │ - Runtime data   │
└──────────────────────┘  └──────────────────┘
         ↑                          ↑
         │                          │
   GitHub Repo                 /tmp/mcp-entities.db
```

## Data Flow

### Read Operation (GET)

```typescript
// service.ts - getTool()
async getTool(namespace: string, name: string) {
  // 1. Get entity from catalog (YAML source of truth)
  const catalogEntity = await this.catalog.getEntityByRef({
    kind: 'Component',
    namespace,
    name,
  });
  
  // 2. Get any database overrides (disabled state, etc.)
  const dbEntity = await this.database.getEntity(entityRef);
  
  // 3. Merge: catalog as base, database annotations overlay
  if (dbEntity) {
    return {
      ...catalogEntity,
      metadata: {
        ...catalogEntity.metadata,
        annotations: {
          ...catalogEntity.metadata.annotations,
          ...dbEntity.metadata.annotations,  // Database wins
        },
      },
    };
  }
  
  return catalogEntity;
}
```

**Result**: Frontend sees entity definition from YAML + runtime state from database.

### Write Operation (PUT)

```typescript
// service.ts - updateTool()
async updateTool(namespace: string, name: string, input: MCPToolInput) {
  // 1. Verify entity exists in catalog (YAML or API-created)
  const existing = await this.catalog.getEntityByRef({...});
  if (!existing) {
    throw new NotFoundError(entityRef);
  }
  
  // 2. Save to database (runtime state)
  const entity = this.buildToolEntity(input, namespace, name);
  await this.database.upsertEntity(entity);
  
  // 3. Return updated entity
  return entity;
}
```

**Result**: Runtime state saved to database, will be merged on next GET.

## Example: Disabling a Tool

### Step 1: User Disables Tool

**Frontend**:
```typescript
PUT /api/mcp-entity-api/tools/default/k8s-list-pods
{
  "metadata": {
    "name": "k8s-list-pods",
    "annotations": {
      "mcp-catalog.io/disabled": "true"  // ← Disable flag
    }
  },
  "spec": { ... }
}
```

**Backend (service.ts)**:
```typescript
async updateTool() {
  // Verify exists in catalog
  const catalogEntity = await this.catalog.getEntityByRef({...});  // ✅ Found in YAML
  
  // Save to database
  await this.database.upsertEntity({
    metadata: {
      annotations: {
        "mcp-catalog.io/disabled": "true"  // ← Saved to database
      }
    }
  });
}
```

**Database After**:
```sql
-- /tmp/mcp-entities.db
entityRef: "component:default/k8s-list-pods"
data: {
  "metadata": {
    "annotations": {
      "mcp-catalog.io/disabled": "true"
    }
  }
}
```

### Step 2: User Refreshes Page

**Frontend**:
```typescript
GET /api/mcp-entity-api/tools/default/k8s-list-pods
```

**Backend (service.ts)**:
```typescript
async getTool() {
  // 1. Get from catalog (YAML definition)
  const catalogEntity = await this.catalog.getEntityByRef({...});
  // catalogEntity.metadata.annotations = {
  //   "backstage.io/managed-by-location": "url:https://github.com/..."
  //   // NO disabled annotation
  // }
  
  // 2. Get from database (runtime state)
  const dbEntity = await this.database.getEntity(entityRef);
  // dbEntity.metadata.annotations = {
  //   "mcp-catalog.io/disabled": "true"  // ← Has disabled flag
  // }
  
  // 3. Merge
  return {
    ...catalogEntity,
    metadata: {
      ...catalogEntity.metadata,
      annotations: {
        ...catalogEntity.metadata.annotations,  // GitHub annotations
        ...dbEntity.metadata.annotations,       // Database wins: disabled = true
      },
    },
  };
}
```

**Frontend Receives**:
```json
{
  "metadata": {
    "name": "k8s-list-pods",
    "annotations": {
      "backstage.io/managed-by-location": "url:https://github.com/...",
      "mcp-catalog.io/disabled": "true"  // ← Merged result!
    }
  },
  "spec": { ... }
}
```

**Result**: ✅ Checkbox stays checked, state persists!

## What Gets Merged?

### From Catalog (Source of Truth)
- `apiVersion`
- `kind`
- `metadata.name`
- `metadata.namespace`
- `metadata.description`
- `metadata.labels` (base)
- `metadata.annotations` (base)
- `spec` (entire spec object)
- `relations` (computed by Backstage)

### From Database (Runtime Overlay)
- `metadata.annotations.*` (overlays on catalog annotations)
  - `mcp-catalog.io/disabled`
  - Any other runtime annotations
- `metadata.labels.*` (future: could overlay labels)

### Merge Logic
```typescript
{
  ...catalogEntity,           // Everything from catalog
  metadata: {
    ...catalogEntity.metadata,
    annotations: {
      ...catalogEntity.metadata.annotations,  // Base annotations
      ...dbEntity.metadata.annotations,       // Database wins
    },
  },
}
```

**Database annotations overlay on (and override) catalog annotations.**

## Why This Approach?

### ✅ Advantages

1. **No Backstage Modifications**
   - Backstage catalog unchanged
   - Backstage core code unchanged
   - Merge logic in our layer (MCP Entity API)

2. **Clear Separation of Concerns**
   - Catalog = definitions (immutable, version controlled)
   - Database = state (mutable, runtime)
   - API = merge (our code)

3. **YAML Remains Source of Truth**
   - Entity definitions in Git
   - Changes via PR/commit
   - Database only for runtime state

4. **State Persists**
   - Disabled flags survive refreshes
   - Database is persistent storage
   - No loss of user actions

5. **Works with All Entities**
   - YAML entities (from GitHub)
   - API-created entities (from POST)
   - Consistent behavior

### ⚠️ Trade-offs

1. **Two Sources of Data**
   - Must check both catalog and database
   - Slightly more complex logic
   - But isolated to our layer

2. **Database Can Drift**
   - If YAML changes, database state remains
   - Usually acceptable (state is independent)
   - Example: Tool renamed in YAML, database still has old disabled state (becomes orphan)

3. **Performance**
   - Two lookups per GET (catalog + database)
   - Mitigated by caching (future)
   - Acceptable for current scale

## Alternatives Considered

### ❌ Option 1: Override YAML in Catalog (Delta Mutations)
**Problem**: Backstage rejects updates when multiple providers manage same entity.
**Result**: Catalog conflict, YAML provider wins, updates ignored.

### ❌ Option 2: Modify YAML Files
**Problem**: Runtime state (disabled) shouldn't be in version control.
**Result**: Git noise, merge conflicts, wrong layer.

### ❌ Option 3: Frontend-Only State
**Problem**: State lost on refresh, not shareable across users.
**Result**: Poor UX, data loss.

### ✅ Option 4: Merge Architecture (Chosen)
**Result**: Clean separation, no Backstage modifications, state persists.

## Implementation Details

### Files Modified

**Primary**: `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`

**Methods with Merge Logic (Servers/Tools only)**:
- `getServer(namespace, name)` - Merges catalog + database
- `getTool(namespace, name)` - Merges catalog + database
- `listServers(params)` - Merges all servers
- `listTools(params)` - Merges all tools

**Methods with Catalog Check (Servers/Tools only)**:
- `updateServer()` - Checks catalog for existence
- `updateTool()` - Checks catalog for existence + parent
- `deleteServer()` - Checks catalog for existence
- `deleteTool()` - Checks catalog for existence

**Workloads (Database-Only)**:
- `createWorkload()` - Database only, no catalog
- `getWorkload()` - Database only, no merge
- `listWorkloads()` - Database only, no merge
- `updateWorkload()` - Database only, supports rename
- `deleteWorkload()` - Database only, hard delete

### Database Schema

```typescript
// database.ts
interface EntityRecord {
  entityRef: string;       // "component:default/k8s-list-pods"
  data: string;            // JSON serialized entity
  entityType: string;      // "mcp-server" | "mcp-tool" | "mcp-workload"
  parentRef?: string;      // For tools: parent server ref
}
```

## Testing

### Manual Test: Disable Tool

1. Navigate to **MCP Catalog → Servers → kubernetes-mcp**
2. Click on **k8s-list-pods** tool
3. Check **"Disabled"** checkbox
4. Click **"Save Changes"**
5. **Refresh page** (F5)
6. **Expected**: Checkbox stays checked ✅

### Verify Database

```bash
oc exec -n backstage <pod> -- sqlite3 /tmp/mcp-entities.db \
  "SELECT entityRef, json_extract(data, '$.metadata.annotations.\"mcp-catalog.io/disabled\"') \
   FROM entities WHERE entityRef = 'component:default/k8s-list-pods';"
```

**Expected Output**:
```
component:default/k8s-list-pods|true
```

### Verify Merge

```bash
TOKEN=$(oc whoami -t)
BACKSTAGE_URL=$(oc get route backstage -n backstage -o jsonpath='{.spec.host}')

curl -k "https://${BACKSTAGE_URL}/api/mcp-entity-api/tools/default/k8s-list-pods" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.metadata.annotations["mcp-catalog.io/disabled"]'
```

**Expected Output**: `"true"`

## Future Enhancements

1. **Caching**
   - Cache merged entities to reduce lookups
   - Invalidate on PUT/DELETE

2. **Merge More Fields**
   - Labels (not just annotations)
   - Tags
   - Custom metadata

3. **Database Cleanup**
   - Detect orphaned database entries
   - Remove when YAML entity deleted

4. **Conflict Resolution UI**
   - Show when database state conflicts with YAML
   - Allow user to resolve

5. **Audit Trail**
   - Track who disabled/enabled tools
   - When state changed

## References

- [YAML-ENTITY-FIX.md](YAML-ENTITY-FIX.md) - Detailed fix documentation
- [AUTHENTICATION-FIX-SUMMARY.md](AUTHENTICATION-FIX-SUMMARY.md) - Authentication fixes
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [Backstage Catalog API](https://backstage.io/docs/features/software-catalog/software-catalog-api)

## Summary

**Pattern**: Catalog (source of truth) + Database (runtime overlay) = Complete Entity

**Key Insight**: Don't fight Backstage's catalog - work with it by merging data at the API layer.

**Result**: Runtime state persists without modifying Backstage core or YAML files.
