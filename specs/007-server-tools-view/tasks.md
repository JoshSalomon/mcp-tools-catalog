# Tasks: Server Tools View Consolidation

**Input**: Design documents from `/specs/007-server-tools-view/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/server-tools-api.yaml, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend API**: `backstage-app/packages/backend/src/plugins/mcp-entity-api/`
- **Frontend UI**: `src/components/`, `src/models/`, `src/services/`
- **Tests**: `backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/`, `tests/sanity/`

---

## Phase 1: Setup

**Purpose**: Ensure feature branch is ready

- [x] T001 Ensure feature branch `007-server-tools-view` exists and is checked out

**Checkpoint**: Feature branch ready

---

## Phase 2: Foundational (Database Schema & Types)

**Purpose**: Core schema and type changes that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/database.ts` - Add `alternative_description` column migration to `mcp_entities` table
- [x] T003 Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/database.ts` - Add `MCPEntityRow` interface extension with `alternative_description: string | null`
- [x] T004 [P] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/types.ts` - Add `alternativeDescription?: string` to tool response types
- [x] T005 [P] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/validation.ts` - Add `validateAlternativeDescription()` function (max 2000 chars, trim whitespace)
- [x] T006 [P] Update `src/models/CatalogMcpTool.ts` - Add `alternativeDescription?: string` field to frontend model

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Browse Tools Within Servers (Priority: P1) 🎯 MVP

**Goal**: Users can expand server rows to see all tools belonging to that server, sorted alphabetically

**Independent Test**: Navigate to Servers list, expand a server row, verify tools are displayed with name, description, and disabled status

<!--
  This user story is frontend-only (US1). The backend already supports
  listing tools by server via existing endpoints. No Phase A/B split needed.
-->

### Frontend Implementation (US1)

- [x] T007 [US1] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `getToolsForServer(serverNamespace, serverName)` method returning tools sorted alphabetically by name
- [x] T008 [US1] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Add `GET /servers/:namespace/:name/tools` endpoint
- [x] T009 [US1] Update `src/services/catalogService.ts` - Add `useServerTools(namespace, name)` hook for fetching tools by server
- [x] T010 [US1] Update `src/components/ServersTab.tsx` - Add expandable row state management (useState for expanded server IDs)
- [x] T011 [US1] Update `src/components/ServersTab.tsx` - Add expand/collapse control to each server row using PatternFly expandable row pattern
- [x] T012 [US1] Update `src/components/ServersTab.tsx` - Render tool list when server is expanded (name as link, description, disabled status)
- [x] T013 [US1] Update `src/components/ServersTab.tsx` - Handle empty state when server has no tools ("No tools available for this server")
- [x] T014 [US1] Update `src/components/ServersTab.tsx` - Sort displayed tools alphabetically (A-Z) by name
- [x] T015 [P] [US1] Create `tests/sanity/server-tools-view.sh` - Add tests for GET /servers/:ns/:name/tools endpoint

**Checkpoint**: Users can browse tools within expanded server rows. US1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Edit Alternative Tool Description (Priority: P2)

**Goal**: Platform administrators can set an alternative description for a tool that overrides the catalog description

**Independent Test**: Navigate to tool detail page, click edit, enter new description, save, verify it appears in all views

<!--
  CONSTITUTION PRINCIPLE XII: Backend-First Implementation
  Split into Phase 4A (backend) and Phase 4B (frontend).
-->

### Phase 4A: Backend Implementation (US2)

> **⚠️ CRITICAL**: Complete and verify all backend tests before starting Phase 4B

- [x] T016 [US2] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/database.ts` - Add `getAlternativeDescription(entityRef)` method
- [x] T017 [US2] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/database.ts` - Add `setAlternativeDescription(entityRef, description)` method with trim and null for empty
- [x] T018 [US2] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Add `updateToolAlternativeDescription(namespace, name, description)` method with validation
- [x] T019 [US2] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` - Update `listTools()` and `getTool()` to merge `alternativeDescription` from database
- [x] T020 [US2] Update `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts` - Add `PUT /tools/:namespace/:name/alternative-description` endpoint (mcp-admin required)
- [x] T021 [P] [US2] Update `tests/sanity/server-tools-view.sh` - Add tests for PUT alternative-description endpoint (success, validation, auth)
- [x] T022 [P] [US2] Create `backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/alternative-description.test.ts` - Unit tests for alternative description operations

**Checkpoint**: Backend tests MUST pass before proceeding to Phase 4B

### Phase 4B: Frontend Implementation (US2)

