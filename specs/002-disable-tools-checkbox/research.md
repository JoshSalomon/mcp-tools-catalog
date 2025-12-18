# Research: Disable Tools Checkbox

**Feature**: 002-disable-tools-checkbox  
**Date**: 2025-12-18

## Research Topics

### 1. Backstage Catalog Entity Updates

**Question**: How to update entity annotations from a frontend-only plugin?

**Decision**: Use Backstage Catalog REST API `PATCH` endpoint via console proxy.

**Rationale**: 
- The Backstage Catalog API supports entity mutation via `POST /entities` (for external providers) or `PATCH /entities/by-uid/:uid` (for annotation updates)
- The existing console proxy at `/api/proxy/plugin/mcp-catalog/backstage` can route these requests
- Annotations are the recommended way to store metadata that doesn't affect the entity's core identity

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Custom backend service | Violates frontend-only constraint; adds operational complexity |
| localStorage | Doesn't persist across devices/browsers; violates spec requirement |
| Separate ConfigMap | Requires Kubernetes API access; out of scope for catalog plugin |

**API Endpoint**:
```
PATCH /api/catalog/entities/by-uid/{entityUid}
Content-Type: application/json-patch+json

[
  { "op": "add", "path": "/metadata/annotations/mcp-catalog.io~1disabled", "value": "true" }
]
```

### 2. Annotation Naming Convention

**Question**: What annotation key to use for disabled state?

**Decision**: Use `mcp-catalog.io/disabled` with values `"true"` or absent (not false).

**Rationale**:
- Follows Backstage annotation naming conventions (reverse-DNS prefix)
- Consistent with existing `mcp-catalog.io/*` labels in the codebase
- Absent annotation = enabled (default); present with `"true"` = disabled
- Simpler than tri-state (true/false/absent)

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| `backstage.io/disabled` | Reserved namespace; not appropriate for custom annotations |
| Label instead of annotation | Labels have stricter format requirements; annotations better for state |
| `spec.disabled` field | Would require catalog entity schema changes |

### 3. Role-Based Authorization

**Question**: How to determine if user has admin/platform-engineer role in OpenShift Console?

**Decision**: Use OpenShift Console's user context from `@openshift-console/dynamic-plugin-sdk`.

**Rationale**:
- The SDK provides access to current user information
- Can check group membership or impersonation context
- No additional backend required

**Implementation Approach**:
```typescript
import { useActiveCluster, useAccessReview } from '@openshift-console/dynamic-plugin-sdk';

// Check if user can update catalog entities
const canEditCatalog = useAccessReview({
  group: '',
  resource: 'configmaps', // Proxy to catalog API
  verb: 'update',
  namespace: 'backstage', // Catalog namespace
});
```

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Custom RBAC backend | Adds complexity; OpenShift already has RBAC |
| Hardcoded role names | Not portable; OpenShift RBAC is more flexible |
| No authorization | Violates security-first principle and spec FR-009 |

### 4. Optimistic UI Updates with Error Handling

**Question**: How to handle the toggle UX with async persistence?

**Decision**: Optimistic update with rollback on failure.

**Rationale**:
- Provides instant feedback (< 100ms perceived)
- Inline error message with retry aligns with spec FR-011
- PatternFly Alert component for error display

**Implementation Pattern**:
```typescript
const toggleDisabled = async (toolUid: string, currentState: boolean) => {
  // 1. Optimistically update UI
  setLocalState(!currentState);
  
  try {
    // 2. Persist to catalog
    await updateEntityAnnotation(toolUid, 'mcp-catalog.io/disabled', !currentState ? 'true' : null);
  } catch (error) {
    // 3. Rollback on failure
    setLocalState(currentState);
    setError({ message: error.message, retry: () => toggleDisabled(toolUid, currentState) });
  }
};
```

### 5. Visual Indicators Across Views

**Question**: How to consistently show disabled state across different views?

**Decision**: Create shared `DisabledIndicator` component with context-aware rendering.

**Rationale**:
- Consistent visual treatment across all views
- Single source of truth for disabled styling
- Supports both interactive (checkbox) and read-only (badge) modes

**Visual Design**:
| View | Indicator Type | Behavior |
|------|---------------|----------|
| Server Details (Provided Tools table) | Checkbox + row styling | Interactive for authorized users |
| Tools Tab | Label/Badge | Read-only indicator |
| Workload Dependencies | Label/Badge | Read-only indicator |

**Styling**:
- Disabled rows: `opacity: 0.6` + `--pf-v5-global--disabled-color--100`
- Badge: PatternFly `<Label color="orange">Disabled</Label>`

## Technical Risks

| Risk | Mitigation |
|------|------------|
| Catalog API rate limiting | Debounce rapid toggles (500ms); batch updates if needed |
| Proxy configuration | Verify PATCH method is allowed through console proxy |
| Entity refresh | After update, refetch entity to ensure consistency |
| Authorization failures | Graceful degradation to read-only view |

## Dependencies

- Backstage Catalog API must support PATCH for annotations (standard feature)
- Console proxy must allow PATCH requests (may need configuration)
- OpenShift Console SDK for user context

## Next Steps

1. Verify console proxy PATCH support
2. Create data-model.md with annotation schema
3. Define API contract for entity updates
4. Create component designs
