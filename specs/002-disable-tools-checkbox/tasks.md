# Tasks: Disable Tools Checkbox

**Input**: Design documents from `/specs/002-disable-tools-checkbox/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are not explicitly requested in the specification. Unit tests can be added in the Polish phase if desired.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all descriptions

---

## Phase 1: Setup

**Purpose**: No additional setup required - extending existing project

- [x] T001 Verify branch `002-disable-tools-checkbox` is checked out and dependencies installed via `yarn install`
- [x] T002 [P] Verify console proxy PATCH support in `deployment/backstage-console-proxy.yaml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add `MCP_TOOL_DISABLED_ANNOTATION` constant and `isToolDisabled()` helper function in `src/models/CatalogMcpTool.ts`
- [x] T004 Add `updateEntityAnnotation()` function to `src/services/catalogService.ts` for PATCH requests to Backstage catalog API
- [x] T005 [P] Create `src/services/authService.ts` with `useCanEditCatalog()` hook for role-based authorization check

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1+2 - Disable & Persist Tools (Priority: P1) 🎯 MVP

**Goal**: Allow authorized users to toggle tool disabled state via checkbox on Server Details page, with state persisted to Backstage catalog

**Independent Test**: Navigate to MCP Server page → click Disabled checkbox → verify visual change → refresh page → verify state persisted

**Note**: US1 (toggle) and US2 (persistence) are combined as persistence is integral to the toggle functionality.

### Implementation for User Story 1+2

- [x] T006 [US1] Create `src/hooks/useToolDisabledState.ts` with `ToolDisabledState` and `ToolDisabledError` interfaces per data-model.md
- [x] T007 [US1] Implement `useToolDisabledState` hook with optimistic update, rollback on failure, and retry mechanism in `src/hooks/useToolDisabledState.ts`
- [x] T008 [US1] Create `src/components/shared/DisabledCheckbox.tsx` component with:
  - Checkbox rendering with disabled state
  - Integration with `useToolDisabledState` hook
  - Integration with `useCanEditCatalog` for authorization
  - Read-only mode for unauthorized users
  - Inline error display with retry button
- [x] T009 [US1] Add "Disabled" column to Provided Tools table in `src/components/McpServerPage.tsx`:
  - Add `<Th>` header for "Disabled" column with accessibility label
  - Add `<Td>` with `DisabledCheckbox` component for each tool row
  - Pass tool entity UID and current disabled state to checkbox
- [x] T010 [US1] Add disabled row styling (reduced opacity) to `src/components/McpServerPage.tsx` for tools where `isToolDisabled()` returns true
- [x] T011 [US1] Add keyboard navigation support (Tab, Space/Enter to toggle) to `DisabledCheckbox` in `src/components/shared/DisabledCheckbox.tsx`

**Checkpoint**: User Story 1+2 complete - Users can toggle and persist disabled state on Server Details page

---

## Phase 4: User Story 3 - Visual Distinction Across Views (Priority: P2)

**Goal**: Show disabled indicator in all catalog views (Tools Tab, Workload dependencies)

**Independent Test**: Disable a tool on Server page → navigate to Tools Tab → verify disabled indicator appears → navigate to Workload page → verify disabled indicator on dependencies

### Implementation for User Story 3

- [x] T012 [P] [US3] Create `src/components/shared/DisabledBadge.tsx` component:
  - PatternFly `<Label color="orange">Disabled</Label>` or similar visual indicator
  - Read-only (no toggle functionality)
  - Accepts `isDisabled` boolean prop
- [x] T013 [US3] Add "Status" column to tools table in `src/components/ToolsTab.tsx`:
  - Add `<Th>` header for "Status" column
  - Add `<Td>` with `DisabledBadge` component for each tool row
  - Use `isToolDisabled()` helper to determine state
- [x] T014 [US3] Add disabled indicator to tool dependencies in `src/components/McpWorkloadPage.tsx`:
  - Show `DisabledBadge` next to tool names in dependency lists
  - Apply visual styling to indicate workload may have disabled dependencies

**Checkpoint**: User Story 3 complete - Disabled state visible across all catalog views

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and validation

- [x] T015 [P] Add ARIA labels and screen reader announcements to `DisabledCheckbox` and `DisabledBadge` in `src/components/shared/`
- [x] T016 [P] Update `locales/en/plugin__mcp-catalog.json` with i18n strings for "Disabled", "Enable", error messages
- [x] T017 Run manual testing checklist from `specs/002-disable-tools-checkbox/quickstart.md`
- [x] T018 [P] Update `CLAUDE.md` with new component and service documentation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1+2 (Phase 3)**: Depends on Foundational (Phase 2)
- **User Story 3 (Phase 4)**: Depends on Foundational (Phase 2), can run parallel to Phase 3
- **Polish (Phase 5)**: Depends on Phase 3 and Phase 4 completion

### User Story Dependencies

- **User Story 1+2 (P1)**: Can start after Foundational (Phase 2) - Core MVP
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Uses same `isToolDisabled()` helper but new UI components

### Within Each User Story

- Models/helpers before hooks
- Hooks before components
- Components before page integration
- Core implementation before refinements

### Parallel Opportunities

Within Phase 2 (Foundational):
- T003 and T005 can run in parallel (different files)

Within Phase 3 (User Story 1+2):
- T006 must complete before T007
- T007 and T008 are sequential (hook before component)
- T009, T010, T011 can be done together after T008

Within Phase 4 (User Story 3):
- T012 must complete before T013 and T014
- T013 and T014 can run in parallel (different files)

Within Phase 5 (Polish):
- T015, T016, T018 can run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```bash
# These can run in parallel (different files):
Task T003: "Add annotation constant and helper in src/models/CatalogMcpTool.ts"
Task T005: "Create src/services/authService.ts with useCanEditCatalog hook"

# This depends on existing catalogService structure:
Task T004: "Add updateEntityAnnotation() in src/services/catalogService.ts"
```

## Parallel Example: Phase 4 (User Story 3)

```bash
# After T012 completes, these can run in parallel:
Task T013: "Add Status column to src/components/ToolsTab.tsx"
Task T014: "Add disabled indicator to src/components/McpWorkloadPage.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1+2 Only)

1. Complete Phase 1: Setup (verify environment)
2. Complete Phase 2: Foundational (model + services)
3. Complete Phase 3: User Story 1+2 (core toggle + persistence)
4. **STOP and VALIDATE**: Test toggle and persistence on Server Details page
5. Deploy/demo if ready - feature is functional for core use case

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1+2 → Test toggle + persistence → Deploy (MVP! 🎯)
3. Add User Story 3 → Test cross-view indicators → Deploy
4. Add Polish → Final validation → Production ready

### Task Counts by Phase

| Phase | Task Count | Parallel Opportunities |
|-------|------------|----------------------|
| Phase 1: Setup | 2 | 1 |
| Phase 2: Foundational | 3 | 2 |
| Phase 3: User Story 1+2 | 6 | 0 (sequential) |
| Phase 4: User Story 3 | 3 | 2 |
| Phase 5: Polish | 4 | 3 |
| **Total** | **18** | **8** |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [US1] and [US3] labels map tasks to user stories for traceability
- US2 is combined with US1 since persistence is integral to toggle
- Verify each phase checkpoint before proceeding
- Commit after each task or logical group
- Run `yarn lint` and `yarn test` after implementation tasks
