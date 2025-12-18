# Research Findings: MCP Tools Catalog

**Date**: 2025-12-11 (Updated from 2025-11-24)
**Feature**: MCP Tools Catalog Backstage Plugin
**Purpose**: Resolve technical unknowns from Technical Context section

---

## 1. @backstage/catalog-model Version Compatibility

### Decision
**Version: ^1.7.5** (peerDependency, shared from RHDH)

### Rationale
- Red Hat Developer Hub 1.8 is based on Backstage 1.42.5, which uses @backstage/catalog-model 1.7.5
- All @backstage scoped packages are shared dependencies by default in RHDH's dynamic plugin system
- React 17 is fully supported by current Backstage packages
- Compatible with @openshift-console/dynamic-plugin-sdk 1.4.0 through RHDH's shared dependency system

### Alternatives Considered
- **Bundling @backstage/catalog-model**: Violates RHDH dynamic plugin architecture
- **Using older versions (1.4.x-1.6.x)**: Not compatible with RHDH 1.8
- **Using version 1.8.x+**: Does not exist yet

### Implementation Notes
- List as **peerDependency** with version `^1.7.5`
- Do NOT bundle in dynamic plugin package
- Use `--shared-package` flag during plugin build

---

## 2. @backstage/core-components Version

### Decision
**Version: ^0.17.4** (peerDependency, shared from RHDH)

### Rationale
- Latest stable version compatible with Backstage 1.42.5 (RHDH 1.8 baseline)
- Provides core UI components used across Backstage plugins (InfoCard, Header, Page, Table)
- Fully compatible with React 17.x
- Shared dependency architecture prevents duplicate installations

### Alternatives Considered
- **Using older 0.16.x versions**: Missing features and bug fixes
- **Not using @backstage/core-components**: Inconsistent UX with RHDH
- **Bundling the package**: Violates dynamic plugin architecture

### Implementation Notes
- Add as **peerDependency** with version `^0.17.4`
- Common components: `InfoCard`, `Header`, `Content`, `Page`, `Table`
- Individual package versioning is decoupled from Backstage release versioning

---

## 3. Jest Setup for TypeScript React Projects

### Decision
**Configuration: Jest 28+ with ts-jest, @testing-library/react, jsdom environment**

### Rationale
- OpenShift Console uses Jest as standard test platform
- ts-jest provides seamless TypeScript compilation for tests
- @testing-library/react is the modern standard (OpenShift Console migrated from Enzyme)
- jsdom environment required for DOM-based React component testing
- Test regex pattern `.*\\.spec\\.(ts|tsx)$` aligns with OpenShift Console conventions

### Alternatives Considered
- **Cypress only**: Lacks unit test capability for isolated component testing
- **Enzyme + Jest**: Deprecated; OpenShift Console migrated away
- **Vitest**: Not aligned with OpenShift Console ecosystem
- **Babel-jest instead of ts-jest**: Requires additional Babel configuration

### Implementation Notes

**Required Dependencies:**
```json
{
  "devDependencies": {
    "jest": "^28.0.0",
    "ts-jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "@testing-library/react": "^12.1.5",
    "@testing-library/jest-dom": "^5.16.5",
    "@testing-library/user-event": "^14.4.3",
    "jest-environment-jsdom": "^28.0.0"
  }
}
```

**jest.config.ts:**
```typescript
module.exports = {
  testEnvironment: 'jsdom',
  testRegex: '.*\\.spec\\.(ts|tsx)$',
  setupFilesAfterEnv: ['<rootDir>/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!**/node_modules/**',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(@patternfly|d3|lodash-es|@console|i18next)/)',
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
};
```

---

## 4. Backstage Entity Definition Best Practices

### Decision
**Approach: Component kind with custom spec.type values (NOT custom entity kinds)**

All MCP entities will be subtypes of the standard Backstage `Component` kind:
- **MCP Server**: `kind: Component`, `spec.type: server`
- **MCP Tool**: `kind: Component`, `spec.type: tool`
- **MCP Workload**: `kind: Component`, `spec.type: service` or `workflow`

