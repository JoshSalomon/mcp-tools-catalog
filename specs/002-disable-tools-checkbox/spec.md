# Feature Specification: Disable Tools Checkbox

**Feature Branch**: `002-disable-tools-checkbox`  
**Created**: 2025-12-18  
**Status**: Draft  
**Input**: User description: "add a 'Disabled' checkbox near the tools in the server details screen (titled 'MCP Server:<server name>'). By default all tools are enabled, but I can check tools in order to disable them."

## Clarifications

### Session 2025-12-18

- Q: Who has permission to toggle the disabled state? → A: Role-based authorization; specific roles (e.g., admin, platform-engineer) can toggle disabled state.
- Q: What happens if the catalog write fails when toggling disabled state? → A: Show inline error message with retry option; revert checkbox to previous state.
- Q: How are concurrent edits handled when two users toggle the same tool? → A: Last write wins; no conflict detection required.
- Q: Should disabled tools appear differently in other catalog views? → A: Yes, show disabled indicator in all catalog views (Tools Tab, Workload dependencies).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Disable Individual Tools (Priority: P1)

As a platform administrator viewing the MCP Server details page, I want to disable specific tools provided by a server so that I can mark tools that should not be used or are temporarily unavailable.

**Why this priority**: This is the core feature - the ability to toggle tool disabled status. Without this, no other functionality can work.

**Independent Test**: Can be fully tested by navigating to any MCP Server page with tools, checking a tool's disabled checkbox, and verifying the visual state changes.

**Acceptance Scenarios**:

1. **Given** I am on the MCP Server details page with at least one tool listed, **When** I view the "Provided Tools" table, **Then** I see a "Disabled" checkbox column next to each tool row.

2. **Given** a tool is currently enabled (unchecked), **When** I click the "Disabled" checkbox for that tool, **Then** the checkbox becomes checked and the tool row displays a visual indicator that it is disabled.

3. **Given** a tool is currently disabled (checked), **When** I click the "Disabled" checkbox for that tool, **Then** the checkbox becomes unchecked and the tool row returns to normal appearance.

---

### User Story 2 - Persist Disabled State (Priority: P1)

As a platform administrator, I want my disabled tool selections to persist so that I don't lose my settings when I navigate away and return to the page.

**Why this priority**: Without persistence, the feature would have minimal value as users would need to re-disable tools on every page visit.

**Independent Test**: Can be fully tested by disabling a tool, navigating to a different page, returning to the server details page, and verifying the tool is still shown as disabled.

**Acceptance Scenarios**:

1. **Given** I have disabled one or more tools on a server, **When** I navigate away from the server details page and then return, **Then** the previously disabled tools remain disabled.

2. **Given** I have disabled tools on a server, **When** I close my browser and reopen the page later (or access from a different device), **Then** the previously disabled tools remain disabled because the state is persisted in the Backstage catalog.

---

### User Story 3 - Visual Distinction for Disabled Tools (Priority: P2)

As a platform administrator, I want disabled tools to be visually distinct so that I can quickly identify which tools are disabled at a glance.

**Why this priority**: Visual feedback enhances usability but the core functionality works without it.

**Independent Test**: Can be tested by disabling a tool and verifying the visual treatment differs from enabled tools.

**Acceptance Scenarios**:

1. **Given** a tool is disabled, **When** I view the "Provided Tools" table, **Then** the disabled tool row appears with reduced opacity or greyed-out styling.

2. **Given** multiple tools are listed with some disabled and some enabled, **When** I scan the table, **Then** I can immediately distinguish disabled tools from enabled ones without reading the checkbox state.

---

### Edge Cases

- What happens when a tool is removed from the server (no longer listed) but was previously disabled? → The stale disabled state should be cleaned up automatically.
- What happens when viewing a server with no tools? → The empty state remains unchanged; no checkbox UI is shown.
- What happens if the user disables all tools on a server? → All tools show as disabled; no special messaging required.
- What happens when a user without an authorized role views the page? → The disabled checkboxes are visible but non-interactive (read-only view).
- What happens if the catalog is unavailable or the write fails? → The checkbox reverts to its previous state, an inline error message is shown, and a retry option is provided.
- What happens if two users toggle the same tool simultaneously? → Last write wins; no conflict detection or notification is implemented.
- How do disabled tools appear in the Tools Tab? → A visual indicator (e.g., badge, icon, or styling) shows the tool is disabled; no toggle checkbox in this view.
- How do disabled tools appear in Workload dependencies? → A visual indicator shows tools are disabled; helps users understand workload health.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Disabled" checkbox in each tool row within the "Provided Tools" table on the MCP Server details page.
- **FR-002**: System MUST allow users to check/uncheck the "Disabled" checkbox to toggle a tool's disabled status.
- **FR-003**: All tools MUST default to enabled (unchecked) when first viewed.
- **FR-004**: System MUST persist the disabled state for each tool in the Backstage catalog so it is available across all browsers, devices, and sessions.
- **FR-005**: System MUST apply visual styling to disabled tool rows to distinguish them from enabled tools.
- **FR-006**: System MUST associate disabled state with the specific server-tool combination (so the same tool name on different servers can have different disabled states).
- **FR-007**: The "Disabled" checkbox MUST be accessible via keyboard navigation.
- **FR-008**: The checkbox column MUST have an appropriate header label for accessibility (e.g., "Disabled" or "Status").
- **FR-009**: System MUST restrict the ability to toggle disabled state to users with authorized roles (e.g., admin, platform-engineer).
- **FR-010**: Users without authorized roles MUST see the disabled state as read-only (checkbox visible but not interactive).
- **FR-011**: If persisting the disabled state fails, the system MUST revert the checkbox to its previous state and display an inline error message with a retry option.
- **FR-012**: Disabled tools MUST display a visual disabled indicator in all catalog views where they appear (Tools Tab, Workload dependencies, Server Details).
- **FR-013**: The disabled state toggle (checkbox) is only available on the Server Details page; other views show read-only status.

### Key Entities

- **Tool Disabled State**: Represents whether a specific tool on a specific server is marked as disabled. Attributes include: server identifier, tool identifier, disabled status (boolean).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can toggle any tool's disabled state within 1 click/tap.
- **SC-002**: 100% of disabled state changes persist and are visible across all browsers and devices accessing the catalog.
- **SC-003**: Disabled tools are visually distinguishable from enabled tools in all catalog views without requiring users to examine individual checkboxes.
- **SC-004**: Keyboard-only users can navigate to and toggle any tool's disabled checkbox.

## Assumptions

- The disabled state is a UI-level preference and does not affect the actual availability or behavior of the tool in the MCP server.
- This feature is for organizational/informational purposes only (e.g., marking tools as "do not use" or "under maintenance").
- The catalog continues to reflect the actual tools available from the server; disabling a tool does not remove it from the catalog.
- The disabled state is persisted in the Backstage catalog, enabling cross-browser and cross-device synchronization.
- Backend/catalog schema changes will be required to support storing the disabled state.
