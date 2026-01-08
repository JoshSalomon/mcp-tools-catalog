import * as React from 'react';
import { useHistory } from 'react-router-dom';
import { PageSection, Title } from '@patternfly/react-core';
import { ShieldAltIcon } from '@patternfly/react-icons';
import { Breadcrumbs, createMcpCatalogBreadcrumbs } from './shared/Breadcrumbs';
import { GuardrailForm, GuardrailFormData } from './GuardrailForm';
import { createGuardrail } from '../services/catalogService';

/**
 * Page for creating a new guardrail.
 * Uses GuardrailForm component and handles save via createGuardrail API.
 */
const GuardrailCreatePage: React.FC = () => {
  const history = useHistory();

  const handleSave = async (data: GuardrailFormData) => {
    const guardrail = await createGuardrail({
      metadata: {
        name: data.name,
        namespace: data.namespace,
        description: data.description,
      },
      spec: {
        deployment: data.deployment,
        parameters: data.parameters,
        disabled: data.disabled,
      },
    });

    // Navigate to the created guardrail's detail page
    history.push(
      `/mcp-catalog/guardrails/${guardrail.metadata.name}?namespace=${
        guardrail.metadata.namespace || 'default'
      }`,
    );
  };

  const handleCancel = () => {
    history.push('/mcp-catalog?type=guardrail');
  };

  return (
    <>
      <PageSection>
        <Breadcrumbs items={[...createMcpCatalogBreadcrumbs('guardrail', 'Create')]} />
      </PageSection>

      <PageSection>
        <Title headingLevel="h1" size="lg" style={{ marginBottom: '1rem' }}>
          <ShieldAltIcon style={{ marginRight: '0.5rem' }} />
          Create New Guardrail
        </Title>
      </PageSection>

      <PageSection>
        <GuardrailForm onSave={handleSave} onCancel={handleCancel} isEditMode={false} />
      </PageSection>
    </>
  );
};

export default GuardrailCreatePage;