### Rationale
- **Avoid Custom Kinds**: Creating custom entity kinds (McpServer, McpTool, McpWorkload) requires significant infrastructure and reduces compatibility with existing Backstage plugins
- **Plugin Compatibility**: Using standard `Component` kind ensures compatibility with all existing Backstage plugins (catalog-react, search, etc.)
- **Built-in Validation**: Automatic schema validation via `componentEntityV1alpha1Validator`
- **Standard Relationships**: Native support for `dependsOn`, `partOf`, `consumesApi`, `providesApi` relations
- **Proven Pattern**: Widely used in Backstage ecosystem as recommended by documentation
- **TypeScript Safety**: Still use TypeScript types for compile-time safety and IDE autocomplete

### Alternatives Considered
- **Custom Entity Kinds (McpServer, McpTool, McpWorkload)**: Rejected due to complexity, compatibility issues, and Backstage team recommendations against custom kinds
- **Using API entity type with annotations**: Limited to API entities
- **Using Resource entities**: Less flexible than Component for software-like entities
- **@mexl/backstage-plugin-catalog-backend-module-mcp**: External dependency concerns

### Implementation Notes

**Entity Structure Using Component Kind:**

**MCP Server Entity (catalog-info.yaml):**
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: github-integration-server
  namespace: default
  description: "MCP server for GitHub API operations"
  labels:
    mcp-catalog.io/category: api-integration
  annotations:
    mcp-catalog.io/version: "1.0.0"
spec:
  type: server
  lifecycle: production
  owner: group:platform-engineering
  system: mcp-infrastructure
  mcp:
    serverType: stdio
    endpoint: "docker run -i --rm ghcr.io/github/mcp-server"
    version: "1.0.0"
    capabilities:
      - tools
      - resources
```

**MCP Tool Entity (catalog-info.yaml):**
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: github-create-issue
  namespace: default
  description: "Create GitHub issues via MCP"
  labels:
    mcp-catalog.io/type: tool
    mcp-catalog.io/server: github-integration-server
spec:
  type: tool
  lifecycle: production
  owner: group:platform-engineering
  mcp:
    server: component:default/github-integration-server
    toolType: mutation
    inputSchema:
      type: object
      properties:
        title: { type: string }
        body: { type: string }
      required: [title]
relations:
  - type: partOf
    targetRef: component:default/github-integration-server
```

**MCP Workload Entity (catalog-info.yaml):**
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: project-setup-workflow
  namespace: default
  description: "Automated project setup workflow"
  labels:
    mcp-catalog.io/type: workload
spec:
  type: workflow
  lifecycle: production
  owner: group:developer-experience
  system: automation-platform
  mcp:
    purpose: "Automate new project scaffolding"
    tools:
      - component:default/github-create-repo
      - component:default/github-create-issue
    deploymentInfo:
      schedule: on-demand
      runtime: nodejs
relations:
  - type: dependsOn
    targetRef: component:default/github-create-repo
  - type: dependsOn
    targetRef: component:default/github-create-issue
```

**TypeScript Type Definitions:**
```typescript
import { ComponentEntityV1alpha1 } from '@backstage/catalog-model';

export interface McpServerEntity extends ComponentEntityV1alpha1 {
  kind: 'Component';
  spec: ComponentEntityV1alpha1['spec'] & {
    type: 'server';
    mcp: {
      serverType: 'stdio' | 'sse' | 'http';
      endpoint: string;
      version: string;
      capabilities?: string[];
    };
  };
}

export interface McpToolEntity extends ComponentEntityV1alpha1 {
  kind: 'Component';
  spec: ComponentEntityV1alpha1['spec'] & {
    type: 'tool';
    mcp: {
      server: string; // EntityRef
      toolType: 'query' | 'mutation';
      inputSchema?: object;
    };
  };
}

