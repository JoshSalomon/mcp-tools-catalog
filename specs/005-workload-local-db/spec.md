# Feature Specification: Workload Entities to Local Database

**Feature Branch**: `005-workload-local-db`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "as a first phase move the workload entities from backstage to local db"

## Overview

This feature migrates workload entity storage from the current dual-source architecture (Backstage Catalog + Database) to a simplified single-source architecture where the local database is the sole source of truth for workloads. This is the first phase of a larger initiative to remove Backstage dependency entirely.

### Background

Currently, workloads are managed through a complex merge architecture:
- YAML-defined workloads live in Backstage Catalog (read from Git)
- User edits and API-created workloads live in the database
- Backend merges both sources on every read operation
- Soft delete is required for YAML workloads to prevent re-ingestion

This complexity leads to:
- Eventual consistency issues
- Soft delete workarounds
- Inability to rename workloads
- Complex merge logic in the service layer

### Goal

Make the local database the single source of truth for all workload entities, eliminating the need for catalog merge logic and soft delete workarounds.

## Clarifications

### Session 2025-12-30

- Q: Should workload renaming be enabled now that database-only storage removes identity constraints? → A: Yes, enable renaming - workload name is editable in the Edit form.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create New Workload (Priority: P1)

As a user with the mcp-user role, I want to create a new workload through the UI so that I can define which tools my application uses.

**Why this priority**: Core functionality - users cannot manage workloads without the ability to create them.

**Independent Test**: Can be fully tested by creating a workload via the UI form and verifying it appears in the workloads list immediately.

**Acceptance Scenarios**:

1. **Given** I am logged in with mcp-user role and on the Workloads tab, **When** I click "Create Workload", fill in the form with name, namespace, and selected tools, and click Save, **Then** the workload is created and appears in the workloads list immediately.

2. **Given** I am logged in with mcp-user role and creating a workload, **When** I try to create a workload with a name that already exists in the same namespace, **Then** I see a clear error message indicating the name is already taken.

3. **Given** I am logged in without mcp-user role, **When** I view the Workloads tab, **Then** I do not see the Create button.

---

### User Story 2 - View and Browse Workloads (Priority: P1)

As a user, I want to browse all workloads in the catalog so that I can understand what tool combinations are available.

**Why this priority**: Core functionality - viewing is fundamental to any catalog.

**Independent Test**: Can be fully tested by loading the Workloads tab and verifying all workloads are displayed.

**Acceptance Scenarios**:

1. **Given** workloads exist in the system, **When** I navigate to the Workloads tab, **Then** I see a list of all workloads with their names, namespaces, and tool counts.

2. **Given** I am viewing the workloads list, **When** I click on a workload, **Then** I see the workload detail page showing all referenced tools organized by server.

---

### User Story 3 - Edit Existing Workload (Priority: P2)

As a user with the mcp-user role, I want to edit an existing workload so that I can modify its name, description, and tool selections as my needs change.

**Why this priority**: Essential for workload lifecycle management, but secondary to create/view.

**Independent Test**: Can be fully tested by editing a workload's name or tool selection and verifying changes persist after page refresh.

**Acceptance Scenarios**:

1. **Given** I am viewing a workload detail page and have mcp-user role, **When** I click Edit, modify the tool selections, and click Save, **Then** the changes are saved and reflected immediately on the detail page.

2. **Given** I am editing a workload, **When** I click Cancel, **Then** my changes are discarded and the original workload state is preserved.

3. **Given** I am editing a workload, **When** I change the workload name to a new unique name and click Save, **Then** the workload is renamed and accessible under the new name.

4. **Given** I am editing a workload, **When** I try to rename it to a name that already exists in the same namespace, **Then** I see a clear error message indicating the name is already taken.

---

### User Story 4 - Delete Workload (Priority: P2)

As a user with the mcp-user role, I want to delete a workload so that I can remove workloads that are no longer needed.

**Why this priority**: Part of complete lifecycle management, but less frequent than create/edit.

**Independent Test**: Can be fully tested by deleting a workload and verifying it no longer appears in the list.

**Acceptance Scenarios**:

1. **Given** I am viewing the workloads list and have mcp-user role, **When** I select Delete from the workload's action menu and confirm, **Then** the workload is permanently removed and no longer appears in any list.

2. **Given** I delete a workload, **When** I refresh the page or revisit later, **Then** the workload remains deleted (no "zombie" reappearance).

---

### User Story 5 - Import Workloads from YAML (Priority: P3)

As a system administrator, I want to optionally import workloads from YAML files so that I can bulk-create workloads from existing definitions.

**Why this priority**: Nice-to-have feature for convenience. No production data requires migration, so this is optional.

**Independent Test**: Can be fully tested by providing a YAML file and verifying the workloads are created in the database.

**Acceptance Scenarios**:

1. **Given** I have a valid YAML file containing workload definitions, **When** I use the import functionality, **Then** the workloads are created in the database with all their metadata preserved.

2. **Given** I am importing a workload with a name that already exists, **When** the import runs, **Then** the existing workload is skipped (not overwritten) and I am notified.

3. **Given** I import workloads from YAML, **When** I later edit or delete them, **Then** they behave identically to UI-created workloads.

---

### Edge Cases

- What happens when the database is unavailable during a workload operation? System displays a clear error message and does not corrupt data.
- How does the system handle a workload referencing tools that no longer exist? The workload is still displayed, but missing tools are indicated as unavailable.
- What happens if two users try to create workloads with the same name simultaneously? The second request fails with a clear "name already exists" error.
- What happens if a YAML file has invalid format during import? The import fails with a descriptive error message indicating the problem.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store all workload entities exclusively in the local database
- **FR-002**: System MUST provide CRUD operations for workloads through the existing API endpoints
- **FR-003**: System MUST enforce mcp-user role for workload create, update, and delete operations
- **FR-004**: System MUST allow read access to workloads without authentication
- **FR-005**: System MUST validate workload name uniqueness within a namespace before creation or rename
- **FR-006**: System MUST support renaming workloads (name is editable in update operations)
- **FR-007**: System MUST permanently delete workloads (no soft delete required)
- **FR-008**: System MUST handle workload-to-tool relationships using tool entity references
- **FR-009**: System MUST return appropriate error messages for all failure scenarios
- **FR-010**: System MUST complete all workload operations within 2 seconds (per SC-001)
- **FR-011**: System SHOULD provide optional YAML import capability for bulk workload creation (nice-to-have)

### Key Entities

- **Workload**: Represents a user-defined combination of tools. Contains name, namespace, description, and references to selected tools. Can reference tools from multiple servers.
- **Tool Reference**: A pointer from a workload to a tool entity. Stored as entity reference strings (e.g., `component:default/my-tool`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All workload CRUD operations complete in under 2 seconds
- **SC-002**: Users can create, edit, and delete workloads without encountering "zombie" re-appearance issues
- **SC-003**: Workload operations work consistently regardless of how the workload was created (UI or import)
- **SC-004**: System supports the current scale (single-digit workloads per cluster) with room for growth to 100+ workloads
- **SC-005**: Zero disruption to existing UI functionality during transition

## Assumptions

1. **No Production Migration Required**: There is no production data that needs to be migrated from Backstage. Users will create workloads fresh or optionally import from YAML.
2. **Backward Compatibility**: Existing API endpoints (`/api/mcp-entity-api/workloads/*`) will maintain their interface; only the backend implementation changes.
3. **Servers and Tools Remain Unchanged**: This phase only affects workloads; servers and tools continue using the existing architecture.
4. **RBAC Unchanged**: Existing role-based access control (mcp-user for workloads) remains in effect.
5. **No UI Changes Required**: The frontend should work without modification since the API contract remains the same.

## Out of Scope

- Migration of Server or Tool entities (future phases)
- Changes to the Backstage Catalog configuration for servers/tools
- New UI components or workflows
- Multi-cluster support
- Conflict detection for concurrent edits (existing limitation, deferred)
- Automatic/continuous YAML ingestion (YAML import is one-time, manual operation)

## Dependencies

- Existing local database infrastructure (already in place)
- Existing workload CRUD API endpoints (already implemented)
