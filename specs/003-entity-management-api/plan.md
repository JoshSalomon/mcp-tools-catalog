# Implementation Plan: Entity Management API

**Branch**: `003-entity-management-api` | **Date**: 2025-12-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-entity-management-api/spec.md`

## Summary

Add a REST API for CRUD operations on MCP entities (Servers, Tools, Workloads) with OCP role-based access control. The Backstage catalog database serves as the authoritative source of truth (per Constitution Principle VI). The API enforces `mcp-admin` role for Servers/Tools and `mcp-user` role for Workloads, with public read access for authenticated users.

## Technical Context

**Language/Version**: TypeScript 4.7+ (strict mode per constitution)
**Primary Dependencies**: @backstage/backend-defaults, @backstage/plugin-catalog-node, @kubernetes/client-node (for OCP SubjectAccessReview)
**Storage**: Backstage Catalog Database (existing PostgreSQL via catalog-backend) - authoritative source of truth
**Testing**: Jest + supertest for API tests
**Target Platform**: OpenShift Container Platform (vanilla, per constitution)
**Project Type**: Backend plugin extension to existing Backstage app
**Performance Goals**: <500ms p95 response time (per SC-001)
**Constraints**: Entities visible in Catalog within 5 seconds (per SC-003)
**Scale/Scope**: Standard Backstage catalog scale (1000s of entities)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Security-First | ✅ PASS | RBAC enforcement via OCP roles; fail-closed on auth service unavailable |
| II. Configuration-First | ✅ PASS | Role mappings externalized in config; no hardcoded policies |
| III. Container-Ready | ✅ PASS | Extends existing containerized Backstage backend |
| IV. Test-First Development | ✅ PASS | API tests with role simulation planned |
| V. Component Isolation | ✅ PASS | New backend plugin; independent from console plugin |
| VI. Backstage Catalog First | ✅ PASS | Database is source of truth; CRUD APIs provided for all entity types; no YAML file dependency |
| VII. Vanilla OpenShift Target | ✅ PASS | Standard OCP RBAC; no proprietary extensions |
| VIII. TypeScript-First | ✅ PASS | All code in TypeScript strict mode |
| IX. Strict Typing for Python | N/A | No Python in this feature |
| X. Red Hat Registry First | N/A | No new container images introduced in this feature |
| XI. User Verification of Fixes | N/A | Agent workflow principle; not applicable to code implementation |

**Gate Status**: ✅ PASSED - All applicable principles satisfied (Constitution v1.5.0).

## Project Structure

### Documentation (this feature)

```text
specs/003-entity-management-api/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── entity-management-api.yaml  # OpenAPI spec
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backstage-app/
├── packages/
│   └── backend/
│       └── src/
│           ├── index.ts                    # Add plugin registration
│           └── plugins/
│               └── mcp-entity-api/         # NEW: Entity Management Plugin
│                   ├── index.ts            # Plugin entry point
│                   ├── router.ts           # Express router with CRUD endpoints
│                   ├── service.ts          # Business logic layer
│                   ├── auth.ts             # OCP RBAC integration
│                   ├── validation.ts       # Entity schema validation
│                   ├── types.ts            # TypeScript interfaces
│                   └── __tests__/          # Tests (Backstage convention)
│                       ├── fixtures.ts
│                       ├── router.test.ts
│                       ├── service.test.ts
│                       ├── auth.test.ts
│                       └── rbac.test.ts
```

**Structure Decision**: Backend plugin within existing Backstage app. The plugin registers as a Backstage backend module and exposes REST endpoints under `/api/mcp-entities/`.

## Complexity Tracking

> No constitution violations requiring justification.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Custom API vs Backstage Catalog API | Custom wrapper | Need OCP RBAC enforcement not native to Backstage |
| Separate microservice vs Plugin | Plugin | Constitution requires component isolation within existing architecture |
| Database vs YAML files | Database | Constitution Principle VI mandates database as source of truth |
