import * as React from 'react';
import {
  Form,
  FormGroup,
  TextInput,
  TextArea,
  Button,
  ActionGroup,
  Alert,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Card,
  CardBody,
  Title,
  Switch,
} from '@patternfly/react-core';
import { CatalogMcpGuardrail } from '../models/CatalogMcpGuardrail';

export interface GuardrailFormData {
  name: string;
  namespace: string;
  description: string;
  deployment: string;
  parameters?: string;
  disabled?: boolean;
}

interface GuardrailFormProps {
  /** Initial guardrail data (for edit mode) */
  initialGuardrail?: CatalogMcpGuardrail;
  /** Callback when save is clicked */
  onSave: (data: GuardrailFormData) => Promise<void>;
  /** Callback when cancel is clicked */
  onCancel: () => void;
  /** Whether this is edit mode */
  isEditMode?: boolean;
}

// Validation constants (match backend)
const NAME_MAX_LENGTH = 63;
const DESCRIPTION_MAX_LENGTH = 1000;
const DEPLOYMENT_MAX_LENGTH = 2000;
const PARAMETERS_MAX_LENGTH = 10000;
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

/**
 * Form component for creating/editing guardrails.
 * Validates input and provides user feedback.
 */
export const GuardrailForm: React.FC<GuardrailFormProps> = ({
  initialGuardrail,
  onSave,
  onCancel,
  isEditMode = false,
}) => {
  // Form state
  const [name, setName] = React.useState(initialGuardrail?.metadata?.name || '');
  const [namespace, setNamespace] = React.useState(
    initialGuardrail?.metadata?.namespace || 'default',
  );
  const [description, setDescription] = React.useState(
    initialGuardrail?.metadata?.description || '',
  );
  const [deployment, setDeployment] = React.useState(initialGuardrail?.spec?.deployment || '');
  const [parameters, setParameters] = React.useState(initialGuardrail?.spec?.parameters || '');
  const [disabled, setDisabled] = React.useState(initialGuardrail?.spec?.disabled || false);

  // UI state
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  // Validation helpers
  const validateName = (value: string): string | null => {
    if (!value) return 'Name is required';
    if (value.length > NAME_MAX_LENGTH) return `Name must be ${NAME_MAX_LENGTH} characters or less`;
    if (!NAME_PATTERN.test(value)) {
      return 'Name must contain only lowercase letters, numbers, and hyphens, and must start/end with alphanumeric';
    }
    return null;
  };

  const validateNamespace = (value: string): string | null => {
    if (!value) return 'Namespace is required';
    return null;
  };

  const validateDescription = (value: string): string | null => {
    if (!value) return 'Description is required';
    if (value.length > DESCRIPTION_MAX_LENGTH)
      return `Description must be ${DESCRIPTION_MAX_LENGTH} characters or less`;
    return null;
  };

  const validateDeployment = (value: string): string | null => {
    if (!value) return 'Deployment is required';
    if (value.length > DEPLOYMENT_MAX_LENGTH)
      return `Deployment must be ${DEPLOYMENT_MAX_LENGTH} characters or less`;
    return null;
  };

  const validateParameters = (value: string): string | null => {
    if (value && value.length > PARAMETERS_MAX_LENGTH) {
      return `Parameters must be ${PARAMETERS_MAX_LENGTH} characters or less`;
    }
    return null;
  };

  // Get validation errors
  const nameError = validateName(name);
  const namespaceError = validateNamespace(namespace);
  const descriptionError = validateDescription(description);
  const deploymentError = validateDeployment(deployment);
  const parametersError = validateParameters(parameters);

  const isValid =
    !nameError && !namespaceError && !descriptionError && !deploymentError && !parametersError;

  const handleSave = async () => {
    // Mark all fields as touched to show any errors
    setTouched({
      name: true,
      namespace: true,
      description: true,
      deployment: true,
      parameters: true,
    });

    if (!isValid) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave({
        name,
        namespace,
        description,
        deployment,
        parameters: parameters || undefined,
        disabled,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  return (
    <Card>
      <CardBody>
        <Title headingLevel="h2" size="lg" style={{ marginBottom: '1.5rem' }}>
          {isEditMode ? 'Edit Guardrail' : 'Create Guardrail'}
        </Title>

        {saveError && (
          <Alert
            variant="danger"
            title="Error saving guardrail"
            isInline
            style={{ marginBottom: '1rem' }}
          >
            {saveError}
          </Alert>
        )}

        <Form>
          <FormGroup label="Name" isRequired fieldId="guardrail-name">
            <TextInput
              id="guardrail-name"
              value={name}
              onChange={(_event, value) => setName(value.toLowerCase())}
              onBlur={() => handleFieldBlur('name')}
              isRequired
              isDisabled={isEditMode}
              validated={touched.name && nameError ? 'error' : 'default'}
              placeholder="my-guardrail"
            />
            {touched.name && nameError ? (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{nameError}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            ) : (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    Lowercase letters, numbers, and hyphens only. Max {NAME_MAX_LENGTH} characters.
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>

          <FormGroup label="Namespace" isRequired fieldId="guardrail-namespace">
            <TextInput
              id="guardrail-namespace"
              value={namespace}
              onChange={(_event, value) => setNamespace(value)}
              onBlur={() => handleFieldBlur('namespace')}
              isRequired
              validated={touched.namespace && namespaceError ? 'error' : 'default'}
              placeholder="default"
            />
            {touched.namespace && namespaceError && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{namespaceError}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>

          <FormGroup label="Description" isRequired fieldId="guardrail-description">
            <TextArea
              id="guardrail-description"
              value={description}
              onChange={(_event, value) => setDescription(value)}
              onBlur={() => handleFieldBlur('description')}
              isRequired
              validated={touched.description && descriptionError ? 'error' : 'default'}
              placeholder="Describe what this guardrail does..."
              rows={3}
            />
            {touched.description && descriptionError ? (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{descriptionError}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            ) : (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    {description.length}/{DESCRIPTION_MAX_LENGTH} characters
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>

          <FormGroup label="Deployment Configuration" isRequired fieldId="guardrail-deployment">
            <TextArea
              id="guardrail-deployment"
              value={deployment}
              onChange={(_event, value) => setDeployment(value)}
              onBlur={() => handleFieldBlur('deployment')}
              isRequired
              validated={touched.deployment && deploymentError ? 'error' : 'default'}
              placeholder="Enter deployment configuration (e.g., sidecar-container, webhook-url, etc.)"
              rows={4}
            />
            {touched.deployment && deploymentError ? (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{deploymentError}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            ) : (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    {deployment.length}/{DEPLOYMENT_MAX_LENGTH} characters
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>

          <FormGroup label="Parameters" fieldId="guardrail-parameters">
            <TextArea
              id="guardrail-parameters"
              value={parameters}
              onChange={(_event, value) => setParameters(value)}
              onBlur={() => handleFieldBlur('parameters')}
              validated={touched.parameters && parametersError ? 'error' : 'default'}
              placeholder="Optional: Enter guardrail parameters (JSON, YAML, or text)"
              rows={4}
            />
            {touched.parameters && parametersError ? (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">{parametersError}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            ) : (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    Optional. {parameters.length}/{PARAMETERS_MAX_LENGTH} characters
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>

          <FormGroup label="Status" fieldId="guardrail-disabled">
            <Switch
              id="guardrail-disabled"
              label={disabled ? 'Disabled' : 'Enabled'}
              isChecked={!disabled}
              onChange={(_event, checked) => setDisabled(!checked)}
              aria-label="Guardrail enabled/disabled toggle"
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>Disabled guardrails will not be enforced.</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

          <ActionGroup>
            <Button
              variant="primary"
              onClick={handleSave}
              isDisabled={isSaving}
              isLoading={isSaving}
            >
              {isSaving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Guardrail'}
            </Button>
            <Button variant="link" onClick={onCancel} isDisabled={isSaving}>
              Cancel
            </Button>
          </ActionGroup>
        </Form>
      </CardBody>
    </Card>
  );
};

export default GuardrailForm;
