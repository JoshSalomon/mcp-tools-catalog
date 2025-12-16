# Quick Start: MCP Tools Catalog

**Feature**: MCP Tools Catalog for Backstage  
**Target**: Platform Engineers, Developers, Architects  
**Time**: 15-30 minutes

## Overview

This guide helps you get started with the MCP Tools Catalog plugin for Backstage. You'll learn how to register MCP servers, tools, and workloads in the catalog, and navigate the relationships between them.

## Prerequisites

- Backstage instance with MCP Tools Catalog plugin installed
- Access to Backstage catalog with appropriate permissions
- Basic understanding of MCP (Model Context Protocol) concepts
- YAML editing capability for entity definitions

## Quick Path: GitHub-Based Catalog (Recommended)

For production environments, store your MCP entity definitions in a GitHub repository for version control and automated sync.

### Step A: Configure GitHub Integration

1. **Create a GitHub Personal Access Token** with `repo` scope
2. **Set up Backstage configuration** in `app-config.yaml`:

```yaml
integrations:
  github:
    - host: github.com
      token: ${GITHUB_TOKEN}

catalog:
  locations:
    - type: url
      target: https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/catalog/**/*.yaml
```

3. **Configure environment variables**:

```bash
# For OpenShift deployments
oc create secret generic backstage-github-token \
  --from-literal=GITHUB_TOKEN=ghp_your_token_here \
  -n backstage

oc create configmap backstage-github-config \
  --from-literal=GITHUB_ORG=your-org \
  --from-literal=GITHUB_REPO=mcp-entities \
  --from-literal=GITHUB_BRANCH=main \
  -n backstage
```

### Step B: Organize Your Repository

Create this structure in your GitHub repository:

```
mcp-entities/
├── catalog/
│   ├── catalog-info.yaml    # Root location file
│   ├── servers/
│   │   └── github-server.yaml
│   ├── tools/
│   │   └── github-tools.yaml
│   └── workloads/
│       └── project-setup.yaml
```

**catalog/catalog-info.yaml** (aggregates all entities):
```yaml
apiVersion: backstage.io/v1alpha1
kind: Location
metadata:
  name: mcp-catalog-root
spec:
  targets:
    - ./servers/*.yaml
    - ./tools/*.yaml
    - ./workloads/*.yaml
```

### Step C: Push and Verify

```bash
git add catalog/
git commit -m "Add MCP catalog entities"
git push origin main

# Wait 5 minutes for sync, then verify
curl -k "https://backstage.example.com/api/catalog/entities?filter=kind=component"
```

**Benefits of GitHub Integration:**
- Version control for all entity definitions
- Pull request workflow for catalog changes
- Automatic sync (default: every 5 minutes)
- GitHub as single source of truth
- Automatic retry on failures with exponential backoff

