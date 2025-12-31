# 005-workload-local-db: Database-Only Storage for Workloads

## Overview

This document summarizes the changes made to migrate workloads from dual-source storage (Backstage Catalog + Database merge) to **database-only storage**. Servers and tools remain on the merge architecture.

**Date:** 2025-12-31
**Feature:** 005-workload-local-db
**Status:** Complete

---

## Key Benefits

1. **Workload Renaming** - Database-only storage enables renaming (not possible with catalog-sourced entities)
2. **Simpler CRUD** - No merge logic needed for workloads
3. **Faster Operations** - Single source of truth, no catalog queries
4. **Clear Ownership** - Workloads are always API-created, never YAML-imported

---

## Architectural Differences

| Aspect | Servers/Tools (Merge) | Workloads (Database-Only) |
|--------|----------------------|---------------------------|
| **List** | Database + Catalog merge | Database only |
| **Get** | Database + Catalog fallback | Database only |
| **Create** | Database + EntityProvider | Database + EntityProvider |
| **Update** | Database + EntityProvider | Database + EntityProvider |
| **Delete** | Database + EntityProvider | Database + EntityProvider |
| **Rename** | Not supported | Supported |
| **YAML Import** | Via catalog | API only |

---

## Files Modified

| File | Changes |
|------|---------|
| `database.ts` | `deleteByParent` returns `string[]` instead of `number` |
| `types.ts` | Added `JsonValue` import and index signature for Entity compatibility |
| `service.ts` | Database-only workload operations, cascade delete fix, Entity type casting |
| `entityProvider.ts` | No changes (already had `managed-by-location` annotation) |
| `router.ts` | No changes (already called correct service methods) |

---

## Detailed Changes

### 1. Database Layer (`database.ts`)

**Changed `deleteByParent` to return entity refs instead of count:**

```typescript
// Before: returned number
async deleteByParent(parentRef: string): Promise<number>

// After: returns entity refs for cascade cleanup
async deleteByParent(parentRef: string): Promise<string[]> {
  // Get all tools that belong to this parent
  const rows = await this.db<MCPEntityRow>(TABLE_NAME)
    .where({ entity_type: 'mcp-tool' })
    .select('id', 'entity_ref', 'entity_json');

  const toDelete: { id: string; entityRef: string }[] = [];
  for (const row of rows) {
    const entity = JSON.parse(row.entity_json) as Entity;
    if ((entity.spec as any)?.subcomponentOf === parentRef) {
      toDelete.push({ id: row.id, entityRef: row.entity_ref });
    }
  }

  const deletedRefs: string[] = [];
  if (toDelete.length > 0) {
    await this.db(TABLE_NAME).whereIn('id', toDelete.map(t => t.id)).delete();
    deletedRefs.push(...toDelete.map(t => t.entityRef));
  }

  return deletedRefs;
}
```

**Why:** Enables the service layer to call `entityProvider.removeEntity()` for each cascade-deleted tool.

---

### 2. Type Definitions (`types.ts`)

**Added index signature for Backstage Entity compatibility:**

```typescript
import type { JsonValue } from '@backstage/types';

export interface MCPEntityMetadata {
  name: string;
  namespace?: string;
  title?: string;
  description?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  tags?: string[];

  // Index signature for JsonObject compatibility with Backstage Entity types
  [key: string]: JsonValue | undefined;
}
```

**Why:** TypeScript requires this for compatibility with Backstage's `Entity` type which uses `JsonObject` for metadata.

---

### 3. Service Layer (`service.ts`)

#### 3.1 Type Import & Entity Casting

```typescript
import type { Entity } from '@backstage/catalog-model';

// When calling entityProvider methods, cast our types to Entity:
await this.entityProvider.updateEntity(entity as unknown as Entity);
await this.entityProvider.removeEntity(entityRef);
```

**Why:** Our custom entity types (`MCPServerEntity`, `MCPToolEntity`, `MCPWorkloadEntity`) need to be cast to Backstage's `Entity` type.

#### 3.2 Workload Operations (Database-Only)

