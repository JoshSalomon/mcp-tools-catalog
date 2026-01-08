# MCP Guardrails Entity - Implementation Summary

**Feature Branch**: `006-mcp-guardrails`
**Date Started**: 2026-01-04
**Date Completed**: 2026-01-08
**Status**: Complete

## Overview

This feature adds MCP Guardrails as a new entity type to the MCP Tools Catalog. Guardrails are protection mechanisms that can be attached to tools and workload-tool relationships, providing pre-execution and post-execution validation, rate limiting, authentication, and other safety controls.

## User Stories Implemented

| ID | Priority | Description |
|----|----------|-------------|
| US1 | P1 | Browse and manage guardrails (list, view details, edit, delete) |
| US2 | P1 | Create guardrails via form UI and YAML import |
| US3 | P2 | Attach/detach guardrails to tools with execution timing |
| US4 | P2 | Manage guardrails on workload-tool relationships with inheritance |
| US5 | P3 | Globally disable/enable guardrails without removing them |

## Architecture

### Data Model

Three new database tables were added:

```sql
-- Core guardrail entity
mcp_guardrails (
  id, namespace, name, description, deployment,
  parameters, disabled, created_at, updated_at
)

-- Tool-level guardrail associations
mcp_tool_guardrails (
  id, tool_namespace, tool_name, guardrail_id,
  execution_timing, parameters, created_at
)

-- Workload-tool-guardrail associations (with inheritance tracking)
mcp_workload_tool_guardrails (
  id, workload_namespace, workload_name,
  tool_namespace, tool_name, guardrail_id,
  execution_timing, source, parameters, created_at
)
```

### API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/guardrails` | List all guardrails | - |
| POST | `/guardrails` | Create guardrail | mcp-admin |
| POST | `/guardrails/import` | Import from YAML | mcp-admin |
| POST | `/guardrails/preview` | Preview YAML import | mcp-admin |
| GET | `/guardrails/:ns/:name` | Get guardrail with usage | - |
| PUT | `/guardrails/:ns/:name` | Update guardrail | mcp-admin |
| DELETE | `/guardrails/:ns/:name` | Delete guardrail | mcp-admin |
| GET | `/tools/:ns/:name/guardrails` | List tool guardrails | - |
| POST | `/tools/:ns/:name/guardrails` | Attach guardrail to tool | mcp-admin |
| DELETE | `/tools/:ns/:name/guardrails/:gNs/:gName` | Detach from tool | mcp-admin |
| GET | `/workloads/:wNs/:wName/tools/:tNs/:tName/guardrails` | List workload-tool guardrails | - |
| POST | `/workloads/:wNs/:wName/tools/:tNs/:tName/guardrails` | Add guardrail | mcp-user |
| PUT | `/workloads/:wNs/:wName/tools/:tNs/:tName/guardrails/:gNs/:gName` | Update guardrail | mcp-user |
| DELETE | `/workloads/:wNs/:wName/tools/:tNs/:tName/guardrails/:gNs/:gName` | Remove guardrail | mcp-user |

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `GuardrailsTab.tsx` | List view with search, pagination, actions menu |
| `GuardrailsPage.tsx` | Detail view with usage information |
| `GuardrailForm.tsx` | Create/edit form with validation |
| `GuardrailCreatePage.tsx` | Standalone create page |
| `GuardrailEditPage.tsx` | Standalone edit page |
| `CatalogMcpGuardrail.ts` | TypeScript model interface |

## Key Features

### 1. Guardrail CRUD (US1 & US2)

- Create guardrails with name, description, deployment configuration, and optional parameters
- Import single or multiple guardrails from YAML files
- Multi-document YAML support with preview before import
- Duplicate name detection and validation
- Rename guardrails with conflict checking

### 2. Tool-Guardrail Associations (US3)

- Attach guardrails to tools with execution timing (pre-execution or post-execution)
- Optional parameters per association for customization
- Visual display on tool detail page with attach/detach UI
- Duplicate attachment prevention

### 3. Workload-Tool-Guardrail Management (US4)

- **Inheritance**: When a tool is added to a workload, tool-level guardrails are automatically copied with `source='tool'`
- **Workload-level additions**: Users can add additional guardrails with `source='workload'`
- **Source distinction**: Inherited guardrails (source='tool') cannot be removed; workload-level guardrails can
- **Edit capability**: Timing and parameters can be edited on workload-level guardrails
- Visual indicators distinguish inherited vs. workload-level guardrails

