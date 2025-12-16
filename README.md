# MCP Tools Catalog

A comprehensive Backstage plugin for managing Model Context Protocol (MCP) infrastructure, providing visibility into MCP servers, tools, and workloads within your organization.

## 🎯 Project Overview

The MCP Tools Catalog extends Backstage with three new entity types to provide complete visibility into your Model Context Protocol infrastructure:

- **🖥️ MCP Servers**: AI capability providers (e.g., GitHub API server, File system server)
- **🔧 MCP Tools**: Individual AI functions (e.g., create-issue, read-file, analyze-text)  
- **⚙️ MCP Workloads**: Composed workflows (e.g., Project setup automation, Content pipeline)

## ✨ Features

- **🔍 Discovery**: Browse and discover MCP servers in your infrastructure
- **🔗 Relationships**: Visualize connections between servers, tools, and workloads
- **✅ Validation**: Automatic validation of entity relationships and references
- **🚀 Integration**: Seamless integration with Backstage catalog and authentication
- **📊 Management**: Manage workload-tool relationships through intuitive UI
- **🏗️ Vanilla OpenShift Ready**: Works on upstream Backstage and standard OpenShift without proprietary extensions

## 🧭 Constitution Alignment

- **Security-first**: Container images run as non-root, secrets stay out of Git, and deployment manifests include health checks and resource limits for defense in depth.
- **Configuration-first**: Behavior is driven by Helm values, `console-extensions.json`, and `app-config` so features vary per environment without rebuilding the plugin.
- **Backstage catalog-first**: MCP servers, tools, and workloads are modeled as standard Backstage Components, keeping entity discovery inside the existing catalog graph.
- **Vanilla OpenShift platform target**: Charts, manifests, and console plugin definitions work unchanged on vanilla OpenShift clusters; Red Hat Developer Hub-specific features must include an upstream-safe fallback.
- **TypeScript-first development**: The root `tsconfig.json` enforces `strict: true` and the codebase ships new logic in TypeScript instead of JavaScript shims. Run `npx tsc --noEmit` from the repo root and `npx tsc --noEmit -p tsconfig.check.json` from `plugins/mcp-tools-catalog` to keep both targets type-safe.
- **Strict typing for Python tooling**: Any Python automation (e.g., helper scripts) must ship with Python 3.9+ type hints and pass `mypy --strict` before merge.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Server    │    │    MCP Tool     │    │  MCP Workload   │
│  (Component)    │    │  (Component)    │    │  (Component)    │
│ spec.type:      │    │ spec.type:      │    │ spec.type:      │
│  mcp-server     │◀───│  mcp-tool       │◀───│  service        │
│                 │    │                 │    │                 │
│ hasPart ────────┼───▶│ subcomponentOf  │    │ dependsOn ──────┤
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Relationships (Standard Backstage):**
- **Tool → Server**: `spec.subcomponentOf` creates `partOf`/`hasPart` relations
- **Workload → Tool**: `spec.dependsOn` creates `dependsOn`/`dependencyOf` relations
- All entities are standard Backstage `Component` kind with custom `spec.type` values

## 🚀 Quick Start

### Prerequisites

- Backstage instance (v1.8+)
- Node.js 18+
- TypeScript 4.9+ with `strict` mode enabled
- Vanilla OpenShift cluster (no proprietary console extensions required)

### Installation

1. **Install the plugin:**
   ```bash
   cd your-backstage-app
   yarn add @internal/plugin-mcp-tools-catalog
   ```

2. **Add to your Backstage app:**
   ```typescript
   // packages/app/src/App.tsx
   import { McpCatalogPage } from '@internal/plugin-mcp-tools-catalog';
   
   <Route path="/mcp-catalog" element={<McpCatalogPage />} />
   ```

3. **Register the entity processor:**
   ```typescript
   // packages/backend/src/plugins/catalog.ts
   import { McpEntityProcessor } from '@internal/plugin-mcp-tools-catalog';
   
   builder.addProcessor(new McpEntityProcessor());
   ```

4. **Configure the plugin:**
   ```yaml
   # app-config.yaml
   mcpCatalog:
     enabled: true
     ui:
       showRelationshipGraphs: true
   ```

### Register Your First MCP Server

Create `github-server.yaml`:
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: github-integration-server
  namespace: default
  description: "MCP server for GitHub API operations"
  labels:
    mcp-catalog.io/type: server
spec:
  type: mcp-server
  lifecycle: production
  owner: platform-team
  mcp:
    serverType: stdio
    endpoint: "docker run -i --rm ghcr.io/github/github-mcp-server"
    version: "1.0.0"
    capabilities:
      - tools
      - resources
