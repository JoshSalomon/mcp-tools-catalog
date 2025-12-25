# Implementation Plan: Editing Capabilities

**Branch**: `004-editing-capabilities` | **Date**: 2025-12-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-editing-capabilities/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature adds editing capabilities to the MCP Tools Catalog frontend plugin, enabling users to:
1. **Batch persist tool state changes** with Save/Cancel workflow (replacing immediate persistence)
2. **Create new workloads** via a form-based UI with server/tool tree selection
3. **Edit existing workloads** using the same form, pre-populated with current data
4. **Delete workloads** via action menu

The implementation leverages existing backend APIs from spec 003 (Entity Management API) and extends the frontend React components with new editing workflows. All operations enforce RBAC (mcp-admin for tool states, mcp-user for workloads).

## Technical Context

**Language/Version**: TypeScript 4.7+, Node.js 18+  
**Primary Dependencies**: 
- React 17.x
- @openshift-console/dynamic-plugin-sdk 1.4.0
- @patternfly/react-core 6.2+ (OpenShift Console UI standard)
- @backstage/catalog-model ^1.7.5 (peerDependency)
- Existing API endpoints from `/api/mcp-entity-api/` (spec 003)

**Storage**: Backstage Catalog database (via Entity Management API backend plugin)  
**Testing**: Jest 28+ with React Testing Library, ts-jest 29+  
**Target Platform**: OpenShift Console dynamic plugin (frontend-only)  
**Project Type**: Frontend React plugin (single project structure)  
**Performance Goals**: 
- Tool state save: <30 seconds for batch changes (SC-001)
- Workload create/edit: <2 minutes end-to-end (SC-003, SC-005)
- Validation errors: <1 second display (SC-008)

**Constraints**: 
- Must work with existing OpenShift Console plugin architecture
- Must use PatternFly React components (OpenShift Console standard)
- Must integrate with existing Backstage Catalog API proxy
- RBAC enforcement via existing mcp-admin and mcp-user roles

**Scale/Scope**: 
- Frontend-only changes (no backend modifications)
- 4 user stories, 35 functional requirements
- 3 new React components (WorkloadForm, ToolStateEditor, ConflictDialog)
- Extensions to 2 existing components (McpServerPage, WorkloadsTab)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Security-First ✅
- **Status**: PASS
- **Rationale**: 
  - RBAC enforcement via existing mcp-admin/mcp-user roles (FR-031, FR-032)
  - Permission checks before enabling editing UI (FR-033)
  - No new authentication mechanisms introduced
  - All API calls use existing secure proxy endpoints

### II. Configuration-First ✅
- **Status**: PASS
- **Rationale**: 
  - No configuration changes required
  - UI behavior driven by user roles (already configured)
  - All editing capabilities are code-based features

### III. Container-Ready ✅
- **Status**: PASS
- **Rationale**: 
  - Frontend-only changes, no container modifications
  - Existing plugin container structure unchanged

### IV. Test-First Development ✅
- **Status**: PASS
- **Rationale**: 
  - Unit tests required for new components (WorkloadForm, ToolStateEditor)
  - Integration tests for Save/Cancel workflows
  - Permission-based UI tests for role enforcement

### V. Component Isolation ✅
- **Status**: PASS
- **Rationale**: 
  - Frontend-only feature, no backend changes
  - Extends existing components without breaking changes
  - Can be developed and tested independently

### VI. Backstage Software Catalog First ✅
- **Status**: PASS
- **Rationale**: 
  - Uses existing Entity Management API (spec 003) for all CRUD operations
  - No new entity stores or databases introduced
  - All persistence via Backstage Catalog database
  - Tool state changes use existing annotation update mechanism

### VII. Vanilla OpenShift Platform Target ✅
- **Status**: PASS
- **Rationale**: 
  - Uses standard OpenShift Console plugin SDK
  - PatternFly React components (OpenShift standard)
  - No proprietary extensions required

### VIII. TypeScript-First Development ✅
- **Status**: PASS
- **Rationale**: 
  - All new code in TypeScript with strict mode
  - Extends existing TypeScript components
  - Type-safe API integration

### IX. Strict Typing for Python ✅
- **Status**: N/A
- **Rationale**: No Python code in this feature

### X. Red Hat Registry First ✅
- **Status**: N/A
- **Rationale**: Frontend-only feature, no container images

### XI. User Verification of Fixes ✅
- **Status**: PASS
- **Rationale**: User approval workflow for conflict resolution (FR-028)

**GATE RESULT**: ✅ ALL CHECKS PASS - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/004-editing-capabilities/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── McpServerPage.tsx           # Extend: Add Save/Cancel buttons, batch state management
│   ├── WorkloadsTab.tsx            # Extend: Add Create button, Edit/Delete menu items
│   ├── WorkloadForm.tsx            # NEW: Create/Edit workload form component
│   ├── ToolStateEditor.tsx         # NEW: Batch tool state editor with Save/Cancel
│   ├── ConflictDialog.tsx          # NEW: Conflict resolution dialog
│   └── shared/
│       ├── DisabledCheckbox.tsx    # Modify: Remove immediate persistence, use callback
│       └── [existing shared components unchanged]
├── hooks/
│   ├── useToolDisabledState.ts     # Modify: Remove immediate persistence, return state only
│   ├── useWorkloadForm.ts          # NEW: Form state management for workload create/edit
│   └── useBatchToolState.ts        # NEW: Batch tool state management with Save/Cancel
├── services/
│   ├── catalogService.ts           # Extend: Add workload CRUD API calls
│   ├── authService.ts              # Extend: Add mcp-user role check (if not exists)
│   └── [existing services unchanged]
└── models/
    └── [existing models unchanged]

