# Data Model: MCP Tools Catalog

**Feature**: MCP Tools Catalog
**Date**: 2025-12-11 (Updated from 2025-11-24)
**Source**: Extracted from [spec.md](./spec.md) and [research.md](./research.md)

## Entity Overview

The MCP Tools Catalog extends Backstage with three Component subtypes representing Model Context Protocol infrastructure components. All entities use the standard Backstage `Component` kind with custom `spec.type` values and MCP-specific data in the `spec.mcp` field.

**IMPORTANT**: These are NOT custom entity kinds. All MCP entities are standard Backstage Components with specialized types.

### Entity Types Summary

| Component Type | spec.type Value | Purpose | Key Relationships | Cardinality |
|----------------|-----------------|---------|------------------|-------------|
| MCP Server | `server` | Represents MCP server instances | Parent of MCP Tool components | 1:N with Tools |
| MCP Tool | `tool` | Individual AI capabilities/functions | Part of Server, Referenced by Workloads | N:1 with Server, M:N with Workloads |
| MCP Workload | `workflow` or `service` | Composed applications using AI tools | Depends on multiple Tool components | M:N with Tools |

## Detailed Entity Specifications

### McpServer Entity

**Purpose**: Represents a Model Context Protocol server instance that provides AI capabilities.

**TypeScript Interface:**
```typescript
import { Entity } from '@backstage/catalog-model';

export interface McpServerEntityV1alpha1 extends Entity {
  apiVersion: 'mcp-catalog.openshift.io/v1alpha1';
  kind: 'McpServer';
  metadata: {
    name: string;                    // Globally unique server identifier
    description?: string;            // Human-readable server description
    annotations?: {
      'mcp-catalog.openshift.io/schema-version'?: string;  // MCP schema version
      [key: string]: string | undefined;
    };
    labels?: {
      [key: string]: string;
    };
    tags?: string[];
  };
  spec: {
    type: string;                    // Server type classification
    lifecycle: string;               // Lifecycle stage (production, experimental, etc.)
    owner: string;                   // Owning team/user
    system?: string;                 // System this server belongs to
    transport: {
      type: 'stdio' | 'sse' | 'http';  // Connection protocol
      command?: string;              // Command for stdio type
      args?: string[];               // Arguments for stdio command
      env?: Record<string, string>;  // Environment variables
      url?: string;                  // URL for sse/http types
    };
    providesTools?: string[];        // List of tool names this server provides
  };
}
```

**Field Definitions:**

- **name**: Globally unique identifier following DNS naming conventions
- **type**: Server type classification (e.g., "filesystem", "api-integration")
- **lifecycle**: Lifecycle stage (e.g., "production", "experimental", "deprecated")
- **owner**: Team or user responsible for the server
- **transport.type**: Connection protocol - one of: `stdio`, `sse`, `http`
- **transport.command**: Command string for stdio connections
- **transport.url**: Endpoint URL for sse/http connections
- **providesTools**: Array of tool names (used for relationship tracking)

**Validation Rules:**
- Name must be globally unique across all McpServer entities (FR-001)
- Transport type must be one of the supported connection types
- Either command (for stdio) or url (for sse/http) must be provided
- Owner must be specified

**Example YAML:**
```yaml
apiVersion: mcp-catalog.openshift.io/v1alpha1
kind: McpServer
metadata:
  name: filesystem-mcp-server
  description: "MCP server providing filesystem operations"
  annotations:
    mcp-catalog.openshift.io/schema-version: '2025-09-29'
  tags:
    - filesystem
    - stdio
spec:
  type: stdio
  lifecycle: production
  owner: platform-team
  system: mcp-infrastructure
  transport:
    type: stdio
    command: /usr/bin/mcp-server-fs
    args: ["--root", "/data"]
    env:
      LOG_LEVEL: info
  providesTools:
    - read_file
    - write_file
    - list_directory
```

---

### McpTool Entity

**Purpose**: Represents individual AI capabilities or functions provided by an MCP server.

**TypeScript Interface:**
```typescript
import { Entity } from '@backstage/catalog-model';

export interface McpToolEntityV1alpha1 extends Entity {
  apiVersion: 'mcp-catalog.openshift.io/v1alpha1';
  kind: 'McpTool';
  metadata: {
    name: string;                    // Tool name (unique within server scope)
    description?: string;            // Human-readable tool description
    annotations?: {
      'mcp-catalog.openshift.io/provided-by'?: string;  // Parent server reference
      [key: string]: string | undefined;
    };
    tags?: string[];
  };
  spec: {
    type: string;                    // Tool type/category
    lifecycle: string;               // Lifecycle stage
    owner: string;                   // Owning team/user
    providedBy: string;              // EntityRef to parent McpServer
    inputSchema?: object;            // JSON Schema for tool parameters
  };
}
```

