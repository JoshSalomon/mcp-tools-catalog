# YAML Entity Fix - Summary

## Problem

When attempting to update or view tools/servers loaded from YAML files (like `kubernetes-tools.yaml`, `kubernetes-server.yaml`), the system had two issues:

### Issue 1: Entity Not Found (Fixed)
- **Frontend**: "The referenced server 'kubernetes-mcp' could not be found in the catalog"
- **Backend**: "Entity 'component:default/k8s-list-pods' not found"

This prevented:
- Viewing tool/server detail pages
- Disabling/enabling tools
- Any updates to YAML-loaded entities

### Issue 2: State Not Persisting (Fixed)
- Disabling a tool would save to database
- But on refresh, the disabled state was lost
- Catalog continued to serve original YAML version

## Root Causes

### Root Cause 1: Database-Only Existence Check

The MCP Entity API's `updateTool()`, `updateServer()`, `deleteTool()`, etc. methods were checking entity existence using:

```typescript
const existing = await this.database.exists(entityRef); // ❌ WRONG
if (!existing) {
  throw new NotFoundError(entityRef);
}
```

**The Problem**:
- YAML entities exist in the **Backstage catalog** (loaded via entity discovery)
- But they don't exist in the MCP Entity API's **database** (SQLite)
- The database only contains entities created via POST `/api/mcp-entity-api/*`
- Result: `database.exists()` returns `false` for YAML entities, even though they're in the catalog

### Root Cause 2: Catalog Provider Conflicts

When we tried to update entities via delta mutations:
- GitHub YAML provider owns the entity (original source)
- MCP Entity Provider tries to update the entity
- Backstage sees conflict: "two providers managing same entity"
- Backstage prefers the original provider (GitHub)
- Result: Database updates ignored, catalog serves YAML version

## The Fixes

### Fix 1: Check Catalog for Existence

Changed all update/delete methods to check the **catalog** instead of the **database**:

```typescript
// ✅ NEW - Check catalog (finds both YAML and API-created entities)
const existing = await this.catalog.getEntityByRef({
  kind: 'Component',
  namespace,
  name,
});
if (!existing || (existing.spec as any)?.type !== 'mcp-server') {
  throw new NotFoundError(entityRef);
}
```

**Why This Works**:
- `catalog.getEntityByRef()` finds **all** entities (YAML + API-created)
- After confirming existence in catalog, `database.upsertEntity()` adds it to database
- Original YAML file remains unchanged (read-only)

### Fix 2: Merge Catalog + Database on GET (The Key Fix!)

Changed all GET/LIST methods to merge catalog entities with database state:

```typescript
// ✅ NEW - Merge approach
async getTool(namespace, name) {
  // 1. Get entity from catalog (YAML source of truth)
  const catalogEntity = await this.catalog.getEntityByRef({...});
  
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
          ...dbEntity.metadata.annotations,  // Database wins for annotations
        },
      },
    };
  }
  
  return catalogEntity;
}
```

**Why This Works**:
- **GitHub YAML** = entity definition (immutable, version controlled)
- **Database** = runtime state (mutable, disabled flag)
- **MCP Entity API** = merge layer (our code, not Backstage)
- Frontend always sees merged result with latest state
- No catalog conflicts (we don't try to override YAML in catalog)

## Files Modified

**Backend** (`backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`):

### Existence Checks (Fix 1):
- `updateServer()` - Changed to check catalog
- `deleteServer()` - Changed to check catalog
- `updateTool()` - Changed to check catalog + parent in catalog
- `deleteTool()` - Changed to check catalog
- `updateWorkload()` - Changed to check catalog
- `deleteWorkload()` - Changed to check catalog

### Merge Logic (Fix 2 - The Key Fix):
- `getServer()` - Now merges catalog + database
- `listServers()` - Now merges catalog + database for all servers
- `getTool()` - Now merges catalog + database
- `listTools()` - Now merges catalog + database for all tools
- `getWorkload()` - Now merges catalog + database
- `listWorkloads()` - Now merges catalog + database for all workloads

**Changes Summary**:
1. ✅ Replaced `this.database.exists()` with `this.catalog.getEntityByRef()`
2. ✅ Added type validation (e.g., `spec.type === 'mcp-server'`)
3. ✅ For tools: Check parent server in catalog (not just database)
4. ✅ **All GET/LIST methods now merge catalog + database state**

## Behavior After Fix

### Architecture
```
┌─────────────────────────────────────────────────────┐
│ Frontend (Console Plugin)                           │
└─────────────────────┬───────────────────────────────┘
                      │ GET /api/mcp-entity-api/tools/...
                      ↓
┌─────────────────────────────────────────────────────┐
│ MCP Entity API (OUR merge layer)                    │  ← MERGE HAPPENS HERE
│  - service.ts: getTool(), listTools()               │
│  - Gets catalog entity (YAML source)                │
│  - Gets database state (disabled flag)              │
│  - Merges and returns result                        │
└──────────────┬──────────────────┬───────────────────┘
               │                  │
               ↓                  ↓
┌──────────────────────┐  ┌──────────────────┐
│ Backstage Catalog    │  │ SQLite Database  │
│ (unchanged)          │  │ (our database)   │
│ - GitHub YAML        │  │ - Disabled state │
└──────────────────────┘  └──────────────────┘
```

### YAML-Loaded Entities (e.g., from `kubernetes-tools.yaml`)

**On Disable (PUT)**:
1. ✅ Checks catalog (entity exists)
2. ✅ Updates database (adds/updates disabled annotation)
3. ✅ Returns success

**On View (GET)**:
1. ✅ Gets entity from catalog (YAML definition)
2. ✅ Gets overrides from database (disabled: true)
3. ✅ Merges annotations (database wins)
4. ✅ Returns merged entity to frontend
5. ✅ **Frontend sees disabled state!**

**On Refresh**:
1. ✅ Same GET flow happens again
2. ✅ Database still has disabled state
3. ✅ Merge produces same result
4. ✅ **State persists across refreshes!**

### API-Created Entities (via POST)

**On Create**:
1. ✅ Added to database immediately
2. ✅ Delta mutation adds to catalog

**On View**:
1. ✅ Gets entity from catalog
2. ✅ Gets same entity from database
3. ✅ Merge produces complete entity
4. ✅ Returns merged result

### Result
**All entities work consistently**, regardless of source (YAML vs API)!
**State persists** because database overlays on catalog!

## Testing

### Test 1: View YAML Entity
```bash
TOKEN=$(oc whoami -t)
BACKSTAGE_URL=$(oc get route backstage -n backstage -o jsonpath='{.spec.host}')

curl -k "https://${BACKSTAGE_URL}/api/mcp-entity-api/tools/default/k8s-list-pods" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Expected**: ✅ `200 OK` with tool details

### Test 2: Disable YAML Entity
```bash
curl -k -X PUT "https://${BACKSTAGE_URL}/api/mcp-entity-api/tools/default/k8s-list-pods" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "name": "k8s-list-pods",
      "namespace": "default",
      "annotations": {
        "mcp-catalog.io/disabled": "true"
      }
    },
    "spec": {
      "type": "mcp-tool",
      "lifecycle": "production",
      "owner": "ops-team",
      "subcomponentOf": "component:default/kubernetes-mcp"
    }
  }'
