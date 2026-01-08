# Feature Specification: MCP Guardrails Entity

**Feature Branch**: `006-mcp-guardrails`
**Created**: 2026-01-04
**Status**: Draft
**Input**: User description: "Add new MCP entity guardrail for workload-tool relationships"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and Manage Guardrails (Priority: P1)

As a platform administrator, I want to view all guardrails in a dedicated list screen so that I can understand what guardrails are available and manage them centrally.

**Why this priority**: Guardrails must exist before they can be attached to tools or workloads. The list screen is the foundation for all guardrail management.

**Independent Test**: Can be fully tested by navigating to the Guardrails tab, viewing the list, and verifying guardrail details display correctly.

**Acceptance Scenarios**:

1. **Given** the user navigates to the MCP catalog, **When** they click the Guardrails tab, **Then** they see a list of all guardrails with name, description, and deployment information
2. **Given** a guardrail exists, **When** the user clicks on a guardrail row, **Then** they see the guardrail detail page with full information
3. **Given** the user is on the guardrails list, **When** they click the action menu for a guardrail, **Then** they see Edit and Delete options
4. **Given** the user clicks Delete on a guardrail, **When** they confirm deletion, **Then** the guardrail is removed from the system

---

### User Story 2 - Create Guardrails (Priority: P1)

As a platform administrator, I want to create guardrails through a form UI or by importing a YAML file so that I can define new guardrails for use with tools and workloads.

**Why this priority**: Creating guardrails is essential before they can be used anywhere in the system.

**Independent Test**: Can be fully tested by creating a new guardrail via the Create button, filling the form, and verifying it appears in the list.

**Acceptance Scenarios**:

1. **Given** the user clicks the Create button, **When** the form opens, **Then** they see fields for name (required), description (required), deployment (required), and parameters (optional)
2. **Given** the user fills all required fields, **When** they submit the form, **Then** a new guardrail is created and visible in the list
3. **Given** the user clicks the Import button, **When** they upload a valid YAML file, **Then** the guardrail is created from the YAML definition
4. **Given** a guardrail with the same name already exists, **When** the user tries to create a duplicate, **Then** they see an error message indicating the conflict

---

### User Story 3 - Attach Guardrails to Tools (Priority: P2)

As a platform administrator, I want to attach guardrails to tools with a pre-execution or post-execution parameter so that when the tool is added to a workload, the guardrail configuration is automatically inherited.

**Why this priority**: Tool-level guardrails provide default protection that applies across all workloads using that tool.

**Independent Test**: Can be fully tested by editing a tool, adding a guardrail with pre/post setting, then verifying the association is saved and displayed.

**Acceptance Scenarios**:

1. **Given** a tool exists, **When** the user edits the tool, **Then** they can add guardrails with pre-execution or post-execution parameter
2. **Given** a guardrail is attached to a tool, **When** viewing the tool details, **Then** the attached guardrails and their execution timing are displayed
3. **Given** a guardrail is attached to a tool, **When** viewing the guardrail details, **Then** the usage section shows which tools reference this guardrail

---

### User Story 4 - Manage Guardrails on Workloads (Priority: P2)

As a workload owner (mcp-user role), I want to manage guardrails on workload-tool relationships so that I can add additional guardrails or view inherited ones from tool definitions.

**Why this priority**: Workload-level guardrail management allows fine-tuning of protection per workload while respecting tool-level defaults.

**Independent Test**: Can be fully tested by creating/editing a workload, adding guardrails to a tool relationship, and verifying the configuration persists.

**Acceptance Scenarios**:

1. **Given** a workload references a tool with attached guardrails, **When** viewing the workload, **Then** the inherited guardrails are displayed and marked as non-removable
2. **Given** the user is editing a workload, **When** they add a new guardrail to a tool relationship, **Then** the guardrail is added with pre/post-execution parameter
3. **Given** a guardrail was added at the workload level, **When** the user wants to remove it, **Then** they can remove only workload-level guardrails (not tool-level ones)
4. **Given** a guardrail is attached to a workload-tool relationship, **When** viewing the guardrail details, **Then** the usage section shows the workload-tool association

---

