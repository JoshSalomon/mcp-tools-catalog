# Tasks: MCP Tools Catalog

**Input**: Design documents from `/specs/001-mcp-tools-catalog/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md

**Tests**: Test tasks are included per constitution requirement (Test-First Development)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**IMPORTANT ARCHITECTURE NOTES**:
1. This is an **OpenShift Console Plugin** (frontend-only) that consumes MCP entities from Backstage catalog via API
2. Uses **Component kind subtypes** (NOT custom entity kinds): spec.type = 'server' | 'tool' | 'workflow' | 'service'
3. Uses **PatternFly React components** for UI (OpenShift Console standard)
4. User Story 4 (GitHub Integration) is handled by Backstage backend configuration - NOT implemented in this plugin
5. This plugin is read-only - entities are managed in Backstage, synced from GitHub

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Backstage plugin structure:
- React components: `src/components/`
- TypeScript models: `src/models/`
- Services: `src/services/`
- Utilities: `src/utils/`
- Tests: `tests/unit/` and `tests/integration/`

---

## Phase 1: Setup (Shared Infrastructure) ✅ COMPLETE

**Purpose**: Project initialization and basic structure

- [x] T001 Verify package.json has correct OpenShift Console plugin configuration in consolePlugin section
- [x] T002 Add @backstage/catalog-model ^1.7.5 as peerDependency in package.json
- [x] T003 [P] Add @backstage/core-components ^0.17.4 as peerDependency in package.json
- [x] T004 [P] Add Jest dependencies to devDependencies: jest ^28.0.0, ts-jest ^29.0.0, @types/jest ^29.0.0 in package.json
- [x] T005 [P] Add React Testing Library dependencies: @testing-library/react ^12.1.5, @testing-library/jest-dom ^5.16.5, @testing-library/user-event ^14.4.3 in package.json
- [x] T006 [P] Add jest-environment-jsdom ^28.0.0 to devDependencies in package.json
- [x] T007 Create jest.config.ts with testEnvironment jsdom, ts-jest transform, and OpenShift Console transformIgnorePatterns
- [x] T008 [P] Create setupTests.ts with @testing-library/jest-dom imports
- [x] T009 [P] Update Dockerfile to use Red Hat UBI base image with non-root user configuration
- [x] T010 [P] Verify webpack.config.ts has correct dynamic plugin bundling configuration
- [x] T011 Update console-extensions.json to register MCP catalog page and entity types

---

## Phase 2: Foundational (Blocking Prerequisites) ✅ COMPLETE

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T012 Create McpServerEntity TypeScript interface in src/models/CatalogMcpServer.ts extending Entity with spec.type: 'mcp-server'
- [x] T013 [P] Create McpToolEntity TypeScript interface in src/models/CatalogMcpTool.ts extending Entity with spec.type: 'mcp-tool'
- [x] T014 [P] Create McpWorkloadEntity TypeScript interface in src/models/CatalogMcpWorkload.ts extending Entity with spec.type: 'service'
- [x] T015 Create catalogService.ts in src/services/ with useCatalogEntities and useCatalogEntity hooks
- [x] T016 [P] Create searchService.ts in src/services/ with filterResources and filterToolsByServer logic
- [x] T017 [P] Create validationService.ts in src/services/ implementing FR-005 server reference validation and FR-006 tool reference validation
- [x] T018 [P] Create hierarchicalNaming.ts in src/utils/ for server/tool naming resolution
- [x] T019 [P] Create performanceMonitor.ts in src/utils/ for tracking list view and detail page performance targets
- [x] T020 Create Pagination.tsx in src/components/shared/ supporting 100 items per page (FR-017)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Browse MCP Servers (Priority: P1) - MVP ✅ COMPLETE

**Goal**: Platform engineers can browse and discover available MCP servers in the Backstage catalog, view server details, and see which tools each server provides

**Independent Test**: Add MCP server entries to catalog, verify they appear in MCP section, click server to view details including server properties and tool list with clickable links

### Implementation for User Story 1

- [x] T021 [P] [US1] Create ServersTab.tsx in src/components/ with PatternFly table showing server list, search, and filter
- [x] T022 [P] [US1] Create McpServerPage.tsx in src/components/ displaying server properties (name, description, version, endpoint) per FR-002
- [x] T023 [US1] Add tool list section to McpServerPage.tsx showing tool name, description, type with clickable links per FR-015
- [x] T024 [US1] Integrate catalogService in ServersTab.tsx to fetch MCP server entities with filter kind=Resource AND spec.type=mcp-server
- [x] T025 [US1] Integrate catalogService in McpServerPage.tsx to fetch server details and related tools (kind=Component, spec.type=mcp-tool, spec.partOf matching current server)
- [x] T026 [US1] Add pagination to ServersTab.tsx using shared Pagination component (100 items/page)
- [x] T027 [US1] Implement text search by name and description in ServersTab.tsx per FR-008
- [x] T028 [US1] Add performance monitoring to ServersTab.tsx and McpServerPage.tsx using performanceMonitor utility
- [x] T029 [US1] Create McpCatalogPage.tsx in src/components/ with PatternFly tabs container for Servers/Tools/Workloads
- [x] T030 [US1] Register McpCatalogPage in console-extensions.json as dynamic plugin exposed module
- [x] T031 [US1] Add ServersTab to McpCatalogPage.tsx as default active tab
- [x] T032 [US1] Create OfflineIndicator.tsx in src/components/shared/ for showing offline server status per FR-016
- [x] T033 [US1] Integrate OfflineIndicator in McpServerPage.tsx to display cached metadata with visual offline status

**Checkpoint**: At this point, User Story 1 should be fully functional - users can browse servers, view details, and see tool lists

---

## Phase 4: User Story 2 - Explore MCP Tools (Priority: P2) ✅ COMPLETE

**Goal**: Developers can browse MCP tools, see which server provides each tool, and navigate from tools to servers and workloads

**Independent Test**: Add MCP tools linked to servers, verify tools appear with server references, click server reference to navigate to server detail page

### Implementation for User Story 2

- [x] T034 [P] [US2] Create ToolsTab.tsx in src/components/ with PatternFly table showing tool list, search, and filter
- [x] T035 [P] [US2] Create McpToolPage.tsx in src/components/ displaying tool properties (name, description, type, parameters) per FR-003
- [x] T036 [US2] Add parent server section to McpToolPage.tsx with clickable link to server detail page per FR-003
- [x] T037 [US2] Add "Used By" workloads section to McpToolPage.tsx showing bidirectional relationships per FR-004
- [x] T038 [US2] Integrate catalogService in ToolsTab.tsx to fetch MCP tool entities with filter kind=Component AND spec.type=tool
- [x] T039 [US2] Integrate catalogService in McpToolPage.tsx to fetch tool details, parent server, and referencing workloads
- [x] T040 [US2] Add pagination to ToolsTab.tsx using shared Pagination component (100 items/page)
- [x] T041 [US2] Implement text search and relationship filters (tools by server) in ToolsTab.tsx per FR-008
- [x] T042 [US2] Add performance monitoring to ToolsTab.tsx and McpToolPage.tsx using performanceMonitor utility
- [x] T043 [US2] Add ToolsTab to McpCatalogPage.tsx tabs
- [x] T044 [US2] Implement hierarchical naming display in McpToolPage.tsx using hierarchicalNaming utility (server/tool format)
- [x] T045 [US2] Add validation error display in McpToolPage.tsx for broken server references using validationService

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can browse both servers and tools with full navigation

---

## Phase 5: User Story 3 - Manage MCP Workloads (Priority: P3) ✅ COMPLETE

**Goal**: Architects can view MCP workloads and their associated tools, understand tool composition, and see which workloads use specific tools

**Independent Test**: Create workloads that reference multiple tools, verify relationships display correctly, navigate from workloads to tools and back

### Implementation for User Story 3

- [x] T046 [P] [US3] Create WorkloadsTab.tsx in src/components/ with PatternFly table showing workload list, search, and filter
- [x] T047 [P] [US3] Create McpWorkloadPage.tsx in src/components/ displaying workload properties (name, description, purpose, deployment info)
- [x] T048 [US3] Add tools section to McpWorkloadPage.tsx listing all referenced tools with links to tool details per FR-004
- [x] T049 [US3] Integrate catalogService in WorkloadsTab.tsx to fetch MCP workload entities with filter kind=Component AND spec.type in ['workflow', 'service']
- [x] T050 [US3] Integrate catalogService in McpWorkloadPage.tsx to fetch workload details and referenced tools using spec.consumesTools
- [x] T051 [US3] Add pagination to WorkloadsTab.tsx using shared Pagination component (100 items/page)
- [x] T052 [US3] Implement text search and relationship filters (workloads by tool) in WorkloadsTab.tsx per FR-008
- [x] T053 [US3] Add performance monitoring to WorkloadsTab.tsx and McpWorkloadPage.tsx using performanceMonitor utility
- [x] T054 [US3] Add WorkloadsTab to McpCatalogPage.tsx tabs
- [x] T055 [US3] Implement tools-by-server grouping in McpWorkloadPage.tsx tools section for better organization
- [x] T056 [US3] Add validation error display in McpWorkloadPage.tsx for broken tool references using validationService
- [x] T057 [US3] Create DependencyTreeView.tsx in src/components/shared/ using PatternFly TreeView for hierarchical visualization per FR-010
- [x] T058 [US3] Integrate DependencyTreeView in McpWorkloadPage.tsx showing workload→server→tool hierarchy with expandable nodes
- [x] T059 [US3] Add clickable navigation from tree nodes to respective entity detail pages in DependencyTreeView
- [x] T060 [US3] Implement search/filter in DependencyTreeView for large dependency trees

**Checkpoint**: All user stories should now be independently functional - complete MCP catalog browsing experience

---

## Phase 6: Polish & Cross-Cutting Concerns (IN PROGRESS)

**Purpose**: Improvements that affect multiple user stories and production readiness

- [x] T061 [P] Add loading states to all tab components (ServersTab, ToolsTab, WorkloadsTab)
- [x] T062 [P] Add error boundary components for graceful error handling across all pages
- [x] T063 [P] Implement empty state components for tabs with no entities
- [x] T064 [P] Add PatternFly breadcrumb navigation to detail pages
- [x] T065 Add entity type filters (McpServer, McpTool, McpWorkload) to catalog search per FR-008
- [x] T066 [P] Create unit tests for ServersTab in src/components/ServersTab.spec.tsx
- [x] T067 [P] Create unit tests for McpServerPage in src/components/McpServerPage.spec.tsx
- [x] T068 [P] Create unit tests for ToolsTab in src/components/ToolsTab.spec.tsx
- [x] T069 [P] Create unit tests for McpToolPage in src/components/McpToolPage.spec.tsx
- [x] T070 [P] Create unit tests for WorkloadsTab in src/components/WorkloadsTab.spec.tsx
- [x] T071 [P] Create unit tests for McpWorkloadPage in src/components/McpWorkloadPage.spec.tsx
- [x] T072 [P] Create unit tests for DependencyTreeView in src/components/shared/DependencyTreeView.spec.tsx
- [x] T073 [P] Create unit tests for catalogService in src/services/catalogService.spec.tsx
- [x] T074 [P] Create unit tests for searchService in src/services/searchService.spec.ts
- [x] T075 [P] Create unit tests for validationService in src/services/validationService.spec.ts
- [ ] T076 Create integration test for server browsing in integration-tests/cypress/e2e/server-browsing.cy.ts
- [ ] T077 [P] Create integration test for tool exploration in integration-tests/cypress/e2e/tool-exploration.cy.ts
- [ ] T078 [P] Create integration test for workload management in integration-tests/cypress/e2e/workload-management.cy.ts
- [x] T079 Create sample entity YAML files for testing: mcp-server-example.yaml, mcp-tool-example.yaml, mcp-workload-example.yaml
- [x] T080 [P] Add accessibility testing to all components (ARIA labels, keyboard navigation)
- [x] T081 [P] Update deployment/kubernetes/deployment.yaml with resource limits and health checks
- [x] T082 [P] Verify container image builds with non-root user and minimal base image
- [x] T083 Run quickstart.md validation to ensure all examples work
- [x] T084 [P] Add JSDoc comments to all public APIs and exported components
- [x] T085 Code cleanup and remove any unused imports or commented code

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 (navigation to servers) but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Integrates with US1/US2 (navigation to servers/tools) but independently testable

### Within Each User Story

**User Story 1 Flow:**
1. T021, T022 (tab and page components) can run in parallel
2. T023 requires T022 (adds to McpServerPage)
3. T024, T025 (service integration) can follow component creation
4. T026-T028 (features) can run after service integration
5. T029-T031 (catalog page setup) integrate all components
6. T032, T033 (offline indicator) can run in parallel at end

**User Story 2 Flow:**
1. T034, T035 (tab and page components) can run in parallel
2. T036-T037 (page sections) require T035
3. T038-T039 (service integration) can follow component creation
4. T040-T042 (features) can run after service integration
5. T043-T045 (integration and validation) complete the story

**User Story 3 Flow:**
1. T046, T047 (tab and page components) can run in parallel
2. T048 requires T047 (adds to McpWorkloadPage)
3. T049-T050 (service integration) can follow component creation
4. T051-T053 (features) can run after service integration
5. T054-T056 (integration and validation) build on features
6. T057 (tree view component) can be developed in parallel
7. T058-T060 (tree integration) require T057 and T047

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T003-T006, T008-T010)
- All Foundational tasks marked [P] can run in parallel within Phase 2 (T013-T014, T016-T019)
- Once Foundational phase completes, all three user stories can start in parallel (if team capacity allows)
- Within each story, component creation tasks marked [P] can run in parallel
- All unit test tasks in Polish phase marked [P] can run in parallel (T066-T075)
- Integration tests marked [P] can run in parallel (T077-T078)

---

## Parallel Example: User Story 1

```bash
# Launch component creation together:
Task: "Create ServersTab.tsx in src/components/" (T021)
Task: "Create McpServerPage.tsx in src/components/" (T022)