```

**Expected**: ✅ `200 OK` with updated entity (disabled)

### Test 3: View in Frontend
1. Navigate to **MCP Catalog → Servers → kubernetes-mcp**
2. Click on **k8s-list-pods** tool
3. **Expected**: ✅ Tool detail page shows, parent server pane shows kubernetes-mcp

### Test 4: Disable via Frontend
1. On tool detail page, check **"Disabled"** checkbox
2. Click **"Save Changes"**
3. **Expected**: ✅ Success message, tool marked as disabled

## Important Notes

### YAML Files Are Read-Only (Source of Truth)
When you update a YAML-loaded entity via the MCP Entity API:
- The **catalog** continues to serve the original YAML definition
- The **database** stores runtime state (disabled, etc.)
- The **MCP Entity API** merges them on GET
- The **original YAML file remains unchanged**

This is by design! YAML files are the "source of truth" for entity definitions.

### Separation of Concerns
- **Catalog** = Entity definitions (immutable, from YAML/GitHub)
- **Database** = Runtime state (mutable, disabled flags, etc.)
- **MCP Entity API** = Merge layer (our code, not Backstage core)

### What Can Be Modified?
- ✅ **Annotations** (like `mcp-catalog.io/disabled`) - stored in database, merged on GET
- ✅ **Labels** - stored in database, merged on GET (future)
- ❌ **Entity definition** (spec, type, etc.) - must update YAML file

### Conflict Resolution
If a YAML file is updated (e.g., via Git) and conflicts with database:
- **Catalog** serves new YAML definition (source of truth)
- **Database** still has runtime state (disabled flags)
- **Merge** produces: new definition + old runtime state
- **Strategy**: This is acceptable - runtime state is independent of definition

### No Backstage Modifications
- ✅ Backstage catalog unchanged (still serves YAML as-is)
- ✅ Backstage core code unchanged (no patches)
- ✅ MCP Entity API is our layer (we control merge logic)
- ✅ Database is ours (separate SQLite file)

**This approach respects the "don't modify Backstage" principle!**

## Related Issues Fixed

This fix also resolves:
- ✅ "Parent server not found" errors on tool pages
- ✅ Can't disable tools from YAML files
- ✅ Can't view server details for YAML servers
- ✅ 404 errors when following tool → server links

## Deployment

1. **Build Backend**:
   ```bash
   cd backstage-app
   yarn install --frozen-lockfile
   yarn build:backend
   ```

2. **Build Image**:
   ```bash
   cd backstage-app
   podman build -f packages/backend/Dockerfile -t quay.io/jsalomon/backstage:latest .
   ```

3. **Push & Deploy**:
   ```bash
   podman push quay.io/jsalomon/backstage:latest
   oc set image deployment/backstage backstage=quay.io/jsalomon/backstage:latest -n backstage
   ```

4. **Verify**:
   ```bash
   oc rollout status deployment/backstage -n backstage
   oc logs -n backstage deployment/backstage --tail=50
   ```

## References

- [AUTHENTICATION-FIX-SUMMARY.md](AUTHENTICATION-FIX-SUMMARY.md) - Authentication fixes
- [VALIDATION-APPROACH.md](VALIDATION-APPROACH.md) - Validation strategy
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide

## Summary

**Problem 1**: MCP Entity API only worked with API-created entities (in database)
**Solution 1**: Check catalog for existence (not just database)
**Result**: ✅ All entities can be viewed and updated

**Problem 2**: Disabled state didn't persist after refresh
**Solution 2**: Merge catalog entities with database state on GET
**Result**: ✅ Runtime state persists across refreshes

**Key Insights**:
1. **Check catalog for existence** (YAML entities exist there)
2. **Store runtime state in database** (disabled flags, etc.)
3. **Merge on GET** (catalog + database = complete picture)
4. **No Backstage modifications** (merge logic in our layer)

**Architecture Pattern**: Catalog (source of truth) + Database (runtime overlay) = Complete Entity
