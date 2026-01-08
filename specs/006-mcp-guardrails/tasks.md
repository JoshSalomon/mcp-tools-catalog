# Tasks: MCP Guardrails Entity

**Input**: Design documents from `/specs/006-mcp-guardrails/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/guardrails-api.yaml, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Backend API**: `backstage-app/packages/backend/src/plugins/mcp-entity-api/`
- **Frontend UI**: `src/components/`, `src/models/`, `src/services/`
- **Tests**: `backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/`, `tests/sanity/`

---

## Phase 1: Setup

**Purpose**: Create feature branch and basic structure

- [x] T001 Ensure feature branch `006-mcp-guardrails` exists and is checked out

**Checkpoint**: Feature branch ready ✓

---

## Phase 2: Foundational (Backend Database & Types)

**Purpose**: Core database schema and TypeScript types that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/database.ts` - Add `mcp_guardrails` table creation in `initDatabase()`
- [x] T003 Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/database.ts` - Add `mcp_tool_guardrails` table creation with foreign key to guardrails
- [x] T004 Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/database.ts` - Add `mcp_workload_tool_guardrails` table creation with foreign key to guardrails
- [x] T005 Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/database.ts` - Add indexes for efficient lookups (namespace_name, tool, workload, guardrail_id)
- [x] T006 Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/types.ts` - Add `Guardrail` interface
- [x] T007 [P] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/types.ts` - Add `ToolGuardrailAssociation` interface
- [x] T008 [P] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/types.ts` - Add `WorkloadToolGuardrailAssociation` interface
- [x] T009 [P] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/types.ts` - Add `CreateGuardrailInput`, `UpdateGuardrailInput`, `AttachGuardrailInput` interfaces
- [x] T010 Create `src/models/CatalogMcpGuardrail.ts` - Add frontend `CatalogMcpGuardrail` interface matching API schema

**Checkpoint**: Database schema and types ready - user story implementation can now begin ✓

---

## Phase 3: User Story 1 - Browse and Manage Guardrails (Priority: P1)

**Goal**: Platform administrators can view all guardrails, see details, edit, and delete them

**Independent Test**: Navigate to Guardrails tab, view list, click a guardrail to see details, use Edit/Delete actions

### Backend Implementation (US1)

- [x] T011 [US1] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `listGuardrails(params: ListParams)` method
- [x] T012 [US1] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `getGuardrail(namespace, name)` method returning guardrail with usage info
- [x] T013 [US1] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `updateGuardrail(namespace, name, input)` method
- [x] T014 [US1] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `deleteGuardrail(namespace, name)` method with reference check (fails if associations exist)
- [x] T015 [US1] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Add `GET /guardrails` endpoint (list all)
- [x] T016 [US1] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Add `GET /guardrails/:namespace/:name` endpoint (get with usage)
- [x] T017 [US1] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Add `PUT /guardrails/:namespace/:name` endpoint (update)
- [x] T018 [US1] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Add `DELETE /guardrails/:namespace/:name` endpoint (delete with protection)

### Frontend Implementation (US1)

- [x] T019 [US1] Update `src/services/catalogService.ts` - Add `useGuardrails()` hook for listing guardrails
- [x] T020 [US1] Update `src/services/catalogService.ts` - Add `useGuardrail(namespace, name)` hook for fetching single guardrail with usage
- [x] T021 [US1] Update `src/services/catalogService.ts` - Add `updateGuardrail(namespace, name, data)` async function
- [x] T022 [US1] Update `src/services/catalogService.ts` - Add `deleteGuardrail(namespace, name)` async function
- [x] T023 [US1] Create `src/components/GuardrailsTab.tsx` - List view following ServersTab pattern with name, description, deployment columns
- [x] T024 [US1] Create `src/components/GuardrailsPage.tsx` - Detail page following McpServerPage pattern with full info and usage section
- [x] T025 [US1] Update `src/components/McpCatalogPage.tsx` - Add Guardrails tab to the main catalog navigation

**Checkpoint**: Users can browse guardrails, view details, edit and delete them ✓

---

## Phase 4: User Story 2 - Create Guardrails (Priority: P1)

**Goal**: Platform administrators can create guardrails via form UI or YAML import

**Independent Test**: Click Create button, fill form with name/description/deployment, submit and verify guardrail appears in list

### Backend Implementation (US2)

- [x] T026 [US2] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/validation.ts` - Add guardrail name validation (1-63 chars, alphanumeric + hyphens)
- [x] T027 [US2] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/validation.ts` - Add guardrail description validation (max 1000 chars)
- [x] T028 [US2] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/validation.ts` - Add guardrail deployment validation (max 2000 chars)
- [x] T029 [US2] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `createGuardrail(input)` method with duplicate name check
- [x] T030 [US2] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Add `POST /guardrails` endpoint (create)
- [x] T031 [US2] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Add `POST /guardrails/import` endpoint (YAML import)

