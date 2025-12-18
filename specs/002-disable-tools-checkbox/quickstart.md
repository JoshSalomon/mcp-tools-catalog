# Quickstart: Disable Tools Checkbox

**Feature**: 002-disable-tools-checkbox  
**Date**: 2025-12-18

## Overview

This feature adds the ability to disable individual tools in the MCP Catalog. Disabled tools are visually marked and the state persists in the Backstage catalog.

## Prerequisites

- Node.js 18+
- Yarn package manager
- Access to OpenShift cluster with Backstage deployed
- Authorized role (admin or platform-engineer) to test edit functionality

## Development Setup

### 1. Clone and Install

```bash
git checkout 002-disable-tools-checkbox
yarn install
```

### 2. Environment Configuration

Ensure the console proxy is configured to allow PATCH requests to the Backstage API. Check `deployment/backstage-console-proxy.yaml` for proxy configuration.

### 3. Run Development Server

```bash
yarn start
```

Access the plugin at `http://localhost:9001/mcp-catalog`.

## Implementation Order

### Phase 1: Core Toggle (P1)

1. **Add `isToolDisabled` helper** to `src/models/CatalogMcpTool.ts`
2. **Create `useToolDisabledState` hook** in `src/hooks/useToolDisabledState.ts`
3. **Add `updateEntityAnnotation` function** to `src/services/catalogService.ts`
4. **Create `DisabledCheckbox` component** in `src/components/shared/DisabledCheckbox.tsx`
5. **Integrate into `McpServerPage`** - add checkbox column to Provided Tools table

### Phase 2: Authorization (P1)

1. **Create `useCanEditCatalog` hook** in `src/services/authService.ts`
2. **Update `DisabledCheckbox`** to respect authorization state
3. **Add read-only mode** for unauthorized users

### Phase 3: Cross-View Indicators (P2)

1. **Update `ToolsTab`** - add disabled indicator column
2. **Update `McpWorkloadPage`** - add disabled indicator to tool dependencies

### Phase 4: Error Handling (P1)

1. **Add inline error display** to `DisabledCheckbox`
2. **Implement retry mechanism**
3. **Add optimistic update with rollback**

## Testing

### Unit Tests

```bash
# Run all tests
yarn test

# Run specific test file
yarn test src/components/shared/DisabledCheckbox.spec.tsx
```

### Manual Testing Checklist

- [ ] Navigate to MCP Server details page
- [ ] Verify "Disabled" checkbox column appears in tools table
- [ ] Click checkbox to disable a tool
- [ ] Verify row styling changes (greyed out)
- [ ] Refresh page - verify disabled state persists
- [ ] Navigate to Tools Tab - verify disabled indicator appears
- [ ] Test as unauthorized user - verify checkbox is read-only
- [ ] Disconnect network - verify error message and retry option

## Key Files

| File | Purpose |
|------|---------|
| `src/models/CatalogMcpTool.ts` | Entity type + disabled helper |
| `src/hooks/useToolDisabledState.ts` | State management hook |
| `src/services/catalogService.ts` | API functions |
| `src/services/authService.ts` | Authorization check |
| `src/components/shared/DisabledCheckbox.tsx` | Reusable toggle component |
| `src/components/McpServerPage.tsx` | Primary integration point |

## API Usage

### Disable a Tool

```typescript
import { updateEntityAnnotation } from '../services/catalogService';

await updateEntityAnnotation(
  toolEntityUid,
  'mcp-catalog.io/disabled',
  'true'
);
```

### Enable a Tool

```typescript
await updateEntityAnnotation(
  toolEntityUid,
  'mcp-catalog.io/disabled',
  null  // Removes annotation
);
```

### Check if Tool is Disabled

```typescript
import { isToolDisabled } from '../models/CatalogMcpTool';

if (isToolDisabled(tool)) {
  // Show disabled styling
}
```

## Troubleshooting

### Checkbox not appearing

- Verify you're on the MCP Server details page (not Tools Tab)
- Check browser console for API errors
- Ensure catalog proxy is reachable

### Cannot toggle (unauthorized)

- Verify you have admin or platform-engineer role
- Check OpenShift group membership
- Console proxy may not be forwarding credentials

### Changes not persisting

- Check network tab for PATCH request failures
- Verify console proxy allows PATCH method
- Check Backstage logs for entity update errors

## Related Documentation

- [spec.md](./spec.md) - Feature specification
- [data-model.md](./data-model.md) - Entity annotation schema
- [contracts/catalog-api.yaml](./contracts/catalog-api.yaml) - API contract