**Field Definitions:**

- **name**: Tool identifier, must be unique when combined with server reference
- **type**: Tool category (e.g., "function", "file-operation", "api-call")
- **lifecycle**: Tool lifecycle stage
- **owner**: Team or user responsible (inherited from server)
- **providedBy**: EntityRef to parent McpServer (e.g., "mcpserver:default/filesystem-mcp-server")
- **inputSchema**: Optional JSON Schema object defining tool input parameters

**Uniqueness Rules:**
- Tools are uniquely identified by the combination `server/toolname` (hierarchical naming - Clarifications 2025-10-26)
- Multiple servers can have tools with identical names
- Server reference must exist and be valid (FR-005)

**Display Requirements (from Clarifications 2025-11-24):**
- Server detail screens show: tool name, description, tool type with clickable links

**Example YAML:**
```yaml
apiVersion: mcp-catalog.openshift.io/v1alpha1
kind: McpTool
metadata:
  name: read-file-tool
  description: "Reads file contents from the filesystem"
  annotations:
    mcp-catalog.openshift.io/provided-by: filesystem-mcp-server
  tags:
    - filesystem
    - read
spec:
  type: function
  lifecycle: production
  owner: platform-team
  providedBy: filesystem-mcp-server
  inputSchema:
    type: object
    properties:
      path:
        type: string
        description: "File path to read"
    required: [path]
```

---

### McpWorkload Entity

**Purpose**: Represents composed applications or workflows that utilize multiple MCP tools.

**TypeScript Interface:**
```typescript
import { Entity } from '@backstage/catalog-model';

export interface McpWorkloadEntityV1alpha1 extends Entity {
  apiVersion: 'mcp-catalog.openshift.io/v1alpha1';
  kind: 'McpWorkload';
  metadata: {
    name: string;                    // Globally unique workload identifier
    description?: string;            // Human-readable workload description
    labels?: {
      'workload-type'?: string;      // Workload type classification
      [key: string]: string;
    };
    tags?: string[];
  };
  spec: {
    type: string;                    // Workload type (e.g., "deployment", "workflow")
    lifecycle: string;               // Lifecycle stage
    owner: string;                   // Owning team/user
    system?: string;                 // System this workload belongs to
    consumesServers?: string[];      // List of McpServer references
    consumesTools?: string[];        // List of McpTool references
  };
}
```

**Field Definitions:**

- **name**: Globally unique workload identifier
- **type**: Workload classification (e.g., "deployment", "batch-job", "ai-agent")
- **lifecycle**: Workload lifecycle stage
- **owner**: Team or user responsible
- **system**: Optional system classification
- **consumesServers**: Array of server names this workload uses
- **consumesTools**: Array of tool names this workload uses

**Relationship Rules:**
- Workloads are peer entities (no hierarchical dependencies - Clarifications 2025-10-26)
- Each tool reference must point to an existing McpTool entity (FR-006)
- Tool references are automatically updated during cascade operations (FR-013)

**Example YAML:**
```yaml
apiVersion: mcp-catalog.openshift.io/v1alpha1
kind: McpWorkload
metadata:
  name: ai-agent-workload
  description: "AI agent using MCP tools for file operations"
  labels:
    workload-type: ai-agent
  tags:
    - ai
    - automation
spec:
  type: deployment
  lifecycle: production
  owner: ai-team
  system: ai-platform
  consumesServers:
    - filesystem-mcp-server
    - database-mcp-server
  consumesTools:
    - read_file
    - write_file
    - query_database
```

---

## Entity Relationships

### Relationship Types

1. **Server → Tool (1:N)**
   - Relationship: `providesTo` (from Server to Tool)
   - Cascade Behavior: Delete tools when server is deleted (FR-012)
   - Validation: Tool `providedBy` references must exist (FR-005)

2. **Tool ← → Workload (M:N)**
   - Relationship: `consumedBy` (bidirectional)
   - Cascade Behavior: Update workload references when tool is deleted (FR-013)
   - Validation: Workload tool references must exist (FR-006)
   - Display: Show bidirectional relationships (FR-004)

