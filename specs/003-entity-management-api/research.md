# Research: Entity Management API

**Feature**: 003-entity-management-api
**Date**: 2025-12-18

## Research Topics

### 1. OCP RBAC Integration with Backstage

**Decision**: Use OpenShift TokenReview API to validate user tokens and SubjectAccessReview to check role bindings.

**Rationale**:
- Standard Kubernetes/OpenShift pattern for RBAC validation
- No custom authentication infrastructure needed
- Works with any OCP cluster (vanilla, per constitution)
- Backstage backend can proxy requests with user tokens from console

**Alternatives Considered**:
- **Custom JWT validation**: Rejected - would duplicate OCP's auth infrastructure
- **Backstage permission framework only**: Rejected - doesn't integrate with OCP roles natively
- **Service account impersonation**: Rejected - less secure, harder to audit

**Implementation Pattern**:
```typescript
// Pseudocode for OCP RBAC check
async function checkOCPRole(token: string, role: string): Promise<boolean> {
  const review = await k8sApi.createSubjectAccessReview({
    spec: {
      user: tokenUser,
      groups: tokenGroups,
      resourceAttributes: {
        group: 'mcp-catalog.io',
        resource: 'mcpservers', // or mcptools, mcpworkloads
        verb: 'create' // or update, delete
      }
    }
  });
  return review.status.allowed;
}
```

### 2. Backstage Catalog Write API

**Decision**: Use `@backstage/plugin-catalog-node` CatalogClient for entity mutations.

**Rationale**:
- Official Backstage API for catalog operations
- Handles database transactions, validation, and indexing
- Maintains consistency with catalog's internal state
- Triggers catalog processors and event subscribers

**Alternatives Considered**:
- **Direct database access**: Rejected - bypasses catalog validation, breaks catalog integrity
- **Catalog REST API from frontend**: Rejected - no RBAC enforcement layer
- **Custom entity store**: Rejected - violates constitution principle VI

**Key APIs**:
- `catalogClient.addEntity(entity)` - Create
- `catalogClient.refreshEntity(entityRef)` - Trigger re-processing
- `catalogClient.removeEntityByUid(uid)` - Delete
- For updates: Delete + Add (atomic via transaction)

### 3. Entity Schema Validation

**Decision**: Use JSON Schema validation with `ajv` library against existing entity schemas.

**Rationale**:
- Existing schemas in `specs/001-mcp-tools-catalog/contracts/entity-schemas.yaml`
- AJV is fast, well-maintained, and supports OpenAPI 3.0 schemas
- Validation happens before catalog write to provide clear error messages

**Alternatives Considered**:
- **Backstage built-in validation only**: Rejected - doesn't cover MCP-specific constraints
- **Zod schemas**: Considered - would require schema duplication; OpenAPI already exists
- **No validation (trust catalog)**: Rejected - poor error messages, delayed failures

### 4. Cascade Delete Implementation

**Decision**: Query catalog for child entities and delete in reverse dependency order within a transaction.

**Rationale**:
- Backstage catalog tracks relationships via `relations[]`
- Query: `GET /entities?filter=relations.partOf=component:ns/server-name`
- Delete tools first, then server (prevents orphan references during deletion)

**Alternatives Considered**:
- **Database cascade constraints**: Rejected - Backstage catalog abstracts database
- **Async cleanup job**: Rejected - leaves inconsistent state temporarily
- **Block delete if children exist**: Rejected by spec clarification

### 5. API Endpoint Structure

**Decision**: RESTful endpoints under `/api/mcp-entities/v1/` with entity-type resources.

**Rationale**:
- Follows REST conventions for resource management
- Version prefix enables future API evolution
- Entity type in path enables per-type RBAC easily

**Endpoint Design**:
```
POST   /api/mcp-entities/v1/servers          # Create server
GET    /api/mcp-entities/v1/servers          # List servers
GET    /api/mcp-entities/v1/servers/:name    # Get server
PUT    /api/mcp-entities/v1/servers/:name    # Update server
DELETE /api/mcp-entities/v1/servers/:name    # Delete server (cascade)

POST   /api/mcp-entities/v1/tools            # Create tool
GET    /api/mcp-entities/v1/tools            # List tools
GET    /api/mcp-entities/v1/tools/:name      # Get tool
PUT    /api/mcp-entities/v1/tools/:name      # Update tool
DELETE /api/mcp-entities/v1/tools/:name      # Delete tool (orphan dependents)

POST   /api/mcp-entities/v1/workloads        # Create workload
GET    /api/mcp-entities/v1/workloads        # List workloads
GET    /api/mcp-entities/v1/workloads/:name  # Get workload
PUT    /api/mcp-entities/v1/workloads/:name  # Update workload
DELETE /api/mcp-entities/v1/workloads/:name  # Delete workload (orphan)
```

### 6. Error Response Format

**Decision**: Standard HTTP status codes with JSON error body containing `error`, `message`, and optional `details`.

**Rationale**:
- Per spec clarification: "Standard HTTP Status Codes (4xx/5xx) + JSON Error Object"
- Consistent with Backstage error patterns
- Machine-readable error codes for frontend handling

**Error Schema**:
```json
{
  "error": "ValidationError",
  "message": "Entity failed schema validation",
  "details": {
    "path": "/spec/version",
    "expected": "string matching semver pattern",
    "received": "1.0"
  }
}
```

## Unresolved Items

None - all technical decisions resolved.

## References

- [Backstage Catalog Backend](https://backstage.io/docs/features/software-catalog/software-catalog-overview)
- [OpenShift SubjectAccessReview](https://docs.openshift.com/container-platform/latest/authentication/using-rbac.html)
- [AJV JSON Schema Validator](https://ajv.js.org/)
