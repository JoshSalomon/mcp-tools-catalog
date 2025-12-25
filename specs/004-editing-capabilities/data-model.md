# Data Model: Editing Capabilities

**Feature**: 004-editing-capabilities
**Date**: 2025-12-18

## Overview

This document defines the data structures used for editing capabilities in the MCP Tools Catalog frontend. All entities follow Backstage catalog-model conventions and integrate with the existing Entity Management API (spec 003).

## Core Entities

### Tool State Management

#### PendingToolStateChanges

In-memory state tracking for batch tool state modifications before persistence.

**Type**: `Map<string, boolean>`

**Fields**:
- **Key**: Tool entity reference (e.g., `"component:default/my-tool"`)
- **Value**: New disabled state (`true` = disabled, `false` = enabled)

**Usage**: Tracks pending changes in `ToolStateEditor` component. Cleared on Save or Cancel.

**Example**:
```typescript
const pendingChanges = new Map<string, boolean>();
pendingChanges.set('component:default/github-create-issue', true);  // Disable tool
pendingChanges.set('component:default/file-read', false);            // Enable tool
```

#### OriginalToolStates

Snapshot of tool states at edit start, used for Cancel operation.

**Type**: `Map<string, boolean>`

**Fields**:
- **Key**: Tool entity reference
- **Value**: Original disabled state before edits

**Usage**: Stored when editing starts, used to revert UI on Cancel.

---

### Workload Form Data

#### WorkloadFormData

Form state for creating or editing workloads.

**Type**: TypeScript interface

**Fields**:
- **name** (string, required): Workload name (FR-034)
- **namespace** (string, required): Workload namespace (FR-034)
- **description** (string, optional): Workload description (FR-035)
- **lifecycle** (string, optional): Workload lifecycle stage (FR-035)
- **owner** (string, optional): Workload owner entity reference (FR-035)
- **selectedTools** (Set<string>, optional): Set of selected tool entity references (FR-029 allows empty)

**Validation Rules**:
- `name`: Required, non-empty string (FR-034)
- `namespace`: Required, non-empty string (FR-034)
- `description`: Optional, can be empty
- `lifecycle`: Optional, typically one of: 'experimental', 'production', 'deprecated'
- `owner`: Optional, entity reference format (e.g., `"user:default/admin"`)
- `selectedTools`: Optional, can be empty set (FR-029)

**Example**:
```typescript
const formData: WorkloadFormData = {
  name: 'my-workload',
  namespace: 'default',
  description: 'Sample workload',
  lifecycle: 'experimental',
  owner: 'user:default/admin',
  selectedTools: new Set([
    'component:default/github-create-issue',
    'component:default/file-read'
  ])
};
```

#### WorkloadFormErrors

Validation errors for workload form fields.

**Type**: `Record<string, string>`

**Fields**:
- **Key**: Field name (e.g., `"name"`, `"namespace"`)
- **Value**: Error message string

**Usage**: Displayed inline with form fields when validation fails (FR-025).

**Example**:
```typescript
const errors: WorkloadFormErrors = {
  name: 'Name is required',
  namespace: 'Namespace cannot be empty'
};
```

---

### Conflict Detection

#### ConflictState

Tracks conflict detection state for concurrent edits.

**Type**: TypeScript interface

**Fields**:
- **editStartTime** (string | null): Timestamp when edit started (`metadata.lastModified` from entity)
- **currentEntityTimestamp** (string | null): Current entity timestamp when conflict detected
- **showDialog** (boolean): Whether to show conflict resolution dialog

**Usage**: Detects when workload was modified by another user during edit (FR-027, FR-028).

**Example**:
```typescript
const conflictState: ConflictState = {
  editStartTime: '2025-12-18T10:00:00Z',
  currentEntityTimestamp: '2025-12-18T10:05:00Z',  // Different = conflict
  showDialog: true
};
```

---

## Entity Relationships

### Tool → Server Relationship

Tools reference their parent server via `spec.subcomponentOf`:

```typescript
{
  metadata: { name: 'my-tool', namespace: 'default' },
  spec: {
    type: 'mcp-tool',
    subcomponentOf: 'component:default/my-server'  // Parent server reference
  }
}
```

**Usage**: Used to group tools by server in the workload creation tree (FR-010, FR-011).

### Workload → Tool Relationship

Workloads reference tools via `spec.dependsOn`:

```typescript
{
  metadata: { name: 'my-workload', namespace: 'default' },
  spec: {
    type: 'mcp-workload',
    dependsOn: [
      'component:default/tool-1',
      'component:default/tool-2'
    ]
  }
}
```

