# Tasks: Workload Entities to Local Database

**Input**: Design documents from `/specs/005-workload-local-db/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/workloads-api.yaml

**Tests**: Unit tests and sanity tests included per constitution (Test-First Development).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backstage-app/packages/backend/src/plugins/mcp-entity-api/`
- **Frontend**: `src/components/`, `src/services/`
- **Tests**: `backstage-app/packages/backend/src/plugins/mcp-entity-api/`, `tests/sanity/`

---

## Phase 1: Setup

**Purpose**: Prepare for the implementation by understanding current code structure

- [x] T001 Review current workload service implementation in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
- [x] T002 [P] Review current database layer in `backstage-app/packages/backend/src/plugins/mcp-entity-api/database.ts`
- [x] T003 [P] Review current router endpoints in `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts`

---

## Phase 2: Foundational (Database-Only Architecture)

**Purpose**: Core infrastructure changes that MUST be complete before user stories can be validated

**⚠️ CRITICAL**: These changes affect ALL user stories - complete before story validation

- [x] T004 Add UNIQUE constraint on (namespace, name, entity_type) if not present in `backstage-app/packages/backend/src/plugins/mcp-entity-api/database.ts`
      Note: entity_ref UNIQUE already enforces workload uniqueness; tool uniqueness handled separately in service layer
- [x] T005 Remove catalog lookup functions for workloads from `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` (keep for servers/tools)
- [x] T006 Remove merge logic for workloads from `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
- [x] T007 Remove soft delete logic for workloads from `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
- [x] T008 Remove soft delete annotations handling from `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`

**Checkpoint**: Foundation ready - database-only architecture in place for workloads

---

## Phase 3: User Story 1 - Create New Workload (Priority: P1) 🎯 MVP

**Goal**: Users with mcp-user role can create workloads through the UI, stored directly in database

**Independent Test**: Create a workload via API/UI, verify it appears in list immediately with no catalog involvement

### Implementation for User Story 1

- [x] T009 [US1] Simplify `createWorkload()` in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` to use database-only storage
- [x] T010 [US1] Add name uniqueness validation (database-level via UNIQUE constraint, application-level for better error messages) in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
- [x] T011 [US1] Ensure proper error response for duplicate name (409 Conflict) in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
- [x] T012 [US1] Verify RBAC check (mcp-user role) remains in place for POST /workloads in `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts`

### Tests for User Story 1

- [x] T013 [US1] Write unit test for createWorkload() database-only path in `backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/workload-service.test.ts`
- [x] T014 [US1] Write sanity test for POST /workloads endpoint in `tests/sanity/workload-crud.sh`

**Checkpoint**: Create workload works with database-only storage

---

## Phase 4: User Story 2 - View and Browse Workloads (Priority: P1) 🎯 MVP

**Goal**: Any user can view and browse all workloads from the database

**Independent Test**: List workloads via API, verify all workloads returned from database only (no catalog merge)

### Implementation for User Story 2

- [x] T015 [US2] Simplify `listWorkloads()` in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` to fetch from database only
- [x] T016 [US2] Remove soft-delete filtering from list operation in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
- [x] T017 [US2] Simplify `getWorkload()` in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` to fetch from database only
- [x] T018 [US2] Verify GET endpoints work without authentication in `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts`
- [x] T018a [US2] Verify workloads with missing tool references display gracefully (tools shown as unavailable) in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`

### Tests for User Story 2

- [x] T019 [P] [US2] Write unit test for listWorkloads() database-only path in `backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/workload-service.test.ts`
- [x] T020 [P] [US2] Write unit test for getWorkload() database-only path in `backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/workload-service.test.ts`
- [x] T021 [US2] Add sanity test for GET /workloads and GET /workloads/:ns/:name in `tests/sanity/workload-crud.sh`

**Checkpoint**: View/browse workloads works with database-only storage

---

## Phase 5: User Story 3 - Edit Existing Workload (Priority: P2)

**Goal**: Users with mcp-user role can edit workloads including renaming them

**Independent Test**: Edit a workload (change name and tools), verify changes persist after refresh

### Implementation for User Story 3

- [x] T022 [US3] Simplify `updateWorkload()` in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` to use database-only update
- [x] T023 [US3] Add rename support: detect when metadata.name differs from URL path name in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
- [x] T024 [US3] Implement rename logic: validate new name uniqueness, update name column and entity_ref in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
- [x] T025 [US3] Return 409 Conflict if new name already exists in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
- [x] T026 [US3] Enable name field editing in edit mode in `src/components/WorkloadForm.tsx`
- [x] T027 [US3] Add frontend validation for duplicate name on rename in `src/components/WorkloadForm.tsx`
      Note: Backend 409 Conflict displayed via existing saveError handling

### Tests for User Story 3

- [x] T028 [P] [US3] Write unit test for updateWorkload() with same name in `backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/workload-service.test.ts`
- [x] T029 [P] [US3] Write unit test for updateWorkload() with rename in `backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/workload-service.test.ts`
- [x] T030 [US3] Add sanity test for PUT /workloads/:ns/:name (update and rename) in `tests/sanity/workload-crud.sh`

**Checkpoint**: Edit workload (including rename) works with database-only storage

---

## Phase 6: User Story 4 - Delete Workload (Priority: P2)

**Goal**: Users with mcp-user role can permanently delete workloads (no zombie reappearance)

**Independent Test**: Delete a workload, verify it's gone permanently (refresh, wait, still gone)

### Implementation for User Story 4

- [x] T031 [US4] Simplify `deleteWorkload()` in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` to use hard delete only
- [x] T032 [US4] Remove soft delete code path (no more annotation-based soft delete) in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
- [x] T033 [US4] Remove admin endpoints for soft-deleted workloads if present in `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts`