export interface McpWorkloadEntity extends ComponentEntityV1alpha1 {
  kind: 'Component';
  spec: ComponentEntityV1alpha1['spec'] & {
    type: 'workflow' | 'service';
    mcp: {
      purpose: string;
      tools: string[]; // Array of EntityRefs
      deploymentInfo?: {
        schedule?: string;
        runtime?: string;
      };
    };
  };
}
```

**Type Guards:**
```typescript
import { Entity } from '@backstage/catalog-model';

export function isMcpServerEntity(entity: Entity): entity is McpServerEntity {
  return (
    entity.kind === 'Component' &&
    entity.spec?.type === 'server' &&
    'mcp' in (entity.spec || {})
  );
}

export function isMcpToolEntity(entity: Entity): entity is McpToolEntity {
  return (
    entity.kind === 'Component' &&
    entity.spec?.type === 'tool' &&
    'mcp' in (entity.spec || {})
  );
}

export function isMcpWorkloadEntity(entity: Entity): entity is McpWorkloadEntity {
  return (
    entity.kind === 'Component' &&
    ['workflow', 'service'].includes(entity.spec?.type || '') &&
    'mcp' in (entity.spec || {})
  );
}
```

**Best Practices:**
- Use standard `backstage.io/v1alpha1` apiVersion
- Filter by `spec.type` instead of custom kinds
- Use labels with `mcp-catalog.io/` prefix for MCP-specific metadata
- Store MCP-specific data in custom `spec.mcp` field
- Use EntityRef format for relationships: `component:namespace/name`
- Use standard Backstage relations: `partOf`, `dependsOn`, `consumesApi`

---

## 5. Hierarchical Tree Visualization in PatternFly

### Decision
**Component: PatternFly TreeView (@patternfly/react-core v6.2+)**

### Rationale
- Native PatternFly component ensures UX consistency with OpenShift Console
- Built-in support for hierarchical data structures with multiple levels
- Expandable/collapsible nodes with customizable icons
- Multi-selection and search/filter capability
- Performance optimizations via useMemo for large datasets
- Aligns with project's existing PatternFly 6.2.2 dependency

### Alternatives Considered
- **react-d3-tree**: Overkill for navigation tree; additional dependency
- **Material UI TreeView**: Not compatible with PatternFly design system
- **Custom tree component**: High maintenance burden; accessibility concerns
- **PatternFly Table with nested rows**: Limited expandable depth
- **PatternFly Topology component**: Heavyweight for simple tree needs

### Implementation Notes

**Import Statement:**
```typescript
import { TreeView, TreeViewDataItem } from '@patternfly/react-core';
import {
  ServerIcon,
  CubeIcon,
  WrenchIcon
} from '@patternfly/react-icons';
```

**Data Structure for Workload → Server → Tool Hierarchy:**
```typescript
const mcpHierarchyData: TreeViewDataItem[] = [
  {
    name: 'AI Agent Workload',
    id: 'workload-ai-agent',
    icon: <CubeIcon />,
    children: [
      {
        name: 'Filesystem MCP Server',
        id: 'server-filesystem',
        icon: <ServerIcon />,
        children: [
          {
            name: 'read_file',
            id: 'tool-read-file',
            icon: <WrenchIcon />,
          },
          {
            name: 'write_file',
            id: 'tool-write-file',
            icon: <WrenchIcon />,
          }
        ]
      }
    ]
  }
];
```

**Component Implementation:**
```typescript
export const McpHierarchyTree: React.FC = () => {
  const [activeItems, setActiveItems] = useState<TreeViewDataItem[]>([]);

  const onSelect = (_event: React.MouseEvent, item: TreeViewDataItem) => {
    setActiveItems([item]);
    // Navigate to detail page based on item type
  };

  return (
    <TreeView
      data={mcpHierarchyData}
      activeItems={activeItems}
      onSelect={onSelect}
      hasSelectableNodes
    />
  );
};
```

**Key Features:**
- `hasSelectableNodes`: Separate selection from expansion
- `isMultiSelectable`: Enable multi-select mode
- `useMemo`: Performance optimization for large datasets
- `hasBadge`: Show tool count per server
- Built-in search/filter for catalogs with >7 nodes

---

## 6. GitHub Catalog Integration

### Decision
**Approach: GithubEntityProvider (built-in) + optional custom validation processor**

### Rationale
- Entity providers preferred over processors for external data ingestion
- Automatic lifecycle management (deletes entities when removed from GitHub)
- Built-in rate limit handling and auth with PAT
- Independent scheduling (configurable sync frequency)
- Location key mechanism makes GitHub authoritative source (meets FR-022)

### Implementation Notes

**Configuration (app-config.yaml):**
```yaml
catalog:
  providers:
    github:
      mcpCatalog:
        organization: 'your-org'
        catalogPath: '/entities/**/*.yaml'
        filters:
          branch: '${MCP_CATALOG_BRANCH}'
          repository: '.*'
        schedule:
          frequency: { minutes: 5 }
          timeout: { minutes: 3 }

