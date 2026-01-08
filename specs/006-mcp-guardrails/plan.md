# Implementation Plan: MCP Guardrails Entity

**Branch**: `006-mcp-guardrails` | **Date**: 2026-01-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-mcp-guardrails/spec.md`

## Summary

Add a new MCP entity type "guardrail" that represents protection mechanisms for workload-tool relationships. Guardrails are database-only entities (no Backstage catalog) with CRUD operations, can be attached to tools with pre/post execution timing, and are automatically inherited when tools are added to workloads. Workload owners can add additional guardrails at the workload-tool level.

## Technical Context

**Language/Version**: TypeScript 4.7+ (strict mode), Node.js 18+
**Primary Dependencies**: @backstage/catalog-model ^1.7.5, Express (Backstage backend), React 17.x + PatternFly 6.2+ (frontend)
**Storage**: SQLite 3.x (existing mcp-entity-api database)
**Testing**: Jest + React Testing Library (unit), sanity tests (integration)
**Target Platform**: OpenShift cluster with Backstage backend + OpenShift Console plugin
**Project Type**: Web application (backend API + frontend UI)
**Performance Goals**: List page loads < 2 seconds with 100 guardrails; CRUD operations < 5 seconds
**Constraints**: Database-only storage (no Backstage catalog), follows existing MCP entity patterns
**Scale/Scope**: Expected ~100 guardrails max; same scale as tools/workloads

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Security-First | ✅ PASS | RBAC enforced (mcp-admin for guardrail CRUD, mcp-user for workload associations) |
| II. Configuration-First | ✅ PASS | YAML import supported; runtime configuration via database |
| III. Container-Ready | ✅ PASS | No changes to container deployment model |
| IV. Test-First Development | ✅ PASS | Unit and sanity tests planned |
| V. Component Isolation | ✅ PASS | Extends existing mcp-entity-api; independent of other components |
| VI. Backstage Catalog First | ✅ PASS | Database-only by design (matches workloads pattern); entity-like structure |
| VII. Vanilla OpenShift | ✅ PASS | No proprietary features required |
| VIII. TypeScript-First | ✅ PASS | All code in TypeScript with strict mode |
| IX. Strict Typing Python | N/A | No Python code |
| X. Red Hat Registry First | ✅ PASS | No new container images |
| XI. User Verification | ✅ PASS | Following established patterns |

**Gate Result**: PASS - No violations

## Project Structure

### Documentation (this feature)

```text
specs/006-mcp-guardrails/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# Backend API (Backstage plugin)
backstage-app/packages/backend/src/plugins/mcp-entity-api/
├── database.ts          # Add guardrails table schema
├── router.ts            # Add /guardrails endpoints
├── service.ts           # Add guardrail CRUD operations
├── types.ts             # Add Guardrail interfaces
├── validation.ts        # Add guardrail validation
└── __tests__/
    └── guardrail-service.test.ts  # Unit tests

# Frontend (OpenShift Console plugin)
src/
├── components/
│   ├── GuardrailsTab.tsx         # List view
│   ├── GuardrailsPage.tsx        # Detail page
│   ├── GuardrailForm.tsx         # Create/Edit form
│   └── McpCatalogPage.tsx        # Add Guardrails tab
├── models/
│   └── CatalogMcpGuardrail.ts    # TypeScript interface
└── services/
    └── catalogService.ts          # Add guardrail API hooks

# Tests
tests/sanity/
└── guardrail-crud.sh             # Sanity tests
```

**Structure Decision**: Web application pattern - follows existing mcp-entity-api (backend) + OpenShift Console plugin (frontend) architecture.
