# Data Model: MCP Tools Catalog

**Feature**: MCP Tools Catalog
**Date**: 2025-12-16 (Updated)
**Source**: Extracted from [spec.md](./spec.md) and [research.md](./research.md)

## Entity Overview

The MCP Tools Catalog uses standard Backstage `Component` entities with custom `spec.type` values to represent Model Context Protocol infrastructure components. All MCP-specific data is stored in the `spec.mcp` field.

**IMPORTANT**: These are NOT custom entity kinds. All MCP entities are standard Backstage Components with specialized types.

### Entity Types Summary

| Component Type | spec.type Value | Purpose | Key Relationships | Cardinality |
|----------------|-----------------|---------|------------------|-------------|
| MCP Server | `mcp-server` | Represents MCP server instances | Parent of MCP Tools (via `hasPart`) | 1:N with Tools |
| MCP Tool | `mcp-tool` | Individual AI capabilities/functions | Child of Server (via `subcomponentOf`), Referenced by Workloads | N:1 with Server, M:N with Workloads |
| MCP Workload | `service`, `workflow`, or `mcp-workload` | Composed applications using AI tools | Depends on multiple Tool components | M:N with Tools |

## Entity Relationships (Backstage Standard)

The plugin uses standard Backstage relationship patterns:

| Spec Field | Relation Generated | Direction | Use Case |
|------------|-------------------|-----------|----------|
| `spec.subcomponentOf` | `partOf` / `hasPart` | Tool → Server | Tool belongs to Server |
| `spec.dependsOn` | `dependsOn` / `dependencyOf` | Workload → Tool | Workload uses Tool |
| `spec.partOf` | `partOf` / `hasPart` | Component → System | System membership |

### Tool-Server Relationship

Tools declare their parent server using `spec.subcomponentOf`:

```yaml
# Tool entity
spec:
  type: mcp-tool
  subcomponentOf: component:default/my-server  # Creates partOf relation
```

Backstage automatically generates:
- `partOf` relation on the Tool pointing to the Server
- `hasPart` relation on the Server pointing to the Tool

---

## Detailed Entity Specifications

### McpServer Entity

**Purpose**: Represents a Model Context Protocol server instance that provides AI capabilities.

**Backstage Entity Format:**
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-mcp-server
  namespace: default
  description: "MCP server providing AI capabilities"
  labels:
    mcp-catalog.io/type: server
    mcp-catalog.io/category: demo
  annotations:
    mcp-catalog.io/version: "1.0.0"
spec:
  type: mcp-server
  lifecycle: production
  owner: platform-team
  system: ai-infrastructure
  # hasPart relations are auto-generated from tool subcomponentOf references
  mcp:
    serverType: stdio
    endpoint: "docker run -i --rm ghcr.io/example/server:latest"
    version: "1.0.0"
    capabilities:
      - tools
      - resources
```

**TypeScript Interface:**
```typescript
import { Entity } from '@backstage/catalog-model';

export interface CatalogMcpServer extends Entity {
  kind: 'Component';
  spec: {
    type: string;              // 'mcp-server'
    lifecycle: string;
    owner: string;
    system?: string;
    hasPart?: string | string[];  // Auto-generated from subcomponentOf
    mcp?: {
      serverType?: 'stdio' | 'sse' | 'http';
      endpoint?: string;
      version?: string;
      capabilities?: string[];
    };
    [key: string]: any;
  };
}
```

**Field Definitions:**

- **metadata.name**: Globally unique identifier following DNS naming conventions
- **spec.type**: Must be `mcp-server`
- **spec.lifecycle**: Lifecycle stage (e.g., "production", "experimental", "deprecated")
- **spec.owner**: Team or user responsible for the server
- **spec.mcp.serverType**: Connection protocol - one of: `stdio`, `sse`, `http`
- **spec.mcp.endpoint**: Connection endpoint (command for stdio, URL for sse/http)

---

### McpTool Entity

**Purpose**: Represents individual AI capabilities or functions provided by an MCP server.

**Backstage Entity Format:**
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-tool
  namespace: default
  description: "Tool that does something useful"
  labels:
    mcp-catalog.io/type: tool
    mcp-catalog.io/server: my-mcp-server
spec:
  type: mcp-tool
  lifecycle: production
  owner: platform-team
  # subcomponentOf establishes the tool-to-server relationship
  subcomponentOf: component:default/my-mcp-server
  mcp:
    toolType: query
    inputSchema:
      type: object
      properties:
        param1:
          type: string
          description: "Parameter description"
      required:
        - param1
    outputSchema:
      type: object
      properties:
        result:
          type: string
    capabilities:
      - read
```

