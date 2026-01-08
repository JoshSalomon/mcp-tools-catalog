# Data Model: MCP Guardrails Entity

**Feature Branch**: `006-mcp-guardrails`
**Date**: 2026-01-04

## Entities

### Guardrail

A protection mechanism that can be attached to tools and workload-tool relationships.

#### Database Schema

```sql
-- New table for guardrails
CREATE TABLE IF NOT EXISTS mcp_guardrails (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  deployment TEXT NOT NULL,
  parameters TEXT,                    -- Optional JSON or text
  disabled INTEGER NOT NULL DEFAULT 0, -- 0 = enabled, 1 = disabled
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(namespace, name)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_mcp_guardrails_namespace_name
  ON mcp_guardrails(namespace, name);

-- Tool-guardrail associations (global defaults)
CREATE TABLE IF NOT EXISTS mcp_tool_guardrails (
  id TEXT PRIMARY KEY,
  tool_namespace TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  guardrail_id TEXT NOT NULL,
  execution_timing TEXT NOT NULL,     -- 'pre-execution' or 'post-execution'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (guardrail_id) REFERENCES mcp_guardrails(id) ON DELETE RESTRICT,
  UNIQUE(tool_namespace, tool_name, guardrail_id)
);

CREATE INDEX IF NOT EXISTS idx_mcp_tool_guardrails_tool
  ON mcp_tool_guardrails(tool_namespace, tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_guardrails_guardrail
  ON mcp_tool_guardrails(guardrail_id);

-- Workload-tool-guardrail associations
CREATE TABLE IF NOT EXISTS mcp_workload_tool_guardrails (
  id TEXT PRIMARY KEY,
  workload_namespace TEXT NOT NULL,
  workload_name TEXT NOT NULL,
  tool_namespace TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  guardrail_id TEXT NOT NULL,
  execution_timing TEXT NOT NULL,     -- 'pre-execution' or 'post-execution'
  source TEXT NOT NULL,               -- 'tool' (inherited) or 'workload' (added)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (guardrail_id) REFERENCES mcp_guardrails(id) ON DELETE RESTRICT,
  UNIQUE(workload_namespace, workload_name, tool_namespace, tool_name, guardrail_id)
);

CREATE INDEX IF NOT EXISTS idx_mcp_wtg_workload
  ON mcp_workload_tool_guardrails(workload_namespace, workload_name);
CREATE INDEX IF NOT EXISTS idx_mcp_wtg_tool
  ON mcp_workload_tool_guardrails(tool_namespace, tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_wtg_guardrail
  ON mcp_workload_tool_guardrails(guardrail_id);
```

#### TypeScript Interfaces

```typescript
// src/models/CatalogMcpGuardrail.ts
export interface CatalogMcpGuardrail {
  metadata: {
    name: string;
    namespace: string;
    description: string;
  };

  spec: {
    type: 'mcp-guardrail';
    deployment: string;
    parameters?: string;
    disabled?: boolean;
  };

  // Read-only fields from API
  usage?: {
    tools: ToolGuardrailAssociation[];
    workloadTools: WorkloadToolGuardrailAssociation[];
  };
}

export interface ToolGuardrailAssociation {
  toolNamespace: string;
  toolName: string;
  guardrailId: string;
  executionTiming: 'pre-execution' | 'post-execution';
}

export interface WorkloadToolGuardrailAssociation {
  workloadNamespace: string;
  workloadName: string;
  toolNamespace: string;
  toolName: string;
  guardrailId: string;
  executionTiming: 'pre-execution' | 'post-execution';
  source: 'tool' | 'workload';  // 'tool' = inherited, 'workload' = added at workload level
}

// Backend types (types.ts)
export interface Guardrail {
  id: string;
  namespace: string;
  name: string;
  description: string;
  deployment: string;
  parameters?: string;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGuardrailInput {
  metadata: {
    name: string;
    namespace?: string;
    description: string;
  };
  spec: {
    deployment: string;
    parameters?: string;
  };
}

export interface UpdateGuardrailInput {
  metadata?: {
    name?: string;
    description?: string;
  };
  spec?: {
    deployment?: string;
    parameters?: string;
    disabled?: boolean;
  };
}
```

#### Field Definitions

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `name` | string | Yes | Unique identifier within namespace | 1-63 chars, alphanumeric + hyphens |
| `namespace` | string | Yes | Namespace for isolation | Default: 'default' |
| `description` | string | Yes | Human-readable description | Max 1000 chars |
| `deployment` | string | Yes | Deployment information | Max 2000 chars |
| `parameters` | string | No | Optional parameters (JSON or text) | Max 10000 chars |
| `disabled` | boolean | No | Global disable flag | Default: false |

### Tool-Guardrail Association