### User Story 5 - Disable/Enable Guardrails (Priority: P3)

As a platform administrator, I want to globally disable or enable guardrails so that I can temporarily suspend a guardrail across all usages without removing it.

**Why this priority**: Global disable provides operational flexibility for maintenance or troubleshooting without losing configuration.

**Independent Test**: Can be fully tested by toggling the disable checkbox on a guardrail and verifying its disabled state is reflected in the UI.

**Acceptance Scenarios**:

1. **Given** the user is viewing the guardrails list, **When** they toggle the disable checkbox, **Then** the guardrail's disabled state is updated immediately
2. **Given** a guardrail is disabled, **When** viewing it in any context (list, details, workload), **Then** it is visually indicated as disabled

---

### Edge Cases

- What happens when a guardrail is deleted while attached to tools or workloads? → System prevents deletion; user must remove all associations first
- What happens when a tool with attached guardrails is removed from a workload? (Guardrail associations for that tool-workload pair should be removed)
- What happens when importing a YAML file with invalid format? (User sees clear validation error)
- What happens when the same guardrail is added multiple times to the same workload-tool pair? (System prevents duplicates)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Guardrails tab in the MCP Catalog page displaying all guardrails
- **FR-002**: System MUST allow creating guardrails via a form with name, description, deployment (required) and parameters (optional) fields
- **FR-003**: System MUST allow importing guardrails from YAML files
- **FR-004**: System MUST allow editing existing guardrails
- **FR-005**: System MUST prevent deletion of guardrails that have existing references (user must remove all tool and workload associations first)
- **FR-006**: System MUST store guardrails in the database only (not in Backstage catalog)
- **FR-007**: System MUST allow attaching guardrails to tools with pre-execution or post-execution parameter
- **FR-008**: System MUST automatically inherit tool-level guardrails when a tool is added to a workload
- **FR-009**: System MUST allow adding additional guardrails at the workload-tool level
- **FR-010**: System MUST prevent removal of tool-level guardrails at the workload level
- **FR-011**: System MUST allow removal of guardrails added at the workload level only
- **FR-012**: System MUST provide a global disable/enable toggle for each guardrail
- **FR-013**: System MUST display guardrail usage (which tools and workload-tool associations reference it)
- **FR-014**: System MUST prevent duplicate guardrail names
- **FR-015**: System MUST support multiple guardrails on the same workload-tool relationship (no ordering, same priority)

### Key Entities

- **Guardrail**: A protection mechanism with name, description, deployment (all required text), and optional parameters field. Can be globally disabled.
- **Tool-Guardrail Association**: Links a guardrail to a tool with execution timing (pre-execution or post-execution). These guardrails are inherited by all workloads using the tool.
- **Workload-Tool-Guardrail Association**: Links a guardrail to a specific workload-tool relationship with execution timing. Includes both inherited (from tool) and workload-specific guardrails.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a new guardrail in under 1 minute via the form UI
- **SC-002**: Users can import guardrails from YAML files with success/failure feedback within 5 seconds
- **SC-003**: 100% of tool-level guardrails are automatically visible on workloads using those tools
- **SC-004**: Users can distinguish between inherited (tool-level) and workload-specific guardrails at a glance
- **SC-005**: Guardrail list page loads within 2 seconds with up to 100 guardrails
- **SC-006**: Users can find guardrail usage information (which tools/workloads reference it) from the guardrail detail page

## Clarifications

### Session 2026-01-04

- Q: When a guardrail is deleted and has existing references, what should happen? → A: Prevent deletion if references exist (user must remove associations first)

## Assumptions

- RBAC for guardrails: mcp-admin role required for guardrail CRUD and tool-level associations; mcp-user role required for workload-level guardrail management
- No ordering or priority between multiple guardrails on the same workload-tool relationship (explicitly stated as non-requirement)
- Guardrail execution timing (pre/post) is informational only - actual execution is handled by external systems
- YAML import format follows the same pattern as other MCP entities

## Out of Scope

- Guardrail execution/enforcement logic (this is an external concern)
- Ordering or prioritization of multiple guardrails (explicitly deferred for future)
- Guardrail templates or inheritance beyond tool-to-workload
- Guardrail versioning
