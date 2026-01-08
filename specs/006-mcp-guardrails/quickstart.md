# Quickstart: MCP Guardrails Entity

**Feature Branch**: `006-mcp-guardrails`
**Date**: 2026-01-04

## Overview

This guide covers implementing the MCP Guardrails entity feature, which adds protection mechanisms for workload-tool relationships.

## Prerequisites

- Existing mcp-entity-api backend running
- OpenShift Console plugin deployed
- Understanding of existing entity patterns (servers, tools, workloads)

## Implementation Order

### Phase 1: Backend - Database & Types (P1)

1. **Update database.ts** - Add guardrails tables:

```typescript
// Add to initDatabase()
await db.run(`
  CREATE TABLE IF NOT EXISTS mcp_guardrails (
    id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    deployment TEXT NOT NULL,
    parameters TEXT,
    disabled INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(namespace, name)
  )
`);

await db.run(`
  CREATE TABLE IF NOT EXISTS mcp_tool_guardrails (
    id TEXT PRIMARY KEY,
    tool_namespace TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    guardrail_id TEXT NOT NULL,
    execution_timing TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guardrail_id) REFERENCES mcp_guardrails(id) ON DELETE RESTRICT,
    UNIQUE(tool_namespace, tool_name, guardrail_id)
  )
`);

await db.run(`
  CREATE TABLE IF NOT EXISTS mcp_workload_tool_guardrails (
    id TEXT PRIMARY KEY,
    workload_namespace TEXT NOT NULL,
    workload_name TEXT NOT NULL,
    tool_namespace TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    guardrail_id TEXT NOT NULL,
    execution_timing TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guardrail_id) REFERENCES mcp_guardrails(id) ON DELETE RESTRICT,
    UNIQUE(workload_namespace, workload_name, tool_namespace, tool_name, guardrail_id)
  )
`);
```

2. **Update types.ts** - Add interfaces:

```typescript
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
  source: 'tool' | 'workload';
}
```

### Phase 2: Backend - Service Layer (P1)

1. **Update service.ts** - Add guardrail CRUD:

```typescript
// Key methods to implement:
async listGuardrails(params: ListParams): Promise<ListResponse<Guardrail>>
async getGuardrail(namespace: string, name: string): Promise<GuardrailWithUsage | null>
async createGuardrail(input: CreateGuardrailInput): Promise<Guardrail>
async updateGuardrail(namespace: string, name: string, input: UpdateGuardrailInput): Promise<Guardrail>
async deleteGuardrail(namespace: string, name: string): Promise<void>
async setGuardrailDisabled(namespace: string, name: string, disabled: boolean): Promise<Guardrail>

// Tool-guardrail methods:
async listToolGuardrails(toolNamespace: string, toolName: string): Promise<ToolGuardrailAssociation[]>
async attachGuardrailToTool(toolNs: string, toolName: string, input: AttachGuardrailInput): Promise<ToolGuardrailAssociation>
async detachGuardrailFromTool(toolNs: string, toolName: string, guardrailNs: string, guardrailName: string): Promise<void>

// Workload-tool-guardrail methods:
async listWorkloadToolGuardrails(workloadNs: string, workloadName: string, toolNs: string, toolName: string): Promise<WorkloadToolGuardrailAssociation[]>
async addGuardrailToWorkloadTool(workloadNs: string, workloadName: string, toolNs: string, toolName: string, input: AttachGuardrailInput): Promise<WorkloadToolGuardrailAssociation>
async removeGuardrailFromWorkloadTool(workloadNs: string, workloadName: string, toolNs: string, toolName: string, guardrailNs: string, guardrailName: string): Promise<void>

// Inheritance when adding tool to workload:
async inheritToolGuardrailsToWorkload(workloadNs: string, workloadName: string, toolNs: string, toolName: string): Promise<void>
```

### Phase 3: Backend - Router (P1)

1. **Update router.ts** - Add endpoints following existing patterns:

