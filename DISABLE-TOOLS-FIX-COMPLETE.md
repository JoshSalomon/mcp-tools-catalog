# Disable Tools Feature - Complete Fix Summary

## Status: ✅ WORKING

The ability to disable/enable tools via the MCP Tools Catalog UI is now fully functional and persistent.

## Quick Test

1. Navigate to **MCP Catalog → Servers → kubernetes-mcp**
2. Click on any tool (e.g., **k8s-list-pods**)
3. Check **"Disabled"** checkbox
4. Click **"Save Changes"**
5. Refresh page (F5)
6. **Result**: ✅ Checkbox stays checked, state persists!

## What Was Fixed

### 1. Authentication & CSRF (Phase 1)
**Problem**: PUT requests failed with 403 Forbidden
**Solution**: 
- Fixed nginx header forwarding (`X-Forwarded-Access-Token`, `Authorization`)
- Added CSRF token extraction from cookie
**Files**: 
- `deployment/backstage-deployment-sqlite.yaml`
- `src/services/catalogService.ts`
**Documentation**: [AUTHENTICATION-FIX-SUMMARY.md](AUTHENTICATION-FIX-SUMMARY.md)

### 2. Validation Approach (Phase 2)
**Problem**: Strict validation rejected valid Backstage properties
**Solution**: Removed custom validation, rely on Backstage catalog
**Files**: 
- `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts`
- `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
**Documentation**: [VALIDATION-APPROACH.md](VALIDATION-APPROACH.md)

### 3. YAML Entity Support (Phase 3)
**Problem**: YAML entities not found, state didn't persist
**Solution**: 
- Check catalog (not database) for existence
- Merge catalog + database on GET
**Files**: 
- `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts` (all GET/LIST methods)
**Documentation**: 
- [MERGE-ARCHITECTURE.md](MERGE-ARCHITECTURE.md) - Detailed architecture
- [YAML-ENTITY-FIX.md](YAML-ENTITY-FIX.md) - Fix history

## Architecture

```
Frontend (Console Plugin)
   │
   ↓
MCP Entity API (Merge Layer)
   ├─→ Backstage Catalog (YAML entity definitions)
   └─→ SQLite Database (Runtime state: disabled flags)
   
Merge Logic:
  GET: catalog entity + database annotations = complete entity
  PUT: verify in catalog, save to database
```

## Key Design Decisions

### ✅ Merge Architecture (Chosen)
- **Catalog** = Source of truth (entity definitions, immutable)
- **Database** = Runtime overlay (disabled state, mutable)  
- **API Layer** = Merges on GET (our code, not Backstage)

**Advantages**:
- ✅ No Backstage core modifications
- ✅ State persists across refreshes
- ✅ Works with YAML and API-created entities
- ✅ Clear separation of concerns

### ❌ Alternatives Rejected
- **Delta mutations to catalog**: Conflicts with GitHub provider
- **Modify YAML files**: Runtime state shouldn't be in Git
- **Frontend-only state**: Lost on refresh

## Technical Details

### Merge Logic (service.ts)

```typescript
async getTool(namespace, name) {
  // 1. Get from catalog (YAML source)
  const catalogEntity = await this.catalog.getEntityByRef({...});
  
  // 2. Get from database (runtime state)
  const dbEntity = await this.database.getEntity(entityRef);
  
  // 3. Merge (database annotations overlay)
  if (dbEntity) {
    return {
      ...catalogEntity,
      metadata: {
        ...catalogEntity.metadata,
        annotations: {
          ...catalogEntity.metadata.annotations,
          ...dbEntity.metadata.annotations,  // Database wins
        },
      },
    };
  }
  
  return catalogEntity;
}
```

### Methods Modified

**Existence Checks** (check catalog, not database):
- `updateServer()`, `deleteServer()`
- `updateTool()`, `deleteTool()`
- `updateWorkload()`, `deleteWorkload()`

**Merge Logic** (merge catalog + database):
- `getServer()`, `listServers()`
- `getTool()`, `listTools()`
- `getWorkload()`, `listWorkloads()`

## Deployment

**Current Image**: `quay.io/jsalomon/backstage:20251225-115253`

**Deployed to**: OpenShift namespace `backstage`

**Verification**:
```bash
oc get deployment backstage -n backstage -o jsonpath='{.spec.template.spec.containers[0].image}'
# Output: quay.io/jsalomon/backstage:20251225-115253

