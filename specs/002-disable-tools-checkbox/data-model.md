# Data Model: Disable Tools Checkbox

**Feature**: 002-disable-tools-checkbox  
**Date**: 2025-12-18

## Entity Changes

### CatalogMcpTool Entity

The disabled state is stored as a metadata annotation on the existing `Component` entity with `spec.type: mcp-tool`.

#### Annotation Schema

| Annotation Key | Type | Values | Default |
|---------------|------|--------|---------|
| `mcp-catalog.io/disabled` | string | `"true"` or absent | absent (enabled) |

#### Example Entity YAML

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: github-create-issue
  namespace: default
  description: "Create a new issue in a GitHub repository"
  annotations:
    mcp-catalog.io/disabled: "true"  # NEW: Tool is disabled
  labels:
    mcp-catalog.io/type: tool
    mcp-catalog.io/server: github-mcp
spec:
  type: mcp-tool
  lifecycle: production
  owner: platform-team
  subcomponentOf: component:default/github-mcp
```

## TypeScript Interface Changes

### Updated CatalogMcpTool Interface

```typescript
// src/models/CatalogMcpTool.ts

import { Entity } from '@backstage/catalog-model';

/** Annotation key for disabled state */
export const MCP_TOOL_DISABLED_ANNOTATION = 'mcp-catalog.io/disabled';

/**
 * Check if a tool entity is disabled.
 * @param entity - The tool entity to check
 * @returns true if the tool is disabled, false otherwise
 */
export const isToolDisabled = (entity: CatalogMcpTool): boolean => {
  return entity.metadata.annotations?.[MCP_TOOL_DISABLED_ANNOTATION] === 'true';
};

/**
 * MCP Tool entity interface.
 * Extended to document the disabled annotation.
 */
export interface CatalogMcpTool extends Entity {
  kind: 'Component';
  metadata: Entity['metadata'] & {
    annotations?: {
      /** Tool disabled state - "true" means disabled */
      'mcp-catalog.io/disabled'?: string;
      [key: string]: string | undefined;
    };
  };
  spec: {
    type: string;
    lifecycle: string;
    owner: string;
    system?: string;
    subcomponentOf?: string;
    partOf?: string | string[];
    inputSchema?: Record<string, unknown>;
    [key: string]: unknown;
  };
}
```

## New Interfaces

### ToolDisabledState

```typescript
// src/hooks/useToolDisabledState.ts

/**
 * State and actions for managing tool disabled state.
 */
export interface ToolDisabledState {
  /** Whether the tool is currently disabled */
  isDisabled: boolean;
  /** Whether an update is in progress */
  isUpdating: boolean;
  /** Error from last update attempt, if any */
  error: ToolDisabledError | null;
  /** Toggle the disabled state */
  toggle: () => Promise<void>;
  /** Retry the last failed operation */
  retry: () => Promise<void>;
  /** Clear the current error */
  clearError: () => void;
}

/**
 * Error state for disabled toggle operations.
 */
export interface ToolDisabledError {
  /** Error message to display */
  message: string;
  /** Whether the error is retryable */
  retryable: boolean;
}
```

### AuthorizationState

```typescript
// src/services/authService.ts

/**
 * User authorization context for catalog operations.
 */
export interface CatalogAuthorizationState {
  /** Whether the user can modify catalog entities */
  canEdit: boolean;
  /** Whether the authorization check is complete */
  loaded: boolean;
  /** User's display name (for audit logging) */
  userName?: string;
}
```

## State Transitions

```
┌─────────────────┐
│    ENABLED      │ (default - annotation absent)
│ (unchecked)     │
└────────┬────────┘
         │
         │ User clicks checkbox
         │ (authorized user only)
         ▼
┌─────────────────┐
│   UPDATING...   │ (optimistic UI)
│ (checkbox checked, row styled)
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
Success     Failure
    │         │
    ▼         ▼
┌─────────┐ ┌─────────────────┐
│ DISABLED│ │ ENABLED + ERROR │
│ (saved) │ │ (rollback + msg)│
└─────────┘ └────────┬────────┘
                     │
                     │ User clicks Retry
                     ▼
              ┌─────────────────┐
              │   UPDATING...   │
              └─────────────────┘
```

## Validation Rules

| Rule | Enforcement |
|------|-------------|
| Annotation value must be "true" or absent | TypeScript type + runtime check |
| Only authorized users can modify | Frontend authorization check |
| Server-tool combination must be unique | Inherent in Backstage entity model |

## Data Migration

**No migration required.** 

- Existing tools without the annotation are treated as enabled (default)
- The annotation is only added when a user explicitly disables a tool
- Removing the annotation (or setting to any value other than "true") re-enables the tool