# After services are integrated, launch features together:
Task: "Add pagination to ServersTab.tsx" (T026)
Task: "Implement text search by name and description" (T027)
Task: "Add performance monitoring" (T028)

# Final offline indicator tasks:
Task: "Create OfflineIndicator.tsx" (T032)
Task: "Integrate OfflineIndicator in McpServerPage.tsx" (T033)
```

---

## Parallel Example: Foundational Phase

```bash
# Launch all model creation together:
Task: "Create McpTool TypeScript interface" (T013)
Task: "Create McpWorkload TypeScript interface" (T014)

# Launch all services together:
Task: "Create searchService.ts" (T016)
Task: "Create validationService.ts" (T017)
Task: "Create hierarchicalNaming.ts" (T018)
Task: "Create performanceMonitor.ts" (T019)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T011)
2. Complete Phase 2: Foundational (T012-T020) - CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T021-T033)
4. **STOP and VALIDATE**: Test server browsing independently, verify all acceptance scenarios
5. Deploy/demo if ready

**MVP Delivers**: Platform engineers can browse MCP servers, view server details including connection info, and see which tools each server provides with clickable navigation.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (Servers) → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 (Tools) → Test independently → Deploy/Demo
4. Add User Story 3 (Workloads) → Test independently → Deploy/Demo
5. Add Polish phase for production readiness
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T020)
2. Once Foundational is done:
   - Developer A: User Story 1 (T021-T033) - Servers
   - Developer B: User Story 2 (T034-T045) - Tools
   - Developer C: User Story 3 (T046-T060) - Workloads