oc exec -n backstage $(oc get pod -n backstage -l app=backstage -o jsonpath='{.items[0].metadata.name}') -c backstage -- grep -c "Merges catalog entity" /app/packages/backend/dist/plugins/mcp-entity-api/service.cjs.js
# Output: 3 (getServer, getTool, getWorkload)
```

## Testing

### Manual Tests ✅
- [x] Disable tool via UI
- [x] Refresh page - state persists
- [x] Re-enable tool via UI  
- [x] View tool in list - shows disabled badge
- [x] View server - shows tool as disabled
- [x] Navigate away and back - state persists

### Database Verification ✅
```bash
oc exec -n backstage <pod> -c backstage -- \
  sqlite3 /tmp/mcp-entities.db \
  "SELECT entityRef, json_extract(data, '$.metadata.annotations') \
   FROM entities WHERE entityRef LIKE '%k8s-list-pods%';"
```

Expected: Shows `"mcp-catalog.io/disabled":"true"`

### API Verification ✅
```bash
TOKEN=$(oc whoami -t)
BACKSTAGE_URL=$(oc get route backstage -n backstage -o jsonpath='{.spec.host}')

curl -k "https://${BACKSTAGE_URL}/api/mcp-entity-api/tools/default/k8s-list-pods" \
  -H "Authorization: Bearer ${TOKEN}" | \
  jq '.metadata.annotations["mcp-catalog.io/disabled"]'
```

Expected: `"true"` (if disabled)

## Documentation

### Architecture & Design
- **[MERGE-ARCHITECTURE.md](MERGE-ARCHITECTURE.md)** - Complete architecture, data flow, diagrams
- **[YAML-ENTITY-FIX.md](YAML-ENTITY-FIX.md)** - Fix history, before/after
- **[VALIDATION-APPROACH.md](VALIDATION-APPROACH.md)** - Validation strategy
- **[AUTHENTICATION-FIX-SUMMARY.md](AUTHENTICATION-FIX-SUMMARY.md)** - Auth fixes

### Operations & Deployment
- **[AUTHENTICATION.md](AUTHENTICATION.md)** - Comprehensive auth guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deployment guide with auth section
- **[README.md](README.md)** - Project overview with links
- **[CLAUDE.md](CLAUDE.md)** - Development guidelines

## Known Limitations

### 1. Only Annotations Merged
Currently, only `metadata.annotations` are merged from database.

**Future**: Could extend to merge:
- `metadata.labels`
- `metadata.tags`
- Custom metadata

### 2. Database Can Drift
If YAML entity is renamed/deleted, database entry becomes orphan.

**Mitigation**: Acceptable - orphan entries are harmless

**Future**: Periodic cleanup job to remove orphan entries

### 3. No Conflict UI
If YAML and database have conflicting state, database always wins (by design).

**Future**: Could show warning when YAML was recently updated

## Future Enhancements

### Phase 1: Performance
- [ ] Cache merged entities (invalidate on PUT/DELETE)
- [ ] Batch database lookups for list operations
- [ ] Add metrics for merge performance

### Phase 2: Features
- [ ] Merge more fields (labels, tags)
- [ ] Disable multiple tools at once (bulk operations)
- [ ] Disable entire server (cascades to all tools)
- [ ] Temporary disable (with expiration)

### Phase 3: Operations
- [ ] Database cleanup job (remove orphans)
- [ ] Audit trail (who disabled, when)
- [ ] Conflict resolution UI
- [ ] Export/import disabled state

### Phase 4: Testing
- [ ] Unit tests for merge logic
- [ ] Integration tests for disable flow
- [ ] E2E tests with Cypress

## Troubleshooting

### Disabled State Not Persisting

**Check 1**: Verify PUT succeeded
```bash
# Check Backstage logs for "Updating MCP Tool" and 200 status
oc logs -n backstage deployment/backstage | grep "PUT.*k8s-list-pods"
```

**Check 2**: Verify database has state
```bash
oc exec -n backstage <pod> -c backstage -- \
  sqlite3 /tmp/mcp-entities.db \
  "SELECT * FROM entities WHERE entityRef LIKE '%k8s-list-pods%';"
