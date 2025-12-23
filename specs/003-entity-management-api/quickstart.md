# Quickstart: Entity Management API

**Feature**: 003-entity-management-api
**Date**: 2025-12-18

## Overview

This guide shows how to use the MCP Entity Management API to create, read, update, and delete MCP entities (Servers, Tools, Workloads).

## Prerequisites

1. Backstage backend running with the MCP Entity API plugin
2. Valid OCP authentication token
3. Appropriate role for write operations:
   - `mcp-admin`: Required for Servers and Tools
   - `mcp-user`: Required for Workloads
   - Any authenticated user can READ all entities

## API Base URL

```
/api/mcp-entities/v1
```

## Authentication

Include your OCP bearer token in all requests:

```bash
curl -H "Authorization: Bearer $OCP_TOKEN" ...
```

## Examples

### Create an MCP Server

```bash
curl -X POST /api/mcp-entities/v1/servers \
  -H "Authorization: Bearer $OCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "name": "github-mcp-server",
      "title": "GitHub MCP Server",
      "description": "Provides GitHub API tools"
    },
    "spec": {
      "lifecycle": "production",
      "owner": "user:default/jsmith",
      "mcp": {
        "connectionType": "stdio",
        "command": "npx",
        "version": "1.0.0",
        "capabilities": ["tools"]
      }
    }
  }'
```

**Response** (201 Created):
```json
{
  "apiVersion": "backstage.io/v1alpha1",
  "kind": "Component",
  "metadata": {
    "name": "github-mcp-server",
    "namespace": "default",
    "title": "GitHub MCP Server",
    "description": "Provides GitHub API tools"
  },
  "spec": {
    "type": "mcp-server",
    "lifecycle": "production",
    "owner": "user:default/jsmith",
    "mcp": {
      "connectionType": "stdio",
      "command": "npx",
      "version": "1.0.0",
      "capabilities": ["tools"]
    }
  }
}
```

### Create an MCP Tool

```bash
curl -X POST /api/mcp-entities/v1/tools \
  -H "Authorization: Bearer $OCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "name": "create-issue",
      "title": "Create GitHub Issue",
      "description": "Creates a new issue in a GitHub repository"
    },
    "spec": {
      "lifecycle": "production",
      "owner": "user:default/jsmith",
      "subcomponentOf": "component:default/github-mcp-server",
      "mcp": {
        "category": "issue-management",
        "parameters": ["repo", "title", "body"]
      }
    }
  }'
```

### Create an MCP Workload

```bash
curl -X POST /api/mcp-entities/v1/workloads \
  -H "Authorization: Bearer $OCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "name": "bug-triage-workflow",
      "title": "Bug Triage Workflow",
      "description": "Automated bug triage using GitHub tools"
    },
    "spec": {
      "lifecycle": "production",
      "owner": "user:default/jsmith",
      "dependsOn": [
        "component:default/create-issue",
        "component:default/list-issues"
      ],
      "mcp": {
        "purpose": "Automate bug triage process",
        "schedule": "daily"
      }
    }
  }'
```

### List Entities

```bash
# List all servers
curl /api/mcp-entities/v1/servers \
  -H "Authorization: Bearer $OCP_TOKEN"

# List tools for a specific server
curl "/api/mcp-entities/v1/tools?server=component:default/github-mcp-server" \
  -H "Authorization: Bearer $OCP_TOKEN"

# List workloads with pagination
curl "/api/mcp-entities/v1/workloads?limit=10&cursor=abc123" \
  -H "Authorization: Bearer $OCP_TOKEN"
```

### Get a Specific Entity

```bash
curl /api/mcp-entities/v1/servers/default/github-mcp-server \
  -H "Authorization: Bearer $OCP_TOKEN"
```

### Update an Entity

```bash
curl -X PUT /api/mcp-entities/v1/servers/default/github-mcp-server \
  -H "Authorization: Bearer $OCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "name": "github-mcp-server",
      "title": "GitHub MCP Server (Updated)",
      "description": "Updated description"
    },
    "spec": {
      "lifecycle": "production",
      "owner": "user:default/jsmith",
      "mcp": {
        "connectionType": "stdio",
        "command": "npx",
        "version": "1.1.0",
        "capabilities": ["tools", "resources"]
      }
    }
  }'
```

### Delete an Entity

```bash
# Delete a server (cascades to all its tools)
curl -X DELETE /api/mcp-entities/v1/servers/default/github-mcp-server \
  -H "Authorization: Bearer $OCP_TOKEN"

# Delete a tool (workload dependencies become dangling)
curl -X DELETE /api/mcp-entities/v1/tools/default/create-issue \
  -H "Authorization: Bearer $OCP_TOKEN"

# Delete a workload
curl -X DELETE /api/mcp-entities/v1/workloads/default/bug-triage-workflow \
  -H "Authorization: Bearer $OCP_TOKEN"
```

## Error Handling

### 400 Bad Request - Validation Error

```json
{
  "error": "ValidationError",
  "message": "Entity failed schema validation",
  "details": {
    "path": "/spec/mcp/version",
    "expected": "string matching semver pattern",
    "received": "1.0"
  }
}
```

### 403 Forbidden - Insufficient Permissions

```json
{
  "error": "ForbiddenError",
  "message": "User lacks required role 'mcp-admin' for this operation"
}
```

### 404 Not Found

```json
{
  "error": "NotFoundError",
  "message": "Entity 'component:default/my-server' not found"
}
```

### 409 Conflict - Entity Already Exists

```json
{
  "error": "ConflictError",
  "message": "Entity 'component:default/my-server' already exists"
}
```

## Role Requirements Summary

| Operation | Servers | Tools | Workloads |
|-----------|---------|-------|-----------|
| READ (GET/LIST) | Any authenticated | Any authenticated | Any authenticated |
| CREATE | mcp-admin | mcp-admin | mcp-user |
| UPDATE | mcp-admin | mcp-admin | mcp-user |
| DELETE | mcp-admin | mcp-admin | mcp-user |

## Next Steps

1. Review the full [OpenAPI specification](./contracts/entity-management-api.yaml)
2. Set up OCP roles: `mcp-admin` and `mcp-user`
3. Configure the Backstage backend plugin
