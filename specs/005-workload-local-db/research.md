# Research: Workload Entities to Local Database

**Feature Branch**: `005-workload-local-db`
**Date**: 2025-12-30

## Research Questions

This document resolves technical unknowns identified during planning.

---

## R1: Current Merge Architecture Complexity

**Question**: What specific merge logic exists that needs to be removed?

**Findings**:

The current `service.ts` implements a complex merge strategy:

```typescript
// Current merge logic in getWorkload()
const merged = {
  ...catalogEntity,
  metadata: {
    ...catalogEntity.metadata,
    description: dbEntity.metadata.description, // Database wins
    annotations: {
      ...catalogEntity.metadata.annotations,
      ...dbEntity.metadata.annotations, // Database wins
    },
  },
  spec: {
    ...catalogEntity.spec,
    lifecycle: dbEntity.spec?.lifecycle,
    owner: dbEntity.spec?.owner,
    dependsOn: dbEntity.spec?.dependsOn, // Always use database dependsOn
  }
}
```

**Complexity Points**:
1. `getWorkload()` - Fetches from catalog, then database, then merges
2. `listWorkloads()` - Fetches all from catalog, all from database, merges each, filters soft-deleted
3. `updateWorkload()` - Must handle both YAML and API-created entities differently
4. `deleteWorkload()` - Soft delete for YAML, hard delete for API-created

**Decision**: Remove all catalog lookups for workloads. Database becomes sole source.

**Rationale**: Eliminates 4 merge code paths and ~100 lines of complexity.

---

## R2: Soft Delete Mechanism

**Question**: How is soft delete currently implemented and why is it needed?

**Findings**:

Soft delete uses annotation-based marking:
```typescript
annotations: {
  'mcp-catalog.io/deleted': 'true',
  'mcp-catalog.io/deleted-at': new Date().toISOString()
}
```

**Why Soft Delete Exists**:
- YAML entities are continuously re-ingested from Git by Backstage
- Hard deleting a YAML workload only removes from database
- Next catalog refresh re-creates the entity from YAML
- Result: "zombie" workloads that keep coming back

**Why Soft Delete is No Longer Needed**:
- With database-only storage, there is no YAML source to re-ingest
- Hard delete permanently removes the entity
- No zombie workloads possible

**Decision**: Remove soft delete logic. Use hard delete (database row deletion).

**Rationale**: Simplifies delete operation and eliminates admin endpoints for undelete.

---

## R3: Database Schema Adequacy

**Question**: Does the current database schema support all workload requirements?

**Findings**:

Current `mcp_entities` table schema:
```typescript
interface MCPEntityRow {
  id: string;              // UUID
  entity_ref: string;      // 'component:namespace/name'
  entity_type: string;     // 'mcp-workload', 'service', 'workflow'
  namespace: string;
  name: string;
  entity_json: string;     // Full entity as JSON
  created_at: Date;
  updated_at: Date;
}
```

**Analysis**:
- ✅ Supports workload storage (entity_json contains full entity)
- ✅ Has namespace/name for lookups
- ✅ Has entity_type for filtering workloads
- ⚠️ No explicit UNIQUE constraint on (namespace, name, entity_type)
- ⚠️ Name uniqueness validated in application code, not database

**Decision**: Add UNIQUE constraint on (namespace, name, entity_type) if not present.

**Rationale**: Database-level constraint prevents race conditions on duplicate names.

**Alternatives Considered**:
- Application-only validation: Rejected due to race condition risk
- Separate workload table: Rejected to avoid schema migration complexity

---

## R4: API Contract Preservation

**Question**: Can the API contract remain unchanged?

**Findings**:

Current endpoints:
```
GET    /api/mcp-entity-api/workloads                    # List
POST   /api/mcp-entity-api/workloads                    # Create
GET    /api/mcp-entity-api/workloads/:namespace/:name   # Read
PUT    /api/mcp-entity-api/workloads/:namespace/:name   # Update
DELETE /api/mcp-entity-api/workloads/:namespace/:name   # Delete
```

Request/Response format (unchanged):
```typescript
// Create/Update request body
{
  metadata: {
    name: string,
    namespace: string,
    description?: string,
    annotations?: Record<string, string>
  },
  spec: {
    type: 'mcp-workload' | 'service' | 'workflow',
    lifecycle: string,
    owner: string,
    dependsOn: string[]  // Tool references
  }
}
```

**Decision**: Keep API contract identical. Only backend implementation changes.

**Rationale**: Frontend remains unchanged, reducing scope and risk.

---

## R5: Workload Renaming

**Question**: How should workload renaming work?

**Current Behavior**:
- Name field is read-only in edit mode
- Renaming requires delete + recreate (user must remember settings)
- Entity identity is `component:namespace/name`

**Database-Only Behavior**:
- Name is just a column in the database
- Can be updated like any other field
- Entity reference changes on rename

**Implementation Options**:

**Option A: Update in Place**
- Change name column in database
- Update entity_ref to match
- Frontend sends new name in PUT request
```typescript
PUT /workloads/default/old-name
{ metadata: { name: 'new-name', ... } }
```

**Option B: Delete + Create Pattern**
- Delete old entity
- Create new entity with new name
- Atomic transaction

**Decision**: Option A - Update in place

**Rationale**:
- Simpler for frontend (just enable name field)
- Preserves created_at timestamp
- Single database operation
- More intuitive API semantics

**Implementation**:
```typescript
// In updateWorkload()
if (newName !== oldName) {
  // Check uniqueness of new name
  const existing = await db.getWorkload(namespace, newName);
  if (existing) throw new ConflictError('Name already exists');

  // Update both name and entity_ref
  await db.updateWorkloadName(namespace, oldName, newName);
}
```

---

## R6: YAML Import (P3 Feature)

**Question**: How should optional YAML import work?

**Findings**:

Per spec (FR-011): "System SHOULD provide optional YAML import capability for bulk workload creation"

**Use Cases**:
1. Migrate existing YAML workloads to database
2. Bulk create workloads from template files
3. Share workload configurations across clusters

**Implementation Options**:

**Option A: API Endpoint**
```
POST /api/mcp-entity-api/workloads/import
Content-Type: application/yaml
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-workload
spec:
  type: mcp-workload
  dependsOn: [component:default/tool-a]
```

**Option B: CLI Tool**
```bash
./import-workloads.sh workloads.yaml
```

**Decision**: Option A - API endpoint (deferred to P3)

**Rationale**:
- Consistent with existing API patterns
- Can be used by automation
- Frontend could add "Import" button later

**Behavior**:
- Skip existing workloads (don't overwrite)
- Return list of created vs skipped
- Validate tool references exist

---

## R7: Tool Reference Validation

**Question**: Should tool references be validated on workload create/update?

**Current Behavior**:
- Validates tool references exist in catalog
- Warns but allows if tools not found (per existing code)

**Decision**: Keep current behavior (warn but allow)

**Rationale**:
- Tools may be added later
- Prevents race conditions during setup
- Consistent with existing behavior

---

## Summary of Decisions

| Topic | Decision | Impact |
|-------|----------|--------|
| Merge logic | Remove completely | ~100 lines deleted |
| Soft delete | Remove, use hard delete | Simpler delete, no zombies |
| Database schema | Add UNIQUE constraint | Prevents duplicates at DB level |
| API contract | Keep unchanged | Frontend stays same |
| Renaming | Update in place | Enable name field in form |
| YAML import | API endpoint (P3) | Deferred, optional |
| Tool validation | Warn but allow | Consistent with current |
