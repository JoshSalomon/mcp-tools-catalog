# mcp-tools-catalog Development Guidelines

Last updated: 2025-12-11

## Active Technologies
- TypeScript 4.7+, Node.js 18+
- React 17.x
- @openshift-console/dynamic-plugin-sdk 1.4.0
- @patternfly/react-core 6.2+
- @backstage/catalog-model ^1.7.5 (peerDependency)
- Jest + React Testing Library for unit tests
- Backstage catalog backend (existing) - no additional storage required

## Project Structure

```text
src/
├── components/           # React components
│   ├── McpCatalogPage.tsx      # Main catalog page with tabs + global search
│   ├── McpServerPage.tsx       # Server detail page
│   ├── McpToolPage.tsx         # Tool detail page
│   ├── McpWorkloadPage.tsx     # Workload detail page (collapsible sections)
│   ├── ServersTab.tsx          # Servers list tab
│   ├── ToolsTab.tsx            # Tools list tab
│   ├── WorkloadsTab.tsx        # Workloads list tab
│   └── shared/                 # Shared components
│       ├── Pagination.tsx
│       ├── OfflineIndicator.tsx
│       ├── DependencyTreeView.tsx
│       ├── Breadcrumbs.tsx
│       └── ErrorBoundary.tsx
├── models/               # TypeScript interfaces
│   ├── CatalogMcpServer.ts
│   ├── CatalogMcpTool.ts
│   └── CatalogMcpWorkload.ts
├── services/             # Business logic
│   ├── catalogService.ts       # API hooks for Backstage catalog
│   ├── searchService.ts        # Filtering utilities
│   └── validationService.ts    # Relationship validation
└── utils/                # Utilities
    ├── hierarchicalNaming.ts   # Entity name parsing
    └── performanceMonitor.ts   # Performance tracking

entities/                 # Example Backstage entity YAML files
charts/                   # Helm charts for deployment
specs/                    # Design documentation
tests/sanity/             # Sanity test scripts
```

## Commands

```bash
# Build
yarn build

# Run unit tests
yarn test

# Build, push, deploy, and test (one command)
./build-push-deploy-test.sh                    # Console plugin (default)
./build-push-deploy-test.sh --backstage-only  # Backstage only

# Build container only
./build-container.sh --local

# Sanity tests (against deployed cluster)
./tests/sanity/quick-check.sh        # Quick health check
./tests/sanity/run-sanity-tests.sh   # Full test suite

# Lint
yarn lint
```

## Entity Model

All MCP entities are standard Backstage `Component` kind:

| Entity Type | spec.type | Parent Relation |
|-------------|-----------|-----------------|
| Server | `mcp-server` | - |
| Tool | `mcp-tool` | `subcomponentOf: component:ns/server` |
| Workload | `service`/`workflow`/`mcp-workload` | `dependsOn: [component:ns/tool]` |

### Key Relationships
- **Tool → Server**: Use `spec.subcomponentOf` (creates `partOf`/`hasPart`)
- **Workload → Tool**: Use `spec.dependsOn` (creates `dependsOn`/`dependencyOf`)

### Relationship Resolution Priority (Tool → Server)
1. `spec.subcomponentOf`
2. `spec.partOf`
3. `relations[]` with `type: 'partOf'`
4. `spec.mcp.server` (legacy)
5. `metadata.labels['mcp-catalog.io/server']`

## Code Style

- TypeScript strict mode
- PatternFly React components for UI
- React hooks for state management
- Client-side filtering after initial API fetch

## Implementation Status

- ✅ Phase 1: Setup & Foundation
- ✅ Phase 2: Browse MCP Servers (User Story 1)
- ✅ Phase 3: Explore MCP Tools (User Story 2)
- ✅ Phase 4: Manage MCP Workloads (User Story 3)
- ✅ Phase 5: GitHub Catalog Integration (User Story 4 - Documentation)
- ✅ Phase 6: Editing Capabilities (User Story: Disable/Enable Tools)
 - ✅ Authentication & CSRF token handling
 - ✅ YAML entity support (catalog + database merge)
 - ✅ Disabled state persistence
 - ✅ Checkbox UI state management fix
 - ✅ Documentation (MERGE-ARCHITECTURE.md, YAML-ENTITY-FIX.md, CHECKBOX-UI-FIX.md)
- 🔄 Phase 7: Polish & Production Readiness (in progress)
 - ✅ Loading states, error boundaries, empty states
 - ✅ Breadcrumb navigation
 - ✅ Entity type filters and global search
 - ✅ Accessibility (ARIA labels, keyboard navigation)
 - ✅ Unit tests (ServersTab, searchService, validationService)
 - 📋 Remaining unit tests (6 components)
 - 📋 Integration tests (Cypress)

## UI Features

- **Global Search**: Syncs across all tabs, persisted in URL
- **Entity Type Filters**: Quick filter chips for Servers/Tools/Workloads
- **Collapsible Sections**: Workload detail page allows collapsing server tool lists
- **Expand/Collapse All**: Bulk toggle for multi-server workloads
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

## Important Notes

- This is an OpenShift Console dynamic plugin (frontend + backend API)
- MCP Entity API provides CRUD operations with SQLite database
- **Merge Architecture**: MCP Entity API merges catalog entities (YAML) with database state (disabled flags)
  - Catalog = source of truth (entity definitions from YAML)
  - Database = runtime state (disabled/enabled, user modifications)
  - API layer = merges on GET (see [MERGE-ARCHITECTURE.md](MERGE-ARCHITECTURE.md))
- Locale files must match plugin name: `locales/en/plugin__mcp-catalog.json`
- Container runs as non-root user on UBI9 nginx base image
- Unit tests use Jest + React Testing Library

## React Hooks Best Practices

### State Management Patterns
- **Batch Editing**: Use `useBatchToolState` for Save/Cancel workflows
- **Optimistic Updates**: Use `useToolDisabledState` for immediate persistence
- **Stable Callbacks**: Keep hook dependencies minimal (avoid frequently-changing state)
- **New Object References**: Use destructuring/spread instead of mutation for reliable re-renders

### Common Pitfalls
- ❌ Don't use `delete` operator for removing properties (unreliable re-renders)
- ❌ Don't include frequently-changing state in `useCallback` dependencies
- ✅ Use destructuring to create new objects when removing properties
- ✅ Access latest state through setter function's `prev` parameter

## Related Documentation

- [CHECKBOX-UI-FIX.md](./CHECKBOX-UI-FIX.md) - Checkbox UI state management fix
- [MERGE-ARCHITECTURE.md](./MERGE-ARCHITECTURE.md) - Catalog + database merge pattern
- [DISABLE-TOOLS-FIX-COMPLETE.md](./DISABLE-TOOLS-FIX-COMPLETE.md) - Disable feature documentation
- [AUTHENTICATION.md](./AUTHENTICATION.md) - Authentication architecture
- [DOCUMENTATION-INDEX.md](./DOCUMENTATION-INDEX.md) - Complete documentation index