**TypeScript Interface:**
```typescript
import { Entity } from '@backstage/catalog-model';

export interface CatalogMcpTool extends Entity {
  kind: 'Component';
  spec: {
    type: string;              // 'mcp-tool'
    lifecycle: string;
    owner: string;
    subcomponentOf?: string;   // Parent server reference
    partOf?: string | string[];  // System reference
    mcp?: {
      toolType?: string;
      inputSchema?: Record<string, any>;
      outputSchema?: Record<string, any>;
      capabilities?: string[];
    };
    [key: string]: any;
  };
}
```

**Field Definitions:**

- **metadata.name**: Tool identifier, unique when combined with server
- **spec.type**: Must be `mcp-tool`
- **spec.subcomponentOf**: EntityRef to parent server (e.g., `component:default/my-server`)
- **spec.mcp.toolType**: Tool category (e.g., "query", "mutation", "function")
- **spec.mcp.inputSchema**: JSON Schema for tool input parameters
- **spec.mcp.outputSchema**: JSON Schema for tool output

**Uniqueness Rules:**
- Tools are uniquely identified by the combination `server/toolname` (hierarchical naming)
- Multiple servers can have tools with identical names
- Server reference must exist and be valid

---

### McpWorkload Entity

**Purpose**: Represents composed applications or workflows that utilize multiple MCP tools.

**Backstage Entity Format:**
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-workload
  namespace: default
  description: "Workload that uses MCP tools"
  labels:
    mcp-catalog.io/type: workload
    mcp-catalog.io/category: automation
spec:
  type: service  # or 'workflow' or 'mcp-workload'
  lifecycle: production
  owner: platform-team
  system: ai-platform
  # dependsOn establishes workload-to-tool relationships
  dependsOn:
    - component:default/tool1
    - component:default/tool2
  # Optional: explicit tool list in consumes
  consumes:
    - component:default/tool1
    - component:default/tool2
  mcp:
    purpose: "Description of workload purpose"
    tools:
      - component:default/tool1
      - component:default/tool2
    deployment:
      type: kubernetes
      namespace: my-namespace
      replicas: 2
```

**TypeScript Interface:**
```typescript
import { Entity } from '@backstage/catalog-model';

