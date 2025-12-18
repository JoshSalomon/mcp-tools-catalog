# Implementation Plan: Disable Tools Checkbox

**Branch**: `002-disable-tools-checkbox` | **Date**: 2025-12-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-disable-tools-checkbox/spec.md`

## Summary

Add a "Disabled" checkbox to each tool row in the MCP Server details page, allowing authorized users (admin, platform-engineer roles) to mark tools as disabled. The disabled state is persisted in the Backstage catalog via entity annotations and displayed across all catalog views (Server Details, Tools Tab, Workload dependencies).

## Technical Context

**Language/Version**: TypeScript 4.7+, Node.js 18+  
**Primary Dependencies**: React 17.x, @patternfly/react-core 6.2+, @openshift-console/dynamic-plugin-sdk 1.4.0, @backstage/catalog-model ^1.7.5  
**Storage**: Backstage Catalog API (entity annotations)  
**Testing**: Jest + React Testing Library  
**Target Platform**: OpenShift Console dynamic plugin (frontend via console proxy)  
**Project Type**: Frontend-only plugin (no backend changes to this repo)  
**Performance Goals**: Toggle response < 500ms perceived latency  
**Constraints**: Frontend-only; must use Backstage Catalog API for persistence via console proxy  
**Scale/Scope**: Hundreds of tools across dozens of servers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Security-First | ✅ PASS | Role-based authorization via OpenShift Console user context |
| II. Configuration-First | ✅ PASS | Disabled state stored in catalog annotations (config) |
| III. Container-Ready | ✅ PASS | No container changes needed; existing plugin architecture |
| IV. Test-First Development | ✅ PASS | Unit tests for new components; integration test for persistence |
| V. Component Isolation | ✅ PASS | Frontend-only change; no cross-component coupling |
| VI. Backstage Catalog First | ✅ PASS | Using catalog annotations for storage |
| VII. Vanilla OpenShift Platform | ✅ PASS | Standard OpenShift Console plugin APIs |
| VIII. TypeScript-First | ✅ PASS | All code in TypeScript with strict mode |
| IX. Strict Typing for Python | N/A | No Python code involved |

**Gate Result**: ✅ PASS - No violations

## Project Structure

### Documentation (this feature)

```text
specs/002-disable-tools-checkbox/
├── plan.md              # This file
├── research.md          # Phase 0 output - technical research
├── data-model.md        # Phase 1 output - entity changes
├── quickstart.md        # Phase 1 output - developer guide
├── contracts/           # Phase 1 output - API contracts
│   └── catalog-api.yaml # Backstage Catalog API usage
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── McpServerPage.tsx       # MODIFY: Add disabled checkbox to tools table
│   ├── ToolsTab.tsx            # MODIFY: Add disabled indicator column
│   ├── McpWorkloadPage.tsx     # MODIFY: Add disabled indicator to tool dependencies
│   └── shared/
│       └── DisabledCheckbox.tsx # NEW: Reusable disabled toggle component
├── models/
│   └── CatalogMcpTool.ts       # MODIFY: Add disabled annotation type
├── services/
│   ├── catalogService.ts       # MODIFY: Add entity update function
│   └── authService.ts          # NEW: Role-based authorization check
└── hooks/
    └── useToolDisabledState.ts # NEW: Custom hook for disabled state management
```

**Structure Decision**: Extending existing single-project structure with new shared component and services.

## Complexity Tracking

> No violations requiring justification.
