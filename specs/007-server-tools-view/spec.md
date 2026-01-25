# Feature Specification: Server Tools View Consolidation

**Feature Branch**: `007-server-tools-view`
**Created**: 2026-01-08
**Status**: Draft
**Input**: User description from 007-hide-tools.md

## Clarifications

### Session 2026-01-08

- Q: What is the maximum length for the alternative description field? → A: 2000 characters maximum
- Q: How should the UI behave when saving an alternative description fails? → A: Show error message inline, keep edit mode open with user's text preserved

## Overview

This feature consolidates the MCP tools navigation by removing the standalone Tools list and integrating tools directly into an expandable Servers list. Users will browse tools within the context of their parent servers, providing a more intuitive hierarchical navigation. Additionally, tools will support an "alternative description" field that can override the original Backstage-managed description.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Tools Within Servers (Priority: P1)

As a platform user, I want to see tools listed within their parent servers in an expandable view, so that I can understand the relationship between servers and tools and browse them in context.

**Why this priority**: This is the core feature that replaces the standalone Tools list. Without this, removing the Tools tab would leave users with no way to discover tools.

**Independent Test**: Navigate to Servers list, expand a server row, verify all tools belonging to that server are displayed with their name, description, and status.

**Acceptance Scenarios**:

1. **Given** I am on the MCP Catalog page viewing the Servers tab, **When** I click the expand control on a server row, **Then** I see a list of all tools belonging to that server sorted alphabetically (A-Z) by name, showing their name, description, and disabled status
2. **Given** a server row is expanded showing its tools, **When** I click the expand control again, **Then** the tools list collapses and only the server row is visible
3. **Given** I am viewing an expanded server, **When** I click on a tool name, **Then** I navigate to the tool detail page
4. **Given** a server has no tools, **When** I expand the server row, **Then** I see a message indicating "No tools available for this server"
5. **Given** a tool has an alternative description set, **When** I view the tool in the expanded server list, **Then** I see the alternative description instead of the original

---

### User Story 2 - Edit Alternative Tool Description (Priority: P2)

As a platform administrator, I want to provide an alternative description for a tool that overrides the Backstage-managed description, so that I can customize how tools are presented to users without modifying the source catalog.

**Why this priority**: This enables customization of tool presentation while maintaining the Backstage catalog as source of truth. It builds on the existing merge architecture pattern.

**Independent Test**: Navigate to a tool detail page, click edit on the alternative description field, enter new text, save, and verify the new description appears wherever the tool description is shown.

**Acceptance Scenarios**:

1. **Given** I am on a tool detail page as an mcp-admin user, **When** I click the edit button next to the alternative description field, **Then** the field becomes editable
2. **Given** the alternative description field is in edit mode, **When** I enter new text and save, **Then** the alternative description is persisted and displayed
3. **Given** a tool has an alternative description set, **When** I view the tool anywhere in the UI (server tools list, tool detail page, workload tools), **Then** I see the alternative description
4. **Given** a tool has an empty alternative description, **When** I view the tool, **Then** I see the original Backstage-managed description
5. **Given** I am not an mcp-admin user, **When** I view a tool detail page, **Then** I do not see the edit button for alternative description

---

### User Story 3 - Remove Tools Navigation Elements (Priority: P3)

As a platform user, I want a simplified navigation without redundant Tools tabs and buttons, so that the interface is cleaner and I naturally browse tools within their server context.

**Why this priority**: This is cleanup work that should only happen after US1 is complete and verified. Users need the alternative navigation (expandable servers) before removing the old navigation.

**Independent Test**: After US1 is complete, verify that Tools tab is removed from main navigation, Tools button is removed from entity type filters, and Guardrails button is added to entity type filters.

**Acceptance Scenarios**:

1. **Given** I am on the MCP Catalog page, **When** I look at the main tabs, **Then** I do not see a "Tools" tab
2. **Given** I am on any page with entity type filter buttons, **When** I look at the available filters, **Then** I do not see a "Tools" button
3. **Given** I am on any page with entity type filter buttons, **When** I look at the available filters, **Then** I see a "Guardrails" button
4. **Given** I have a bookmarked URL to the old Tools tab, **When** I navigate to that URL, **Then** I am redirected to the Servers tab

---

### Edge Cases

- What happens when a server has a very large number of tools (50+)?
  - Display all tools with the same expandable pattern; pagination is not required within the expanded view
- How does the system handle tools that have no parent server?
  - Orphaned tools (if any exist) are not displayed in the servers list; they remain accessible via direct URL if needed
- What happens when the alternative description is set to whitespace only?
  - Treat whitespace-only as empty; use original description
- What happens when a tool's original description is updated in Backstage after an alternative description is set?
  - The alternative description continues to override; users must clear the alternative description to see updates from Backstage
- What happens when saving an alternative description fails?
  - Show error message inline, keep edit mode open with user's text preserved so they can retry or cancel

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display an expand/collapse control on each server row in the Servers list
- **FR-002**: System MUST show all tools belonging to a server when the server row is expanded, sorted alphabetically by tool name (A-Z)
- **FR-003**: Expanded tool rows MUST display: tool name (as link), description (alternative if set, original otherwise), and disabled status
- **FR-004**: System MUST NOT display namespace, type, or server columns in the expanded tools view (redundant information)
- **FR-005**: System MUST persist the alternative description field in the database for each tool (maximum 2000 characters)
- **FR-006**: System MUST merge the alternative description with catalog data when returning tool information (following existing merge architecture)
- **FR-007**: Alternative description MUST override original description in all UI locations when set and non-empty
- **FR-008**: System MUST provide an inline edit button for alternative description on the tool detail page (mcp-admin only)
- **FR-008a**: On save failure, system MUST display error inline and preserve user's text in edit mode
- **FR-009**: System MUST remove the Tools tab from the main MCP Catalog navigation
- **FR-010**: System MUST remove the Tools button from entity type filter controls
- **FR-011**: System MUST add a Guardrails button to entity type filter controls
- **FR-012**: System MUST redirect legacy Tools tab URLs to the Servers tab

### Key Entities

- **Tool (extended)**: Existing tool entity extended with an `alternativeDescription` field that can override the catalog-managed description
- **Server**: Existing server entity, now displayed with expandable rows showing child tools

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can discover all tools in the system through the expandable Servers list within 3 clicks from the main catalog page
- **SC-002**: Alternative description changes are reflected immediately across all UI locations after save
- **SC-003**: Navigation complexity is reduced by eliminating one top-level tab (Tools) and one filter button (Tools)
- **SC-004**: 100% of existing tool functionality remains accessible (tool detail pages, workload associations, guardrail attachments)
- **SC-005**: Page load time for Servers list with expandable tools does not increase by more than 500ms compared to current implementation

## Assumptions

- The existing merge architecture (catalog + database) will be extended for the alternative description field
- Tools are always associated with exactly one server (via subcomponentOf relation)
- The mcp-admin role check for editing already exists and can be reused
- Expansion state does not need to persist across page navigation (collapses on page reload)

## Dependencies

- 006-mcp-guardrails feature must be complete (for Guardrails filter button addition)
- Existing tool CRUD and merge architecture from previous features

## Out of Scope

- Bulk editing of alternative descriptions
- Search/filter within expanded tool lists
- Keyboard navigation for expand/collapse
- Persisting expansion state across sessions