```

**Check 3**: Verify merge is happening
```bash
# Should return "3" (getServer, getTool, getWorkload have merge logic)
oc exec -n backstage <pod> -c backstage -- \
  grep -c "Merges catalog entity" \
  /app/packages/backend/dist/plugins/mcp-entity-api/service.cjs.js
```

### Authentication Errors (403, 401)

See [AUTHENTICATION.md](AUTHENTICATION.md) - Comprehensive troubleshooting guide

**Quick Checks**:
- [ ] CSRF token in cookie (`csrf-token=...`)
- [ ] nginx forwarding headers (`X-Forwarded-Access-Token`, `Authorization`)
- [ ] User has `mcp-admin` role

### Catalog Conflicts Warning

**Log Message**: `"Source mcp-entity-provider detected conflicting entityRef..."`

**Meaning**: Both GitHub YAML provider and MCP Entity Provider claim ownership

**Status**: ⚠️ Expected - this is by design

**Impact**: None - merge logic handles this correctly

## Success Criteria ✅

- [x] User can disable tool via UI
- [x] Disabled state persists across page refreshes
- [x] Disabled state visible in tool list
- [x] Disabled state visible in server detail page
- [x] User can re-enable tool
- [x] Works with YAML-loaded entities
- [x] Works with API-created entities
- [x] No modifications to Backstage core
- [x] Comprehensive documentation

## Timeline

- **Dec 24, 2025**: Initial authentication fixes
- **Dec 24, 2025**: Validation approach changed
- **Dec 25, 2025**: YAML entity support (catalog check)
- **Dec 25, 2025**: Merge architecture implemented
- **Dec 25, 2025**: Checkbox UI state management fix
- **Dec 25, 2025**: ✅ Feature complete and working

## Related Documentation

- [CHECKBOX-UI-FIX.md](CHECKBOX-UI-FIX.md) - ⭐ Checkbox UI state management fix (React patterns)
- [MERGE-ARCHITECTURE.md](MERGE-ARCHITECTURE.md) - Complete architecture explanation
- [YAML-ENTITY-FIX.md](YAML-ENTITY-FIX.md) - Fix history
- [AUTHENTICATION-FIX-SUMMARY.md](AUTHENTICATION-FIX-SUMMARY.md) - Auth fixes
- [AUTHENTICATION.md](AUTHENTICATION.md) - Auth architecture
- [VALIDATION-APPROACH.md](VALIDATION-APPROACH.md) - Validation strategy
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [DOCUMENTATION-INDEX.md](DOCUMENTATION-INDEX.md) - All documentation

## Contributors

- Josh Salomon (user)
- Claude (AI assistant)

## References

- [GitHub Issue #002](https://github.com/JoshSalomon/mcp-tools-catalog/issues/002) - Disable tools checkbox
- [Backstage Catalog API](https://backstage.io/docs/features/software-catalog/software-catalog-api)
- [OpenShift Console Dynamic Plugins](https://docs.openshift.com/container-platform/latest/web_console/dynamic-plug-ins.html)

---

**Status**: ✅ **COMPLETE & WORKING**

**Last Updated**: December 25, 2025

**Verified By**: User testing + manual verification