**`listWorkloads`** - Reads ONLY from database:
```typescript
async listWorkloads(params?: EntityListParams): Promise<EntityListResponse<MCPWorkloadEntity>> {
  const validTypes = ['mcp-workload', 'service', 'workflow'];

  // Fetch all entities and filter by workload types
  const allDbEntities = await this.database.listEntities();
  const workloads = allDbEntities.filter(entity => {
    const entityType = (entity.spec as any)?.type;
    if (!validTypes.includes(entityType)) return false;
    if (params?.namespace && entity.metadata.namespace !== params.namespace) return false;
    return true;
  });

  return {
    items: workloads as unknown as MCPWorkloadEntity[],
    totalCount: workloads.length,
  };
}
```

**`getWorkload`** - Database-only lookup:
```typescript
async getWorkload(namespace: string, name: string): Promise<MCPWorkloadEntity> {
  const entityRef = buildEntityRef('component', namespace, name);
  const dbEntity = await this.database.getEntity(entityRef);

  if (!dbEntity) {
    throw new NotFoundError(entityRef);
  }

  // Verify it's a workload type
  const validTypes = ['mcp-workload', 'service', 'workflow'];
  const entityType = (dbEntity.spec as any)?.type;
  if (!validTypes.includes(entityType)) {
    throw new NotFoundError(entityRef);
  }

  return dbEntity as unknown as MCPWorkloadEntity;
}
```

**`createWorkload`** - Database + EntityProvider sync:
```typescript
async createWorkload(input: MCPWorkloadInput): Promise<MCPWorkloadEntity> {
  // Build entity
  const entity: MCPWorkloadEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name, namespace, ...input.metadata },
    spec: { type: 'mcp-workload', ...input.spec },
  };

  // Check for duplicates
  const exists = await this.database.exists(entityRef);
  if (exists) throw new ConflictError(...);

  // Save to database
  await this.database.upsertEntity(entity);

  // Sync to catalog via EntityProvider
  await this.entityProvider.updateEntity(entity as unknown as Entity);

  return entity;
}
```

**`updateWorkload`** - Supports renaming:
```typescript
async updateWorkload(namespace: string, name: string, input: MCPWorkloadInput): Promise<MCPWorkloadEntity> {
  const newName = input.metadata?.name || name;
  const isRename = newName !== name;

  if (isRename) {
    // Validate new name doesn't exist
    const newEntityRef = buildEntityRef('component', namespace, newName);
    const existingWithNewName = await this.database.exists(newEntityRef);
    if (existingWithNewName) throw new ConflictError(...);

    // Delete old entity
    await this.database.deleteEntity(oldEntityRef);
    await this.entityProvider.removeEntity(oldEntityRef);
  }

  // Save updated entity (with potentially new name)
  await this.database.upsertEntity(updatedEntity);
  await this.entityProvider.updateEntity(updatedEntity as unknown as Entity);

  return updatedEntity;
}
```

**`deleteWorkload`** - Simple delete:
```typescript
async deleteWorkload(namespace: string, name: string): Promise<void> {
  const entityRef = buildEntityRef('component', namespace, name);

  // Get existing from database
  const dbEntity = await this.database.getEntity(entityRef);
  if (!dbEntity) throw new NotFoundError(entityRef);

  // Delete from database
  await this.database.deleteEntity(entityRef);

  // Remove from catalog via EntityProvider
  await this.entityProvider.removeEntity(entityRef);
}
```

#### 3.3 Cascade Delete Fix (FR-007)

**`deleteServer`** - Cascade deletes child tools:
```typescript
async deleteServer(namespace: string, name: string): Promise<void> {
  const entityRef = buildEntityRef('component', namespace, name);

  // Cascade delete tools from database (FR-007)
  const deletedToolRefs = await this.database.deleteByParent(entityRef);
  this.logger.info('Cascade deleted tools from database', { count: deletedToolRefs.length });

  // Remove cascade-deleted tools from entityProvider
  for (const toolRef of deletedToolRefs) {
    await this.entityProvider.removeEntity(toolRef);
  }

  // Delete server from database
  await this.database.deleteEntity(entityRef);

  // Remove from catalog via EntityProvider
  await this.entityProvider.removeEntity(entityRef);
}
```

