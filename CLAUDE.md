# mcp-tools-catalog Development Guidelines

Last updated: 2025-12-16

## Active Technologies
- TypeScript 4.7+, Node.js 18+
- React 17.x
- @openshift-console/dynamic-plugin-sdk 1.4.0
- @patternfly/react-core 6.2+
- @backstage/catalog-model ^1.7.5 (peerDependency)
- Backstage catalog backend (existing) - no additional storage required

## Project Structure

```text
src/
├── components/           # React components
│   ├── McpCatalogPage.tsx      # Main catalog page with tabs
│   ├── McpServerPage.tsx       # Server detail page
│   ├── McpToolPage.tsx         # Tool detail page
│   ├── McpWorkloadPage.tsx     # Workload detail page
│   ├── ServersTab.tsx          # Servers list tab
│   ├── ToolsTab.tsx            # Tools list tab
│   ├── WorkloadsTab.tsx        # Workloads list tab
│   └── shared/                 # Shared components
│       ├── Pagination.tsx
│       ├── OfflineIndicator.tsx
│       └── DependencyTreeView.tsx
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
```

## Commands

```bash
# Build
yarn build

# Build container
./build-container.sh --local

# Deploy to OpenShift
./push-and-deploy.sh

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
- 📋 Phase 6: Polish & Production Readiness (pending)

## Important Notes

- This is an OpenShift Console dynamic plugin (frontend-only)
- All data comes from Backstage Catalog API via console proxy
- Locale files must match plugin name: `locales/en/plugin__mcp-catalog.json`
- Container runs as non-root user on UBI9 nginx base image
