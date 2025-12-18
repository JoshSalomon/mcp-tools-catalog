# Feature Specification: MCP Tools Catalog

**Feature Branch**: `001-mcp-tools-catalog`
**Created**: 2025-10-26
**Updated**: 2025-12-11
**Status**: Draft
**Input**: User description: "mcp tools catalog extends the backstage catalog by adding 3 new software artifacts: MCP servers, MCP tools and MP workloads, each MCP tool references a server (the server that includes it) each workload references a list of tools (each tool can be referenced by various workloads)"
**Additional Input (2025-12-11)**: "add to the requirements the configuration of the backstage catalog to load yaml files from a github repo, the github repo and the branch name should be configurable."

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Browse MCP Servers (Priority: P1)

As a platform engineer, I want to browse and discover available MCP servers in the Backstage catalog so that I can understand what AI capabilities are available in our infrastructure.

**Why this priority**: This is the foundation layer - users need to see MCP servers before they can understand tools or workloads. Provides immediate value by making existing MCP infrastructure visible.

**Independent Test**: Can be fully tested by adding MCP server entries to the catalog and verifying they appear in a dedicated catalog section with server details.

**Acceptance Scenarios**:

1. **Given** the Backstage catalog is accessible, **When** I navigate to the MCP section, **Then** I see a list of all registered MCP servers
2. **Given** an MCP server is registered, **When** I click on it, **Then** I navigate to a separate screen that displays all properties of the MCP server
3. **Given** I'm viewing the MCP server properties screen, **Then** I see server metadata including name, description, version, and connection endpoint
4. **Given** I'm viewing the MCP server properties screen, **Then** I see a list of all tools that the MCP server exports showing tool name, description, and tool type with clickable links to view full tool details

---

### User Story 2 - Explore MCP Tools (Priority: P2)

As a developer, I want to browse MCP tools and see which server provides each tool so that I can understand what AI capabilities I can integrate into my applications.

**Why this priority**: Tools are the functional units developers care about. This builds on P1 by adding the tool-to-server relationship visibility.

**Independent Test**: Can be fully tested by adding MCP tools linked to servers and verifying the tools appear with clear server references.

**Acceptance Scenarios**:

1. **Given** MCP tools are registered, **When** I browse the tools catalog, **Then** I see each tool with its parent server clearly indicated
2. **Given** I'm viewing a tool, **When** I click on the server reference, **Then** I navigate to the server's detail page

---

### User Story 3 - Manage MCP Workloads (Priority: P3)

As an architect, I want to view MCP workloads and their associated tools so that I can understand how AI capabilities are composed into higher-level applications.

**Why this priority**: Workloads represent the business-level composition of tools. Most valuable for architectural planning and dependency management.

**Independent Test**: Can be fully tested by creating workloads that reference multiple tools and verifying the relationships are displayed correctly.

**Acceptance Scenarios**:

1. **Given** workloads are defined with tool references, **When** I view a workload, **Then** I see all associated tools listed with links to their details
2. **Given** I'm viewing a tool, **When** I check its usage, **Then** I see which workloads reference this tool

---

### User Story 4 - Configure GitHub Catalog Integration (Priority: P1)

As a platform administrator, I want to configure the Backstage catalog to automatically load MCP entity definitions from a GitHub repository so that I can manage catalog entries as code and maintain version control.

**Why this priority**: This is foundational infrastructure that enables GitOps-style catalog management. It's a prerequisite for scaling catalog management and enabling team collaboration on catalog definitions.

**Independent Test**: Can be fully tested by configuring a GitHub repository URL and branch name, then verifying that YAML entity definitions from that repository are automatically loaded into the catalog.

**Acceptance Scenarios**:

