# MCP Tools Catalog Plugin

A Backstage plugin for managing Model Context Protocol (MCP) infrastructure including servers, tools, and workloads.

## Overview

The MCP Tools Catalog extends Backstage with three new entity types:
- **MCP Servers**: AI capability providers
- **MCP Tools**: Individual AI functions provided by servers  
- **MCP Workloads**: Composed applications using multiple tools

## Features

- Browse and discover MCP servers in your infrastructure
- Explore MCP tools and their relationships to servers
- Manage MCP workloads and their tool dependencies
- Visualize relationships between servers, tools, and workloads
- Validate entity relationships and references
- Integration with Backstage catalog and authentication

## Installation

### Prerequisites

- Backstage app (version 1.8+)
- Node.js 18+
- TypeScript 4.9+

### Add to Backstage App

1. **Install the plugin package:**
   ```bash
   # From your Backstage app root directory
   yarn add @internal/plugin-mcp-tools-catalog
   ```

2. **Add plugin to your app:**

   In `packages/app/src/App.tsx`:
   ```typescript
   import { mcpToolsCatalogPlugin } from '@internal/plugin-mcp-tools-catalog';

   // Add to your app routes
   <Route path="/mcp-catalog" element={<McpCatalogPage />} />
   ```

3. **Register entity processor (backend):**

   In `packages/backend/src/plugins/catalog.ts`:
   ```typescript
   import { McpEntityProcessor } from '@internal/plugin-mcp-tools-catalog';

   const builder = CatalogBuilder.create(env);
   builder.addProcessor(new McpEntityProcessor());
   ```

4. **Configure the plugin (optional):**

   In `app-config.yaml`:
   ```yaml
   mcpCatalog:
     enabled: true
     processing:
       batchSize: 100
       validationInterval: 30
     ui:
       showRelationshipGraphs: true
       maxEntitiesPerPage: 50
   ```

## Configuration

### Basic Configuration

```yaml
mcpCatalog:
  enabled: true
  processing:
    batchSize: 100              # Entities processed per batch
    validationInterval: 30      # Minutes between relationship validation
    autoFixReferences: false    # Auto-fix broken references
  ui:
    showRelationshipGraphs: true
    maxEntitiesPerPage: 50
    defaultView: 'card'         # 'card' | 'table' | 'graph'
```

### OpenShift Integration

```yaml
mcpCatalog:
  integrations:
    openshift:
      enabled: true
      baseUrl: https://api.openshift.example.com
      namespace: mcp-tools
```

### External Registry Integration

```yaml
mcpCatalog:
  integrations:
    registry:
      enabled: true
      url: https://mcp-registry.example.com
      apiKey: ${MCP_REGISTRY_API_KEY}
```

## Usage

### Registering MCP Entities

#### MCP Server Example

Create `mcp-server-github.yaml`:
```yaml
apiVersion: mcp-catalog.io/v1alpha1
kind: MCPServer
metadata:
  name: github-integration-server
  description: "MCP server for GitHub API operations"
  labels:
    mcp-catalog.io/type: "api-integration"
  annotations:
    mcp-catalog.io/version: "1.0.0"
spec:
  type: stdio
  endpoint: "docker run -i --rm ghcr.io/github/github-mcp-server"
  version: "1.0.0"
  capabilities: ["tools", "resources"]
```

#### MCP Tool Example

Create `mcp-tool-create-issue.yaml`:
```yaml
apiVersion: mcp-catalog.io/v1alpha1
kind: MCPTool
metadata:
  name: create-issue
  description: "Create GitHub issues with title, body, and labels"
  labels:
    mcp-catalog.io/server: "github-integration-server"
    mcp-catalog.io/category: "issue-management"
spec:
  server: "mcpserver:default/github-integration-server"
  type: "api-call"
  inputSchema:
    type: object
    properties:
      title: 
        type: string
        description: "Issue title"
      body:
        type: string 
        description: "Issue description"
    required: ["title"]
  capabilities: ["create", "github-api"]
  parameters: ["title", "body", "labels"]
```

#### MCP Workload Example

Create `mcp-workload-project-setup.yaml`:
```yaml
apiVersion: mcp-catalog.io/v1alpha1
kind: MCPWorkload
metadata:
  name: new-project-setup
  description: "Automated new project initialization workflow"
  labels:
    mcp-catalog.io/category: "automation"
spec:
  type: "workflow"
  purpose: "Streamline new project creation with automated repository setup"
  tools:
    - "mcptool:default/github-integration-server/create-repository"
    - "mcptool:default/github-integration-server/create-issue"
  deploymentInfo:
    schedule: "on-demand"
    runtime: "nodejs"
    environment: "development"
```

### Register Entities in Backstage

1. Navigate to "Create Component" in Backstage UI
2. Select "Register Existing Component"  
3. Upload YAML files or provide Git repository URLs
4. Verify entities appear in the MCP catalog sections