3. Stories complete and integrate independently
4. All developers: Polish phase (T061-T085) - can divide unit tests and integration tests

---

## Task Summary

**Total Tasks**: 85 tasks across 6 phases

**Task Count by User Story:**
- Setup: 11 tasks
- Foundational: 9 tasks (BLOCKS all user stories)
- User Story 1 (Browse Servers): 13 tasks
- User Story 2 (Explore Tools): 12 tasks
- User Story 3 (Manage Workloads): 15 tasks
- Polish & Cross-Cutting: 25 tasks

**Parallel Opportunities Identified**: 45 tasks marked [P] can run in parallel with other tasks in same phase

**Independent Test Criteria:**
- **US1**: Add servers to catalog → View in MCP section → Click server → See properties and tool list → Click tools → Navigate to tool details
- **US2**: Add tools with server refs → View in tools tab → See parent server → Click server link → Navigate to server page → Check "Used By" section shows workloads
- **US3**: Create workloads referencing tools → View in workloads tab → See tool list → Click tools → Navigate to tool pages → Use tree view for dependency visualization

**Suggested MVP Scope**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (User Story 1 only) = 33 tasks

This delivers immediate value by making MCP server infrastructure visible with tool discovery capabilities, without waiting for full workload management features.

---

## User Story 4: Configure GitHub Catalog Integration (Priority: P1) ✅ DOCUMENTATION COMPLETE

