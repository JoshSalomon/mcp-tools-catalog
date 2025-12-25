# Checkbox UI State Fix

**Date**: 2024-12-25  
**Status**: ✅ Resolved  
**Image**: `quay.io/jsalomon/mcp-tools-catalog:20251225-125706`

## Problem Description

When toggling a tool's disabled state in the Server detail page, the checkbox visual state was not updating correctly:

### Symptoms
- Tool loaded as **disabled** (checked checkbox, gray background)
- User clicks checkbox to **enable** the tool
- Gray background correctly removed ✅
- **BUT**: Checkbox remained checked ❌
- **AND**: Label still showed "Disabled" ❌
- Save button correctly persisted the enabled state ✅

### Root Cause

**Issue 1: Incomplete Annotation Removal**

In `src/components/McpServerPage.tsx`, when constructing `toolWithState` to pass to `DisabledCheckbox`, the code was using `delete` to remove the disabled annotation:

```typescript
// ❌ ORIGINAL CODE
const annotations = { ...tool.metadata.annotations };
if (currentDisabledState) {
  annotations['mcp-catalog.io/disabled'] = 'true';
} else {
  delete annotations['mcp-catalog.io/disabled']; // Delete doesn't always trigger re-render
}
```

**Problem**: JavaScript's `delete` operator mutates the object in place. While it removes the property, React's change detection might not always recognize this as a state change, especially when the object reference remains the same.

**Issue 2: Unstable Callback Dependency**

In `src/hooks/useBatchToolState.ts`, the `toggleTool` callback had `pendingChanges` in its dependency array:

```typescript
// ❌ ORIGINAL CODE
const toggleTool = useCallback((tool: CatalogMcpTool) => {
  const currentState = pendingChanges.get(entityRef) ?? originalStates.get(entityRef) ?? isToolDisabled(tool);
  const newState = !currentState;
  
  setPendingChanges(prev => {
    const updated = new Map(prev);
    updated.set(entityRef, newState);
    return updated;
  });
  setError(null);
}, [pendingChanges, originalStates]); // ❌ pendingChanges causes recreation
```

**Problem**: Including `pendingChanges` in the dependency array caused the callback to be recreated on every state change, potentially causing timing issues with React's rendering cycle.

## Solution

### Fix 1: Explicit Annotation Removal via Destructuring

Use JavaScript destructuring to **create a new object** without the disabled annotation:

```typescript
// ✅ FIXED CODE
const baseAnnotations = { ...tool.metadata.annotations };
const { 'mcp-catalog.io/disabled': _, ...annotationsWithoutDisabled } = baseAnnotations;

const annotations = currentDisabledState
  ? { ...annotationsWithoutDisabled, 'mcp-catalog.io/disabled': 'true' }
  : annotationsWithoutDisabled;
```

**Why This Works**:
- Creates a **new object reference** when removing the annotation
- React's change detection reliably sees the change
- More explicit and functional programming style
- No mutation, purely declarative

### Fix 2: Stable Callback with Internal State Access

Move `pendingChanges` access inside the setter function:

```typescript
// ✅ FIXED CODE
const toggleTool = useCallback((tool: CatalogMcpTool) => {
  const entityRef = `component:${tool.metadata.namespace || 'default'}/${tool.metadata.name}`;
  
  setPendingChanges(prev => {
    const currentState = prev.get(entityRef) ?? originalStates.get(entityRef) ?? isToolDisabled(tool);
    const newState = !currentState;
    const updated = new Map(prev);
    updated.set(entityRef, newState);
    return updated;
  });
  setError(null);
}, [originalStates]); // ✅ Only stable dependency
```

**Why This Works**:
- Callback only depends on `originalStates` (stable)
- Access latest `pendingChanges` via setter function's `prev` parameter
- No unnecessary callback recreations
- React hooks best practice

## Files Modified

1. **`src/components/McpServerPage.tsx`**
   - Changed annotation removal from `delete` to destructuring pattern
   - Ensures React sees new object reference on state changes

2. **`src/hooks/useBatchToolState.ts`**
   - Removed `pendingChanges` from `toggleTool` callback dependencies
   - Access current state through setter function parameter

## Testing

### Before Fix
```
1. Load server with disabled tool
2. Click checkbox to enable
3. ❌ Checkbox stays checked
4. ❌ Label stays "Disabled"
5. ✅ Background removes
6. ✅ Save persists correctly (backend was fine)
```

### After Fix
```
1. Load server with disabled tool
2. Click checkbox to enable
3. ✅ Checkbox unchecks immediately
4. ✅ Label changes to "Enabled"
5. ✅ Background removes
6. ✅ Save persists correctly
```

## Lessons Learned

### React Change Detection
- **Object mutation** (via `delete`) can be unreliable for triggering re-renders
- **New object references** (via destructuring/spread) are more reliable
- React compares references, not deep equality

### React Hooks Best Practices
- Keep callback dependencies **minimal and stable**
- Use setter function's parameter to access latest state
- Avoid including frequently-changing state in dependency arrays

### Declarative over Imperative
- Prefer **creating new objects** over mutating existing ones
- Use **ternary operators** for conditional object shapes
- More predictable behavior with React's rendering model

## Related Documentation

- [Merge Architecture](./MERGE-ARCHITECTURE.md) - How catalog and database states merge
- [Disable Tools Fix](./DISABLE-TOOLS-FIX-COMPLETE.md) - Backend persistence fix
- [Documentation Index](./DOCUMENTATION-INDEX.md) - All fix documentation

## Deployment

```bash
# Build and deploy
yarn build
./build-container.sh --local
podman tag quay.io/jsalomon/mcp-tools-catalog:latest quay.io/jsalomon/mcp-tools-catalog:20251225-125706
podman push quay.io/jsalomon/mcp-tools-catalog:20251225-125706
oc set image deployment/mcp-catalog mcp-catalog=quay.io/jsalomon/mcp-tools-catalog:20251225-125706 -n mcp-tools-catalog
```

## Status

✅ **RESOLVED** - Checkbox UI now correctly reflects disabled state changes in real-time.
