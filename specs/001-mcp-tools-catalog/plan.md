# Implementation Plan: MCP Tools Catalog

**Branch**: `001-mcp-tools-catalog` | **Date**: 2025-12-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-mcp-tools-catalog/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Extend Backstage Software Catalog with three new MCP entity types (Server, Tool, Workload) to provide discovery and relationship tracking for Model Context Protocol infrastructure. Include GitHub repository integration for GitOps-style catalog management with configurable repository URL, branch selection, and automatic synchronization with conflict resolution.

## Technical Context

**Language/Version**: TypeScript 4.9+, Node.js 18+
**Primary Dependencies**:
- @backstage/catalog-model ^1.7.5 (entity schemas and validation)
- @backstage/core-components ^0.17.4 (UI components and patterns)
- @backstage/plugin-catalog-react ^1.13.2 (catalog integration)
- @openshift-console/dynamic-plugin-sdk 1.4.0 (OpenShift console integration)
- @patternfly/react-core 6.2+ (UI components)
- @octokit/rest ^21.0.0 (GitHub API client for catalog sync)

**Storage**: Backstage Software Catalog (existing) - no additional storage required
**Testing**: Jest, React Testing Library, Backstage test utilities
**Target Platform**: Vanilla OpenShift cluster (containerized deployment), Backstage upstream
**Project Type**: Web application (Backstage plugin + OpenShift Console plugin)
**Performance Goals**:
- List views < 2s load time with 1000+ entities
- Detail pages < 1s load time
- Search results < 1s response time
- GitHub sync 99% reliability with 5-minute default interval

**Constraints**:
- Must use Backstage catalog as sole entity storage (no custom databases)
- Must target vanilla OpenShift without proprietary extensions
- Must maintain compatibility with upstream Backstage
- GitHub sync must handle rate limits and auth failures gracefully
- UI must support pagination at 100 items/page

**Scale/Scope**:
- 1000+ MCP entities (servers, tools, workloads)
- Multiple concurrent users browsing catalog
- Periodic GitHub synchronization without impacting user experience
- Three new entity types with bidirectional relationships

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Security-First (NON-NEGOTIABLE)
✅ **PASS** - GitHub PAT stored securely, no secrets in logs/config, container images use minimal base, entity validation prevents injection

### II. Configuration-First
✅ **PASS** - Catalog extensions via Backstage entity schemas, GitHub repo/branch/token configurable, no code changes for entity types

### III. Container-Ready
✅ **PASS** - Components packaged as containers for OpenShift, health checks for sync process, graceful shutdown, resource limits

### IV. Test-First Development
✅ **PASS** - Integration tests for GitHub sync, UI component tests, catalog entity validation tests, isolated test environments

### V. Component Isolation
✅ **PASS** - Backstage plugin (entity schemas + UI) independently deployable, GitHub sync processor separate, test suite isolated

### VI. Backstage Software Catalog First
✅ **PASS** - All MCP entities use Backstage catalog-model, EntityRef for relationships, no custom databases, integrates with existing catalog API

### VII. Vanilla OpenShift Platform Target
✅ **PASS** - Uses upstream Backstage distributions, standard OpenShift deployment, Helm charts compatible with vanilla OpenShift, no proprietary features

### VIII. TypeScript-First Development
✅ **PASS** - All code in TypeScript 4.9+, strict mode enabled, explicit type annotations, no JavaScript files

### IX. Strict Typing for Python
✅ **N/A** - No Python code in this feature

**Overall Gate Status**: ✅ **PASSED** - All applicable principles satisfied, no violations requiring justification

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── models/
│   ├── McpServerEntity.ts          # MCP Server entity type definition
│   ├── McpToolEntity.ts            # MCP Tool entity type definition
│   ├── McpWorkloadEntity.ts        # MCP Workload entity type definition
│   └── index.ts                    # Entity type exports
├── components/
│   ├── McpCatalogPage.tsx          # Main MCP catalog page with tabs
│   ├── ServersTab.tsx              # MCP Servers list view
│   ├── ToolsTab.tsx                # MCP Tools list view
│   ├── WorkloadsTab.tsx            # MCP Workloads list view
│   ├── McpServerPage.tsx           # MCP Server detail page
│   ├── McpToolPage.tsx             # MCP Tool detail page
│   ├── McpWorkloadPage.tsx         # MCP Workload detail page
│   └── shared/
│       ├── DependencyTree.tsx      # Hierarchical relationship visualization
│       ├── EntityCard.tsx          # Reusable entity display card
│       └── FilterPanel.tsx         # Search and filter controls
├── services/
│   ├── GitHubCatalogProcessor.ts   # GitHub sync processor
│   ├── EntityValidator.ts          # Entity validation logic
│   └── MetricsExporter.ts          # Observability metrics
└── utils/
    ├── entityRefs.ts               # EntityRef helpers
    └── retry.ts                    # Exponential backoff utilities

tests/
├── unit/
│   ├── models/                     # Entity schema tests
│   ├── components/                 # React component tests
│   └── services/                   # Service logic tests
└── integration/
    ├── github-sync.test.ts         # GitHub integration tests
    ├── catalog-api.test.ts         # Backstage catalog API tests
    └── entity-lifecycle.test.ts    # Cascade delete and relationship tests

deployment/
├── helm/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── deployment.yaml
│       ├── service.yaml
│       └── configmap.yaml
└── manifests/
    └── openshift/                  # OpenShift-specific manifests
```

**Structure Decision**: Web application structure selected. This is a Backstage plugin with both frontend UI components and backend catalog processors. The `src/` directory contains entity type definitions (models), React UI components following Backstage patterns, and services for GitHub synchronization and metrics. Tests are organized by type (unit vs integration) to support isolated testing environments. Deployment artifacts include Helm charts for vanilla OpenShift compatibility.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations detected. All complexity is justified by functional requirements and constitution principles.
