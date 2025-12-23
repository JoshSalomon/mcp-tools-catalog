# Tasks: Entity Management API

**Input**: Design documents from `/specs/003-entity-management-api/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are included as the constitution mandates Test-First Development (Principle IV).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Backend plugin**: `backstage-app/packages/backend/src/plugins/mcp-entity-api/`
- **Tests**: `backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and plugin structure

- [x] T001 Create plugin directory structure at backstage-app/packages/backend/src/plugins/mcp-entity-api/
- [x] T002 [P] Create TypeScript interfaces for MCP entities in backstage-app/packages/backend/src/plugins/mcp-entity-api/types.ts
- [x] T003 [P] Create error types and response helpers in backstage-app/packages/backend/src/plugins/mcp-entity-api/errors.ts
- [x] T004 Add plugin dependencies to backstage-app/packages/backend/package.json (@backstage/plugin-catalog-node, ajv, @kubernetes/client-node)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create plugin entry point and registration in backstage-app/packages/backend/src/plugins/mcp-entity-api/index.ts
- [x] T006 [P] Create base Express router skeleton in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T007 [P] Implement entity schema validation with AJV in backstage-app/packages/backend/src/plugins/mcp-entity-api/validation.ts
- [x] T008 Register mcp-entity-api plugin in backstage-app/packages/backend/src/index.ts
- [x] T009 [P] Create configuration schema for role mappings in backstage-app/app-config.yaml

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - CRUD Operations for MCP Entities (Priority: P1) 🎯 MVP

**Goal**: Provide REST API endpoints to Create, Read, Update, and Delete MCP entities (Servers, Tools, Workloads)

**Independent Test**: Send HTTP requests to API endpoints and verify entities appear in Backstage catalog

### Tests for User Story 1

- [x] T010 [P] [US1] Create test fixtures for MCP entities in backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/fixtures.ts
- [x] T011 [P] [US1] Create service unit tests in backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/service.test.ts
- [x] T012 [P] [US1] Create router integration tests in backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/router.test.ts

### Implementation for User Story 1

- [x] T013 [US1] Implement CatalogClient wrapper service in backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts
- [x] T014 [US1] Add createEntity method to service (FR-001, FR-002) in backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts
- [x] T015 [US1] Add getEntity and listEntities methods to service (FR-001, FR-012) in backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts
- [x] T016 [US1] Add updateEntity method to service (FR-001, FR-013) in backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts
- [x] T017 [US1] Add deleteEntity method with cascade logic for servers (FR-001, FR-007) in backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts
- [x] T018 [US1] Add uniqueness validation (FR-009, FR-010) in backstage-app/packages/backend/src/plugins/mcp-entity-api/validation.ts
- [x] T019 [US1] Implement POST /servers endpoint in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T020 [US1] Implement GET /servers and GET /servers/:namespace/:name endpoints in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T021 [US1] Implement PUT /servers/:namespace/:name endpoint in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T022 [US1] Implement DELETE /servers/:namespace/:name endpoint with cascade in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T023 [P] [US1] Implement POST /tools endpoint in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T024 [P] [US1] Implement GET /tools and GET /tools/:namespace/:name endpoints in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T025 [P] [US1] Implement PUT /tools/:namespace/:name endpoint in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T026 [P] [US1] Implement DELETE /tools/:namespace/:name endpoint in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts (orphan behavior: workload dependsOn refs become dangling per FR-008)
- [x] T027 [P] [US1] Implement POST /workloads endpoint in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T028 [P] [US1] Implement GET /workloads and GET /workloads/:namespace/:name endpoints in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts (missing tools with dependsOn ref generate a warning (not an error))
- [x] T029 [P] [US1] Implement PUT /workloads/:namespace/:name endpoint in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T030 [P] [US1] Implement DELETE /workloads/:namespace/:name endpoint in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T031 [US1] Add error handling middleware with JSON responses (FR-011) in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts

**Checkpoint**: At this point, CRUD operations work for all entity types (without RBAC enforcement)

---

## Phase 4: User Story 2 - Role-Based Access Control (Priority: P1)

**Goal**: Enforce OCP role-based permissions for entity management operations

