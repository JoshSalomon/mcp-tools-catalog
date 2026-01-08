# Research: MCP Guardrails Entity

**Feature Branch**: `006-mcp-guardrails`
**Date**: 2026-01-04

## Overview

This research documents technology decisions and patterns for implementing the guardrails entity feature. Since guardrails follow the established database-only pattern from workloads (005-workload-local-db), most patterns are already proven.

## Decisions

### 1. Database Schema Pattern

**Decision**: Use a dedicated `mcp_guardrails` table rather than extending `mcp_entities`

**Rationale**:
- Guardrails have a distinct structure (name, description, deployment, parameters, disabled)
- Guardrails need separate association tables for tool and workload relationships
- Cleaner schema than overloading the generic entities table

**Alternatives considered**:
- Extend `mcp_entities` table: Rejected because guardrails have different attributes and relationships than other entities

### 2. Association Tables Design

**Decision**: Create three tables for guardrail associations:
- `mcp_guardrails` - Core guardrail entity
- `mcp_tool_guardrails` - Tool-guardrail associations with execution timing
- `mcp_workload_tool_guardrails` - Workload-tool-guardrail associations with source indicator

**Rationale**:
- Clear separation of concerns
- Efficient queries for usage tracking
- Supports inheritance model (tool-level vs workload-level)

**Alternatives considered**:
- Single JSON column for associations: Rejected due to query complexity and lack of referential integrity

### 3. Tool-Level Guardrail Inheritance

**Decision**: When a tool is added to a workload, create explicit records in `mcp_workload_tool_guardrails` marked as `source='tool'`

**Rationale**:
- Explicit records enable efficient querying
- Clear distinction between inherited and workload-added guardrails
- Supports the "non-removable" UI requirement for tool-level guardrails

**Alternatives considered**:
- Compute inheritance at query time: Rejected due to complexity and performance concerns

### 4. Frontend Component Pattern

**Decision**: Follow existing Tab pattern (ServersTab, ToolsTab, WorkloadsTab) for GuardrailsTab

**Rationale**:
- Consistent user experience
- Proven patterns for list/detail/form workflows
- Reuses existing shared components (Pagination, ErrorBoundary)

**Alternatives considered**:
- None - consistent UI patterns are required

### 5. YAML Import Format

**Decision**: Use same YAML structure as other MCP entities:
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: guardrail-name
  namespace: default
spec:
  type: mcp-guardrail
  deployment: "<deployment info>"
  parameters: "<optional parameters>"
```

**Rationale**:
- Consistent with existing entity import patterns
- Familiar to users who already import servers/tools/workloads

**Alternatives considered**:
- Custom YAML format: Rejected for consistency reasons

### 6. API Endpoint Structure

**Decision**: Add `/api/mcp-entity-api/guardrails` endpoints following RESTful patterns

**Rationale**:
- Consistent with existing `/servers`, `/tools`, `/workloads` endpoints
- Standard REST operations (GET, POST, PUT, DELETE)
- Follows established error handling patterns

**Alternatives considered**:
- None - must follow existing API patterns

### 7. Tool/Workload UI Integration

**Decision**: Add guardrails management to existing Tool and Workload edit forms

**Rationale**:
- Guardrails are attached to tools/workloads in context
- Users expect to manage guardrails where they use them
- Reduces navigation complexity

**Alternatives considered**:
- Separate guardrail attachment screens: Rejected as less user-friendly

## Dependencies

### Existing Infrastructure

| Dependency | Version | Usage |
|------------|---------|-------|
| SQLite | 3.x | Database storage (existing) |
| Express | 4.x | API router (existing) |
| React | 17.x | UI components (existing) |
| PatternFly | 6.2+ | UI component library (existing) |
| @backstage/catalog-model | ^1.7.5 | Entity type definitions (existing) |

### New Components Required

| Component | Location | Purpose |
|-----------|----------|---------|
| GuardrailsTab.tsx | src/components/ | List view |
| GuardrailsPage.tsx | src/components/ | Detail page |
| GuardrailForm.tsx | src/components/ | Create/Edit form |
| CatalogMcpGuardrail.ts | src/models/ | TypeScript interface |
| guardrail-crud.sh | tests/sanity/ | Sanity tests |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tool-guardrail inheritance complexity | Medium | High | Use explicit records with source indicator |
| Performance with many guardrails | Low | Medium | Index on common query patterns |
| UI complexity with nested associations | Medium | Medium | Clear visual distinction between inherited/added |

## Open Questions

None - all clarifications resolved in spec.