```typescript
// GET /guardrails - list all
// POST /guardrails - create
// POST /guardrails/import - import from YAML
// GET /guardrails/:namespace/:name - get with usage
// PUT /guardrails/:namespace/:name - update
// DELETE /guardrails/:namespace/:name - delete
// POST /guardrails/:namespace/:name/disable - disable
// DELETE /guardrails/:namespace/:name/disable - enable

// Tool guardrail endpoints:
// GET /tools/:namespace/:name/guardrails
// POST /tools/:namespace/:name/guardrails
// DELETE /tools/:namespace/:name/guardrails/:guardrailNs/:guardrailName

// Workload-tool guardrail endpoints:
// GET /workloads/:workloadNs/:workloadName/tools/:toolNs/:toolName/guardrails
// POST /workloads/:workloadNs/:workloadName/tools/:toolNs/:toolName/guardrails
// DELETE /workloads/:workloadNs/:workloadName/tools/:toolNs/:toolName/guardrails/:guardrailNs/:guardrailName
```

### Phase 4: Frontend - Model & Service (P1)

1. **Create src/models/CatalogMcpGuardrail.ts**:

```typescript
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
  usage?: {
    tools: ToolGuardrailAssociation[];
    workloadTools: WorkloadToolGuardrailAssociation[];
  };
}
```

2. **Update src/services/catalogService.ts** - Add API hooks:

```typescript
export function useGuardrails() { /* ... */ }
export function useGuardrail(namespace: string, name: string) { /* ... */ }
export async function createGuardrail(data: CreateGuardrailInput) { /* ... */ }
export async function updateGuardrail(namespace: string, name: string, data: UpdateGuardrailInput) { /* ... */ }
export async function deleteGuardrail(namespace: string, name: string) { /* ... */ }
export async function setGuardrailDisabled(namespace: string, name: string, disabled: boolean) { /* ... */ }
```

### Phase 5: Frontend - Components (P1)

1. **Create src/components/GuardrailsTab.tsx** - Follow ServersTab pattern
2. **Create src/components/GuardrailsPage.tsx** - Follow McpServerPage pattern
3. **Create src/components/GuardrailForm.tsx** - Follow WorkloadForm pattern
4. **Update src/components/McpCatalogPage.tsx** - Add Guardrails tab

### Phase 6: Tool Guardrail Attachments (P2)

1. **Update src/components/McpToolPage.tsx** - Add guardrails section
2. **Update src/components/ToolsTab.tsx** - Show guardrail count (optional)

### Phase 7: Workload Guardrail Management (P2)

1. **Update src/components/McpWorkloadPage.tsx** - Show guardrails per tool
2. **Update src/components/WorkloadForm.tsx** - Add/remove workload-level guardrails
3. **Update workload service** - Call `inheritToolGuardrailsToWorkload` when adding tools

### Phase 8: Disable/Enable (P3)

1. **Add disable checkbox to GuardrailsTab.tsx**
2. **Show disabled state in all views**

## Testing

### Unit Tests

```bash
# Run all tests
cd backstage-app && yarn test

# Run specific test file
yarn test guardrail-service.test.ts
```

### Sanity Tests

```bash
# Run guardrail CRUD tests
./tests/sanity/guardrail-crud.sh
```

## Key Patterns

### RBAC

- **mcp-admin**: Guardrail CRUD, tool-level attachments
- **mcp-user**: Workload-level guardrail management only

### Deletion Protection

```typescript
// Check for references before deleting
const toolRefs = await getToolGuardrailCount(guardrailId);
const workloadRefs = await getWorkloadToolGuardrailCount(guardrailId);
if (toolRefs > 0 || workloadRefs > 0) {
  throw new ConflictError(`Cannot delete: guardrail has ${toolRefs + workloadRefs} reference(s)`);
}
```

### Inheritance

```typescript
// When tool is added to workload, copy tool-level guardrails
async function inheritToolGuardrailsToWorkload(workloadNs, workloadName, toolNs, toolName) {
  const toolGuardrails = await listToolGuardrails(toolNs, toolName);
  for (const tg of toolGuardrails) {
    await db.run(`
      INSERT OR IGNORE INTO mcp_workload_tool_guardrails
      (id, workload_namespace, workload_name, tool_namespace, tool_name, guardrail_id, execution_timing, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'tool')
    `, [uuid(), workloadNs, workloadName, toolNs, toolName, tg.guardrailId, tg.executionTiming]);
  }
}
```

## Deployment

No special deployment steps - uses existing mcp-entity-api and console plugin deployment pipeline.

```bash
# Build and deploy
./build-push-deploy-test.sh
```
