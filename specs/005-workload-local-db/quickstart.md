# Quickstart: Workload Entities to Local Database

**Feature Branch**: `005-workload-local-db`
**Date**: 2025-12-30

## Overview

This feature simplifies workload management by making the local database the sole source of truth. No more merge complexity, no more soft delete, and workloads can now be renamed.

## What's Changed

| Before (Catalog + Database) | After (Database Only) |
|----------------------------|----------------------|
| YAML workloads in Backstage Catalog | All workloads in SQLite |
| Database overrides for edits | Database is sole source |
| Soft delete for YAML workloads | Hard delete for all |
| Name is immutable | Name is editable (rename supported) |
| Complex merge logic | Direct CRUD operations |

## User Workflows

### Create a Workload

1. Navigate to **MCP Catalog** → **Workloads** tab
2. Click **Create Workload**
3. Fill in the form:
   - **Name**: Unique identifier (e.g., `my-data-pipeline`)
   - **Namespace**: Leave as `default` or specify
   - **Description**: Optional description
   - **Owner**: Select team or user
   - **Tools**: Expand servers and check tools to include
4. Click **Save**
5. Workload appears immediately in the list

### Edit a Workload

1. Find the workload in the list
2. Click the **⋮** menu → **Edit**
3. Modify any field:
   - **Name**: Can now be changed (rename)
   - **Description**: Update as needed
   - **Tools**: Add or remove tool selections
4. Click **Save**
5. Changes are immediately visible

### Rename a Workload

**New capability** in this feature:

1. Edit the workload
2. Change the **Name** field to a new unique name
3. Click **Save**
4. Workload is accessible under the new name
5. Old name is no longer valid

### Delete a Workload

1. Find the workload in the list
2. Click the **⋮** menu → **Delete**
3. Confirm the deletion
4. Workload is permanently removed
5. **No zombie reappearance** (unlike before)

### Import Workloads from YAML (Optional - P3)

For bulk creation from existing YAML files:

```bash
# Via API (when implemented)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/yaml" \
  --data-binary @workloads.yaml \
  https://<cluster>/api/mcp-entity-api/workloads/import
```

Example YAML format:
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-workload
  namespace: default
  description: Example workload
spec:
  type: mcp-workload
  lifecycle: production
  owner: team:platform
  dependsOn:
    - component:default/github-search-repos
    - component:default/filesystem-read
```

## API Examples

### List Workloads

```bash
curl https://<cluster>/api/mcp-entity-api/workloads
```

Response:
```json
[
  {
    "apiVersion": "backstage.io/v1alpha1",
    "kind": "Component",
    "metadata": {
      "name": "my-workload",
      "namespace": "default"
    },
    "spec": {
      "type": "mcp-workload",
      "dependsOn": ["component:default/github-search-repos"]
    }
  }
]
```

### Create Workload

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  https://<cluster>/api/mcp-entity-api/workloads \
  -d '{
    "metadata": {
      "name": "new-workload",
      "namespace": "default",
      "description": "A new workload"
    },
    "spec": {
      "type": "mcp-workload",
      "lifecycle": "production",
      "owner": "team:platform",
      "dependsOn": ["component:default/github-search-repos"]
    }
  }'
```

### Update Workload (including rename)

```bash
# Rename from "old-name" to "new-name"
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  https://<cluster>/api/mcp-entity-api/workloads/default/old-name \
  -d '{
    "metadata": {
      "name": "new-name",
      "namespace": "default"
    },
    "spec": {
      "type": "mcp-workload",
      "lifecycle": "production",
      "owner": "team:platform",
      "dependsOn": ["component:default/github-search-repos"]
    }
  }'
```

### Delete Workload

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  https://<cluster>/api/mcp-entity-api/workloads/default/my-workload
```

Response: `204 No Content`

## Permissions

| Operation | Required Role |
|-----------|--------------|
| List workloads | None (public) |
| Get workload | None (public) |
| Create workload | `mcp-user` |
| Update workload | `mcp-user` |
| Delete workload | `mcp-user` |
| Import workloads | `mcp-user` |

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| 400 Bad Request | Invalid workload data | Check name format, required fields |
| 403 Forbidden | Missing mcp-user role | Request role from admin |
| 404 Not Found | Workload doesn't exist | Verify namespace and name |
| 409 Conflict | Name already exists | Choose different name |

## Troubleshooting

### Workload not appearing after create

**Before this feature**: Wait for catalog sync (eventual consistency)

**After this feature**: Should appear immediately. If not:
1. Check browser console for errors
2. Verify API response shows success
3. Hard refresh the page (Ctrl+Shift+R)

### "Name already exists" error

The workload name must be unique within the namespace:
1. Choose a different name
2. Or delete the existing workload first

### Cannot edit workload

Verify you have the `mcp-user` role:
```bash
oc auth can-i get rolebindings -n <namespace>
```

## Migration Notes

### From YAML Workloads

If you have workloads defined in YAML files:

1. **Option A**: Use the YAML import feature (when available)
2. **Option B**: Manually create via UI
3. **Option C**: Create via API script

YAML workloads in the Backstage catalog will be ignored for workloads. Only the database is used.

### From API-Created Workloads

No migration needed. Existing API-created workloads are already in the database and will continue to work.

## Technical Details

### Database Schema

Workloads are stored in the `mcp_entities` table:
- `entity_ref`: `component:namespace/name`
- `entity_type`: `mcp-workload`, `service`, or `workflow`
- `entity_json`: Full entity as JSON

### Performance

- All operations: < 2 seconds
- No catalog sync delay
- Direct database reads/writes