### 4. Disable/Enable (US5)

- Toggle guardrails globally without removing associations
- Disabled guardrails are visually indicated in all views
- Create guardrails as disabled initially
- Import YAML with disabled state

### 5. Deletion Protection

Guardrails with active associations cannot be deleted:
```
Cannot delete: guardrail has 5 reference(s) (2 tool(s), 3 workload-tool relationship(s))
```

### 6. RBAC

| Role | Permissions |
|------|-------------|
| mcp-admin | Full guardrail CRUD, tool-level associations |
| mcp-user | View guardrails, manage workload-level guardrails only |

## Files Modified/Created

### Backend (`backstage-app/packages/backend/src/plugins/mcp-entity-api/`)

| File | Changes |
|------|---------|
| `database.ts` | Added 3 tables, 20+ database methods for guardrail operations |
| `types.ts` | Added Guardrail, ToolGuardrailAssociation, WorkloadToolGuardrailAssociation interfaces |
| `service.ts` | Added 15+ service methods for guardrail business logic |
| `router.ts` | Added 14 API endpoints |
| `validation.ts` | Added guardrail validation rules |
| `__tests__/guardrail-service.test.ts` | 67 unit tests for guardrail operations |

### Frontend (`src/`)

| File | Changes |
|------|---------|
| `models/CatalogMcpGuardrail.ts` | New - Frontend model interface |
| `models/index.ts` | Export CatalogMcpGuardrail |
| `services/catalogService.ts` | Added 15+ hooks and functions for guardrail API |
| `services/authService.ts` | Added useCanEditGuardrails hook |
| `components/GuardrailsTab.tsx` | New - List view with actions |
| `components/GuardrailsPage.tsx` | New - Detail view |
| `components/GuardrailForm.tsx` | New - Create/edit form |
| `components/GuardrailCreatePage.tsx` | New - Create page |
| `components/GuardrailEditPage.tsx` | New - Edit page |
| `components/McpCatalogPage.tsx` | Added Guardrails tab |
| `components/McpToolPage.tsx` | Added guardrails section with attach/detach |
| `components/McpWorkloadPage.tsx` | Added guardrails per tool with inheritance display |
| `components/shared/Breadcrumbs.tsx` | Added guardrail breadcrumb support |

### Tests (`tests/sanity/`)

| File | Changes |
|------|---------|
| `guardrail-crud.sh` | New - 89 API sanity tests |
| `run-sanity-tests.sh` | Added guardrail tests to suite |

### Configuration

| File | Changes |
|------|---------|
| `console-extensions.json` | Added guardrail routes |
| `package.json` | Version bump |
| `.eslintrc.yml` | Added test file overrides |

## Validation

### Unit Tests
- 125 tests passing (Jest)
- Coverage: guardrail service, validation, CRUD operations

### Sanity Tests
- 89 API tests passing
- Coverage: all endpoints, RBAC, validation, edge cases

### Build
- TypeScript compilation: Success
- Webpack build: Success
- Lint: 0 errors (42 pre-existing warnings)

## UI Screenshots (Conceptual)

### Guardrails List
- Table with Name, Namespace, Description, Deployment, Status columns
- Actions menu: Edit, Enable/Disable, Delete
- Create button and Import YAML button
- Search and pagination

### Guardrail Detail
- Full information display
- Usage section showing tool and workload-tool associations
- Edit and Delete buttons (with protection for associated guardrails)

### Tool Page - Guardrails Section
- Expandable section showing attached guardrails
- Attach guardrail dropdown (for mcp-admin)
- Execution timing labels (pre-execution / post-execution)
- Detach action per guardrail

### Workload Page - Tool Guardrails
- Per-tool expandable sections
- Guardrails table with source indicator (Inherited / Workload-level)
- Inherited guardrails shown as non-removable
- Add/Edit/Remove actions for workload-level guardrails

## Known Limitations

1. Parameters field is free-form text (not validated as JSON/YAML)
2. No bulk operations for guardrail management
3. Inheritance is copy-on-add (changes to tool guardrails don't propagate to existing workloads)

## Future Enhancements

1. Parameter schema validation per guardrail type
2. Guardrail templates/presets
3. Bulk enable/disable operations
4. Audit logging for guardrail changes
5. Sync inheritance option for tool guardrail updates
