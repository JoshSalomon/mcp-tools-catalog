/**
 * Hook for managing batch tool state changes with Save/Cancel workflow.
 * Replaces immediate persistence with batch editing pattern.
 */

import { useState, useCallback } from 'react';
import { CatalogMcpTool, isToolDisabled } from '../models/CatalogMcpTool';
import { batchUpdateToolStates } from '../services/catalogService';

/**
 * State and actions for batch tool state management.
 */
export interface BatchToolState {
  /** Map of pending changes: entityRef -> new disabled state */
  pendingChanges: Map<string, boolean>;
  /** Map of original states: entityRef -> original disabled state */
  originalStates: Map<string, boolean>;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Error from last save attempt */
  error: Error | null;
  /** Toggle a tool's disabled state (adds to pending changes) */
  toggleTool: (tool: CatalogMcpTool) => void;
  /** Save all pending changes */
  save: () => Promise<void>;
  /** Cancel all pending changes and revert to original states */
  cancel: () => void;
  /** Clear any error state */
  clearError: () => void;
  /** Check if there are any pending changes */
  hasChanges: () => boolean;
  /** Get the current disabled state for a tool (considering pending changes) */
  getToolState: (tool: CatalogMcpTool) => boolean;
}

/**
 * Hook to manage batch tool state changes with Save/Cancel workflow.
 * 
 * @param tools - Array of tools to manage
 * @param onSaveComplete - Optional callback when save completes successfully
 * @returns State and actions for batch tool state management
 */
export const useBatchToolState = (
  tools: CatalogMcpTool[],
  onSaveComplete?: (updatedTools: CatalogMcpTool[]) => void
): BatchToolState => {
  // Initialize original states from current tool states
  const [originalStates] = useState<Map<string, boolean>>(() => {
    const states = new Map<string, boolean>();
    tools.forEach(tool => {
      const entityRef = `component:${tool.metadata.namespace || 'default'}/${tool.metadata.name}`;
      states.set(entityRef, isToolDisabled(tool));
    });
    return states;
  });

  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const toggleTool = useCallback((tool: CatalogMcpTool) => {
    const entityRef = `component:${tool.metadata.namespace || 'default'}/${tool.metadata.name}`;
    
    setPendingChanges(prev => {
      // Access current state inside setter to avoid unstable callback dependency
      // See CHECKBOX-UI-FIX.md for explanation
      const currentState = prev.get(entityRef) ?? originalStates.get(entityRef) ?? isToolDisabled(tool);
      const newState = !currentState;
      const updated = new Map(prev);
      updated.set(entityRef, newState);
      return updated;
    });
    setError(null);
  }, [originalStates]); // ✅ Only depends on stable originalStates

  const save = useCallback(async () => {
    if (pendingChanges.size === 0) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updatedTools = await batchUpdateToolStates(pendingChanges);
      
      // Update original states to reflect saved changes
      pendingChanges.forEach((newState, entityRef) => {
        originalStates.set(entityRef, newState);
      });
      
      // Clear pending changes
      setPendingChanges(new Map());
      
      if (onSaveComplete) {
        onSaveComplete(updatedTools);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsSaving(false);
    }
  }, [pendingChanges, originalStates, onSaveComplete]);

  const cancel = useCallback(() => {
    setPendingChanges(new Map());
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const hasChanges = useCallback(() => {
    return pendingChanges.size > 0;
  }, [pendingChanges]);

  const getToolState = useCallback((tool: CatalogMcpTool): boolean => {
    const entityRef = `component:${tool.metadata.namespace || 'default'}/${tool.metadata.name}`;
    // Return pending change if exists, otherwise return original state
    if (pendingChanges.has(entityRef)) {
      return pendingChanges.get(entityRef)!;
    }
    return originalStates.get(entityRef) ?? isToolDisabled(tool);
  }, [pendingChanges, originalStates]);

  return {
    pendingChanges,
    originalStates,
    isSaving,
    error,
    toggleTool,
    save,
    cancel,
    clearError,
    hasChanges,
    getToolState,
  };
};
