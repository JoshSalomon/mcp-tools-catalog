/**
 * Hook for managing tool disabled state with optimistic updates.
 */

import { useState, useCallback } from 'react';
import {
  CatalogMcpTool,
  MCP_TOOL_DISABLED_ANNOTATION,
  isToolDisabled,
} from '../models/CatalogMcpTool';
import { updateEntityAnnotation } from '../services/catalogService';

/**
 * Error state for tool disabled operations.
 */
export interface ToolDisabledError {
  message: string;
  originalState: boolean;
}

/**
 * State and actions for managing tool disabled state.
 */
export interface ToolDisabledState {
  /** Current disabled state */
  isDisabled: boolean;
  /** Whether an update is in progress */
  isUpdating: boolean;
  /** Error from last update attempt */
  error: ToolDisabledError | null;
  /** Toggle the disabled state */
  toggle: () => Promise<void>;
  /** Retry the last failed update */
  retry: () => Promise<void>;
  /** Clear any error state */
  clearError: () => void;
}

/**
 * Hook to manage the disabled state of a tool with optimistic updates.
 *
 * @param tool - The tool entity to manage
 * @param onUpdate - Optional callback when the tool is updated
 * @returns State and actions for managing disabled state
 */
export const useToolDisabledState = (
  tool: CatalogMcpTool,
  onUpdate?: (updatedTool: CatalogMcpTool) => void,
): ToolDisabledState => {
  const [isDisabled, setIsDisabled] = useState(() => isToolDisabled(tool));
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<ToolDisabledError | null>(null);
  const [pendingState, setPendingState] = useState<boolean | null>(null);

  const entityRef = `component:${tool.metadata.namespace || 'default'}/${tool.metadata.name}`;

  const performUpdate = useCallback(
    async (newDisabledState: boolean) => {
      const previousState = isDisabled;

      // Optimistic update
      setIsDisabled(newDisabledState);
      setIsUpdating(true);
      setError(null);
      setPendingState(newDisabledState);

      try {
        const updatedTool = await updateEntityAnnotation<CatalogMcpTool>(
          entityRef,
          MCP_TOOL_DISABLED_ANNOTATION,
          newDisabledState ? 'true' : null,
        );

        // Success - notify parent
        if (onUpdate) {
          onUpdate(updatedTool);
        }
        setPendingState(null);
      } catch (err) {
        // Rollback on error
        setIsDisabled(previousState);
        setError({
          message: err instanceof Error ? err.message : 'Failed to update tool state',
          originalState: previousState,
        });
        setPendingState(null);
      } finally {
        setIsUpdating(false);
      }
    },
    [entityRef, isDisabled, onUpdate],
  );

  const toggle = useCallback(async () => {
    await performUpdate(!isDisabled);
  }, [isDisabled, performUpdate]);

  const retry = useCallback(async () => {
    if (pendingState !== null) {
      await performUpdate(pendingState);
    }
  }, [pendingState, performUpdate]);

  const clearError = useCallback(() => {
    setError(null);
    setPendingState(null);
  }, []);

  return {
    isDisabled,
    isUpdating,
    error,
    toggle,
    retry,
    clearError,
  };
};
