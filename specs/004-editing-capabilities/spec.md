# Feature Specification: Editing Capabilities

**Feature Branch**: `004-editing-capabilities`  
**Created**: 2025-12-18  
**Status**: Draft  
**Input**: User description: "Adding Editing capabilities, first step - Make the tools enable/disable state persistent, Creating new workloads, Editing existing workloads, Deleting a workload"

## Clarifications

### Session 2025-12-18

- Q: How should the system handle concurrent edits to the same workload? → A: Show conflict warning with option to overwrite or cancel
- Q: Should workloads be required to have at least one tool, or can they be empty? → A: Allow empty workloads (no tools required)
- Q: How should the system handle concurrent tool state changes on the same server? → A: Last-write-wins (no warning, silently overwrite)
- Q: What permission requirements should apply to editing operations? → A: Use existing RBAC roles (mcp-user for edit, mcp-admin for tool state changes)
- Q: Which workload metadata fields are required vs optional? → A: Name and namespace required; description, lifecycle, owner optional

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Persist Tool Enable/Disable State Changes (Priority: P1)

A user with mcp-admin role needs to review and batch multiple tool state changes before committing them, ensuring they can cancel unintended modifications and only persist changes when ready.

**Why this priority**: This is foundational editing functionality that enables safe, controlled modifications to tool states. Without this, users risk accidentally persisting changes or losing work if they navigate away.

**Independent Test**: Can be fully tested by navigating to a server detail page, toggling multiple tool states, verifying Save/Cancel buttons enable/disable correctly, clicking Save to persist changes, and confirming changes persist after page refresh. This delivers value independently by providing controlled editing workflow.

**Acceptance Scenarios**:

1. **Given** a user is viewing a server detail page with tools displayed, **When** the page loads, **Then** Save and Cancel buttons are visible but disabled, and tool checkboxes reflect their current persisted state
2. **Given** Save and Cancel buttons are disabled, **When** a user toggles any tool's enable/disable checkbox, **Then** both Save and Cancel buttons become enabled
3. **Given** Save and Cancel buttons are enabled after making changes, **When** a user clicks Cancel, **Then** all tool checkboxes revert to their original persisted state and Save/Cancel buttons become disabled
4. **Given** Save and Cancel buttons are enabled after making changes, **When** a user clicks Save, **Then** all changes are persisted to the backend, Save/Cancel buttons become disabled, and the updated tool states are reflected in the UI
5. **Given** a user has made and saved tool state changes, **When** the user navigates away and returns to the server detail page, **Then** the tool states reflect the previously saved changes
6. **Given** Save and Cancel buttons are enabled, **When** a user navigates away from the page, **Then** unsaved changes are lost (no auto-save)
7. **Given** a user without mcp-admin role is viewing a server detail page, **When** the page loads, **Then** tool checkboxes are displayed in read-only mode (disabled) and Save/Cancel buttons are not shown

---

### User Story 2 - Create New Workloads (Priority: P2)

A user with mcp-user role needs to create new MCP workloads by selecting enabled tools from available servers, defining workload metadata, and saving the configuration.

**Why this priority**: Enables users to compose new workloads from existing tools, which is a core catalog management capability. However, it depends on the persistence mechanism from Story 1 being in place, so it's prioritized second.

**Independent Test**: Can be fully tested by navigating to workloads list, clicking Create button, filling in metadata fields, selecting tools from the server/tool tree, clicking Save, and verifying the new workload appears in the list. This delivers value independently by enabling workload creation workflow.

**Acceptance Scenarios**:

1. **Given** a user is viewing the workloads list page, **When** the user clicks the Create button, **Then** a new workload creation screen appears with Save and Cancel buttons, metadata input fields, and a tree view of all servers
2. **Given** the workload creation screen is displayed, **When** a user expands a server node in the tree, **Then** a list of tools for that server is displayed
3. **Given** a tool list is displayed for a server, **When** a tool is enabled, **Then** a checkbox appears before the tool name that can be selected
4. **Given** a tool list is displayed for a server, **When** a tool is disabled, **Then** the tool is visible with a visual indicator (e.g., grayed out, strikethrough, or disabled icon) and the checkbox is not selectable
5. **Given** a user has filled in required metadata fields (with or without tool selections), **When** the user clicks Save, **Then** a new workload is created via API call and the user is returned to the workloads list with the new workload visible
6. **Given** a user is on the workload creation screen, **When** the user clicks Cancel, **Then** no workload is created and the user is returned to the workloads list
7. **Given** required metadata fields are empty or invalid, **When** the user attempts to click Save, **Then** validation errors are displayed and the workload is not created
8. **Given** a user without mcp-user role is viewing the workloads list, **When** the user attempts to access Create functionality, **Then** the Create button is disabled or hidden, or a permission error is displayed

---

### User Story 3 - Edit Existing Workloads (Priority: P2)

A user with mcp-user role needs to modify existing workloads by updating metadata fields, adding enabled tools, or removing tools from the workload configuration.