### Frontend Implementation (US2)

- [x] T032 [US2] Update `src/services/catalogService.ts` - Add `createGuardrail(data)` async function
- [x] T033 [US2] Update `src/services/catalogService.ts` - Add `importGuardrailYaml(file)` async function
- [x] T034 [US2] Create `src/components/GuardrailForm.tsx` - Create/Edit form with name, description, deployment (required), parameters (optional), disabled (optional) fields following WorkloadForm pattern
- [x] T035 [US2] Update `src/components/GuardrailsTab.tsx` - Add Create button that opens GuardrailForm
- [x] T036 [US2] Update `src/components/GuardrailsTab.tsx` - Add Import button for YAML file upload
- [x] T037 [US2] Update `src/components/GuardrailsPage.tsx` - Add Edit action that opens GuardrailForm in edit mode

**Checkpoint**: Users can create guardrails via form and YAML import, with validation and duplicate prevention ✓

---

## Phase 5: User Story 3 - Attach Guardrails to Tools (Priority: P2)

**Goal**: Platform administrators can attach guardrails to tools with pre/post execution timing

**Independent Test**: Edit a tool, add a guardrail with pre-execution timing, verify it appears in tool details and guardrail usage

### Backend Implementation (US3)

- [x] T038 [US3] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `listToolGuardrails(toolNamespace, toolName)` method
- [x] T039 [US3] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `attachGuardrailToTool(toolNs, toolName, input)` method with duplicate check
- [x] T040 [US3] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `detachGuardrailFromTool(toolNs, toolName, guardrailNs, guardrailName)` method
- [x] T041 [US3] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Add `GET /tools/:namespace/:name/guardrails` endpoint
- [x] T042 [US3] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Add `POST /tools/:namespace/:name/guardrails` endpoint (mcp-admin required)
- [x] T043 [US3] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Add `DELETE /tools/:namespace/:name/guardrails/:guardrailNs/:guardrailName` endpoint (mcp-admin required)

### Frontend Implementation (US3)

- [x] T044 [US3] Update `src/services/catalogService.ts` - Add `useToolGuardrails(namespace, name)` hook
- [x] T045 [US3] Update `src/services/catalogService.ts` - Add `attachGuardrailToTool(toolNs, toolName, data)` async function
- [x] T046 [US3] Update `src/services/catalogService.ts` - Add `detachGuardrailFromTool(toolNs, toolName, guardrailNs, guardrailName)` async function
- [x] T047 [US3] Update `src/components/McpToolPage.tsx` - Add Guardrails section showing attached guardrails with execution timing
- [x] T048 [US3] Update `src/components/McpToolPage.tsx` - Add ability to attach/detach guardrails (for mcp-admin users)

**Checkpoint**: Administrators can attach guardrails to tools with pre/post execution timing ✓

---

## Phase 6: User Story 4 - Manage Guardrails on Workloads (Priority: P2)

**Goal**: Workload owners can manage guardrails on workload-tool relationships, see inherited guardrails, add workload-level guardrails

**Independent Test**: View a workload with tool that has guardrails attached, verify inherited guardrails show as non-removable; add a workload-level guardrail, verify it can be removed

### Backend Implementation (US4)