## Development

### Local Development Setup

1. **Clone and setup:**
   ```bash
   git clone <repository-url>
   cd mcp-tools-catalog
   yarn install
   ```

2. **Build the plugin:**
   ```bash
   cd plugins/mcp-tools-catalog
   yarn build
   ```

3. **Run tests:**
   ```bash
   yarn test
   ```

4. **Start development server:**
   ```bash
   # From Backstage app root
   yarn dev
   ```

### Building for Production

```bash
# Build plugin
cd plugins/mcp-tools-catalog
yarn build

# Package for deployment
yarn pack
```

## Testing

### Unit Tests

```bash
cd plugins/mcp-tools-catalog
yarn test
```

### Integration Tests

The project includes Cypress integration tests:

```bash
# Run integration tests
cd integration-tests
yarn cypress:run

# Open Cypress UI
yarn cypress:open
```

### Test Scenarios

The integration tests cover:
- Entity registration and validation
- Relationship navigation between entities
- Search and filtering functionality
- Error handling for broken references

### Manual Testing

1. **Register test entities:**
   ```bash
   # Use example YAML files from quickstart guide
   kubectl apply -f examples/mcp-entities/
   ```

2. **Verify in Backstage UI:**
   - Navigate to `/mcp-catalog`
   - Browse servers, tools, and workloads
   - Test relationship navigation
   - Verify search and filtering

3. **Test API endpoints:**
   ```bash
   # Health check
   curl http://localhost:7007/api/catalog/mcp/health
   
   # Get server tools
   curl http://localhost:7007/api/catalog/mcp/servers/github-integration-server/tools
   
   # Validate relationships
   curl -X POST http://localhost:7007/api/catalog/mcp/validation
   ```

## Deployment

### OpenShift Deployment

1. **Build container image:**
   ```bash
   docker build -t mcp-tools-catalog:latest .
   ```

2. **Deploy using Helm:**
   ```bash
   helm install mcp-catalog charts/mcp-tools-catalog/ \
     --set image.repository=mcp-tools-catalog \
     --set image.tag=latest
   ```

3. **Configure OpenShift integration:**
   ```yaml
   # In app-config.production.yaml
   mcpCatalog:
     integrations:
       openshift:
         enabled: true
         baseUrl: ${OPENSHIFT_API_URL}
         namespace: ${OPENSHIFT_NAMESPACE}
   ```

### Environment Variables

```bash
# Required for OpenShift integration
OPENSHIFT_API_URL=https://api.openshift.example.com
OPENSHIFT_NAMESPACE=mcp-tools
OPENSHIFT_TOKEN=${OPENSHIFT_SERVICE_ACCOUNT_TOKEN}

# Optional for external registry
MCP_REGISTRY_API_KEY=${MCP_REGISTRY_API_KEY}
```

### Health Checks

The plugin provides health endpoints for container orchestration:

```yaml
# In deployment.yaml
livenessProbe:
  httpGet:
    path: /api/catalog/mcp/health
    port: 7007
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/catalog/mcp/health
    port: 7007
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Troubleshooting

### Common Issues

#### Entity Not Appearing in Catalog

**Problem:** MCP entity doesn't show up after registration

**Solutions:**
1. Check YAML syntax and required fields
2. Verify entity processor is registered in backend
3. Check Backstage logs for validation errors
4. Ensure correct apiVersion: `mcp-catalog.io/v1alpha1`

#### Broken Relationship References

**Problem:** Tools show "server not found" or workloads show "tool not found"

**Solutions:**
1. Verify EntityRef format: `mcpserver:namespace/name`
2. Ensure referenced entities exist in catalog
3. Run validation endpoint: `POST /api/catalog/mcp/validation`
4. Check for typos in entity names

#### Plugin Not Loading

**Problem:** MCP plugin doesn't appear in Backstage

**Solutions:**
1. Verify plugin is added to `packages/app/package.json`
2. Check plugin import in `App.tsx`
3. Ensure entity processor is registered in backend
4. Check browser console for JavaScript errors

### Debug Mode

Enable debug logging:

```yaml
# In app-config.yaml
backend:
  logger:
    level: debug
    format: json
```

### Validation Tools

```bash
# Validate all MCP entities
curl -X POST http://localhost:7007/api/catalog/mcp/validation

# Check specific entity
curl http://localhost:7007/api/catalog/entities/by-name/mcpserver/default/github-integration-server
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following TypeScript and Backstage conventions
4. Add tests for new functionality
5. Run linting: `yarn lint`
6. Submit a pull request

## License

Apache 2.0 - See LICENSE file for details

## Support

- [Backstage Documentation](https://backstage.io/docs)
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Issue Tracker](https://github.com/your-org/mcp-tools-catalog/issues)