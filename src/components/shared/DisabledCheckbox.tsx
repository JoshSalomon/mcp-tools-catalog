/**
 * DisabledCheckbox component for toggling tool disabled state.
 * Used in the Server detail page to enable/disable tools.
 */

import * as React from 'react';
import { Checkbox, Spinner, Tooltip, Button, Flex, FlexItem } from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { CatalogMcpTool, isToolDisabled } from '../../models/CatalogMcpTool';
import { useToolDisabledState } from '../../hooks/useToolDisabledState';
import { useCanEditCatalog } from '../../services/authService';

interface DisabledCheckboxProps {
  /** The tool entity to manage */
  tool: CatalogMcpTool;
  /** Optional callback when the tool is updated */
  onUpdate?: (updatedTool: CatalogMcpTool) => void;
  /** If true, use callback pattern instead of immediate persistence */
  readOnly?: boolean;
  /** Optional callback when checkbox is toggled (for batch editing mode) */
  onToggle?: (tool: CatalogMcpTool) => void;
}

/**
 * A checkbox component for toggling the disabled state of a tool.
 * Includes loading state, error handling with retry, and authorization checks.
 * Supports two modes:
 * - Immediate persistence (default): Uses useToolDisabledState hook
 * - Callback pattern (readOnly=false, onToggle provided): Uses callback for batch editing
 */
export const DisabledCheckbox: React.FC<DisabledCheckboxProps> = ({
  tool,
  onUpdate,
  readOnly = false,
  onToggle,
}) => {
  const { canEdit, loaded: authLoaded } = useCanEditCatalog();

  // Use callback pattern if onToggle is provided and not in read-only mode
  const useCallbackPattern = !readOnly && !!onToggle;

  // For callback pattern, just read the state from tool
  const isDisabledCallback = isToolDisabled(tool);

  // For immediate persistence, use the hook
  const toolState = useToolDisabledState(tool, onUpdate);
  const isDisabled = useCallbackPattern ? isDisabledCallback : toolState.isDisabled;
  const isUpdating = useCallbackPattern ? false : toolState.isUpdating;
  const error = useCallbackPattern ? null : toolState.error;

  const handleToggle = useCallbackPattern
    ? () => {
        if (onToggle) {
          onToggle(tool);
        }
      }
    : toolState.toggle;

  const retry = useCallbackPattern ? undefined : toolState.retry;
  const clearError = useCallbackPattern ? undefined : toolState.clearError;

  // Show loading spinner while checking authorization
  if (!authLoaded) {
    return <Spinner size="sm" aria-label="Checking permissions" />;
  }

  // Show loading spinner while updating (only in immediate persistence mode)
  if (!useCallbackPattern && isUpdating) {
    return (
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
        <FlexItem>
          <Spinner size="sm" aria-label="Updating" />
        </FlexItem>
        <FlexItem>
          <span style={{ fontSize: '0.875rem', color: '#6a6e73' }}>Updating...</span>
        </FlexItem>
      </Flex>
    );
  }

  // Show error with retry option (only in immediate persistence mode)
  if (!useCallbackPattern && error && retry && clearError) {
    return (
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
        <FlexItem>
          <ExclamationCircleIcon color="#c9190b" />
        </FlexItem>
        <FlexItem>
          <span style={{ fontSize: '0.875rem', color: '#c9190b' }}>Failed</span>
        </FlexItem>
        <FlexItem>
          <Button variant="link" size="sm" onClick={retry} style={{ padding: 0 }}>
            Retry
          </Button>
        </FlexItem>
        <FlexItem>
          <Button variant="plain" size="sm" onClick={clearError} style={{ padding: 0 }}>
            ×
          </Button>
        </FlexItem>
      </Flex>
    );
  }

  // Read-only mode if user can't edit
  if (!canEdit) {
    return (
      <Tooltip content="You do not have permission to modify this tool">
        <Checkbox
          id={`enabled-${tool.metadata.name}`}
          isChecked={!isDisabled}
          isDisabled
          label={isDisabled ? 'Disabled' : 'Enabled'}
          aria-label={`${tool.metadata.name} is ${isDisabled ? 'disabled' : 'enabled'} (read-only)`}
        />
      </Tooltip>
    );
  }

  // Interactive checkbox - checked = enabled, unchecked = disabled
  return (
    <Tooltip content={isDisabled ? 'Click to enable this tool' : 'Click to disable this tool'}>
      <Checkbox
        id={`enabled-${tool.metadata.name}`}
        isChecked={!isDisabled}
        onChange={handleToggle}
        label={isDisabled ? 'Disabled' : 'Enabled'}
        aria-label={`${isDisabled ? 'Enable' : 'Disable'} ${tool.metadata.name}`}
      />
    </Tooltip>
  );
};

export default DisabledCheckbox;
