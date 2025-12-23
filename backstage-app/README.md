# MCP Tools Catalog - Backstage Backend

This Backstage application provides the backend services for the MCP Tools Catalog, including the MCP Entity Management API.

## Quick Start

```sh
yarn install
yarn start
```

## MCP Entity Management API

The MCP Entity Management API provides RESTful endpoints for managing MCP entities (Servers, Tools, Workloads) with OCP role-based access control.

**Base Path**: `/api/mcp-entity-api`

### Authentication

Write operations (POST, PUT, DELETE) require OCP bearer token authentication:

```bash
curl -H "Authorization: Bearer $OCP_TOKEN" ...
```

Read operations (GET) are public and do not require authentication.

### Role Requirements

| Entity Type | Required Role | Operations |
|-------------|---------------|------------|
| MCP Server | `mcp-admin` | Create, Update, Delete |
| MCP Tool | `mcp-admin` | Create, Update, Delete |
| MCP Workload | `mcp-user` | Create, Update, Delete |

### Endpoints

#### Health Check

```
GET /api/mcp-entity-api/health
```

Returns API health status.

---

#### Servers

**List Servers**
```bash
GET /api/mcp-entity-api/servers
GET /api/mcp-entity-api/servers?namespace=default&limit=10
```

**Get Server**
```bash
GET /api/mcp-entity-api/servers/{namespace}/{name}
```

**Create Server** (requires `mcp-admin`)
```bash
POST /api/mcp-entity-api/servers
Content-Type: application/json

{
  "metadata": {
    "name": "my-server",
    "namespace": "default",
    "title": "My MCP Server"
  },
  "spec": {
    "lifecycle": "experimental",
    "owner": "user:default/admin",
    "mcp": {
      "connectionType": "stdio",
      "command": "node server.js",
      "version": "1.0.0"
    }
  }
}
```

**Update Server** (requires `mcp-admin`)
```bash
PUT /api/mcp-entity-api/servers/{namespace}/{name}
```

**Delete Server** (requires `mcp-admin`)
```bash
DELETE /api/mcp-entity-api/servers/{namespace}/{name}
```
> **Note**: Deleting a server cascades to delete all associated tools (FR-007).

---

#### Tools

**List Tools**
```bash
GET /api/mcp-entity-api/tools
GET /api/mcp-entity-api/tools?server=my-server
```

**Get Tool**
```bash
GET /api/mcp-entity-api/tools/{namespace}/{name}
```

**Create Tool** (requires `mcp-admin`)
```bash
POST /api/mcp-entity-api/tools
Content-Type: application/json

{
  "metadata": {
    "name": "my-tool",
    "namespace": "default"
  },
  "spec": {
    "lifecycle": "experimental",
    "owner": "user:default/admin",
    "subcomponentOf": "component:default/my-server"
  }
}
```

**Update Tool** (requires `mcp-admin`)
```bash
PUT /api/mcp-entity-api/tools/{namespace}/{name}
```

**Delete Tool** (requires `mcp-admin`)
```bash
DELETE /api/mcp-entity-api/tools/{namespace}/{name}
```
> **Note**: Deleting a tool orphans workload references (FR-008).

---

#### Workloads

**List Workloads**
```bash
GET /api/mcp-entity-api/workloads
```

**Get Workload**
```bash
GET /api/mcp-entity-api/workloads/{namespace}/{name}
```

**Create Workload** (requires `mcp-user`)
```bash
POST /api/mcp-entity-api/workloads
Content-Type: application/json

{
  "metadata": {
    "name": "my-workload",
    "namespace": "default"
  },
  "spec": {
    "lifecycle": "experimental",
    "owner": "user:default/admin",
    "dependsOn": ["component:default/my-tool"]
  }
}
```

**Update Workload** (requires `mcp-user`)
```bash
PUT /api/mcp-entity-api/workloads/{namespace}/{name}
```

**Delete Workload** (requires `mcp-user`)
```bash
DELETE /api/mcp-entity-api/workloads/{namespace}/{name}
```

---

### Error Responses

All errors return a JSON object with the following structure:

```json
{
  "error": "ErrorType",
  "message": "Human-readable error description",
  "details": {}
}
```

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | ValidationError | Invalid request body or parameters |
| 401 | Unauthorized | Missing authentication token |
| 403 | Forbidden | User lacks required role |
| 404 | NotFoundError | Entity not found |
| 500 | InternalError | Server error |
| 503 | ServiceUnavailable | OCP auth service unavailable (fail-closed) |

---

### Pagination

List endpoints support pagination via query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Maximum number of results per page |
| `cursor` | string | Opaque cursor for next page |

Response includes pagination metadata:

```json
{
  "items": [...],
  "totalCount": 100,
  "cursor": "next-page-cursor"
}
```

---

### Configuration

Role mappings can be customized in `app-config.yaml`:

```yaml
mcpEntityApi:
  roles:
    server: mcp-admin    # Role for server management
    tool: mcp-admin      # Role for tool management  
    workload: mcp-user   # Role for workload management
```

## Development

```bash
# Run in development mode
yarn start

# Run tests
yarn test

# Type check
yarn tsc --noEmit

# Build for production
yarn build
```

## Database

The application uses SQLite for local development (stored in `./sqlite-data/`) and can be configured for PostgreSQL in production via `app-config.production.yaml`.