**Why this priority**: Enables users to maintain and evolve workloads over time, which is essential for catalog management. It shares the same priority as creation since editing uses the same screen and workflow, making it a natural extension of the creation capability.

**Independent Test**: Can be fully tested by navigating to workloads list, clicking Edit on an existing workload, modifying metadata or tool selections, clicking Save, and verifying the changes are reflected in the workload. This delivers value independently by enabling workload modification workflow.

**Acceptance Scenarios**:

1. **Given** a user is viewing the workloads list page, **When** the user clicks Edit (or an Edit option in the workload row menu), **Then** a workload editing screen appears with Save and Cancel buttons, metadata input fields populated with current workload data, and a tree view of all servers with currently selected tools pre-checked
2. **Given** the workload editing screen is displayed, **When** the screen loads, **Then** all metadata fields are populated with the existing workload's values and the tree view shows checkboxes selected for tools currently in the workload
3. **Given** a user is editing a workload, **When** the user modifies metadata fields (e.g., name, description, lifecycle, owner), **Then** the changes are reflected in the input fields and Save/Cancel buttons become enabled
4. **Given** a user is editing a workload, **When** the user unchecks a currently selected tool, **Then** the tool is deselected and Save/Cancel buttons become enabled
5. **Given** a user is editing a workload, **When** the user checks an enabled tool that was not previously selected, **Then** the tool is selected and Save/Cancel buttons become enabled
6. **Given** a user has made changes to a workload (metadata or tool selections), **When** the user clicks Save, **Then** the workload is updated via API call and the user is returned to the workloads list with the updated workload reflecting the changes
7. **Given** a user is editing a workload, **When** the user clicks Cancel, **Then** no changes are saved and the user is returned to the workloads list with the workload unchanged
8. **Given** a user has modified workload data, **When** the user attempts to save with invalid data (e.g., empty required fields), **Then** validation errors are displayed and the workload is not updated
9. **Given** a user is editing a workload, **When** a tool that was previously selected becomes disabled (e.g., by another user), **Then** the tool remains checked but is visually marked as disabled and cannot be unchecked (or is automatically unchecked with a warning)
10. **Given** a user without mcp-user role is viewing the workloads list, **When** the user attempts to access Edit functionality, **Then** the Edit option is disabled or hidden, or a permission error is displayed

---

### User Story 4 - Delete Workloads (Priority: P3)

A user with mcp-user role needs to remove workloads that are no longer needed from the catalog.

**Why this priority**: Provides cleanup capability but is less critical than creation and editing. Users can manage without deletion initially, though it's important for catalog hygiene.

**Independent Test**: Can be fully tested by navigating to workloads list, clicking the action menu on a workload row, selecting Delete, confirming the deletion, and verifying the workload is removed from the list. This delivers value independently by enabling workload removal workflow.

**Acceptance Scenarios**:

1. **Given** a user is viewing the workloads list page, **When** the user views a workload row, **Then** an expandable menu (e.g., kebab menu) is visible on the right side of the row
2. **Given** a workload row menu is visible, **When** the user clicks the menu, **Then** a Delete option is displayed
3. **Given** a user has clicked Delete from the menu, **When** the user confirms the deletion, **Then** the workload is deleted via API call and removed from the workloads list
4. **Given** a user has clicked Delete from the menu, **When** the user cancels the deletion confirmation, **Then** no deletion occurs and the menu closes
5. **Given** a workload deletion fails (e.g., network error, permission denied), **When** the error occurs, **Then** an error message is displayed and the workload remains in the list
6. **Given** a user without mcp-user role is viewing the workloads list, **When** the user attempts to delete a workload, **Then** the Delete option is disabled or hidden, or a permission error is displayed

---

### Edge Cases

