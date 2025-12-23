# Data Model: Entity Management API

**Feature**: 003-entity-management-api
**Date**: 2025-12-18

## Overview

This feature uses the existing Backstage Catalog as the data store. No new database tables or schemas are introduced. All entities are standard Backstage `Component` entities with MCP-specific `spec.type` values.

## Entity Types

### MCP Server

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiVersion` | string | Yes | `backstage.io/v1alpha1` |
| `kind` | string | Yes | `Component` |
| `metadata.name` | string | Yes | Unique identifier (lowercase, alphanumeric with dashes) |
| `metadata.namespace` | string | No | Defaults to `default` |
| `metadata.title` | string | No | Human-readable display name |
| `metadata.description` | string | No | Server description |
| `spec.type` | string | Yes | Must be `mcp-server` |
| `spec.lifecycle` | string | Yes | `production`, `experimental`, or `deprecated` |
| `spec.owner` | string | Yes | Owner reference (e.g., `user:default/jsmith`) |
| `spec.mcp.connectionType` | string | Yes | `stdio`, `sse`, or `websocket` |
| `spec.mcp.endpoint` | string | No | Connection URL (for network types) |
| `spec.mcp.command` | string | No | Start command (for stdio) |
| `spec.mcp.version` | string | Yes | Semantic version |
| `spec.mcp.capabilities` | string[] | No | `tools`, `resources`, `prompts`, `sampling` |

**Uniqueness**: `kind` + `metadata.namespace` + `metadata.name` (global)

**Relationships**:
- `hasPart` → MCP Tools (auto-generated from Tool's `partOf`)

### MCP Tool

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiVersion` | string | Yes | `backstage.io/v1alpha1` |
| `kind` | string | Yes | `Component` |
| `metadata.name` | string | Yes | Unique within parent server |
| `metadata.namespace` | string | No | Defaults to `default` |
| `metadata.title` | string | No | Human-readable tool name |
| `metadata.description` | string | No | Tool description |
| `spec.type` | string | Yes | Must be `mcp-tool` |
| `spec.lifecycle` | string | Yes | `production`, `experimental`, or `deprecated` |
| `spec.owner` | string | Yes | Owner reference |
| `spec.subcomponentOf` | string | Yes | Parent server ref (e.g., `component:default/my-server`) |
| `spec.mcp.inputSchema` | object | No | JSON Schema for tool inputs |
| `spec.mcp.category` | string | No | Tool category |
| `spec.mcp.parameters` | string[] | No | Simplified parameter list |

**Uniqueness**: `metadata.name` unique within scope of `spec.subcomponentOf` server

**Relationships**:
- `partOf` → Parent MCP Server (explicit via `spec.subcomponentOf`)
- `dependencyOf` → MCP Workloads that use this tool

### MCP Workload

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiVersion` | string | Yes | `backstage.io/v1alpha1` |
| `kind` | string | Yes | `Component` |
| `metadata.name` | string | Yes | Unique identifier |
| `metadata.namespace` | string | No | Defaults to `default` |
| `metadata.title` | string | No | Human-readable name |
| `metadata.description` | string | No | Workload description |
| `spec.type` | string | Yes | `mcp-workload`, `service`, or `workflow` |
| `spec.lifecycle` | string | Yes | `production`, `experimental`, or `deprecated` |
| `spec.owner` | string | Yes | Owner reference |
| `spec.dependsOn` | string[] | No | Tool references (e.g., `component:default/my-tool`) |
| `spec.mcp.purpose` | string | No | Business purpose |
| `spec.mcp.schedule` | string | No | `on-demand`, `daily`, `weekly` |
| `spec.mcp.runtime` | string | No | Runtime environment |

**Uniqueness**: `kind` + `metadata.namespace` + `metadata.name` (global)

**Relationships**:
- `dependsOn` → MCP Tools (explicit via `spec.dependsOn`)

## Relationship Diagram

```
┌─────────────────┐
│   MCP Server    │
│  (mcp-server)   │
└────────┬────────┘
         │ hasPart (1:N)
         ▼
┌─────────────────┐
│    MCP Tool     │◄─────── dependsOn (N:M) ────┐
│   (mcp-tool)    │                             │
└─────────────────┘                             │
                                    ┌───────────┴───────────┐
                                    │     MCP Workload      │
                                    │   (mcp-workload)      │
                                    └───────────────────────┘
```

## Delete Behavior

| Entity Type | Delete Behavior | Dependents |
|-------------|-----------------|------------|
| MCP Server | **Cascade** | All child MCP Tools are deleted |
| MCP Tool | **Orphan** | Workload `dependsOn` refs become dangling (allowed) |
| MCP Workload | **Orphan** | No dependents |

## Validation Rules

### FR-006: Schema Validation

1. All required fields must be present
2. `spec.type` must match entity type (`mcp-server`, `mcp-tool`, `mcp-workload`)
3. `metadata.name` must match pattern: `^[a-z0-9]+(?:[-][a-z0-9]+)*$`
4. `spec.mcp.version` (servers) must be valid semver: `^[0-9]+\.[0-9]+\.[0-9]+$`
5. Entity references must be valid format: `component:namespace/name`

### FR-009/FR-010: Uniqueness Validation

1. **Servers/Workloads**: Check catalog for existing entity with same `kind:namespace/name`
2. **Tools**: Check catalog for existing tool with same name under same parent server

### FR-007: Cascade Delete Validation

Before deleting a server:
1. Query: `GET /entities?filter=spec.subcomponentOf=component:${namespace}/${serverName}`
2. Delete all returned tools
3. Delete server

## State Transitions

Entities do not have explicit state machines. The `spec.lifecycle` field indicates maturity:

```
experimental → production → deprecated
```

Transitions are managed via UPDATE operations. No restrictions on transitions.