- [x] T049 [US4] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `listWorkloadToolGuardrails(workloadNs, workloadName, toolNs, toolName)` method
- [x] T050 [US4] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `addGuardrailToWorkloadTool(workloadNs, workloadName, toolNs, toolName, input)` method with source='workload'
- [x] T051 [US4] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `removeGuardrailFromWorkloadTool(...)` method - only allows removing source='workload' guardrails
- [x] T052 [US4] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `inheritToolGuardrailsToWorkload(workloadNs, workloadName, toolNs, toolName)` method - copies tool guardrails with source='tool'
- [x] T053 [US4] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/database.ts` - Add workload-tool-guardrail database methods (listWorkloadToolGuardrails, addGuardrailToWorkloadTool, workloadToolGuardrailExists, removeGuardrailFromWorkloadTool, inheritToolGuardrailsToWorkload)
- [x] T054 [US4] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Add `GET /workloads/:wNs/:wName/tools/:tNs/:tName/guardrails` endpoint
- [x] T055 [US4] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Add `POST /workloads/:wNs/:wName/tools/:tNs/:tName/guardrails` endpoint (mcp-user required)
- [x] T056 [US4] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Add `DELETE /workloads/:wNs/:wName/tools/:tNs/:tName/guardrails/:gNs/:gName` endpoint (mcp-user required, source='workload' only)
- [x] T056a [US4] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Add `PUT /workloads/:wNs/:wName/tools/:tNs/:tName/guardrails/:gNs/:gName` endpoint for editing timing/parameters
- [x] T056b [US4] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `updateWorkloadToolGuardrail(...)` method
- [x] T056c [US4] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/database.ts` - Add `updateWorkloadToolGuardrail(...)` database method

### Frontend Implementation (US4)

- [x] T057 [US4] Update `src/services/catalogService.ts` - Add `useWorkloadToolGuardrails(workloadNs, workloadName, toolNs, toolName)` hook
- [x] T058 [US4] Update `src/services/catalogService.ts` - Add `addGuardrailToWorkloadTool(...)` async function
- [x] T059 [US4] Update `src/services/catalogService.ts` - Add `removeGuardrailFromWorkloadTool(...)` async function
- [x] T060 [US4] Update `src/components/McpWorkloadPage.tsx` - Show guardrails per tool with source indicator (inherited vs workload-level)
- [x] T061 [US4] Update `src/components/McpWorkloadPage.tsx` - Add visual distinction for inherited guardrails (non-removable)
- [x] T062 [US4] Update `src/components/McpWorkloadPage.tsx` - Add ability to add/remove workload-level guardrails
- [x] T062a [US4] Update `src/services/catalogService.ts` - Add `updateWorkloadToolGuardrail(...)` async function for editing timing/parameters
- [x] T062b [US4] Update `src/components/McpWorkloadPage.tsx` - Add Edit action for workload-level guardrails with modal for timing/parameters
- [x] T062c [US4] Update `src/components/McpWorkloadPage.tsx` - Add Parameters column to workload-tool-guardrails table

**Checkpoint**: US4 complete (89 API tests passing). Workload owners can see inherited guardrails and manage workload-level guardrails with full CRUD ✓

---

## Phase 7: User Story 5 - Disable/Enable Guardrails (Priority: P3)

**Goal**: Platform administrators can globally disable/enable guardrails without removing them

**Independent Test**: Toggle disable checkbox on a guardrail, verify disabled state is persisted and visually indicated

### Backend Implementation (US5)

- [x] T063 [US5] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `setGuardrailDisabled(namespace, name, disabled)` method
- [x] T064 [US5] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Disabled state managed via PUT /guardrails/:namespace/:name with disabled in spec (simpler than separate endpoints)
- [x] T065 [US5] (Merged with T064) - Enable/disable via same PUT endpoint with disabled: true/false

### Frontend Implementation (US5)