- What happens when a user modifies tool states, then another user modifies the same server's tools before the first user saves? (Last-write-wins - no conflict detection, later save overwrites earlier changes)
- How does the system handle network failures when saving tool state changes? (Show error, allow retry, preserve unsaved changes)
- What happens when a user tries to create a workload with a name that already exists? (Show validation error, prevent creation)
- What happens when a user tries to create or update a workload without providing name or namespace? (Show validation error for missing required fields, prevent save)
- How does the system handle a tool being disabled while a user is creating or editing a workload that includes that tool? (Tool becomes unselectable in real-time if already selected, or shows warning message; if previously selected in edit mode, tool is auto-unchecked with warning)
- What happens when a user edits a workload and changes the name to one that already exists? (Show validation error, prevent update)
- What happens when a user edits a workload and removes all tools? (Allow empty workload - no validation error, workload can exist without tools)
- What happens when a user deletes a workload that is referenced by other entities? (Allow deletion but display warning message about orphaned references before confirming deletion)
- How does the system handle concurrent edits to the same workload? (Show conflict warning when save detects changes by another user, allow user to overwrite or cancel)
- How does the system handle concurrent deletions of the same workload? (Idempotent delete, return success even if already deleted)
- What happens when a server has no tools available? (Show empty state in tree view, disable tool selection)
- How does the system handle very long lists of servers or tools in the workload creation tree? (Virtual scrolling, pagination, or search/filter)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display Save and Cancel buttons on the server details screen, disabled by default
- **FR-002**: System MUST enable Save and Cancel buttons when any tool enable/disable state change is detected
- **FR-003**: System MUST persist tool enable/disable state changes only when the Save button is clicked
- **FR-004**: System MUST revert all unsaved tool state changes when the Cancel button is clicked
- **FR-005**: System MUST persist tool state changes across user sessions (changes must survive page refresh and navigation)
- **FR-006**: System MUST display a Create button on the workloads list screen
- **FR-007**: System MUST display a workload creation screen when the Create button is clicked
- **FR-008**: System MUST display Save and Cancel buttons on the workload creation screen
- **FR-009**: System MUST provide text input fields for all workload metadata fields (name, description, namespace, lifecycle, owner, etc.)
- **FR-010**: System MUST display a tree view of all servers in the workload creation screen
- **FR-011**: System MUST allow expanding and collapsing server nodes to show/hide their associated tools
- **FR-012**: System MUST display checkboxes before enabled tool names that can be selected
- **FR-013**: System MUST display disabled tools with a visual indicator (e.g., grayed out, strikethrough, disabled icon) and prevent their selection
- **FR-014**: System MUST create a new workload via API call when Save is clicked on the creation screen
- **FR-015**: System MUST display an expandable menu (e.g., kebab menu) on the right side of each workload row in the workloads list
- **FR-016**: System MUST display an Edit option in the workload row menu
- **FR-017**: System MUST display a workload editing screen when Edit is clicked, using the same screen structure as workload creation
- **FR-018**: System MUST populate all metadata input fields with the existing workload's current values when editing
- **FR-019**: System MUST pre-select checkboxes for tools currently included in the workload when editing
- **FR-020**: System MUST enable Save and Cancel buttons when any changes are detected during workload editing (metadata or tool selections)
- **FR-021**: System MUST update a workload via API call when Save is clicked on the editing screen
- **FR-022**: System MUST display a Delete option in the workload row menu
- **FR-023**: System MUST delete a workload via API call when Delete is confirmed
- **FR-024**: System MUST validate required metadata fields before creating or updating a workload
- **FR-025**: System MUST display validation errors when workload creation or update fails due to invalid data
- **FR-026**: System MUST display error messages when API operations (save tool states, create workload, update workload, delete workload) fail
- **FR-027**: System MUST detect concurrent edit conflicts when saving workload changes (e.g., workload was modified by another user since edit started)
- **FR-028**: System MUST display a conflict warning dialog when concurrent edit conflict is detected, offering options to overwrite changes or cancel the save operation
- **FR-029**: System MUST allow workloads to be created or updated with zero tools (empty workloads are permitted)
- **FR-030**: System MUST use last-write-wins strategy for concurrent tool state changes (no conflict detection, later save overwrites earlier changes)
- **FR-031**: System MUST require mcp-admin role for modifying tool enable/disable states
- **FR-032**: System MUST require mcp-user role for creating, editing, or deleting workloads
- **FR-033**: System MUST display appropriate permission error messages when users without required roles attempt editing operations
- **FR-034**: System MUST require name and namespace metadata fields when creating or updating workloads
- **FR-035**: System MUST allow description, lifecycle, and owner metadata fields to be optional when creating or updating workloads

### Key Entities *(include if feature involves data)*

- **Tool State**: Represents the enabled/disabled state of an MCP tool. Key attributes: tool identifier, disabled state (boolean), persisted state vs. pending changes state
- **Workload**: Represents an MCP workload entity. Key attributes: metadata (name, namespace, description), spec (lifecycle, owner, dependsOn array of tool references), relationships to selected tools
- **Server**: Represents an MCP server entity. Key attributes: server identifier, associated tools list, tool states
- **Pending Changes**: Represents unsaved modifications to tool states. Key attributes: list of changed tools, original states, new states

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can modify tool states for a server and save all changes in under 30 seconds from the time they start making changes
- **SC-002**: 95% of workload creation attempts complete successfully on the first attempt when all required fields are provided
- **SC-003**: Users can create a new workload with tool selections in under 2 minutes from clicking Create to seeing the workload in the list
- **SC-004**: 100% of saved tool state changes persist across page refreshes and navigation events
- **SC-005**: Users can edit an existing workload (modify metadata or tool selections) and save changes in under 2 minutes from clicking Edit to seeing the updated workload in the list
- **SC-006**: 95% of workload update attempts complete successfully on the first attempt when all required fields are provided
- **SC-007**: Users can delete a workload in under 10 seconds from clicking the menu to seeing it removed from the list
- **SC-008**: Validation errors are displayed within 1 second of attempting to save invalid workload data (create or update)