1. **Given** I have access to catalog configuration, **When** I specify a GitHub repository URL and Personal Access Token, **Then** the system validates and securely stores both the repository URL and token for catalog synchronization
2. **Given** I have configured a GitHub repository, **When** I specify a branch name, **Then** the system uses that branch when loading catalog YAML files
3. **Given** the GitHub integration is configured, **When** YAML entity files are added to the repository, **Then** they appear in the Backstage catalog within the configured sync interval
4. **Given** the GitHub integration is configured, **When** I update the branch name, **Then** the system switches to load catalog definitions from the new branch

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- When an MCP server is offline or unreachable, the system displays cached server and tool metadata with a visual indicator showing offline status
- What happens when a workload references a tool that no longer exists? (Automatically removed via cascade delete)
- What happens when multiple servers provide tools with identical names? (Resolved via hierarchical naming)
- Workloads are treated as peer entities with no hierarchical dependencies (no circular dependency concerns)
- What happens when the configured GitHub repository is unreachable? (System logs error, continues using cached catalog data, and automatically retries with exponential backoff)
- What happens when a YAML file in the GitHub repository contains invalid entity definitions? (System logs validation errors and skips invalid entities while processing valid ones)
- What happens when the configured branch does not exist in the GitHub repository? (System logs error and falls back to default branch or previous valid configuration)
- What happens when the GitHub Personal Access Token expires or is revoked? (System logs authentication error, continues using cached catalog data, and automatically retries with exponential backoff until token is updated)
- What happens when an entity is manually created in Backstage and the same entity exists in the GitHub repository with different data? (GitHub repository data overwrites the manual Backstage entry during next sync)
- What happens when GitHub API rate limits are exceeded during synchronization? (System parses rate limit headers and delays sync until the rate limit reset time, continuing to use cached catalog data)

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST extend Backstage catalog with three new entity types: MCP Server, MCP Tool, and MCP Workload
- **FR-002**: System MUST provide a dedicated screen for each MCP server displaying all server properties including name, description, version, and connection endpoint
- **FR-015**: System MUST display all tools exported by an MCP server on the server's detail screen showing tool name, description, and tool type with clickable links to full tool details
- **FR-003**: Users MUST be able to view MCP tools with clear indication of their parent server
- **FR-004**: System MUST show bidirectional relationships between tools and workloads (which tools a workload uses, which workloads use a tool)
- **FR-005**: System MUST validate that MCP tool references point to existing MCP servers
- **FR-006**: System MUST validate that workload tool references point to existing MCP tools
- **FR-012**: System MUST cascade delete MCP tools when their parent server is deleted
- **FR-013**: System MUST update workload references when tools are cascade deleted
- **FR-007**: System MUST integrate with existing Backstage authentication and authorization
- **FR-008**: System MUST provide text search by name and description, relationship filters (tools by server, workloads by tool, servers by tool count), and entity type filters across all MCP entity types
- **FR-009**: System MUST handle entity lifecycle management via manual registration (external tooling will handle updates)
- **FR-010**: System MUST provide interactive hierarchical tree view with expandable nodes showing workload-server-tool relationships for dependency visualization
- **FR-011**: System MUST provide MCP Tools Catalog UI for creating and managing links between workloads and tools
- **FR-014**: System MUST provide read-only catalog views for all MCP entity types with links to external management forms
- **FR-016**: System MUST display cached metadata for offline or unreachable MCP servers with a visual indicator of offline status
- **FR-017**: System MUST implement pagination for catalog list views displaying 100 items per page
- **FR-018**: System MUST support loading catalog entity definitions from YAML files stored in a GitHub repository
- **FR-019**: System MUST allow configuration of the GitHub repository URL from which to load catalog YAML files
- **FR-020**: System MUST allow configuration of the specific branch name to use when loading catalog YAML files from the GitHub repository
- **FR-021**: System MUST authenticate to GitHub using a Personal Access Token (PAT) configured by administrators
- **FR-022**: System MUST treat GitHub repository as the authoritative source of truth, overwriting any conflicting Backstage catalog entries during synchronization
- **FR-023**: System MUST expose observability metrics including GitHub sync success rate and last successful sync timestamp for monitoring catalog synchronization health
- **FR-024**: System MUST automatically retry failed GitHub synchronization attempts using exponential backoff strategy to handle transient failures
- **FR-025**: System MUST respect GitHub API rate limit headers and delay synchronization until the rate limit reset time when rate limits are exceeded

### Key Entities