> **NOTE**: Only start after Phase 4A tests are verified passing

- [x] T023 [US2] Update `src/services/catalogService.ts` - Add `updateToolAlternativeDescription(namespace, name, description)` async function
- [x] T024 [US2] Update `src/components/McpToolPage.tsx` - Add Alternative Description section with inline edit button (mcp-admin only)
- [x] T025 [US2] Update `src/components/McpToolPage.tsx` - Implement edit mode with save/cancel buttons and error handling (keep text on failure)
- [x] T026 [US2] Update `src/components/McpToolPage.tsx` - Display alternative description when set, original description when empty
- [x] T027 [US2] Update `src/components/ServersTab.tsx` - Use alternativeDescription in expanded tool rows when available
- [x] T028 [US2] Update `src/components/McpWorkloadPage.tsx` - Use alternativeDescription in tool lists when available

**Checkpoint**: Alternative description can be edited and displays correctly in all views. US2 is fully functional.

---

## Phase 5: User Story 3 - Remove Tools Navigation Elements (Priority: P3)

**Goal**: Simplify navigation by removing redundant Tools tabs and buttons, add Guardrails button

**Independent Test**: Verify Tools tab is removed, Tools filter button is removed, Guardrails button is added, legacy URLs redirect

<!--
  This user story is frontend-only (US3). No backend changes required.
-->

### Frontend Implementation (US3)

- [x] T029 [US3] Update `src/components/McpCatalogPage.tsx` - Remove Tools tab from main navigation tabs
- [x] T030 [US3] Update `src/components/McpCatalogPage.tsx` - Remove Tools button from entity type filter buttons
- [x] T031 [US3] Update `src/components/McpCatalogPage.tsx` - Add Guardrails button to entity type filter buttons
- [x] T032 [US3] Update `src/components/McpCatalogPage.tsx` - Add redirect from legacy Tools tab URL to Servers tab
- [x] T033 [P] [US3] Update `console-extensions.json` - Remove Tools tab route if defined separately
- [x] T034 [P] [US3] Update `tests/sanity/server-tools-view.sh` - Add tests verifying Tools navigation removal

**Checkpoint**: Navigation simplified. US3 is complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and documentation

<!--
  CONSTITUTION PRINCIPLE XIII: Branch Documentation
  The final phase MUST include creation of IMPLEMENTATION-SUMMARY.md.
-->

- [x] T035 Run `yarn lint` and fix any issues
- [x] T036 Run `yarn test` and ensure all tests pass
- [x] T037 Run full build with `yarn build`
- [x] T038 Run `tests/sanity/server-tools-view.sh` - Validate all sanity tests pass
- [x] T039 Validate against quickstart.md steps
- [x] T040 Create `specs/007-server-tools-view/IMPLEMENTATION-SUMMARY.md` documenting feature (REQUIRED per Constitution XIII)

**Checkpoint**: Feature complete, all tests pass, documentation ready

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on Foundational; can run parallel with US1
- **User Story 3 (Phase 5)**: Depends on US1 completion (need expandable servers before removing Tools tab)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent after Foundational
- **User Story 2 (P2)**: Independent after Foundational; can develop parallel with US1
- **User Story 3 (P3)**: DEPENDS ON US1 - must complete after expandable servers are working

### Within Each User Story

- Backend before frontend (Constitution XII)
- Service methods before router endpoints
- Database methods before service methods
- Tests should pass before moving on

### Parallel Opportunities

- T004, T005, T006 can run in parallel (different files)
- T015, T021, T022 can run in parallel (test files)
- T033, T034 can run in parallel (different files)
- US1 and US2 can be developed in parallel by different team members
- US3 must wait for US1 to complete

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test expandable servers independently
5. Deploy/demo if ready - users can now browse tools within servers

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Expandable servers working → Deploy/Demo (MVP!)
3. Add User Story 2 → Alternative descriptions available → Deploy/Demo
4. Add User Story 3 → Tools navigation removed → Deploy/Demo
5. Polish phase → Full feature complete

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (expandable servers)
   - Developer B: User Story 2 (alternative descriptions)
3. After US1 complete:
   - Developer A: User Story 3 (navigation cleanup)
4. Polish together

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US3 MUST wait for US1 - don't remove Tools tab until expandable servers work
- Alternative description uses existing merge architecture pattern
- mcp-admin role check already exists - reuse for alternative description editing
- **CONSTITUTION XII**: US2 splits into backend (4A) and frontend (4B) phases
- **CONSTITUTION XIII**: Polish phase MUST create IMPLEMENTATION-SUMMARY.md
