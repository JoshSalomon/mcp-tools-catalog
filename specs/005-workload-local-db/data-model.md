# Data Model: Workload Entities to Local Database

**Feature Branch**: `005-workload-local-db`
**Date**: 2025-12-30

## Entities

### Workload

A user-defined combination of tools from one or more MCP servers.

#### Database Schema

```sql
-- Existing table (no schema changes required)
CREATE TABLE IF NOT EXISTS mcp_entities (
  id TEXT PRIMARY KEY,
  entity_ref TEXT NOT NULL,           -- 'component:namespace/name'
  entity_type TEXT NOT NULL,          -- 'mcp-workload', 'service', 'workflow'
  namespace TEXT NOT NULL,
  name TEXT NOT NULL,
  entity_json TEXT NOT NULL,          -- Full entity as JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Add unique constraint for name validation
  UNIQUE(namespace, name, entity_type)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_mcp_entities_type
  ON mcp_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_mcp_entities_namespace_name
  ON mcp_entities(namespace, name);
```

#### TypeScript Interface

```typescript
// src/models/CatalogMcpWorkload.ts (unchanged)
export interface CatalogMcpWorkload extends Entity {
  kind: 'Component';

  metadata: {
    name: string;
    namespace: string;
    description?: string;
    annotations?: Record<string, string>;
    labels?: Record<string, string>;
  };

  spec: {
    type: 'mcp-workload' | 'service' | 'workflow';
    lifecycle: string;         // 'production', 'experimental', 'development'
    owner: string;             // Team or user reference
    system?: string;           // Optional system grouping
    dependsOn: string[];       // Tool entity references
  };
}
```

#### Field Definitions

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `metadata.name` | string | Yes | Unique identifier within namespace | 1-63 chars, alphanumeric + hyphens |
| `metadata.namespace` | string | Yes | Namespace for isolation | Default: 'default' |
| `metadata.description` | string | No | Human-readable description | Max 1000 chars |
| `spec.type` | enum | Yes | Workload type | One of: mcp-workload, service, workflow |
| `spec.lifecycle` | string | Yes | Lifecycle stage | Typically: production, experimental |
| `spec.owner` | string | Yes | Owner reference | team:name or user:name format |
| `spec.dependsOn` | string[] | Yes | Tool references | Array of component:ns/name refs |

#### Relationships

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Server    │ ──1:N──▶│    Tool     │◀──N:M── │  Workload   │
│             │         │             │         │             │
│ (catalog)   │         │ (catalog)   │         │ (database)  │
└─────────────┘         └─────────────┘         └─────────────┘
                              ▲
                              │
                       spec.dependsOn[]
```

- **Workload → Tool**: Many-to-many via `spec.dependsOn` array
- **Tool → Server**: Many-to-one via `spec.subcomponentOf`
- Workloads can reference tools from multiple servers

### Tool Reference

A reference from a workload to a tool entity.

```typescript
// Example tool references in spec.dependsOn
[
  'component:default/github-search-repos',
  'component:default/github-list-issues',
  'component:mcp-servers/filesystem-read'
]
```

#### Entity Reference Format

```
component:<namespace>/<name>
```

- `component` - Kind (always Component for tools)
- `namespace` - Entity namespace
- `name` - Entity name

## State Transitions

### Workload Lifecycle

```
[Create]
    │
    ▼
┌──────────┐     [Update]      ┌──────────┐
│  Active  │ ────────────────▶ │  Active  │
│          │ ◀──────────────── │ (edited) │
└──────────┘                   └──────────┘
    │
    │ [Delete]
    ▼
┌──────────┐
│ Deleted  │  (row removed from database)
│          │
└──────────┘
```

**Key Change**: No more soft delete state. Delete is permanent.

### Workload Name Change (Rename)

```
[Workload: "old-name"]
         │
         │ PUT /workloads/default/old-name
         │ { metadata: { name: "new-name" } }
         ▼
[Workload: "new-name"]
```

- Entity reference updates: `component:default/old-name` → `component:default/new-name`
- created_at timestamp preserved
- updated_at timestamp updated

## Validation Rules

### Create Workload

| Rule | Error |
|------|-------|
| Name unique in namespace | 409 Conflict: "Workload with this name already exists" |
| Name format valid | 400 Bad Request: "Invalid name format" |
| spec.type valid | 400 Bad Request: "Invalid workload type" |
| spec.owner provided | 400 Bad Request: "Owner is required" |
| spec.dependsOn is array | 400 Bad Request: "dependsOn must be an array" |

### Update Workload

| Rule | Error |
|------|-------|
| Workload exists | 404 Not Found: "Workload not found" |
| New name unique (if renaming) | 409 Conflict: "Name already exists" |
| User has mcp-user role | 403 Forbidden: "Insufficient permissions" |

### Delete Workload

| Rule | Error |
|------|-------|
| Workload exists | 404 Not Found: "Workload not found" |
| User has mcp-user role | 403 Forbidden: "Insufficient permissions" |

## Data Migration

**Not Required**

Per spec assumption: "There is no production data that needs to be migrated from Backstage."

- Existing API-created workloads are already in the database
- YAML workloads (if any) can be optionally imported via YAML import endpoint
- No automatic migration needed

## Backward Compatibility

| Aspect | Compatibility |
|--------|---------------|
| API endpoints | ✅ Unchanged |
| Request/response format | ✅ Unchanged |
| Entity references | ✅ Same format |
| Tool relationships | ✅ Same dependsOn array |
| RBAC | ✅ Same mcp-user role |
