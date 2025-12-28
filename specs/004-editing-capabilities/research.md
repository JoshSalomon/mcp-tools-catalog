# Research: Editing Capabilities

**Feature**: 004-editing-capabilities
**Date**: 2025-12-18

## Research Topics

### 1. Batch State Management Pattern for React

**Decision**: Use React state to track pending changes, persist only on Save click.

**Rationale**:
- Standard React pattern for form editing
- Allows Cancel to revert to original state
- Enables optimistic UI updates before persistence
- Matches existing codebase patterns (React hooks, state management)
- No additional dependencies required

**Implementation Pattern**:
```typescript
// Pseudocode for batch tool state management
const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
const [originalStates, setOriginalStates] = useState<Map<string, boolean>>(new Map());
const [hasChanges, setHasChanges] = useState(false);

const handleToggle = (toolId: string, newState: boolean) => {
  setPendingChanges(prev => new Map(prev).set(toolId, newState));
  setHasChanges(true); // Enable Save/Cancel buttons
};

const handleSave = async () => {
  // Batch API calls for all pending changes
  await Promise.all(Array.from(pendingChanges.entries()).map(([id, state]) => 
    updateToolState(id, state)
  ));
  setPendingChanges(new Map());
  setHasChanges(false);
};

const handleCancel = () => {
  setPendingChanges(new Map());
  setHasChanges(false);
  // Revert UI to originalStates
};
```

**Alternatives Considered**:
- **Immediate persistence (current)**: Rejected - doesn't meet spec requirement for Save/Cancel workflow (FR-003)
- **Redux/Context for global state**: Rejected - overkill for component-local editing state, adds unnecessary complexity
- **Optimistic updates with rollback**: Considered but not needed - simple state reversion sufficient for Cancel operation

**References**:
- React Hooks documentation: useState for local component state
- Existing codebase: `useToolDisabledState` hook pattern (to be modified)

---

### 2. Server/Tool Tree Component for Workload Creation

**Decision**: Use PatternFly TreeView component with expandable server nodes and tool checkboxes.

**Rationale**:
- PatternFly TreeView provides standard OpenShift Console UI pattern
- Supports expand/collapse for hierarchical data (servers → tools)
- Can integrate checkboxes for tool selection
- Matches existing PatternFly component usage in codebase
- No custom tree implementation needed

**Implementation Pattern**:
```typescript
// Pseudocode for server/tool tree
import { TreeView, TreeViewNode } from '@patternfly/react-core';

<TreeView>
  {servers.map(server => (
    <TreeViewNode key={server.id} title={server.name}>
      {server.tools.map(tool => (
        <TreeViewNode
          key={tool.id}
          title={
            <Checkbox
              isChecked={selectedTools.has(tool.id)}
              isDisabled={tool.disabled}
              onChange={() => toggleTool(tool.id)}
            >
              {tool.name}
            </Checkbox>
          }
        />
      ))}
    </TreeViewNode>
  ))}
</TreeView>
```

**Alternatives Considered**:
- **Custom tree component**: Rejected - reinvents PatternFly functionality, violates DRY principle
- **Flat list with grouping**: Rejected - doesn't match spec requirement for tree view (FR-010, FR-011)
- **Backstage catalog-graph plugin**: Rejected - designed for relationship graphs, not hierarchical selection UI
- **Material UI TreeView**: Rejected - codebase uses PatternFly for OpenShift Console consistency

**References**:
- PatternFly React TreeView: https://www.patternfly.org/v4/components/tree-view
- Existing codebase: PatternFly components in `src/components/`

---

### 3. Conflict Detection for Concurrent Edits

**Decision**: Use `metadata.lastModified` timestamp from Backstage entity to detect conflicts.

**Rationale**:
- Standard HTTP pattern for optimistic concurrency control
- Backstage Catalog entities include `metadata.lastModified` field
- Can compare edit start time with current entity timestamp
- Minimal API changes required (read existing field)
- Works with existing Backstage catalog model

**Implementation Pattern**:
```typescript
// Pseudocode for conflict detection
const [editStartTime, setEditStartTime] = useState<string | null>(null);

const startEdit = async (workloadId: string) => {
  const workload = await fetchWorkload(workloadId);
  setEditStartTime(workload.metadata.lastModified);
  // ... populate form with workload data
};

const handleSave = async () => {
  // Fetch current entity to check for conflicts
  const current = await fetchWorkload(workloadId);
  if (current.metadata.lastModified !== editStartTime) {
    // Conflict detected - show dialog
    setShowConflictDialog(true);
    setConflictData({
      original: editStartTime,
      current: current.metadata.lastModified
    });
    return;
  }
  // No conflict - proceed with save
  await updateWorkload(workloadId, formData);
};
```