```

Register: Push to your GitHub catalog repository and wait for Backstage to sync.

## 📁 Project Structure

```
mcp-tools-catalog/
├── plugins/mcp-tools-catalog/          # Main Backstage plugin
│   ├── src/
│   │   ├── components/                 # React components
│   │   ├── schemas/                   # Entity type definitions
│   │   ├── api/                       # API client and interfaces
│   │   ├── services/                  # Business logic
│   │   ├── processors/                # Backstage processors
│   │   └── utils/                     # Utilities and validation
│   ├── package.json
│   └── README.md
├── charts/mcp-tools-catalog/          # Helm charts for deployment
│   ├── templates/
│   └── values.yaml
├── integration-tests/                 # End-to-end tests
│   ├── tests/
│   └── cypress.config.js
├── specs/001-mcp-tools-catalog/       # Design documentation
│   ├── plan.md
│   ├── spec.md
│   ├── data-model.md
│   └── quickstart.md
└── README.md                          # This file
```

## 🧪 Development & Testing

### Local Development

```bash
# Clone repository
git clone <repository-url>
cd mcp-tools-catalog

# Install dependencies
yarn install

# Build plugin
cd plugins/mcp-tools-catalog
yarn build

# Run tests
yarn test

# Start development server
yarn dev
```

### Testing

```bash
# Unit tests
yarn test

# Integration tests
cd integration-tests
yarn cypress:run

# Lint and format
yarn lint
```

### Manual Testing Scenarios

1. **Entity Registration:**
   - Register MCP server, verify it appears in catalog
   - Add tools linked to server, verify relationships
   - Create workload referencing tools, test navigation

2. **Relationship Management:**
   - Navigate from server → tools → workloads
   - Test bidirectional relationship display
   - Verify cascade delete behavior

3. **Search & Filtering:**
   - Filter by entity type (servers/tools/workloads)
   - Search by name, description, labels
   - Test advanced filtering combinations

4. **Error Handling:**
   - Test broken entity references
   - Validate error messages and recovery
   - Test validation endpoint responses

## 🏭 Deployment

### Vanilla OpenShift Deployment

> These steps are validated against a vanilla OpenShift Container Platform cluster with upstream Backstage distributions. If you enable any Red Hat Developer Hub–specific features, document a fallback that keeps the plugin functional on vanilla clusters.

> **Deploying Backstage itself?** See the comprehensive [Deployment Guide (DEPLOYMENT.md)](DEPLOYMENT.md#-deploying-upstream-backstage-on-openshift) for instructions on deploying upstream Backstage to OpenShift, including the required Dockerfile patches for OpenShift's Security Context Constraints.

1. **Build and push container:**
   ```bash
   docker build -t registry.example.com/mcp-tools-catalog:latest .
   docker push registry.example.com/mcp-tools-catalog:latest
   ```

2. **Deploy with Helm:**
   ```bash
   helm install mcp-catalog charts/mcp-tools-catalog/ \
     --set image.repository=registry.example.com/mcp-tools-catalog \
     --set image.tag=latest \
     --set openshift.enabled=true
   ```

3. **Configure environment:**
   ```yaml
   # app-config.production.yaml
   mcpCatalog:
     integrations:
       openshift:
         enabled: true
         baseUrl: ${OPENSHIFT_API_URL}
         namespace: mcp-tools
   ```

### Environment Variables

```bash
# Required
OPENSHIFT_API_URL=https://api.openshift.example.com
OPENSHIFT_NAMESPACE=mcp-tools
OPENSHIFT_TOKEN=${OPENSHIFT_SERVICE_ACCOUNT_TOKEN}