For detailed configuration options, see [DEPLOYMENT.md](../../DEPLOYMENT.md#-configure-github-catalog-integration).

---

## Manual Path: Direct Registration

If you prefer to register entities manually for testing, follow the steps below.

## Step 1: Understanding MCP Entities

The MCP Tools Catalog uses **standard Backstage Component entities** with custom `spec.type` values:

| spec.type Value | Purpose | Example |
|-----------------|---------|---------|
| `mcp-server` | AI capability providers | GitHub API server, File system server |
| `mcp-tool` | Individual AI functions | create-issue, read-file, analyze-text |
| `service` / `workflow` / `mcp-workload` | Composed workflows | Project setup automation, Content pipeline |

**Key Relationship**: Tools use `spec.subcomponentOf` to link to their parent server. Backstage automatically generates `partOf`/`hasPart` relations.

## Step 2: Register Your First MCP Server

Create a new entity file `mcp-server-github.yaml`:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: github-integration-server
  namespace: default
  description: "MCP server for GitHub API operations"
  labels:
    mcp-catalog.io/type: server
    mcp-catalog.io/category: api-integration
  annotations:
    mcp-catalog.io/version: "1.0.0"
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

**Register in Backstage:**
1. Push the YAML to your GitHub catalog repository
2. Wait for Backstage to sync (or trigger manual refresh)
3. Verify the server appears in the MCP Catalog → Servers tab

## Step 3: Add MCP Tools

Create `mcp-tools-github.yaml` with tools provided by your server:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: create-issue
  namespace: default
  description: "Create GitHub issues with title, body, and labels"
  labels:
    mcp-catalog.io/type: tool
    mcp-catalog.io/server: github-integration-server
spec:
  type: mcp-tool
  lifecycle: production
  owner: platform-team
  # subcomponentOf creates the tool-to-server relationship
  subcomponentOf: component:default/github-integration-server
  mcp:
    toolType: api-call
    inputSchema:
      type: object
      properties:
        title: 
          type: string
          description: "Issue title"
        body:
          type: string 
          description: "Issue description"
        labels:
          type: array
          items:
            type: string
          description: "Issue labels"
      required:
        - title
    capabilities:
      - create
      - github-api
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: search-repositories
  namespace: default
  description: "Search GitHub repositories by keyword"
  labels:
    mcp-catalog.io/type: tool
    mcp-catalog.io/server: github-integration-server
spec:
  type: mcp-tool
  lifecycle: production
  owner: platform-team
  subcomponentOf: component:default/github-integration-server
  mcp:
    toolType: query
    inputSchema:
      type: object
      properties:
        query:
          type: string
          description: "Search query"
        language:
          type: string
          description: "Programming language filter"
      required:
        - query
    capabilities:
      - search
      - github-api
```

**Register the tools:**
1. Push to your GitHub catalog repository
2. After sync, verify tools appear in the MCP Catalog → Tools tab
3. Check that clicking on a tool shows the parent server relationship
4. Verify the server detail page shows these tools in its "Provided Tools" section

## Step 4: Create an MCP Workload

Create `mcp-workload-project-setup.yaml` that uses your tools:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: new-project-setup
  namespace: default
  description: "Automated new project initialization workflow"
  labels:
    mcp-catalog.io/type: workload
    mcp-catalog.io/category: automation
spec:
  type: workflow
  lifecycle: production
  owner: platform-team
  system: automation-platform
  # dependsOn creates workload-to-tool relationships
  dependsOn:
    - component:default/create-issue
    - component:default/search-repositories
  mcp:
    purpose: "Streamline new project creation with automated repository setup and initial issues"
    tools:
      - component:default/create-issue
      - component:default/search-repositories
    deployment:
      type: kubernetes
      schedule: on-demand
      runtime: nodejs
      environment: development
```

**Register the workload:**
1. Push to your GitHub catalog repository
2. Navigate to MCP Catalog → Workloads tab
3. Click on the workload to see:
   - Tools grouped by server (expandable sections)
   - Dependency tree view
   - Links to individual tool pages

## Step 5: Navigate Entity Relationships

### From MCP Server to Tools
1. Go to your MCP Server page (`github-integration-server`)
2. Look for "Tools" section or tab
3. See all tools provided by this server
4. Click on any tool to view its details

### From Tool to Server and Workloads
1. Go to any MCP Tool page (e.g., `create-issue`)
2. See "Server" section showing the parent server
3. See "Used By" section showing workloads that reference this tool
4. Use breadcrumb navigation to explore relationships

### From Workload to Tools
1. Go to your MCP Workload page (`new-project-setup`)
2. See "Tools" section listing all referenced tools
3. Click on tool names to navigate to tool details
4. Use the dependency visualization (if available)

## Step 6: Search and Filter

### Basic Searching
```
# Find all MCP servers
Filter by: kind=Component,spec.type=mcp-server

# Find tools for specific server (via relations)
Filter by: kind=Component,spec.type=mcp-tool,relations.partOf=component:default/github-integration-server

# Find workloads
Filter by: kind=Component,spec.type=service
# or
Filter by: kind=Component,metadata.labels['mcp-catalog.io/type']=workload
```

### Using MCP Catalog UI
1. Navigate to MCP Catalog in the OpenShift Console
2. Use the **Servers**, **Tools**, **Workloads** tabs to filter by type
3. Use the search box to filter by name/description
4. On Tools tab, use the "Server" dropdown to filter tools by parent server
5. On Workloads tab, use the "Tool" dropdown to filter workloads by referenced tool

## Step 7: Managing Tool-Workload Relationships

### Add Tool to Existing Workload
If you have the MCP Tools Catalog UI (FR-011):

1. Navigate to your workload
2. Look for "Manage Tools" or "Edit Tools" button
3. Search for available tools
4. Add tools using the relationship management interface
5. Save changes and verify relationships update

### Remove Tool from Workload
1. Navigate to workload details
2. Find the tool in the tools list
3. Use "Remove" or "Unlink" action
4. Confirm removal and verify update

## Common Patterns

### Pattern 1: Server → Multiple Tools → Workload
```
GitHub Server
├── create-issue (tool)
├── search-repos (tool)  
└── create-repo (tool)
         ↓
    Project Setup (workload)
```

### Pattern 2: Multi-Server Workload
```
File System Server → create-directory (tool) ┐
GitHub Server → create-repo (tool)           ├→ Complex Workload
Database Server → init-schema (tool)         ┘
```

### Pattern 3: Tool Reuse Across Workloads
```
create-issue (tool)
├→ Bug Triage (workload)
├→ Feature Planning (workload)
└→ Support Automation (workload)
```

## Troubleshooting

### Missing Relationships
- **Issue**: Tool doesn't show parent server
- **Solution**: Check that `spec.subcomponentOf` uses correct EntityRef format: `component:namespace/servername`

### Broken Tool References
- **Issue**: Workload shows "tool not found" 
- **Solution**: Verify tool exists and `spec.dependsOn` uses correct format: `component:namespace/toolname`

### Server Not Showing Tools
- **Issue**: Server page doesn't list provided tools
- **Solution**: Ensure tools have `subcomponentOf: component:namespace/servername` and Backstage has synced. Check that the `partOf`/`hasPart` relations appear in the entity's relations array.

### Entity Not Appearing
- **Issue**: Entity doesn't show up in catalog
- **Solution**: Check YAML syntax, required fields (`kind: Component`, `spec.type`, `spec.lifecycle`, `spec.owner`), and wait for GitHub sync

### Relations Not Generated
- **Issue**: Tool has `subcomponentOf` but no `partOf` relation appears
- **Solution**: Backstage generates relations during processing. Restart Backstage or wait for the next catalog refresh cycle. Verify the target entity exists.

## Next Steps

1. **Explore Dependency Visualization**: Use Backstage's graph view to see entity relationships
2. **Set Up Automation**: Configure external tooling to update MCP entities automatically  
3. **Add Documentation**: Link to external documentation using entity annotations
4. **Integrate with CI/CD**: Use entity metadata to trigger deployment workflows
5. **Monitor Usage**: Track which tools and workloads are most utilized

## Getting Help

- **Backstage Docs**: [backstage.io/docs](https://backstage.io/docs)
- **MCP Protocol**: Official MCP specification documentation
- **Schema Reference**: See [entity-schemas.yaml](./contracts/entity-schemas.yaml) for detailed field definitions
- **API Reference**: See [catalog-api.yaml](./contracts/catalog-api.yaml) for programmatic access

## Example Repository

For complete working examples, see the integration test fixtures which demonstrate:
- Complex multi-server setups
- Advanced workload compositions  
- Proper relationship management
- Error handling scenarios