Links a guardrail to a tool with execution timing.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tool_namespace` | string | Yes | Tool namespace |
| `tool_name` | string | Yes | Tool name |
| `guardrail_id` | string | Yes | Reference to guardrail |
| `execution_timing` | enum | Yes | 'pre-execution' or 'post-execution' |

### Workload-Tool-Guardrail Association

Links a guardrail to a specific workload-tool relationship.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `workload_namespace` | string | Yes | Workload namespace |
| `workload_name` | string | Yes | Workload name |
| `tool_namespace` | string | Yes | Tool namespace |
| `tool_name` | string | Yes | Tool name |
| `guardrail_id` | string | Yes | Reference to guardrail |
| `execution_timing` | enum | Yes | 'pre-execution' or 'post-execution' |
| `source` | enum | Yes | 'tool' (inherited) or 'workload' (added) |

## Relationships

```
┌─────────────┐
│  Guardrail  │
│             │
│ (database)  │
└──────┬──────┘
       │
       ├────────────────────────────────────┐
       │                                    │
       ▼                                    ▼
┌──────────────────┐              ┌────────────────────────┐
│ Tool-Guardrail   │              │ Workload-Tool-Guardrail │
│   Association    │              │      Association        │
│                  │              │                         │
│ execution_timing │              │ execution_timing        │
│                  │              │ source (tool/workload)  │
└────────┬─────────┘              └──────────┬──────────────┘
         │                                   │
         ▼                                   ▼
┌─────────────┐                   ┌─────────────┐  ┌─────────────┐
│    Tool     │                   │  Workload   │──│    Tool     │
│  (catalog)  │                   │ (database)  │  │  (catalog)  │
└─────────────┘                   └─────────────┘  └─────────────┘
```

- **Guardrail → Tool**: Many-to-many via `mcp_tool_guardrails`
- **Guardrail → Workload-Tool**: Many-to-many via `mcp_workload_tool_guardrails`
- Guardrails can be deleted only if no associations exist (RESTRICT)

## State Transitions

### Guardrail Lifecycle

```
[Create]
    │
    ▼
┌──────────┐     [Update]      ┌──────────┐
│ Enabled  │ ────────────────▶ │ Enabled  │
│          │ ◀──────────────── │ (edited) │
└──────────┘                   └──────────┘
    │                               │
    │ [Disable]              [Enable]
    ▼                               │
┌──────────┐                        │
│ Disabled │ ◀──────────────────────┘
│          │
└──────────┘
    │
    │ [Delete] (only if no references)
    ▼
┌──────────┐
│ Deleted  │  (row removed from database)
└──────────┘
```

### Tool-Guardrail Inheritance Flow

```
[Admin attaches guardrail to tool]
              │
              ▼
    ┌─────────────────┐
    │ Tool-Guardrail  │
    │  Association    │
    └────────┬────────┘
             │
             │ [User adds tool to workload]
             ▼
    ┌─────────────────────────┐
    │ Workload-Tool-Guardrail │
    │   (source='tool')       │
    │   [non-removable]       │
    └─────────────────────────┘
             │
             │ [User adds extra guardrail]
             ▼
    ┌─────────────────────────┐
    │ Workload-Tool-Guardrail │
    │   (source='workload')   │
    │   [removable]           │
    └─────────────────────────┘
```

## Validation Rules

### Create Guardrail

| Rule | Error |
|------|-------|
| Name unique in namespace | 409 Conflict: "Guardrail with this name already exists" |
| Name format valid | 400 Bad Request: "Invalid name format" |
| Description provided | 400 Bad Request: "Description is required" |
| Deployment provided | 400 Bad Request: "Deployment is required" |
| User has mcp-admin role | 403 Forbidden: "Insufficient permissions" |

### Update Guardrail

| Rule | Error |
|------|-------|
| Guardrail exists | 404 Not Found: "Guardrail not found" |
| New name unique (if renaming) | 409 Conflict: "Name already exists" |
| User has mcp-admin role | 403 Forbidden: "Insufficient permissions" |

### Delete Guardrail

| Rule | Error |
|------|-------|
| Guardrail exists | 404 Not Found: "Guardrail not found" |
| No tool associations | 409 Conflict: "Cannot delete: guardrail is attached to N tool(s)" |
| No workload associations | 409 Conflict: "Cannot delete: guardrail is attached to N workload-tool relationship(s)" |
| User has mcp-admin role | 403 Forbidden: "Insufficient permissions" |

### Attach Guardrail to Tool

| Rule | Error |
|------|-------|
| Guardrail exists | 404 Not Found: "Guardrail not found" |
| Tool exists (in catalog) | 404 Not Found: "Tool not found" |
| Not already attached | 409 Conflict: "Guardrail already attached to this tool" |
| Valid execution timing | 400 Bad Request: "Invalid execution timing" |
| User has mcp-admin role | 403 Forbidden: "Insufficient permissions" |

### Attach Guardrail to Workload-Tool

| Rule | Error |
|------|-------|
| Guardrail exists | 404 Not Found: "Guardrail not found" |
| Workload exists | 404 Not Found: "Workload not found" |
| Tool in workload's dependsOn | 400 Bad Request: "Tool not associated with workload" |
| Not already attached | 409 Conflict: "Guardrail already attached" |
| Valid execution timing | 400 Bad Request: "Invalid execution timing" |
| User has mcp-user role | 403 Forbidden: "Insufficient permissions" |

### Remove Guardrail from Workload-Tool

| Rule | Error |
|------|-------|
| Association exists | 404 Not Found: "Association not found" |
| Source is 'workload' | 403 Forbidden: "Cannot remove tool-level guardrails" |
| User has mcp-user role | 403 Forbidden: "Insufficient permissions" |
