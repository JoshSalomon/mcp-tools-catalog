# Implementation Plan: Workload Entities to Local Database

**Branch**: `005-workload-local-db` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-workload-local-db/spec.md`

## Summary

Migrate workload entity storage from the current dual-source architecture (Backstage Catalog + Database) to a simplified single-source architecture where the local SQLite database is the sole source of truth for workloads. This eliminates merge complexity, soft delete workarounds, and enables true CRUD operations including workload renaming.

## Technical Context

**Language/Version**: TypeScript 4.7+ (strict mode), Node.js 18+
**Primary Dependencies**: Express (Backstage backend), React 17.x (frontend), PatternFly 6.2+, @backstage/catalog-model ^1.7.5
**Storage**: SQLite 3.x (existing mcp-entity-api database)
**Testing**: Jest + React Testing Library (unit), manual sanity tests
**Target Platform**: OpenShift Console (dynamic plugin) + Backstage backend
**Project Type**: Web application (frontend plugin + backend API)
**Performance Goals**: All CRUD operations complete in <2 seconds (SC-001)
**Constraints**: No UI changes required (API contract preserved), backward compatible endpoints
**Scale/Scope**: Single-digit workloads per cluster currently, support growth to 100+ workloads (SC-004)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Security-First | ✅ PASS | Existing RBAC (mcp-user role) preserved; no new attack surface |
| II. Configuration-First | ✅ PASS | No new configuration required; uses existing database |
| III. Container-Ready | ✅ PASS | No container changes; backend already containerized |
| IV. Test-First Development | ✅ PASS | Unit tests for service layer; sanity tests for API |
| V. Component Isolation | ✅ PASS | Backend-only changes; frontend unchanged |
| VI. Backstage Software Catalog First | ⚠️ DEVIATION | **Justified**: This feature intentionally moves workloads OUT of catalog to database-only. Servers/Tools remain in catalog. This is Phase 1 of a planned migration. |
| VII. Vanilla OpenShift Platform Target | ✅ PASS | No proprietary features used |
| VIII. TypeScript-First Development | ✅ PASS | All code in TypeScript strict mode |
| IX. Strict Typing for Python | N/A | No Python code in this feature |
| X. Red Hat Registry First | ✅ PASS | No new container images; existing images use quay.io |
| XI. User Verification of Fixes | ✅ PASS | User explicitly requested this feature |

**Gate Status**: PASS (with documented deviation for Principle VI)

## Project Structure

### Documentation (this feature)

```text
specs/005-workload-local-db/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API schemas)
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
# Backend (Backstage mcp-entity-api plugin)
backstage-app/packages/backend/src/plugins/mcp-entity-api/
├── router.ts            # Express routes (workload endpoints)
├── service.ts           # Business logic (CRUD, merge → simplified)
├── database.ts          # SQLite operations (workload table)
├── auth.ts              # RBAC middleware (unchanged)
└── errors.ts            # Error handling (unchanged)

# Frontend (unchanged - API contract preserved)
src/
├── components/
│   ├── WorkloadsTab.tsx       # List view (unchanged)
│   ├── McpWorkloadPage.tsx    # Detail view (unchanged)
│   └── WorkloadForm.tsx       # Create/edit form (minor: enable rename)
├── services/
│   └── catalogService.ts      # API calls (unchanged endpoints)
└── models/
    └── CatalogMcpWorkload.ts  # Interface (unchanged)

# Tests
backstage-app/packages/backend/src/plugins/mcp-entity-api/
└── service.test.ts      # Unit tests for workload CRUD
tests/sanity/
└── workload-crud.sh     # Sanity tests for API
```

**Structure Decision**: Web application with backend-focused changes. Frontend remains unchanged except for enabling workload name editing in WorkloadForm.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle VI deviation (workloads out of catalog) | Database-only storage eliminates merge complexity, soft delete, and enables true CRUD | Keeping catalog would require continued soft delete workarounds and prevent renaming |

## Implementation Approach

### What Changes

1. **Backend Service Layer** (`service.ts`):
   - Remove catalog lookup for workloads
   - Remove merge logic for workloads
   - Remove soft delete logic (use hard delete)
   - All workload CRUD operates on database only

2. **Database Layer** (`database.ts`):
   - Ensure workload table schema supports all required fields
   - Add unique constraint on (namespace, name) for name validation

3. **Frontend** (`WorkloadForm.tsx`):
   - Make name field editable in edit mode (currently read-only)
   - Add validation for duplicate name on rename

### What Stays the Same

- API endpoints (`/api/mcp-entity-api/workloads/*`)
- Request/response formats
- RBAC (mcp-user role)
- Frontend components (WorkloadsTab, McpWorkloadPage)
- Server and Tool handling (remain in catalog)

### Migration Strategy

- No production data migration required (per spec assumption)
- Optional YAML import endpoint for bulk creation (P3)
- Existing API-created workloads already in database

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Pre-Design | Post-Design | Notes |
|-----------|------------|-------------|-------|
| I. Security-First | ✅ PASS | ✅ PASS | No changes to security model |
| II. Configuration-First | ✅ PASS | ✅ PASS | No new configuration |
| III. Container-Ready | ✅ PASS | ✅ PASS | No container changes |
| IV. Test-First Development | ✅ PASS | ✅ PASS | Tests defined in data-model.md |
| V. Component Isolation | ✅ PASS | ✅ PASS | Backend changes only |
| VI. Backstage Catalog First | ⚠️ DEVIATION | ⚠️ DEVIATION | Justified and documented |
| VII. Vanilla OpenShift | ✅ PASS | ✅ PASS | No proprietary features |
| VIII. TypeScript-First | ✅ PASS | ✅ PASS | All TypeScript strict mode |
| IX. Python Typing | N/A | N/A | No Python code |
| X. Red Hat Registry First | ✅ PASS | ✅ PASS | No new images |
| XI. User Verification | ✅ PASS | ✅ PASS | User requested feature |

**Post-Design Gate Status**: ✅ PASS

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Plan | `specs/005-workload-local-db/plan.md` | ✅ Complete |
| Research | `specs/005-workload-local-db/research.md` | ✅ Complete |
| Data Model | `specs/005-workload-local-db/data-model.md` | ✅ Complete |
| API Contract | `specs/005-workload-local-db/contracts/workloads-api.yaml` | ✅ Complete |
| Quickstart | `specs/005-workload-local-db/quickstart.md` | ✅ Complete |
| Tasks | `specs/005-workload-local-db/tasks.md` | ⏳ Pending (`/speckit.tasks`) |

## Next Steps

Run `/speckit.tasks` to generate the implementation task breakdown.