- **MCP Server**: Represents a Model Context Protocol server instance. Attributes include name (globally unique), description, version, connection endpoint. Has one-to-many relationship with MCP Tools.
- **MCP Tool**: Represents individual AI capabilities or functions. Attributes include name, description, parameters, tool type. Uniquely identified by server/tool combination. References exactly one MCP Server (parent). Can be referenced by multiple MCP Workloads.
- **MCP Workload**: Represents composed applications using AI tools. Attributes include name (globally unique), description, purpose, deployment info. References multiple MCP Tools in a many-to-many relationship.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Users can discover and view any MCP server in the catalog within 30 seconds of accessing Backstage
- **SC-002**: System displays tool-to-server relationships with 100% accuracy (no broken references)
- **SC-003**: 90% of users can successfully navigate from a workload to its constituent tools on first attempt
- **SC-004**: Platform teams reduce time spent documenting AI capabilities by 60% (captured automatically in catalog)
- **SC-005**: System handles 1000+ MCP artifacts with list views loading in under 2 seconds, detail pages in under 1 second, and search results in under 1 second
- **SC-006**: Catalog views paginate at 100 items per page to maintain performance and usability
- **SC-007**: Administrators can configure GitHub repository integration in under 5 minutes with zero downtime
- **SC-008**: Catalog entities from GitHub repository appear in Backstage within the configured sync interval (default: 5 minutes) with 99% reliability
- **SC-009**: System exposes sync metrics that update within 30 seconds of each synchronization attempt, enabling real-time monitoring of catalog health

## Assumptions

- Existing Backstage installation is available and properly configured
- Users have appropriate Backstage access permissions
- MCP servers follow standard Model Context Protocol specifications
- Organization has established naming conventions for MCP artifacts
- Basic understanding of Backstage catalog concepts among users
- GitHub repository containing catalog YAML files is accessible to the Backstage instance
- Administrators have a valid GitHub Personal Access Token with read permissions for the configured repository
- Catalog entity YAML files in the GitHub repository follow Backstage entity schema standards

## Dependencies

- Backstage Software Catalog (core platform)
- Backstage Entity API for extending catalog schema
- Access to MCP server metadata and connection information
- Integration with existing Backstage authentication system
- GitHub API access for reading repository contents and branch information
- Network connectivity between Backstage instance and GitHub

## Clarifications

### Session 2025-10-26

- Q: How should MCP artifacts (servers, tools, workloads) be registered in the Backstage catalog? → A: Manual registration via Backstage UI/API (external tooling will handle updates)
- Q: How should MCP entities be uniquely identified within the Backstage catalog? → A: Hierarchical naming: servers by name, tools by server/tool, workloads by name
- Q: How should the system handle orphaned tools (when their parent server is deleted)? → A: Automatically delete orphaned tools when server is removed
- Q: How should the system determine MCP server connection status? → A: No connection status checking (handled elsewhere in workflow)
- Q: How should circular dependencies between workloads be handled? → A: Treat workloads as peers with no hierarchical dependencies
- Q: What specific UI capabilities should the MCP Tools Catalog provide beyond workload-tool linking? → A: Read-only views with external forms for entity creation/editing

### Session 2025-11-24

- Q: What level of tool information should be displayed on the MCP server detail screen? → A: Show tool name, description, and tool type with links to full tool details
- Q: What happens when an MCP server is offline or unreachable? → A: Show cached server and tool metadata with visual indicator of offline status
- Q: What search and filtering capabilities should be provided beyond basic text search? → A: Text search plus relationship filters (tools by server, workloads by tool, servers by tool count) and entity type filters
- Q: What format and interaction model should be used for dependency visualization? → A: Interactive hierarchical tree view with expandable nodes showing workload-server-tool relationships
- Q: What are the specific performance targets for catalog operations? → A: List views load in under 2 seconds, detail pages in under 1 second, search results in under 1 second, with pagination at 100 items per page

### Session 2025-12-11

- Q: Which GitHub authentication method should be used for accessing the repository? → A: Personal Access Token (PAT)
- Q: How should the system resolve conflicts when the same entity exists in both GitHub and Backstage with different data? → A: GitHub as source of truth - GitHub repository data always overwrites Backstage entries during sync
- Q: What observability signals (beyond error logs) should the system expose for monitoring catalog synchronization health? → A: Sync success rate and last sync timestamp
- Q: How should the system handle recovery after a failed GitHub synchronization attempt? → A: Automatic retry with exponential backoff
- Q: How should the system handle GitHub API rate limit errors? → A: Respect rate limit headers and delay - Parse GitHub rate limit headers and wait until reset time

## Out of Scope

- Implementation or deployment of MCP servers themselves
- Real-time monitoring of MCP server health/performance
- Automatic discovery of MCP servers (manual registration only)
- Integration with specific MCP client libraries or frameworks
- Advanced workflow orchestration between workloads
