import * as React from 'react';
import { useParams, useHistory, useLocation } from 'react-router-dom';
import {
  PageSection,
  Title,
  Bullseye,
  Spinner,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Card,
  CardBody,
  Label,
  EmptyState,
  EmptyStateBody,
  Button,
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Alert,
  Flex,
  FlexItem,
  ExpandableSection,
} from '@patternfly/react-core';
import { ShieldAltIcon, WrenchIcon, CubeIcon, TrashIcon, EditIcon } from '@patternfly/react-icons';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { usePerformanceMonitor } from '../utils/performanceMonitor';
import { Breadcrumbs, createMcpCatalogBreadcrumbs } from './shared/Breadcrumbs';
import { useGuardrail, deleteGuardrail } from '../services/catalogService';
import { useCanEditCatalog } from '../services/authService';

const GuardrailsPage: React.FC = () => {
  const params = useParams<{ name: string }>();
  const location = useLocation();
  const history = useHistory();

  // Extract name from pathname as fallback
  const extractNameFromPath = (pathname: string): string => {
    const match = pathname.match(/\/mcp-catalog\/guardrails\/([^/?]+)/);
    return match ? match[1] : '';
  };

  const name = params.name || extractNameFromPath(location.pathname);

  const searchParams = new URLSearchParams(location.search);
  const namespace = searchParams.get('namespace') || 'default';

  const stopPerfMonitor = usePerformanceMonitor('GuardrailsPage');

  const shouldFetch = Boolean(name);

  // Fetch guardrail entity
  const [guardrail, loaded, loadError] = useGuardrail(
    namespace,
    shouldFetch ? name : '__placeholder__',
    location.key,
  );

  // Check if user has mcp-admin role
  const { canEdit: canEditGuardrails, loaded: authLoaded } = useCanEditCatalog();

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Expandable sections for usage
  const [isToolsExpanded, setIsToolsExpanded] = React.useState(true);
  const [isWorkloadToolsExpanded, setIsWorkloadToolsExpanded] = React.useState(true);

  React.useEffect(() => {
    if (loaded) {
      stopPerfMonitor();
    }
  }, [loaded, stopPerfMonitor]);

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteGuardrail(namespace, name);
      setIsDeleteModalOpen(false);
      history.push('/mcp-catalog?type=guardrail');
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete guardrail');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!loaded) {
    return (
      <Bullseye>
        <Spinner size="xl" />
      </Bullseye>
    );
  }

  // Handle missing name parameter
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

  const isDisabled = guardrail.spec?.disabled === true;
  const toolAssociations = guardrail.usage?.tools || [];
  const workloadToolAssociations = guardrail.usage?.workloadTools || [];
  const hasAssociations = toolAssociations.length > 0 || workloadToolAssociations.length > 0;

  return (
    <>
      <PageSection>
        <Breadcrumbs items={createMcpCatalogBreadcrumbs('guardrail', guardrail.metadata.name)} />
      </PageSection>

      <PageSection>
        <Flex
          justifyContent={{ default: 'justifyContentSpaceBetween' }}
          alignItems={{ default: 'alignItemsCenter' }}
        >
          <FlexItem>
            <Title headingLevel="h1" size="lg">
              <ShieldAltIcon style={{ marginRight: '0.5rem' }} />
              MCP Guardrail: {guardrail.metadata.name}
            </Title>
          </FlexItem>
          <FlexItem>
            {isDisabled && (
              <Label color="grey" style={{ marginRight: '0.5rem' }}>
                Disabled
              </Label>
            )}
            {authLoaded && canEditGuardrails && (
              <>
                <Button
                  variant="secondary"
                  icon={<EditIcon />}
                  onClick={() =>
                    history.push(`/mcp-catalog/guardrails/${name}/edit?namespace=${namespace}`)
                  }
                  style={{ marginRight: '0.5rem' }}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  icon={<TrashIcon />}
                  onClick={() => setIsDeleteModalOpen(true)}
                  isDisabled={hasAssociations}
                  title={
                    hasAssociations
                      ? 'Cannot delete guardrail with active associations'
                      : 'Delete guardrail'
                  }
                >
                  Delete
                </Button>
              </>
            )}
          </FlexItem>
        </Flex>
      </PageSection>

      <PageSection>
        <Card>
          <CardBody>
            <Title headingLevel="h2" size="md" style={{ marginBottom: '1rem' }}>
              Guardrail Details
            </Title>
            <DescriptionList columnModifier={{ lg: '2Col' }}>
              <DescriptionListGroup>
                <DescriptionListTerm>Name</DescriptionListTerm>
                <DescriptionListDescription>{guardrail.metadata.name}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Namespace</DescriptionListTerm>
                <DescriptionListDescription>
                  {guardrail.metadata.namespace || 'default'}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Description</DescriptionListTerm>
                <DescriptionListDescription>
                  {guardrail.metadata.description || 'No description'}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Status</DescriptionListTerm>
                <DescriptionListDescription>
                  <Label color={isDisabled ? 'grey' : 'green'}>
                    {isDisabled ? 'Disabled' : 'Enabled'}
                  </Label>
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Deployment</DescriptionListTerm>
                <DescriptionListDescription>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {guardrail.spec.deployment || 'Not specified'}
                  </pre>
                </DescriptionListDescription>
              </DescriptionListGroup>
              {guardrail.spec.parameters && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Parameters</DescriptionListTerm>
                  <DescriptionListDescription>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {guardrail.spec.parameters}
                    </pre>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
            </DescriptionList>
          </CardBody>
        </Card>
      </PageSection>

      {/* Tool Associations */}
      <PageSection>
        <Card>
          <CardBody>
            <ExpandableSection
              toggleText={`Tool Associations (${toolAssociations.length})`}
              onToggle={() => setIsToolsExpanded(!isToolsExpanded)}
              isExpanded={isToolsExpanded}
            >
              {toolAssociations.length === 0 ? (
                <EmptyState variant="xs" icon={WrenchIcon}>
                  <Title headingLevel="h4" size="md">
                    No tool associations
                  </Title>
                  <EmptyStateBody>This guardrail is not attached to any tools.</EmptyStateBody>
                </EmptyState>
              ) : (
                <Table aria-label="Tool Associations Table" variant="compact">
                  <Thead>
                    <Tr>
                      <Th>Tool</Th>
                      <Th>Namespace</Th>
                      <Th>Execution Timing</Th>
                      <Th>Parameters</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {toolAssociations.map((assoc, index) => (
                      <Tr key={`tool-${assoc.toolNamespace}-${assoc.toolName}-${index}`}>
                        <Td dataLabel="Tool">
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              history.push(
                                `/mcp-catalog/tools/${assoc.toolName}?namespace=${assoc.toolNamespace}`,
                              );
                            }}
                          >
                            {assoc.toolName}
                          </a>
                        </Td>
                        <Td dataLabel="Namespace">{assoc.toolNamespace}</Td>
                        <Td dataLabel="Execution Timing">
                          <Label
                            color={assoc.executionTiming === 'pre-execution' ? 'blue' : 'purple'}
                          >
                            {assoc.executionTiming}
                          </Label>
                        </Td>
                        <Td dataLabel="Parameters">
                          {assoc.parameters ? (
                            <pre
                              style={{
                                margin: 0,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontSize: '0.875rem',
                              }}
                            >
                              {assoc.parameters}
                            </pre>
                          ) : (
                            <span style={{ color: '#6a6e73' }}>—</span>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </ExpandableSection>
          </CardBody>
        </Card>
      </PageSection>

      {/* Workload-Tool Associations */}
      <PageSection>
        <Card>
          <CardBody>
            <ExpandableSection
              toggleText={`Workload-Tool Associations (${workloadToolAssociations.length})`}
              onToggle={() => setIsWorkloadToolsExpanded(!isWorkloadToolsExpanded)}
              isExpanded={isWorkloadToolsExpanded}
            >
              {workloadToolAssociations.length === 0 ? (
                <EmptyState variant="xs" icon={CubeIcon}>
                  <Title headingLevel="h4" size="md">
                    No workload-tool associations
                  </Title>
                  <EmptyStateBody>
                    This guardrail is not used in any workload-tool relationships.
                  </EmptyStateBody>
                </EmptyState>
              ) : (
                <Table aria-label="Workload-Tool Associations Table" variant="compact">
                  <Thead>
                    <Tr>
                      <Th>Workload</Th>
                      <Th>Tool</Th>
                      <Th>Execution Timing</Th>
                      <Th>Source</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {workloadToolAssociations.map((assoc, index) => (
                      <Tr
                        key={`wt-${assoc.workloadNamespace}-${assoc.workloadName}-${assoc.toolName}-${index}`}
                      >
                        <Td dataLabel="Workload">
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              history.push(
                                `/mcp-catalog/workloads/${assoc.workloadName}?namespace=${assoc.workloadNamespace}`,
                              );
                            }}
                          >
                            {assoc.workloadName}
                          </a>
                        </Td>
                        <Td dataLabel="Tool">
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              history.push(
                                `/mcp-catalog/tools/${assoc.toolName}?namespace=${assoc.toolNamespace}`,
                              );
                            }}
                          >
                            {assoc.toolName}
                          </a>
                        </Td>
                        <Td dataLabel="Execution Timing">
                          <Label
                            color={assoc.executionTiming === 'pre-execution' ? 'blue' : 'purple'}
                          >
                            {assoc.executionTiming}
                          </Label>
                        </Td>
                        <Td dataLabel="Source">
                          <Label color={assoc.source === 'tool' ? 'grey' : 'orange'}>
                            {assoc.source === 'tool' ? 'Inherited from tool' : 'Workload-level'}
                          </Label>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </ExpandableSection>
          </CardBody>
        </Card>
      </PageSection>

      {/* Delete Confirmation Modal */}
      <Modal
        variant={ModalVariant.medium}
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        aria-labelledby="delete-guardrail-title"
        aria-describedby="delete-guardrail-body"
      >
        <ModalHeader title="Delete Guardrail" labelId="delete-guardrail-title" />
        <ModalBody id="delete-guardrail-body">
          {deleteError && (
            <Alert variant="danger" title="Delete failed" isInline style={{ marginBottom: '1rem' }}>
              {deleteError}
            </Alert>
          )}
          <p style={{ marginBottom: '0.5rem' }}>
            Are you sure you want to delete the guardrail <strong>{name}</strong>?
          </p>
          <p style={{ color: '#6a6e73' }}>This action cannot be undone.</p>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={isDeleting}
            isDisabled={isDeleting}
          >
            Delete
          </Button>
          <Button
            variant="link"
            onClick={() => setIsDeleteModalOpen(false)}
            isDisabled={isDeleting}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default GuardrailsPage;