**Note**: User Story 4 is implemented via Backstage backend configuration, NOT as plugin code. This plugin consumes entities from the catalog regardless of their source.

**Documentation Tasks**:
- [x] T086 [US4] Add "Configure GitHub Catalog Integration" section to DEPLOYMENT.md covering FR-018 through FR-025
- [x] T087 [US4] Document GitHub repository URL configuration (FR-019)
- [x] T088 [US4] Document branch name configuration (FR-020)
- [x] T089 [US4] Document Personal Access Token setup (FR-021)
- [x] T090 [US4] Document source of truth behavior - GitHub overwrites Backstage (FR-022)
- [x] T091 [US4] Document observability metrics and monitoring (FR-023)
- [x] T092 [US4] Document automatic retry with exponential backoff (FR-024)
- [x] T093 [US4] Document GitHub API rate limit handling (FR-025)
- [x] T094 [US4] Add GitHub integration quick start section to quickstart.md

**Implementation Location**: See `DEPLOYMENT.md` section "📦 Configure GitHub Catalog Integration"

---

## Notes

- [P] tasks = different files, no dependencies within the phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Foundational phase MUST be 100% complete before any user story work begins
- Performance targets: List views <2s, detail pages <1s, search <1s (SC-005)
- Pagination: 100 items per page (FR-017, SC-006)
- All entity references must be validated per FR-005 and FR-006
- Container must use non-root user and Red Hat UBI base image
- This is an OpenShift Console dynamic plugin (frontend-only), not a Backstage backend plugin
- All MCP entities are Component kind with custom spec.type values ('server', 'tool', 'workflow', 'service')
- MCP-specific data stored in spec.mcp field (serverType, endpoint, tools array, etc.)
- Entity definitions are registered via YAML in the existing Backstage catalog
- GitHub Integration (User Story 4) is configured in Backstage backend - this plugin only consumes entities
- Plugin consumes entities as read-only data via Backstage catalog API (FR-014)
- Use PatternFly components for UI (NOT Backstage components - this is OpenShift Console, not Backstage UI)
