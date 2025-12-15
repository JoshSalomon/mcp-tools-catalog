import * as React from 'react';
import { Label } from '@patternfly/react-core';
import { ExclamationTriangleIcon, CheckCircleIcon } from '@patternfly/react-icons';

interface OfflineIndicatorProps {
  isOffline: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ isOffline }) => {
  if (isOffline) {
    return (
      <Label color="orange" icon={<ExclamationTriangleIcon />}>
        Offline
      </Label>
    );
  }
  return (
    <Label color="green" icon={<CheckCircleIcon />}>
      Active
    </Label>
  );
};