**Independent Test**: Attempt operations with different user tokens/roles and verify 403 Forbidden vs 200 OK

### Tests for User Story 2

- [x] T032 [P] [US2] Create auth module unit tests in backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/auth.test.ts
- [x] T033 [P] [US2] Create RBAC integration tests in backstage-app/packages/backend/src/plugins/mcp-entity-api/__tests__/rbac.test.ts

### Implementation for User Story 2

- [x] T034 [US2] Implement OCP token extraction middleware in backstage-app/packages/backend/src/plugins/mcp-entity-api/auth.ts
- [x] T035 [US2] Implement SubjectAccessReview check function (FR-003) in backstage-app/packages/backend/src/plugins/mcp-entity-api/auth.ts
- [x] T036 [US2] Implement role requirement resolver per entity type (FR-004, FR-005) in backstage-app/packages/backend/src/plugins/mcp-entity-api/auth.ts
- [x] T037 [US2] Implement fail-closed behavior when OCP unavailable in backstage-app/packages/backend/src/plugins/mcp-entity-api/auth.ts
- [x] T038 [US2] Add RBAC middleware to server endpoints (mcp-admin) in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T039 [US2] Add RBAC middleware to tool endpoints (mcp-admin) in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T040 [US2] Add RBAC middleware to workload endpoints (mcp-user) in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T041 [US2] Skip RBAC for GET/LIST operations (FR-012) in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts

**Checkpoint**: At this point, all CRUD operations enforce proper RBAC

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T042 [P] Add request logging for all endpoints in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T043 [P] Add pagination support for list endpoints in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T044 [P] Add OpenAPI documentation comments in backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts
- [x] T045 Update backstage-app/README.md with API documentation
- [x] T046 Run quickstart.md validation scenarios against deployed API (test script: tests/sanity/test-quickstart-validation.sh - requires admin user)
- [x] T047 Performance test: Verify <500ms p95 response time (SC-001) (test script: tests/sanity/test-performance-security-visibility.sh)
- [x] T048 Security review: Verify 100% unauthorized requests blocked (SC-002) (test script: tests/sanity/test-performance-security-visibility.sh)
- [x] T049 Verify entities visible in Catalog within 5 seconds (SC-003) (test script: tests/sanity/test-performance-security-visibility.sh - requires admin user)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on User Story 1 (adds RBAC to existing endpoints)
- **Polish (Phase 5)**: Depends on User Stories 1 and 2 being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 endpoints existing - Adds middleware to US1 routes

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types/interfaces before service layer
- Service layer before router endpoints
- Core CRUD before advanced features (cascade, validation)
- Story complete before moving to next

### Parallel Opportunities

- T002, T003 can run in parallel (different files)
- T006, T007, T009 can run in parallel (different files)
- T010, T011, T012 can run in parallel (test files)
- T023-T030 can run in parallel (different endpoint groups)
- T032, T033 can run in parallel (test files)
- T042, T043, T044 can run in parallel (different concerns)

---

## Parallel Example: User Story 1 Endpoints

```bash
# After service layer is complete (T013-T018), launch endpoint groups in parallel:
Task: "Implement POST /tools endpoint"
Task: "Implement POST /workloads endpoint"

# Within tools endpoints, these can run in parallel:
Task: "Implement GET /tools endpoints"
Task: "Implement PUT /tools/:namespace/:name endpoint"
Task: "Implement DELETE /tools/:namespace/:name endpoint"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test CRUD operations work without RBAC
5. Proceed to Phase 4 for security

### Incremental Delivery

1. Complete Setup + Foundational → Plugin skeleton ready
2. Add User Story 1 → CRUD works → Can demo basic functionality
3. Add User Story 2 → RBAC enforced → Production-ready security
4. Polish → Documentation, performance → Ready for release

### Suggested MVP Scope

**MVP = Phase 1 + Phase 2 + Phase 3 (User Story 1)**

This delivers working CRUD APIs that can be tested and demonstrated. RBAC (User Story 2) should follow immediately for production use.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Both user stories are P1 priority; US2 builds on US1
- Constitution requires test-first development (Principle IV)
- All code must be TypeScript strict mode (Principle VIII)
- Database is source of truth, not YAML files (Principle VI)