integrations:
  github:
    - host: github.com
      token: ${GITHUB_TOKEN}
```

**Rate Limiting:**
- Backstage's GitHub client automatically respects rate limit headers
- When rate limited, waits until reset time (no manual backoff needed)
- Standard PAT rate limit: 5,000 requests/hour

**Exponential Backoff for Transient Failures:**
- Custom retry logic in validation processor if needed
- Schedule: 1s, 2s, 4s delays (max 3 retries)

---

## 7. UI Framework Decision

### Decision
**IMPORTANT: Use Backstage Components (Material UI), NOT PatternFly**

The current codebase appears to mix OpenShift Console Plugin (PatternFly) with Backstage plugin patterns. These are **incompatible architectures** - you must choose one.

### Rationale for Backstage Approach
- Constitution principle VI requires Backstage Software Catalog
- PatternFly and Backstage are incompatible UI frameworks
- Using Backstage components ensures plugin compatibility
- Consistent UX with Backstage ecosystem
- Built-in pagination, filtering, search in CatalogTable

### Recommended Component Stack
- `@backstage/core-components` - InfoCard, Table, Progress, etc.
- `@backstage/plugin-catalog-react` - CatalogTable, EntityListProvider, useEntity
- Material UI (MUI) - Additional UI components
- `@backstage/plugin-catalog-graph` - Relationship visualization (network graph)

### Migration Required
Replace PatternFly components:
- `PageSection` → `Page`, `Content` from `@backstage/core-components`
- `Title` → `Typography variant="h1"` from `@material-ui/core`
- `Tabs/Tab` → Material UI `Tabs/Tab`
- PatternFly `Table` → `CatalogTable` or Material UI `Table`
- PatternFly `TreeView` → `@backstage/plugin-catalog-graph` (network) or custom Material UI `TreeView` (hierarchical)

---

## Summary Table

| Research Item | Decision | Version/Approach |
|--------------|----------|------------------|
| @backstage/catalog-model | PeerDependency (shared) | ^1.7.5 |
| @backstage/core-components | PeerDependency (shared) | ^0.17.4 |
| Jest Configuration | ts-jest + @testing-library/react | Jest 28+, ts-jest 29+ |
| Entity Definitions | Component kind with custom types | backstage.io/v1alpha1 kind:Component |
| GitHub Sync | GithubEntityProvider | Built-in with PAT auth |
| UI Framework | Backstage + Material UI | NOT PatternFly |
| Tree Visualization | @backstage/plugin-catalog-graph | Network graph (not hierarchical tree) |

---

## Next Steps

With research complete, proceed to Phase 1:
1. Generate data-model.md (entity schemas for Component subtypes)
2. Generate contracts/ (API contracts if needed - likely none for Backstage plugin)
3. Generate quickstart.md (developer onboarding guide)
4. Update agent context (CLAUDE.md) with new technology decisions
5. Migrate existing PatternFly components to Backstage + Material UI
6. Implement GithubEntityProvider configuration for catalog sync
