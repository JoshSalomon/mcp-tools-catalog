# Implementation Plan: Server Tools View Consolidation

**Branch**: `007-server-tools-view` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-server-tools-view/spec.md`

## Summary

Consolidate the MCP tools navigation by integrating tools directly into expandable server rows in the Servers list. Users will browse tools within the context of their parent servers. Additionally, tools will support an "alternative description" field stored in the database that can override the Backstage-managed description. The Tools tab and filter button will be removed, and a Guardrails filter button will be added.

## Technical Context

**Language/Version**: TypeScript 4.7+ (strict mode)
**Primary Dependencies**: React 17.x, PatternFly 6.2+, @backstage/catalog-model ^1.7.5, Express (Backstage backend)
**Storage**: SQLite 3.x (existing mcp-entity-api database) - add `alternative_description` column to `mcp_entities` table
**Testing**: Jest + React Testing Library (unit tests), Bash scripts (sanity tests)
**Target Platform**: OpenShift Console dynamic plugin + Backstage backend
**Project Type**: Web application (frontend plugin + backend API)
**Performance Goals**: Page load time increase ≤ 500ms for Servers list with expandable tools (SC-005)
**Constraints**: Follow existing merge architecture pattern; mcp-admin role for editing
**Scale/Scope**: Moderate - extends existing entity management patterns

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Security-First | ✅ Pass | Alternative description editing restricted to mcp-admin role |
| II. Configuration-First | ✅ Pass | No configuration changes required; extends existing patterns |
| III. Container-Ready | ✅ Pass | No container changes; plugin build unchanged |
| IV. Test-First Development | ✅ Pass | Unit tests and sanity tests planned |
| V. Component Isolation | ✅ Pass | Frontend and backend changes are isolated |
| VI. Backstage Catalog First | ✅ Pass | Uses existing merge architecture; database stores only alternative_description |
| VII. Vanilla OpenShift Target | ✅ Pass | Standard PatternFly components; no proprietary features |
| VIII. TypeScript-First | ✅ Pass | All new code in TypeScript with strict mode |
| IX. Strict Typing for Python | N/A | No Python code in this feature |
| X. Red Hat Registry First | ✅ Pass | No container image changes |
| XI. User Verification of Fixes | ✅ Pass | Following explicit user requirements |
| XII. Backend-First Implementation | ✅ Pass | US2 (alternative description) will follow Phase A (backend) → Phase B (frontend) pattern |
| XIII. Branch Documentation | ✅ Pass | IMPLEMENTATION-SUMMARY.md will be created in Polish phase |

## Project Structure

### Documentation (this feature)

```text
specs/007-server-tools-view/
├── plan.md              # This file
├── research.md          # Phase 0 output (not needed - no unknowns)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── server-tools-api.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
# Backend API (Backstage plugin)
backstage-app/packages/backend/src/plugins/mcp-entity-api/
├── database.ts          # Add alternative_description column and methods
├── service.ts           # Add getToolsForServer(), updateToolAlternativeDescription()
├── router.ts            # Add GET /servers/:ns/:name/tools, PUT /tools/:ns/:name/alternative-description
├── types.ts             # Extend MCPToolEntity with alternativeDescription
├── validation.ts        # Add alternative description validation (max 2000 chars)
└── __tests__/
    └── tool-alternative-description.test.ts

# Frontend UI (OpenShift Console plugin)
src/
├── components/
│   ├── ServersTab.tsx           # Add expandable rows with tools
│   ├── McpToolPage.tsx          # Add alternative description inline edit
│   ├── McpCatalogPage.tsx       # Remove Tools tab, update entity filters
│   └── ToolsTab.tsx             # Mark as deprecated (remove routes later)
├── services/
│   └── catalogService.ts        # Add useServerTools(), updateToolAlternativeDescription()
└── models/
    └── CatalogMcpTool.ts        # Add alternativeDescription field

# Tests
tests/sanity/
└── server-tools-view.sh         # Sanity tests for new endpoints
```

**Structure Decision**: Web application pattern with separate backend/ and frontend/ concerns. Backend extends existing mcp-entity-api plugin; frontend extends existing plugin components.

## Complexity Tracking

> No violations requiring justification. Feature follows established patterns.
