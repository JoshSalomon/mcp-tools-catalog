/**
 * ConflictDialog component for resolving concurrent edit conflicts.
 */

import * as React from 'react';
import { Modal, ModalVariant, Button, Alert } from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';

interface ConflictDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when user chooses to overwrite */
  onOverwrite: () => void;
  /** Callback when user chooses to cancel */
  onCancel: () => void;
}

/**
 * Dialog for resolving concurrent edit conflicts.
 * Shown when a workload was modified by another user during editing.
 */
export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  isOpen,
  onOverwrite,
  onCancel,
}) => {
  return (
    <Modal
      variant={ModalVariant.small}
      title="Edit Conflict Detected"
      isOpen={isOpen}
      onClose={onCancel}
    >
      <Alert variant="warning" title="This workload was modified by another user" isInline>
        <ExclamationTriangleIcon style={{ marginRight: '0.5rem' }} />
        <p>
          The workload you are editing has been modified since you started editing. If you save now,
          your changes will overwrite the other user&apos;s changes.
        </p>
        <p style={{ marginTop: '1rem' }}>
          Do you want to proceed with overwriting, or cancel to review the changes?
        </p>
      </Alert>
      <div
        style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}
      >
        <Button variant="primary" onClick={onOverwrite}>
          Overwrite Changes
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
};

export default ConflictDialog;