**Alternatives Considered**:
- **Optimistic locking with version numbers**: Considered but Backstage uses timestamps, not version numbers
- **Pessimistic locking (lock entity during edit)**: Rejected - complex, requires backend changes, blocks other users unnecessarily
- **No conflict detection**: Rejected - spec requires conflict warning (FR-027, FR-028)
- **ETag headers**: Considered but Backstage API may not support ETags consistently

**References**:
- Backstage catalog-model: Entity.metadata.lastModified field
- Existing codebase: Entity fetching in `catalogService.ts`

---

### 4. Workload Form State Management

**Decision**: Use React state with controlled inputs, validate on Save click.

**Rationale**:
- Standard React form pattern, no additional dependencies
- Allows real-time validation feedback
- Enables Save/Cancel button state management (FR-020)
- Matches existing form patterns in codebase
- Simple and maintainable

**Implementation Pattern**:
```typescript
// Pseudocode for workload form
interface WorkloadFormData {
  name: string;
  namespace: string;
  description?: string;
  lifecycle?: string;
  owner?: string;
  selectedTools: Set<string>;
}

const [formData, setFormData] = useState<WorkloadFormData>({
  name: '',
  namespace: 'default',
  description: '',
  lifecycle: 'experimental',
  owner: '',
  selectedTools: new Set()
});

const [errors, setErrors] = useState<Record<string, string>>({});
const [hasChanges, setHasChanges] = useState(false);

const validate = (): boolean => {
  const newErrors: Record<string, string> = {};
  if (!formData.name.trim()) newErrors.name = 'Name is required';
  if (!formData.namespace.trim()) newErrors.namespace = 'Namespace is required';
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

const handleSave = async () => {
  if (!validate()) return;
  // API call to create/update workload
  await (isEditMode ? updateWorkload : createWorkload)(formData);
};
```

**Alternatives Considered**:
- **Formik/Yup**: Considered but adds dependency, simple forms don't need it, increases bundle size
- **React Hook Form**: Considered but overkill for this use case, adds dependency
- **Uncontrolled inputs**: Rejected - need validation and change tracking for Save/Cancel buttons
- **Redux form state**: Rejected - form state is component-local, no need for global state

**References**:
- React Forms: https://react.dev/reference/react-dom/components/form
- Existing codebase: Form patterns in other components

---

### 5. Permission Checking for UI Elements

**Decision**: Use existing `useCanEditCatalog` hook pattern, extend for mcp-user role check.

**Rationale**:
- Existing codebase has `authService.ts` with permission checking
- Pattern already established for mcp-admin checks
- Can extend to check mcp-user role for workload operations
- Consistent with existing RBAC implementation

**Implementation Pattern**:
```typescript
// Extend existing authService.ts
export const useCanEditWorkloads = (): { canEdit: boolean; loaded: boolean } => {
  // Check for mcp-user role via existing RBAC check mechanism
  // Similar to useCanEditCatalog but checks mcp-user instead of mcp-admin
};
```

**Alternatives Considered**:
- **New permission service**: Rejected - duplicates existing pattern
- **Inline permission checks**: Rejected - violates DRY, harder to test
- **Backend permission check on every API call**: Already implemented in spec 003, frontend check is for UI optimization

**References**:
- Existing codebase: `src/services/authService.ts`
- Spec 003: RBAC implementation in backend

---

## Summary Table

| Research Item | Decision | Rationale |
|--------------|----------|-----------|
| Batch state management | React useState with Map | Standard pattern, no dependencies, enables Cancel |
| Server/tool tree UI | PatternFly TreeView | OpenShift Console standard, supports hierarchy |
| Conflict detection | metadata.lastModified timestamp | Standard Backstage pattern, no API changes |
| Form state management | React controlled inputs | Standard pattern, no dependencies, simple |
| Permission checking | Extend existing authService | Consistent with existing patterns, DRY |

---

## Next Steps

With research complete, proceed to Phase 1:
1. Generate `data-model.md` with detailed data structures
2. Generate `contracts/editing-api.yaml` with frontend API service interfaces
3. Generate `quickstart.md` with user-facing workflows
4. Update agent context with new components