export interface CatalogMcpWorkload extends Entity {
  kind: 'Component';
  spec: {
    type: string;              // 'service', 'workflow', or 'mcp-workload'
    lifecycle: string;
    owner: string;
    system?: string;
    dependsOn?: string[];      // Tool references
    consumes?: string[];       // Alternative tool references
    mcp?: {
      purpose?: string;
      tools?: string[];
      deployment?: Record<string, any>;
    };
    [key: string]: any;
  };
}
```

**Field Definitions:**

- **metadata.name**: Globally unique workload identifier
- **spec.type**: Workload classification (`service`, `workflow`, or `mcp-workload`)
- **spec.dependsOn**: Array of tool references this workload uses
- **spec.consumes**: Alternative field for tool references (checked as fallback)
- **spec.mcp.tools**: MCP-specific tool list (checked as fallback)
- **spec.mcp.purpose**: Description of workload purpose
- **spec.mcp.deployment**: Deployment configuration details

---

## Relationship Resolution Priority

The plugin resolves relationships using the following priority order:

### Tool → Server (finding parent server)
1. `spec.subcomponentOf` (standard Backstage Component-to-Component)
2. `spec.partOf` (if pointing to Component, not System)
3. `relations[]` array with `type: 'partOf'`
4. `spec.mcp.server` (legacy)
5. `metadata.labels['mcp-catalog.io/server']` (fallback)

### Server → Tools (finding child tools)
1. `relations[]` array with `type: 'hasPart'` (auto-generated)
2. `spec.hasPart` (explicit, not recommended)

### Workload → Tools (finding consumed tools)
1. `spec.dependsOn` array
2. `spec.consumes` array
3. `spec.mcp.tools` array
4. `relations[]` array with `type: 'dependsOn'` or `type: 'consumesApi'`

---

## Example Entity Set

### Server
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: test1
  namespace: default
  description: "Test MCP server"
  labels:
    mcp-catalog.io/type: server
spec:
  type: mcp-server
  lifecycle: experimental
  owner: platform-team
  mcp:
    serverType: stdio
    endpoint: "docker run -i --rm ghcr.io/example/test1-server:latest"
    version: "1.0.0"
    capabilities:
      - tools
      - resources
```

### Tools
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: getinfo
  namespace: default
  description: "Read details from the server"
  labels:
    mcp-catalog.io/type: tool
    mcp-catalog.io/server: test1
spec:
  type: mcp-tool
  lifecycle: experimental
  owner: platform-team
  subcomponentOf: component:default/test1
  mcp:
    toolType: query
    inputSchema:
      type: object
      properties:
        resourceId:
          type: string
      required:
        - resourceId
---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: setinfo
  namespace: default
  description: "Update data on the server"
  labels:
    mcp-catalog.io/type: tool
    mcp-catalog.io/server: test1
spec:
  type: mcp-tool
  lifecycle: experimental
  owner: platform-team
  subcomponentOf: component:default/test1
  mcp:
    toolType: mutation
    inputSchema:
      type: object
      properties:
        resourceId:
          type: string
        payload:
          type: object
      required:
        - resourceId
        - payload
```

### Workload
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: data-sync-service
  namespace: default
  description: "Service that synchronizes data using MCP tools"
  labels:
    mcp-catalog.io/type: workload
spec:
  type: service
  lifecycle: experimental
  owner: platform-team
  system: data-platform
  dependsOn:
    - component:default/getinfo
    - component:default/setinfo
  mcp:
    purpose: "Automated data synchronization"
    tools:
      - component:default/getinfo
      - component:default/setinfo
    deployment:
      type: kubernetes
      replicas: 2
```

---

## Performance Considerations

**Performance Targets:**
- List views load in under 2 seconds
- Detail pages load in under 1 second
- Search results return in under 1 second
- Pagination at 100 items per page

**Optimization Strategies:**
- Client-side filtering after initial entity fetch
- Relation resolution from entity data (no extra API calls)
- Performance monitoring using `usePerformanceMonitor` hook

---

## UI Display Requirements

### Server Detail Screen
- Server properties: name, namespace, type, lifecycle, owner
- MCP-specific: serverType, endpoint, version, capabilities
- Tools list with count, showing: name, type, lifecycle, owner
- Clickable links to tool detail pages

### Tool Detail Screen
- Tool properties: name, namespace, type, lifecycle, owner
- MCP-specific: toolType, inputSchema, outputSchema, capabilities
- Parent server section with clickable link
- Hierarchical name display (server/tool format)
- "Used By" workloads section
- Validation warning for broken server references

### Workload Detail Screen
- Workload properties: name, namespace, type, lifecycle, owner
- MCP-specific: purpose, deployment info
- Tools grouped by parent server (expandable sections)
- Dependency tree view (hierarchical visualization)
- Validation warning for broken tool references
- Clickable links to tools and servers