3. **Workload ← → Workload (Peer)**
   - Relationship: None (workloads are peer entities)
   - No hierarchical dependencies allowed (Clarifications 2025-10-26)
   - No cascade behavior between workloads

### Cascade Delete Behavior

**When McpServer is deleted (FR-012):**
1. All child McpTool entities are automatically deleted
2. Workload entities are updated to remove references to deleted tools (FR-013)
3. Relationship graph is updated to reflect changes

**When McpTool is deleted:**
1. All McpWorkload entities are updated to remove tool references (FR-013)
2. Empty workloads (no tool references) remain valid

**When McpWorkload is deleted:**
1. No cascade effects on other entities
2. Only relationship records are cleaned up

---

## State Transitions

### McpServer Lifecycle
```
Created → Registered → Active ⟷ Offline → Deleted
```

**Offline Handling (Clarifications 2025-11-24):**
- When server is offline or unreachable, display cached metadata with visual indicator (FR-016)
- Server status is NOT actively checked by this plugin (handled elsewhere)

### McpTool Lifecycle
```
Defined → Validated → Available → Deprecated → Removed
```

### McpWorkload Lifecycle
```
Designed → Configured → Deployed → Active → Retired
```

---

## Validation Rules Summary

1. **Global Uniqueness**: McpServer names and McpWorkload names must be globally unique
2. **Hierarchical Uniqueness**: McpTool names must be unique within their parent server (hierarchical naming: server/tool)
3. **Reference Integrity**: All entity references must point to existing entities (FR-005, FR-006)
4. **Cascade Consistency**: Cascade deletes must maintain referential integrity (FR-012, FR-013)
5. **Schema Compliance**: All entities must conform to their respective JSON schemas
6. **Relationship Limits**: No circular dependencies between workloads (treated as peers)

---

## Performance Considerations (from Clarifications 2025-11-24)

**Performance Targets (SC-005, SC-006):**
- List views load in under 2 seconds
- Detail pages load in under 1 second
- Search results return in under 1 second
- Pagination at 100 items per page (FR-017)

**Optimization Strategies:**
- Field selection for catalog API queries (fetch only needed fields)
- Client-side caching of entity relationships
- Incremental loading for large tool lists on server detail pages
- Search index for text search and relationship filters (FR-008)

**Search and Filtering (FR-008, Clarifications 2025-11-24):**
- Text search by name and description across all entity types
- Relationship filters: tools by server, workloads by tool, servers by tool count
- Entity type filters (McpServer, McpTool, McpWorkload)

---

## Data Access Patterns

### Frontend Plugin Data Access
Since this is an OpenShift Console dynamic plugin (frontend-only), all data access occurs via Backstage catalog API:

```typescript
import { catalogApiRef } from '@backstage/plugin-catalog-react';

// Fetch McpServer entities
const servers = await catalogApi.getEntities({
  filter: { kind: 'McpServer' },
  fields: ['metadata.name', 'spec.type', 'spec.transport']
});

// Fetch tools for a specific server
const tools = await catalogApi.getEntities({
  filter: {
    kind: 'McpTool',
    'spec.providedBy': 'filesystem-mcp-server'
  }
});

// Fetch workloads consuming a specific tool
const workloads = await catalogApi.getEntities({
  filter: {
    kind: 'McpWorkload',
    'spec.consumesTools': 'read_file'
  }
});
```

**No Backend Processor in This Plugin:**
- Entity definitions are registered via YAML files in the Backstage catalog
- Relationship management handled by Backstage catalog backend (existing)
- Plugin consumes entities as read-only data (FR-014)

---

## UI Display Requirements

### Server Detail Screen (User Story 1, FR-002, FR-015)
Display all server properties:
- Name, description, version, connection endpoint
- List of exported tools showing: tool name, description, tool type
- Clickable links to individual tool detail pages

### Tool Detail Screen (User Story 2, FR-003)
- Tool name, description, type, parameters
- Clear indication of parent server
- Clickable link to parent server detail page
- List of workloads that use this tool (bidirectional relationship - FR-004)

### Workload Detail Screen (User Story 3)
- Workload name, description, purpose
- List of associated tools with links to tool details
- Organized by parent server

### Hierarchical Tree View (FR-010, Clarifications 2025-11-24)
- Interactive tree with expandable nodes
- Structure: Workload → Server → Tool
- PatternFly TreeView component implementation
- Clickable nodes navigate to entity detail pages