- [x] T066 [US5] Update `src/services/catalogService.ts` - Disabled state managed via `updateGuardrail()` with disabled in spec
- [x] T067 [US5] Update `src/components/GuardrailsTab.tsx` - Status column shows Enabled/Disabled label with visual styling
- [x] T068 [US5] Update `src/components/GuardrailsPage.tsx` - Show disabled state prominently
- [x] T069 [US5] Update `src/components/GuardrailForm.tsx` - Add Switch toggle for disabled state in create/edit form
- [x] T070 [US5] Update `src/components/McpToolPage.tsx` - Visually indicate disabled guardrails (completed in Phase 5)
- [x] T071-alt [US5] Update `src/components/McpWorkloadPage.tsx` - Visually indicate disabled guardrails (Status column shows Enabled/Disabled with styling)

**Checkpoint**: Administrators can globally disable/enable guardrails with visual indication in all guardrails views ✓

---

## Phase 8: Tests & Polish

**Purpose**: Unit tests, sanity tests, and final polish

### Unit Tests

- [x] T071 [P] Create `backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/guardrail-service.test.ts` - Test guardrail CRUD operations + validation (67 tests passing)
- [x] T072 [P] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/guardrail-service.test.ts` - Test US5 disable/enable operations (setGuardrailDisabled, updateGuardrail with disabled)
- [x] T073 [P] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/guardrail-service.test.ts` - Test workload-tool-guardrail parameters operations (US4)
- [x] T074 [P] Create `backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/guardrail-service.test.ts` - Test deletion protection (cannot delete with references)

### Sanity Tests

- [x] T075 Create `tests/sanity/guardrail-crud.sh` - CRUD operations for guardrails via API (89 tests passing total)
- [x] T076 Update `tests/sanity/guardrail-crud.sh` - Test tool-guardrail attachment via API (17 tests for US3)
- [x] T077 Update `tests/sanity/guardrail-crud.sh` - Test workload-tool-guardrail operations via API (12 tests for US4)
- [x] T078 Update `tests/sanity/guardrail-crud.sh` - Test disable/enable operations via API (create/import with disabled, PUT with disabled)

### Polish

- [x] T079 Run `yarn lint` and fix any issues (0 errors, 42 pre-existing warnings)
- [x] T080 Run `yarn test` and ensure all tests pass (125 unit tests passing)
- [x] T081 Run full build with `yarn build` (build successful)
- [x] T082 Validate against quickstart.md steps (89 sanity tests passing)

**Checkpoint**: All tests pass, feature is complete ✓

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phases 3-7)**: All depend on Foundational phase completion
  - US1 (P1) and US2 (P1) can proceed in parallel after Foundational
  - US3 (P2) and US4 (P2) can proceed after Foundational, may reference US1/US2 components
  - US5 (P3) can proceed after Foundational, integrates with all prior stories
- **Tests & Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Shares GuardrailForm with US1 edit
- **User Story 3 (P2)**: Can start after Foundational - References guardrails list from US1
- **User Story 4 (P2)**: Can start after Foundational - References guardrails list from US1, uses tool-guardrail patterns from US3
- **User Story 5 (P3)**: Can start after Foundational - Modifies components from US1, US3, US4

### Within Each User Story

- Backend before frontend (API must exist before UI can call it)
- Service methods before router endpoints
- Core CRUD before associations

### Parallel Opportunities

- T007, T008, T009 can run in parallel (different type definitions)
- All [P] marked tasks within a phase can run in parallel
- Backend tasks from different user stories can run in parallel if they don't share files

---

## Implementation Strategy

### MVP First (User Stories 1 & 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Browse and Manage)
4. Complete Phase 4: User Story 2 (Create)
5. **STOP and VALIDATE**: Test guardrail CRUD end-to-end
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational -> Foundation ready
2. Add US1 + US2 -> Guardrail CRUD complete -> Deploy/Demo (MVP!)
3. Add US3 -> Tool-level guardrails -> Deploy/Demo
4. Add US4 -> Workload-level guardrails with inheritance -> Deploy/Demo
5. Add US5 -> Disable/Enable feature -> Deploy/Demo
6. Add Tests & Polish -> Production ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- RBAC: mcp-admin for guardrail CRUD and tool-level associations; mcp-user for workload-level management
- Deletion protection: guardrails with references cannot be deleted (FR-005)
- Inheritance: tool-level guardrails auto-copy to workload with source='tool' when tool is added to workload
