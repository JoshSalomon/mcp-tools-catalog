# Feature Specification: Entity Management API

**Feature Branch**: `003-entity-management-api`
**Created**: 2025-12-18
**Status**: Draft
**Input**: User description: "Add to the system API for entity management (create, modify, delete). make the backstage database the source of truth for all the mcp-* entities. the APIs are allowed according to OCP roles, the roles are per entity type."

## Clarifications

### Session 2025-12-18
- Q: How should deletion of entities with active dependents (e.g., deleting a Server that has Tools) be handled? → A: Cascade delete for Servers (deleting server deletes its tools), Orphan for others (Tools/Workloads).
- Q: What are the uniqueness constraints for entity names? → A: Global uniqueness (Kind+Namespace+Name) for Servers/Workloads; Per-Server uniqueness for Tools.
- Q: What is the format for API error responses? → A: Standard HTTP Status Codes (4xx/5xx) + JSON Error Object.
- Q: What role is required for READ operations on MCP entities? → A: Public (any authenticated user can read).
- Q: How should concurrent updates to the same entity be handled? → A: Last write wins.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - CRUD Operations for MCP Entities (Priority: P1)

As an API client (user or system), I want to create, update, and delete MCP entities (Servers, Tools, Workloads) via a REST API, so that I can manage the catalog dynamically without manual file edits.

**Why this priority**: Core functionality required to make the database the source of truth and enable dynamic management.

**Independent Test**: Can be tested by sending HTTP requests to the API endpoints and verifying the entities appear in the Backstage catalog.

**Acceptance Scenarios**:

1. **Given** a valid MCP Server payload and authorized credentials, **When** I send a POST request to the creation endpoint, **Then** the server entity is created in the Backstage database and returns 201 Created.
2. **Given** an existing MCP Tool entity, **When** I send a DELETE request for that entity with authorized credentials, **Then** the entity is removed from the catalog.
3. **Given** an existing MCP Workload, **When** I send a PUT/PATCH request with updated fields, **Then** the entity is updated in the database.

---

### User Story 2 - Role-Based Access Control (RBAC) (Priority: P1)

As a system administrator, I want to enforce OCP role-based permissions for entity management, so that only authorized users can modify specific entity types.

**Why this priority**: Security requirement stated in the description ("APIs are allowed according to OCP roles").

**Independent Test**: Can be tested by attempting operations with different user tokens/roles and verifying 403 Forbidden vs 200 OK.

**Acceptance Scenarios**:

1. **Given** a user with the correct OCP role for `mcp-server`, **When** they attempt to create a server, **Then** the operation succeeds.
2. **Given** a user WITHOUT the correct OCP role for `mcp-server`, **When** they attempt to create a server, **Then** the operation is denied with 403 Forbidden.
3. **Given** different roles configured for `mcp-tool` and `mcp-workload`, **When** users access APIs for those types, **Then** their specific role requirements are enforced.

---

### Edge Cases

- What happens when an invalid entity payload is sent? (Should return 400 Bad Request with validation errors)
- How does the system handle concurrent updates to the same entity? (Last write wins - no versioning/locking)
- What happens if the OCP role check service is unavailable? (Fail closed - deny access)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide API endpoints to Create, Read, Update, and Delete `mcp-server`, `mcp-tool`, and `mcp-workload` entities.
- **FR-002**: System MUST store all managed entities in the Backstage database as the source of truth.
- **FR-003**: System MUST validate that the authenticated user possesses the required OCP role before allowing any Create, Update, or Delete operation.
- **FR-004**: System MUST allow configuring different OCP roles for each entity type (Server, Tool, Workload).
- **FR-005**: System MUST enforce the 'mcp-admin' role for managing `mcp-server` and `mcp-tool` entities, and the 'mcp-user' role for managing `mcp-workload` entities. These are the default role mappings; FR-004 allows configuration override.
- **FR-006**: System MUST validate entity schemas (required fields, relations) before persisting to the database.

- **FR-007**: System MUST perform a cascade delete when an `mcp-server` is deleted (automatically deleting all associated `mcp-tool` entities).
- **FR-008**: System MUST orphan dependent entities (remove parent reference but keep entity) when `mcp-tool` or `mcp-workload` entities are deleted, unless otherwise constrained by schema.
- **FR-009**: System MUST enforce standard Backstage global uniqueness (Kind+Namespace+Name) for `mcp-server` and `mcp-workload` entities.
- **FR-010**: System MUST enforce name uniqueness for `mcp-tool` entities only within the scope of their parent `mcp-server`.
- **FR-011**: System MUST return appropriate HTTP status codes (4xx for client errors, 5xx for server errors) and a JSON error object with a descriptive message for all failed API requests.
- **FR-012**: System MUST allow any authenticated user to perform READ operations on all MCP entity types without requiring specific roles.
- **FR-013**: System MUST use "last write wins" semantics for concurrent updates (no optimistic locking or version checks).

### Key Entities

- **MCP Server**: Represents a server providing tools.
- **MCP Tool**: Represents a specific tool available on a server.
- **MCP Workload**: Represents a task or workflow using tools.
- **OCP Role**: OpenShift Cluster Platform role used for authorization.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: API responds to valid CRUD requests in under 500ms (p95).
- **SC-002**: 100% of unauthorized requests (missing role) are blocked.
- **SC-003**: Entities created via API are visible in the Catalog within 5 seconds.
