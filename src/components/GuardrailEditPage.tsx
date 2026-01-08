import * as React from 'react';
import { useParams, useHistory, useLocation } from 'react-router-dom';
import {
  PageSection,
  Title,
  Bullseye,
  Spinner,
  EmptyState,
  EmptyStateBody,
} from '@patternfly/react-core';
import { ShieldAltIcon } from '@patternfly/react-icons';
import { Breadcrumbs } from './shared/Breadcrumbs';
import { GuardrailForm, GuardrailFormData } from './GuardrailForm';
import { useGuardrail, updateGuardrail } from '../services/catalogService';

/**
 * Page for editing an existing guardrail.
 * Fetches the guardrail data and uses GuardrailForm component.
 */
const GuardrailEditPage: React.FC = () => {
  const params = useParams<{ name: string }>();
  const location = useLocation();
  const history = useHistory();

  // Extract name from pathname as fallback
  const extractNameFromPath = (pathname: string): string => {
    const match = pathname.match(/\/mcp-catalog\/guardrails\/([^/?]+)\/edit/);
    return match ? match[1] : '';
  };

  const name = params.name || extractNameFromPath(location.pathname);

  const searchParams = new URLSearchParams(location.search);
  const namespace = searchParams.get('namespace') || 'default';

  // Fetch the guardrail
  const [guardrail, loaded, loadError] = useGuardrail(
    namespace,
    name || '__placeholder__',
    location.key,
  );

  const handleSave = async (data: GuardrailFormData) => {
    await updateGuardrail(namespace, name, {
      metadata: {
        description: data.description,
      },
      spec: {
        deployment: data.deployment,
        parameters: data.parameters,
        disabled: data.disabled,
      },
    });

    // Navigate back to the guardrail's detail page
    history.push(`/mcp-catalog/guardrails/${name}?namespace=${namespace}`);
  };

  const handleCancel = () => {
    history.push(`/mcp-catalog/guardrails/${name}?namespace=${namespace}`);
  };

  if (!loaded) {
    return (
      <Bullseye>
        <Spinner size="xl" />
      </Bullseye>
    );
  }

  if (!name) {
    return (
      <PageSection>
        <EmptyState icon={ShieldAltIcon}>
          <Title headingLevel="h1" size="lg">
            Invalid Guardrail URL
          </Title>
          <EmptyStateBody>
            No guardrail name provided in the URL. Please navigate from the guardrails list.
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  if (loadError || !guardrail) {
    return (
      <PageSection>
        <EmptyState icon={ShieldAltIcon}>
          <Title headingLevel="h1" size="lg">
            Guardrail Not Found
          </Title>
          <EmptyStateBody>
            {loadError?.message || `MCP Guardrail "${name}" not found in namespace "${namespace}".`}
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  return (
    <>
      <PageSection>
        <Breadcrumbs
          items={[
            { label: 'MCP Catalog', path: '/mcp-catalog' },
            { label: 'Guardrails', path: '/mcp-catalog?type=guardrail' },
            {
              label: guardrail.metadata.name,
              path: `/mcp-catalog/guardrails/${guardrail.metadata.name}?namespace=${namespace}`,
            },
            { label: 'Edit' },
          ]}
        />
      </PageSection>

      <PageSection>
        <Title headingLevel="h1" size="lg" style={{ marginBottom: '1rem' }}>
          <ShieldAltIcon style={{ marginRight: '0.5rem' }} />
          Edit Guardrail: {guardrail.metadata.name}
        </Title>
      </PageSection>

      <PageSection>
        <GuardrailForm
          initialGuardrail={guardrail}
          onSave={handleSave}
          onCancel={handleCancel}
          isEditMode={true}
        />
      </PageSection>
    </>
  );
};

export default GuardrailEditPage;
