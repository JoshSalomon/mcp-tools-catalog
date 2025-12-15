# MCP Tools Catalog CRDs

This directory contains CustomResourceDefinition (CRD) files for the MCP Tools Catalog OpenShift Console plugin.

## CRDs Included

1. **MCPServer** (`mcpserver.crd.yaml`) - Represents MCP server instances
2. **MCPTool** (`mcptool.crd.yaml`) - Represents individual AI tools/functions
3. **MCPWorkload** (`mcpworkload.crd.yaml`) - Represents composed workloads using MCP tools

## Installation

### Quick Install

From the project root:

```bash
./deployment/install-crds.sh
```

### Manual Install

```bash
# Apply all CRDs
oc apply -f deployment/crds/mcpserver.crd.yaml
oc apply -f deployment/crds/mcptool.crd.yaml
oc apply -f deployment/crds/mcpworkload.crd.yaml

# Verify installation
oc get crd | grep mcp-catalog.io
```

## Usage

After installing the CRDs, you can create MCP entities:

```bash
# Create an MCP Server
oc apply -f deployment/github-server.yaml

# Create an MCP Tool (depends on server)
oc apply -f deployment/github-create-issue-tool.yaml

# Create an MCP Workload (depends on tools)
oc apply -f deployment/project-setup-workload.yaml
```

## Entity Reference Format

- **MCPServer references**: `mcpserver:namespace/name`
- **MCPTool references**: `mcptool:namespace/name`

Example:
```yaml
spec:
  server: "mcpserver:default/github-integration-server"
  tools:
    - "mcptool:default/create-issue"
```

## Verification

```bash
# List all MCP Servers
oc get mcpservers -A

# List all MCP Tools
oc get mcptools -A

# List all MCP Workloads
oc get mcpworkloads -A

# Get details of a specific server
oc get mcpserver github-integration-server -n default -o yaml
```

## Troubleshooting

If CRDs fail to install:

1. Check cluster permissions:
   ```bash
   oc auth can-i create crd
   ```

2. Check if CRDs already exist:
   ```bash
   oc get crd mcpservers.mcp-catalog.io
   ```

3. View CRD status:
   ```bash
   oc get crd mcpservers.mcp-catalog.io -o yaml
   ```

4. Check for validation errors:
   ```bash
   oc describe crd mcpservers.mcp-catalog.io
   ```