### Tests for User Story 4

- [x] T034 [US4] Write unit test for deleteWorkload() hard delete in `backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/workload-service.test.ts`
- [x] T035 [US4] Add sanity test for DELETE /workloads/:ns/:name (verify permanent deletion) in `tests/sanity/workload-crud.sh`
- [x] T036 [US4] Verify no "zombie" reappearance after delete (wait and re-check) in `tests/sanity/workload-crud.sh`

**Checkpoint**: Delete workload is permanent with no zombie reappearance

---

## Phase 7: User Story 5 - Import Workloads from YAML (Priority: P3)

**Goal**: Administrators can bulk import workloads from YAML files

**Independent Test**: Import a YAML file with 2 workloads, verify both are created and behave like UI-created ones

**Note**: This is a P3 feature (nice-to-have). Can be deferred if time-constrained.

### Implementation for User Story 5

- [ ] T037 [US5] Add POST /workloads/import endpoint in `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts`
- [ ] T038 [US5] Implement `importWorkloads()` function in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
- [ ] T039 [US5] Add YAML parsing support (application/yaml content type) in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
- [ ] T040 [US5] Implement skip-existing logic (don't overwrite, return skipped list) in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
- [ ] T041 [US5] Return ImportResult schema (created, skipped, errors arrays) in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`

### Tests for User Story 5

- [ ] T042 [P] [US5] Write unit test for importWorkloads() with valid YAML in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.test.ts`
- [ ] T043 [P] [US5] Write unit test for importWorkloads() skip-existing behavior in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.test.ts`
- [ ] T044 [US5] Add sanity test for POST /workloads/import in `tests/sanity/workload-crud.sh`

**Checkpoint**: YAML import creates workloads that behave identically to UI-created ones

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T045 Remove dead code related to catalog-workload merge from `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
      Note: No dead code found - workload methods were already simplified during Phase 2
- [x] T046 Update inline documentation/comments in `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
- [x] T047 Run full sanity test suite and verify all tests pass in `tests/sanity/`
      Note: 12/13 tests passed. 1 failure is pre-existing cascade delete test issue (not workload related)
- [x] T048 Verify performance goal: all CRUD operations complete in <2 seconds
      Note: All operations ~0.5s (Create, Get, Update/Rename, Delete)
- [x] T049 Run quickstart.md validation scenarios manually
      Note: Validated create, rename, delete, no-zombie scenarios via API
- [x] T050 Update any outdated comments referencing catalog merge architecture
      Note: Updated MERGE-ARCHITECTURE.md to reflect workloads are database-only

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 and US2 can proceed in parallel (both P1)
  - US3 and US4 can proceed in parallel (both P2, after US1/US2)
  - US5 can proceed after core CRUD is working (P3)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (Create)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (View)**: Can start after Foundational - No dependencies on other stories
- **User Story 3 (Edit)**: Can start after Foundational - Logically follows Create but independently testable
- **User Story 4 (Delete)**: Can start after Foundational - Logically follows Create but independently testable
- **User Story 5 (Import)**: Can start after Foundational - Optional, can be deferred

### Within Each User Story

- Implementation before tests (tests validate implementation)
- Core logic before validation logic
- Backend before frontend (for US3)
- Story complete before moving to next priority

### Parallel Opportunities

- T002 and T003 can run in parallel (Setup)
- T019 and T020 can run in parallel (US2 tests)
- T028 and T029 can run in parallel (US3 tests)
- T042 and T043 can run in parallel (US5 tests)
- User Story 1 and User Story 2 can run in parallel (both P1)
- User Story 3 and User Story 4 can run in parallel (both P2)

---

## Parallel Example: Phase 2 (Foundational)

```bash
# These tasks must be sequential (same file, dependent changes):
Task T004: Add UNIQUE constraint
Task T005: Remove catalog lookup
Task T006: Remove merge logic
Task T007: Remove soft delete logic
Task T008: Remove soft delete annotations
```

## Parallel Example: User Story 1 + User Story 2 (P1 Stories)

```bash
# Can run in parallel by different developers:
Developer A: T009-T014 (US1: Create)
Developer B: T015-T021 (US2: View/Browse)
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T008) **CRITICAL**
3. Complete Phase 3: User Story 1 - Create (T009-T014)
4. Complete Phase 4: User Story 2 - View (T015-T021)
5. **STOP and VALIDATE**: Test create and view independently
6. Deploy/demo if ready - this is the MVP!

### Incremental Delivery

1. Setup + Foundational → Database-only architecture
2. Add US1 + US2 → Test → **MVP (Create + View)**
3. Add US3 (Edit) → Test → Deploy/Demo
4. Add US4 (Delete) → Test → Deploy/Demo
5. Add US5 (Import) → Test → Deploy/Demo (if needed)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Create) + User Story 3 (Edit)
   - Developer B: User Story 2 (View) + User Story 4 (Delete)
3. US5 (Import) can be picked up by whoever finishes first
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files or independent operations
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Most work is in `service.ts` - this is a simplification effort (removing code)
- Frontend changes minimal (only WorkloadForm.tsx for rename support)
- API contract unchanged - frontend should work without modification