**Usage**: Defines which tools are selected for a workload (FR-019, FR-012).

---

## State Transitions

### Tool State Editing Flow

```
[Initial State]
  ↓
[User toggles tool checkbox]
  ↓
[PendingChanges updated, hasChanges = true]
  ↓
[Save clicked] → [Batch API calls] → [PendingChanges cleared, hasChanges = false]
  OR
[Cancel clicked] → [Revert to OriginalStates] → [PendingChanges cleared, hasChanges = false]
```

### Workload Creation Flow

```
[Empty Form]
  ↓
[User fills form, selects tools]
  ↓
[hasChanges = true, Save enabled]
  ↓
[Save clicked] → [Validate] → [Create API call] → [Navigate to workloads list]
  OR
[Cancel clicked] → [Clear form] → [Navigate to workloads list]
```

### Workload Edit Flow

```
[Load workload data]
  ↓
[Populate form, set editStartTime]
  ↓
[User modifies form]
  ↓
[hasChanges = true, Save enabled]
  ↓
[Save clicked] → [Check conflict] → [If conflict: show dialog, else: update API call]
  OR
[Cancel clicked] → [Clear changes] → [Navigate to workloads list]
```

---

## Data Validation Rules

### Tool State Changes

- **No validation required**: Boolean state changes are always valid
- **Permission check**: Must have mcp-admin role (FR-031)
- **Batch size**: No limit (all tools on server can be modified)

### Workload Form

- **name**: Required, non-empty, valid entity name format (FR-034)
- **namespace**: Required, non-empty, valid namespace format (FR-034)
- **description**: Optional, can be empty (FR-035)
- **lifecycle**: Optional, if provided must be valid lifecycle stage (FR-035)
- **owner**: Optional, if provided must be valid entity reference format (FR-035)
- **selectedTools**: Optional, can be empty set (FR-029)
- **Uniqueness**: Name + namespace must be unique (handled by API, spec 003)

---

## API Integration

### Tool State Updates

Uses existing annotation update mechanism:

```typescript
// Current implementation (to be modified for batch)
updateEntityAnnotation<CatalogMcpTool>(
  entityRef,
  'mcp-catalog.io/disabled',
  isDisabled ? 'true' : null
);
```

**Batch version**:
```typescript
// New batch update function
async function batchUpdateToolStates(
  changes: Map<string, boolean>
): Promise<void> {
  await Promise.all(
    Array.from(changes.entries()).map(([entityRef, isDisabled]) =>
      updateEntityAnnotation<CatalogMcpTool>(
        entityRef,
        'mcp-catalog.io/disabled',
        isDisabled ? 'true' : null
      )
    )
  );
}
```

### Workload CRUD Operations

Uses Entity Management API endpoints (spec 003):

```typescript
// Create
POST /api/mcp-entity-api/workloads
Body: WorkloadInput

// Update
PUT /api/mcp-entity-api/workloads/{namespace}/{name}
Body: WorkloadInput

// Delete
DELETE /api/mcp-entity-api/workloads/{namespace}/{name}

// Get (for conflict detection)
GET /api/mcp-entity-api/workloads/{namespace}/{name}
Response: WorkloadEntity (includes metadata.lastModified)
```

---

## TypeScript Definitions

```typescript
// Tool state management
type PendingToolStateChanges = Map<string, boolean>;
type OriginalToolStates = Map<string, boolean>;

// Workload form
interface WorkloadFormData {
  name: string;
  namespace: string;
  description?: string;
  lifecycle?: string;
  owner?: string;
  selectedTools: Set<string>;
}

type WorkloadFormErrors = Record<string, string>;

// Conflict detection
interface ConflictState {
  editStartTime: string | null;
  currentEntityTimestamp: string | null;
  showDialog: boolean;
}

// Component state
interface ToolStateEditorState {
  pendingChanges: PendingToolStateChanges;
  originalStates: OriginalToolStates;
  hasChanges: boolean;
  isSaving: boolean;
  error: Error | null;
}

interface WorkloadFormState {
  formData: WorkloadFormData;
  errors: WorkloadFormErrors;
  hasChanges: boolean;
  isSaving: boolean;
  isEditMode: boolean;
  conflictState: ConflictState;
  error: Error | null;
}
```

---

## Notes

- All entity references use Backstage EntityRef format: `kind:namespace/name`
- Tool disabled state stored as annotation: `mcp-catalog.io/disabled = "true"` or absent
- Workload tool selections stored in `spec.dependsOn` array
- Conflict detection uses `metadata.lastModified` timestamp comparison
- Form validation occurs client-side before API calls (FR-024, FR-025)