tests/
├── unit/
│   ├── WorkloadForm.test.tsx       # NEW: Form validation, tool selection tests
│   ├── ToolStateEditor.test.tsx   # NEW: Batch state management tests
│   ├── ConflictDialog.test.tsx     # NEW: Conflict resolution tests
│   └── [existing tests unchanged]
└── integration/
    └── [existing integration tests unchanged]
```

**Structure Decision**: Extends existing single-project frontend structure. New components follow existing patterns (PatternFly React, TypeScript strict mode). No new directories or architectural changes required.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - all constitution checks pass.

---

## Phase 0: Outline & Research

**Status**: ✅ **COMPLETE** - See `research.md` for detailed research findings.

### Research Topics Resolved

1. **Batch State Management Pattern**: React useState with Map for pending changes
2. **Server/Tool Tree Component**: PatternFly TreeView with expandable nodes
3. **Conflict Detection**: metadata.lastModified timestamp comparison
4. **Workload Form State**: React controlled inputs with validation
5. **Permission Checking**: Extend existing authService pattern

**Output**: `research.md` with all decisions documented

---

## Phase 1: Design & Contracts

**Status**: ✅ **COMPLETE** - All design artifacts generated.

### Data Model

**Status**: ✅ **COMPLETE** - See `data-model.md` for detailed entity definitions.

**Key Entities**:
- **PendingToolStateChanges**: Map of tool ID → new disabled state (in-memory only)
- **WorkloadFormData**: Form state for create/edit (name, namespace, description, lifecycle, owner, selectedTools)
- **ConflictState**: Tracks conflict detection (editStartTime, currentEntityTimestamp)

### API Contracts

**Status**: ✅ **COMPLETE** - See `contracts/editing-api.yaml` for detailed API specifications.

**Existing Endpoints (from spec 003)**:
- `POST /api/mcp-entity-api/workloads` - Create workload
- `PUT /api/mcp-entity-api/workloads/{namespace}/{name}` - Update workload
- `DELETE /api/mcp-entity-api/workloads/{namespace}/{name}` - Delete workload
- Tool state updates via annotation patch (existing mechanism)

**New Frontend API Service Methods**:
- `createWorkload(data: WorkloadInput): Promise<WorkloadEntity>`
- `updateWorkload(namespace: string, name: string, data: WorkloadInput): Promise<WorkloadEntity>`
- `deleteWorkload(namespace: string, name: string): Promise<void>`
- `batchUpdateToolStates(changes: Map<string, boolean>): Promise<void>`

### Quickstart

**Status**: ✅ **COMPLETE** - See `quickstart.md` for user-facing quickstart guide.

**Key Workflows**:
1. Editing tool states: Navigate to server → Toggle tools → Click Save → Changes persist
2. Creating workload: Workloads tab → Create → Fill form → Select tools → Save
3. Editing workload: Workloads tab → Edit menu → Modify form → Save
4. Deleting workload: Workloads tab → Delete menu → Confirm

**Output**: `data-model.md`, `contracts/editing-api.yaml`, `quickstart.md`

---

## Phase 2: Implementation Planning

**Status**: ✅ **COMPLETE** - See `tasks.md` for detailed task breakdown.

**High-Level Implementation Order**:
1. **Phase 1**: Tool state batch management (User Story 1)
   - Modify `useToolDisabledState` hook
   - Create `ToolStateEditor` component
   - Add Save/Cancel buttons to `McpServerPage`
   - Update `DisabledCheckbox` to use callback pattern

2. **Phase 2**: Workload creation (User Story 2)
   - Create `WorkloadForm` component
   - Add server/tool tree selection
   - Add Create button to `WorkloadsTab`
   - Implement form validation

3. **Phase 3**: Workload editing (User Story 3)
   - Extend `WorkloadForm` for edit mode
   - Add Edit menu item to `WorkloadsTab`
   - Implement conflict detection
   - Create `ConflictDialog` component

4. **Phase 4**: Workload deletion (User Story 4)
   - Add Delete menu item to `WorkloadsTab`
   - Implement delete confirmation
   - Handle delete errors

5. **Phase 5**: Polish & Testing
   - Unit tests for all new components
   - Integration tests for workflows
   - Permission-based UI tests
   - Error handling improvements

**Output**: `tasks.md` with 57 tasks organized by user story

---

## Next Steps

1. ✅ **Research complete** - `research.md` generated
2. ✅ **Data model complete** - `data-model.md` generated
3. ✅ **Contracts complete** - `contracts/editing-api.yaml` generated
4. ✅ **Quickstart complete** - `quickstart.md` generated
5. ✅ **Tasks complete** - `tasks.md` generated
6. ✅ **Agent context updated** - Cursor IDE context file updated

**Ready for**: `/speckit.implement` - Begin implementation phase
