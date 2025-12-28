# Tasks: Editing Capabilities

**Input**: Design documents from `/specs/004-editing-capabilities/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are NOT included as they were not explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- React components: `src/components/`
- React hooks: `src/hooks/`
- Services: `src/services/`
- Models: `src/models/`
- Tests: `tests/unit/` (not included in this task list)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and verification

- [X] T001 Verify existing project structure matches plan.md requirements
- [X] T002 Verify existing dependencies in package.json (React 17.x, PatternFly, TypeScript 4.7+)
- [X] T003 [P] Verify existing API proxy configuration for `/api/mcp-entity-api/` endpoints

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Extend authService.ts to add useCanEditWorkloads hook for mcp-user role check in src/services/authService.ts
- [X] T005 [P] Extend catalogService.ts to add batchUpdateToolStates function for batch tool state updates in src/services/catalogService.ts
- [X] T006 [P] Extend catalogService.ts to add createWorkload function calling POST /api/mcp-entity-api/workloads in src/services/catalogService.ts
- [X] T007 [P] Extend catalogService.ts to add updateWorkload function calling PUT /api/mcp-entity-api/workloads/{namespace}/{name} in src/services/catalogService.ts
- [X] T008 [P] Extend catalogService.ts to add deleteWorkload function calling DELETE /api/mcp-entity-api/workloads/{namespace}/{name} in src/services/catalogService.ts
- [X] T009 [P] Extend catalogService.ts to add getWorkload function calling GET /api/mcp-entity-api/workloads/{namespace}/{name} in src/services/catalogService.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Persist Tool Enable/Disable State Changes (Priority: P1) 🎯 MVP

**Goal**: Enable batch editing of tool states with Save/Cancel workflow, replacing immediate persistence

**Independent Test**: Navigate to server detail page, toggle multiple tool states, verify Save/Cancel buttons enable/disable correctly, click Save to persist changes, confirm changes persist after page refresh

### Implementation for User Story 1

- [X] T010 [P] [US1] Create useBatchToolState hook for batch tool state management with Save/Cancel in src/hooks/useBatchToolState.ts
- [X] T011 [P] [US1] Modify useToolDisabledState hook to remove immediate persistence and return state only in src/hooks/useToolDisabledState.ts
- [X] T012 [US1] Create ToolStateEditor component with Save/Cancel buttons and batch state management in src/components/ToolStateEditor.tsx
- [X] T013 [US1] Modify DisabledCheckbox component to use callback pattern instead of immediate persistence in src/components/shared/DisabledCheckbox.tsx
- [X] T014 [US1] Extend McpServerPage component to integrate ToolStateEditor with Save/Cancel buttons in src/components/McpServerPage.tsx
- [X] T015 [US1] Add permission check in McpServerPage to hide Save/Cancel buttons for users without mcp-admin role in src/components/McpServerPage.tsx
- [X] T016 [US1] Implement error handling and retry logic for batch tool state save operations in src/components/ToolStateEditor.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Users can batch edit tool states and persist changes with Save/Cancel workflow.

---

## Phase 4: User Story 2 - Create New Workloads (Priority: P2)

**Goal**: Enable users to create new workloads via form-based UI with server/tool tree selection

**Independent Test**: Navigate to workloads list, click Create button, fill in metadata fields, select tools from server/tool tree, click Save, verify new workload appears in list

### Implementation for User Story 2

- [X] T017 [P] [US2] Create useWorkloadForm hook for form state management with validation in src/hooks/useWorkloadForm.ts
- [X] T018 [P] [US2] Create WorkloadForm component with metadata input fields and server/tool tree in src/components/WorkloadForm.tsx
- [X] T019 [US2] Implement server/tool tree view using PatternFly TreeView component with expandable nodes in src/components/WorkloadForm.tsx
- [X] T020 [US2] Implement tool selection checkboxes for enabled tools in WorkloadForm tree view in src/components/WorkloadForm.tsx
- [X] T021 [US2] Implement visual indicators for disabled tools (grayed out, non-selectable) in WorkloadForm tree view in src/components/WorkloadForm.tsx
- [X] T022 [US2] Implement form validation for required fields (name, namespace) in useWorkloadForm hook in src/hooks/useWorkloadForm.ts
- [X] T023 [US2] Implement Save button handler to create workload via API in WorkloadForm component in src/components/WorkloadForm.tsx
- [X] T024 [US2] Implement Cancel button handler to discard changes and navigate back in WorkloadForm component in src/components/WorkloadForm.tsx
- [X] T025 [US2] Add Create button to WorkloadsTab component in src/components/WorkloadsTab.tsx
- [X] T026 [US2] Implement navigation from Create button to WorkloadForm in create mode in src/components/WorkloadsTab.tsx
- [X] T027 [US2] Add permission check to disable/hide Create button for users without mcp-user role in src/components/WorkloadsTab.tsx
- [X] T028 [US2] Implement error handling and validation error display in WorkloadForm component in src/components/WorkloadForm.tsx

**Checkpoint**: At this point, User Story 2 should be fully functional and testable independently. Users can create new workloads with metadata and tool selections.

---

## Phase 5: User Story 3 - Edit Existing Workloads (Priority: P2)

**Goal**: Enable users to edit existing workloads using the same form, pre-populated with current data, with conflict detection

**Independent Test**: Navigate to workloads list, click Edit on existing workload, modify metadata or tool selections, click Save, verify changes reflected in workload

### Implementation for User Story 3

- [X] T029 [US3] Extend WorkloadForm component to support edit mode with pre-populated data in src/components/WorkloadForm.tsx
- [X] T030 [US3] Implement form data population from existing workload entity in WorkloadForm edit mode in src/components/WorkloadForm.tsx
- [X] T031 [US3] Implement pre-selection of tools currently in workload in WorkloadForm tree view in src/components/WorkloadForm.tsx
- [X] T032 [US3] Implement change detection to enable Save/Cancel buttons when form data changes in useWorkloadForm hook in src/hooks/useWorkloadForm.ts
- [X] T033 [US3] Create ConflictDialog component for conflict resolution with overwrite/cancel options in src/components/ConflictDialog.tsx
- [ ] T034 [US3] **DEFERRED** - Implement conflict detection using metadata.lastModified timestamp comparison in WorkloadForm component in src/components/WorkloadForm.tsx (Edge case: concurrent edits - current last-write-wins is acceptable for PoC)
- [ ] T035 [US3] **DEFERRED** - Implement conflict dialog display when concurrent edit detected in WorkloadForm component in src/components/WorkloadForm.tsx (Depends on T034)
- [X] T036 [US3] Implement Save button handler to update workload via API with conflict check in WorkloadForm component in src/components/WorkloadForm.tsx
- [X] T037 [US3] Implement overwrite option in ConflictDialog to proceed with save despite conflict in src/components/ConflictDialog.tsx
- [X] T038 [US3] Implement cancel option in ConflictDialog to abort save operation in src/components/ConflictDialog.tsx
- [X] T039 [US3] Add Edit menu item to workload row menu in WorkloadsTab component in src/components/WorkloadsTab.tsx
- [X] T040 [US3] Implement navigation from Edit menu to WorkloadForm in edit mode in src/components/WorkloadsTab.tsx
- [X] T041 [US3] Add permission check to disable/hide Edit menu item for users without mcp-user role in src/components/WorkloadsTab.tsx
- [ ] T042 [US3] **DEFERRED** - Handle disabled tools that were previously selected (auto-uncheck with warning message) in WorkloadForm component in src/components/WorkloadForm.tsx (Edge case: admin disables tool after workload uses it - current grayed-out display is acceptable for PoC)

**Checkpoint**: At this point, User Story 3 should be fully functional and testable independently. Users can edit existing workloads with conflict detection and resolution.

---

## Phase 6: User Story 4 - Delete Workloads (Priority: P3)

**Goal**: Enable users to delete workloads via action menu with confirmation

**Independent Test**: Navigate to workloads list, click action menu on workload row, select Delete, confirm deletion, verify workload removed from list

### Implementation for User Story 4

- [X] T043 [US4] Add Delete menu item to workload row menu in WorkloadsTab component in src/components/WorkloadsTab.tsx
- [X] T044 [US4] Implement delete confirmation dialog in WorkloadsTab component in src/components/WorkloadsTab.tsx
- [X] T045 [US4] Implement Delete button handler to call deleteWorkload API function in WorkloadsTab component in src/components/WorkloadsTab.tsx
- [X] T046 [US4] Implement workload removal from list after successful deletion in WorkloadsTab component in src/components/WorkloadsTab.tsx
- [X] T047 [US4] Add permission check to disable/hide Delete menu item for users without mcp-user role in src/components/WorkloadsTab.tsx
- [X] T048 [US4] Implement error handling for delete failures with error message display in WorkloadsTab component in src/components/WorkloadsTab.tsx

**Checkpoint**: At this point, User Story 4 should be fully functional and testable independently. Users can delete workloads with confirmation and error handling.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T049 [P] Add loading states and spinners for all async operations across all components
- [X] T050 [P] Improve error messages and user feedback for all API operations
- [X] T051 [P] Add accessibility attributes (ARIA labels, keyboard navigation) to all new components
- [X] T052 [P] Optimize server/tool tree rendering for large datasets (virtual scrolling or pagination if needed)
- [X] T053 [P] Add empty state handling for servers with no tools in WorkloadForm tree view
- [X] T054 [P] Verify all permission checks work correctly across all editing operations
- [ ] T055 [P] **IN PROGRESS** - Run quickstart.md validation to ensure all workflows work as documented (See T055-validation-results.md for code review and manual testing checklist)
- [X] T056 [P] Code cleanup and refactoring for consistency across all new components
- [X] T057 [P] Update component documentation and inline comments

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent, but shares WorkloadForm component structure with US3
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Extends WorkloadForm from US2, but can be implemented independently
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Independent, only needs WorkloadsTab modifications

### Within Each User Story

- Hooks before components that use them
- Core components before integration into parent components
- Form validation before API integration
- Permission checks integrated throughout
- Error handling added during implementation

### Parallel Opportunities

- All Setup tasks can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Tasks marked [P] within a story can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all foundational hooks/services together:
Task: "Extend authService.ts to add useCanEditWorkloads hook"
Task: "Extend catalogService.ts to add batchUpdateToolStates function"
Task: "Extend catalogService.ts to add createWorkload function"
Task: "Extend catalogService.ts to add updateWorkload function"
Task: "Extend catalogService.ts to add deleteWorkload function"
Task: "Extend catalogService.ts to add getWorkload function"

# Launch US1 hooks/components together:
Task: "Create useBatchToolState hook"
Task: "Modify useToolDisabledState hook"
Task: "Create ToolStateEditor component"
Task: "Modify DisabledCheckbox component"
```

---

## Parallel Example: User Story 2

```bash
# Launch US2 components together:
Task: "Create useWorkloadForm hook"
Task: "Create WorkloadForm component"
Task: "Add Create button to WorkloadsTab component"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Navigate to server detail page
   - Toggle tool states
   - Verify Save/Cancel buttons work
   - Save changes and verify persistence
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo (extends US2 form)
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add Polish phase → Final validation → Deploy

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Tool state editing)
   - Developer B: User Story 2 (Workload creation)
   - Developer C: User Story 4 (Workload deletion)
3. After US2 completes:
   - Developer B: User Story 3 (Workload editing - extends US2 form)
4. All stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- User Story 3 extends User Story 2's WorkloadForm component but can be developed independently by extending the form after US2 is complete
- All API endpoints already exist from spec 003 - no backend work needed
- Permission checks (mcp-admin, mcp-user) use existing RBAC infrastructure
