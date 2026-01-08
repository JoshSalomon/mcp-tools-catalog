/**
 * ToolStateEditor component for batch editing tool states with Save/Cancel workflow.
 * Provides Save/Cancel buttons and state management for batch tool state editing.
 * The actual tool checkboxes are rendered by the parent component using the provided
 * batch state management functions.
 */

import * as React from 'react';
import { Button, Alert, Flex, FlexItem, Spinner } from '@patternfly/react-core';
import { CheckCircleIcon, TimesCircleIcon } from '@patternfly/react-icons';
import { CatalogMcpTool } from '../models/CatalogMcpTool';
import { useBatchToolState, BatchToolState } from '../hooks/useBatchToolState';

interface ToolStateEditorProps {
  /** Array of tools to manage */
  tools: CatalogMcpTool[];
  /** Optional callback when save completes successfully */
  onSaveComplete?: (updatedTools: CatalogMcpTool[]) => void;
  /** Optional callback when cancel is clicked */
  onCancel?: () => void;
  /** Render prop for custom checkbox rendering */
  renderCheckboxes?: (batchState: BatchToolState) => React.ReactNode;
}

/**
 * Component for batch editing tool states with Save/Cancel buttons.
 * Buttons are disabled by default and enabled when changes are detected.
 *
 * This component provides the Save/Cancel UI and state management.
 * The parent component should render the actual tool checkboxes using
 * the batch state management functions.
 */
export const ToolStateEditor: React.FC<ToolStateEditorProps> = ({
  tools,
  onSaveComplete,
  onCancel,
  renderCheckboxes,
}) => {
  const batchState = useBatchToolState(tools, onSaveComplete);

  const handleSave = React.useCallback(async () => {
    await batchState.save();
  }, [batchState]);

  const handleCancel = React.useCallback(() => {
    batchState.cancel();
    if (onCancel) {
      onCancel();
    }
  }, [batchState, onCancel]);

  const hasPendingChanges = batchState.hasChanges();

  return (
    <div>
      {/* Error display */}
      {batchState.error && (
        <Alert
          variant="danger"
          title="Failed to save tool state changes"
          isInline
          actionClose={
            <Button variant="plain" onClick={batchState.clearError}>
              ×
            </Button>
          }
        >
          {batchState.error.message}
        </Alert>
      )}

      {/* Custom checkbox rendering if provided */}
      {renderCheckboxes && renderCheckboxes(batchState)}

      {/* Save/Cancel buttons */}
      <Flex
        alignItems={{ default: 'alignItemsCenter' }}
        spaceItems={{ default: 'spaceItemsMd' }}
        style={{ marginTop: '1rem', marginBottom: '1rem' }}
      >
        <FlexItem>
          <Button
            variant="primary"
            onClick={handleSave}
            isDisabled={!hasPendingChanges || batchState.isSaving}
            icon={batchState.isSaving ? <Spinner size="sm" /> : <CheckCircleIcon />}
          >
            {batchState.isSaving ? 'Saving...' : 'Save'}
          </Button>
        </FlexItem>
        <FlexItem>
          <Button
            variant="secondary"
            onClick={handleCancel}
            isDisabled={!hasPendingChanges || batchState.isSaving}
            icon={<TimesCircleIcon />}
          >
            Cancel
          </Button>
        </FlexItem>
        {hasPendingChanges && (
          <FlexItem>
            <span style={{ fontSize: '0.875rem', color: '#6a6e73' }}>
              {batchState.pendingChanges.size} change
              {batchState.pendingChanges.size !== 1 ? 's' : ''} pending
            </span>
          </FlexItem>
        )}
      </Flex>
    </div>
  );
};

/**
 * Hook to access batch tool state management.
 * Use this in parent components to integrate batch editing with custom UI.
 */
export const useToolStateEditor = (
  tools: CatalogMcpTool[],
  onSaveComplete?: (updatedTools: CatalogMcpTool[]) => void,
): BatchToolState => {
  return useBatchToolState(tools, onSaveComplete);
};

export default ToolStateEditor;