# Optional
MCP_REGISTRY_API_KEY=${MCP_REGISTRY_API_KEY}
```

## 📚 Documentation

- **[Plugin README](plugins/mcp-tools-catalog/README.md)**: Detailed plugin documentation
- **[Quickstart Guide](specs/001-mcp-tools-catalog/quickstart.md)**: Step-by-step usage examples
- **[Data Model](specs/001-mcp-tools-catalog/data-model.md)**: Entity schemas and relationships
- **[API Contracts](specs/001-mcp-tools-catalog/contracts/)**: OpenAPI specifications
- **[Implementation Plan](specs/001-mcp-tools-catalog/plan.md)**: Technical architecture
- **[Feature Spec](specs/001-mcp-tools-catalog/spec.md)**: User stories and requirements

## 🎯 Roadmap

### ✅ Phase 1: Setup & Foundation
- [x] Project initialization and basic structure
- [x] TypeScript models for MCP entities
- [x] Core services (catalog, search, validation)
- [x] Shared components (Pagination, OfflineIndicator)

### ✅ Phase 2: Browse MCP Servers (User Story 1)
- [x] Browse and discover MCP servers
- [x] Server detail pages with metadata
- [x] Tool list on server pages with clickable links
- [x] Basic search and filtering
- [x] Performance monitoring

### ✅ Phase 3: Explore MCP Tools (User Story 2)
- [x] Browse MCP tools with server relationships
- [x] Tool detail pages with parameter schemas
- [x] Tool-to-server navigation (subcomponentOf/partOf relations)
- [x] "Used By" workloads section
- [x] Hierarchical naming (server/tool format)
- [x] Validation for broken server references

### ✅ Phase 4: Manage MCP Workloads (User Story 3)
- [x] Browse MCP workloads with tool dependencies
- [x] Workload detail pages with deployment info
- [x] Tools grouped by server (expandable sections)
- [x] Dependency tree view (hierarchical visualization)
- [x] Filter workloads by tool
- [x] Validation for broken tool references

### ✅ Phase 5: GitHub Catalog Integration (User Story 4)
- [x] Documentation for GitHub repository configuration
- [x] Branch and PAT setup instructions
- [x] Source of truth behavior (GitHub overwrites Backstage)
- [x] Automatic sync and retry mechanisms

### 📋 Phase 6: Polish & Production Readiness
- [ ] Unit tests for all components
- [ ] Integration tests (Cypress)
- [ ] Loading states and error boundaries
- [ ] Breadcrumb navigation
- [ ] Accessibility improvements (ARIA labels, keyboard nav)

### 🔮 Future Enhancements
- [ ] Real-time MCP server health monitoring
- [ ] Automatic MCP server discovery
- [ ] Advanced dependency visualization
- [ ] Workflow orchestration integration
- [ ] Performance metrics and analytics

## 📝 TODO

### Authentication Support

**Current State**: The OpenShift console plugin communicates with the Backstage catalog API through the console's built-in proxy. Currently, authentication is disabled on the Backstage backend using `dangerouslyDisableDefaultAuthPolicy: true` in `app-config.production.yaml`. This is a **development/testing workaround** and is **not suitable for production**.

**What Needs to Be Implemented**:
1. **Service-to-service authentication**: Configure a static token or service account that the console plugin proxy can use to authenticate with the Backstage backend.
2. **Token injection in proxy config**: Update the Helm chart's `ConsolePlugin` proxy configuration to include an `Authorization` header with a bearer token.
3. **Backstage backend token validation**: Configure Backstage to accept and validate the service token for catalog API requests.

**Possible Approaches**:
- **Static backend token**: Generate a `BACKEND_SECRET` in Backstage and configure the console plugin proxy to send it as a bearer token.
- **Kubernetes service account**: Use OpenShift's built-in service account tokens with Backstage's Kubernetes auth provider.
- **OAuth/OIDC integration**: Integrate with OpenShift's OAuth server for user-based authentication (more complex, supports per-user permissions).

**References**:
- [Backstage Auth Documentation](https://backstage.io/docs/auth/)
- [Backstage Backend-to-Backend Auth](https://backstage.io/docs/auth/service-to-service-auth)
- [OpenShift Console Plugin Proxy](https://docs.openshift.com/container-platform/latest/web_console/dynamic-plugin-development.html)

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Follow** our coding standards and add tests
4. **Run** linting: `yarn lint`
5. **Submit** a pull request

### Coding Standards

- TypeScript-first with `tsconfig.json` enforcing `strict: true` (no new JavaScript entry points); use `npx tsc --noEmit` at the root and `npx tsc --noEmit -p tsconfig.check.json` inside `plugins/mcp-tools-catalog`
- ESLint + Prettier for formatting
- Jest for unit testing
- Cypress for integration testing
- Python automation/tooling must include type hints and pass `mypy --strict`
- Backstage conventions for plugin development

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Entity not appearing | Check YAML syntax, verify entity processor registration |
| Broken relationships | Validate EntityRef format, ensure target entities exist |
| Plugin not loading | Verify imports in App.tsx, check browser console |
| API errors | Check authentication, validate request format |

### Debug Mode

```yaml
# Enable debug logging
backend:
  logger:
    level: debug
```

### Support Resources

- 📖 [Backstage Documentation](https://backstage.io/docs)
- 🔗 [MCP Protocol Spec](https://spec.modelcontextprotocol.io/)
- 🐛 [Issue Tracker](https://github.com/your-org/mcp-tools-catalog/issues)
- 💬 [Discussions](https://github.com/your-org/mcp-tools-catalog/discussions)

## 📄 License

Apache 2.0 - See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Backstage](https://backstage.io/) for the amazing developer portal platform
- [Model Context Protocol](https://modelcontextprotocol.io/) for the AI tooling standard
- [OpenShift](https://openshift.com/) for enterprise Kubernetes platform
- The open source community for continuous inspiration

---

**Ready to explore your MCP infrastructure?** 🚀 [Get started with the quickstart guide!](specs/001-mcp-tools-catalog/quickstart.md)
