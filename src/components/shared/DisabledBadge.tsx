/**
 * DisabledBadge component for displaying read-only disabled status indicator.
 * Used in views where the disabled state cannot be toggled (Tools Tab, Workload dependencies).
 */

import * as React from 'react';
import { Label, Tooltip } from '@patternfly/react-core';
import { BanIcon } from '@patternfly/react-icons';

interface DisabledBadgeProps {
  /** Whether the tool is disabled */
  isDisabled: boolean;
  /** Optional tool name for accessibility */
  toolName?: string;
}

/**
 * A read-only badge component that indicates whether a tool is disabled.
 * Only shows a badge when the tool is disabled.
 */
export const DisabledBadge: React.FC<DisabledBadgeProps> = ({
  isDisabled,
  toolName,
}) => {
  if (!isDisabled) {
    return null;
  }

  return (
    <Tooltip
      content={toolName ? `${toolName} is disabled` : 'This tool is disabled'}
      position="top"
    >
      <Label
        color="orange"
        icon={<BanIcon />}
        isCompact
        aria-label={toolName ? `${toolName} is disabled` : 'Disabled'}
      >
        Disabled
      </Label>
    </Tooltip>
  );
};

export default DisabledBadge;