**`deleteTool`** - Handles eventual consistency for cascade-deleted tools:
```typescript
async deleteTool(namespace: string, name: string): Promise<void> {
  const entityRef = buildEntityRef('component', namespace, name);

  // Check database first (for API-created tools)
  const dbEntity = await this.database.getEntity(entityRef);

  if (!dbEntity) {
    // Not in database - check catalog for YAML-defined tools
    const existing = await this.catalog.getEntityByRef({
      kind: 'Component',
      namespace,
      name,
    });

    if (!existing || (existing.spec as any)?.type !== 'mcp-tool') {
      throw new NotFoundError(entityRef);
    }

    // Check if this is an API-created tool (managed by our entityProvider)
    // If so, and it's not in our database, it was cascade-deleted
    const managedByLocation = existing.metadata.annotations?.['backstage.io/managed-by-location'];
    if (managedByLocation?.startsWith('mcp-entity-provider:')) {
      // Tool was API-created but not in database = already cascade-deleted
      // Catalog hasn't caught up due to eventual consistency
      this.logger.info('Tool already deleted (cascade or API)', { entityRef });
      throw new NotFoundError(entityRef);
    }
    // It's a YAML-defined tool, proceed with delete
  }

  // Delete from database and catalog
  await this.database.deleteEntity(entityRef);
  await this.entityProvider.removeEntity(entityRef);
}
```

**Why the cascade delete fix was needed:**
1. When a server is deleted, child tools are cascade-deleted from the database
2. `entityProvider.removeEntity()` is called for each cascade-deleted tool
3. But due to Backstage catalog's eventual consistency, the catalog still returns the entity briefly
4. Without the fix, attempting to delete an already-cascade-deleted tool would return 204 (success) instead of 404 (not found)
5. The fix checks the `managed-by-location` annotation to distinguish API-created tools from YAML-defined tools

---

### 4. EntityProvider Annotations

The `entityProvider.ts` already adds these annotations to all API-created entities:

```typescript
private addProviderMetadata(entity: Entity): Entity {
  return {
    ...entity,
    metadata: {
      ...entity.metadata,
      annotations: {
        ...entity.metadata.annotations,
        'backstage.io/managed-by-location': `${this.getProviderName()}:mcp-entity-api`,
        'backstage.io/managed-by-origin-location': `${this.getProviderName()}:mcp-entity-api`,
      },
    },
  };
}
```

These annotations are used to:
1. Identify API-created entities vs YAML-defined entities
2. Enable the cascade delete fix (detecting already-deleted tools)

---

## Migration/Cleanup Required

When switching an entity type to database-only storage, existing YAML-sourced entities may remain in the database from the previous merge architecture. They must be manually deleted:

```bash
# Get auth token
TOKEN=$(oc whoami -t)

# Delete all legacy workloads
curl -X DELETE "https://<backstage-url>/api/mcp-entity-api/workloads/default/<name>" \
  -H "Authorization: Bearer $TOKEN"
```

Or delete all at once:
```bash
for workload in $(curl -sk "https://<backstage-url>/api/mcp-entity-api/workloads" | jq -r '.items[].metadata.name'); do
  curl -sk -X DELETE "https://<backstage-url>/api/mcp-entity-api/workloads/default/${workload}" \
    -H "Authorization: Bearer $TOKEN"
done
```

---

## Testing

All 13 RBAC sanity tests pass, including:
- Workload CRUD operations
- Cascade delete (server delete cascades to tools)
- Orphan behavior (tool delete leaves workload refs dangling)

```bash
./tests/sanity/test-rbac.sh
# Result: 13/13 passed
```

---

## Future Work: Servers and Tools to Database-Only

When migrating servers and tools to database-only storage, apply the same pattern:

1. **Remove catalog fallback** in `listServers`, `listTools`, `getServer`, `getTool`
2. **Keep EntityProvider sync** for catalog visibility
3. **Enable renaming** in update operations
4. **Clean up legacy data** from database after migration
5. **Update tests** to reflect new behavior

The key insight: Database is the source of truth, EntityProvider syncs to catalog for visibility, but catalog is never queried for reads.
