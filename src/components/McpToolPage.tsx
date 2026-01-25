import * as React from 'react';
import { useParams, useLocation, useHistory } from 'react-router-dom';
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
  Alert,
  Button,
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextArea,
  AlertVariant,
  Flex,
  FlexItem,
  Dropdown,
  DropdownList,
  DropdownItem,
  MenuToggle,
  MenuToggleElement,
} from '@patternfly/react-core';
import {
  WrenchIcon,
  ServerIcon,
  CubeIcon,
  ShieldAltIcon,
  EllipsisVIcon,
} from '@patternfly/react-icons';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { usePerformanceMonitor } from '../utils/performanceMonitor';
import { Breadcrumbs, createMcpCatalogBreadcrumbs } from './shared/Breadcrumbs';
import { CatalogMcpTool, CATALOG_MCP_TOOL_KIND } from '../models/CatalogMcpTool';
import { CatalogMcpServer, CATALOG_MCP_SERVER_KIND } from '../models/CatalogMcpServer';
import { CatalogMcpWorkload, CATALOG_MCP_WORKLOAD_KIND } from '../models/CatalogMcpWorkload';
import {
  useCatalogEntity,
  useCatalogEntities,
  useToolGuardrails,
  useGuardrails,
  attachGuardrailToTool,
  detachGuardrailFromTool,
  updateToolAlternativeDescription,
} from '../services/catalogService';
import { getEntityName, formatToolName } from '../utils/hierarchicalNaming';
import { validateServerReference } from '../services/validationService';
import { useCanEditCatalog } from '../services/authService';
import { ExecutionTiming } from '../models/CatalogMcpGuardrail';

const McpToolPage: React.FC = () => {
  const params = useParams<{ name: string }>();
  const location = useLocation();
  const history = useHistory();

  // OpenShift Console dynamic plugins may not populate useParams correctly
  // Extract name from pathname as fallback: /mcp-catalog/tools/:name
  const extractNameFromPath = (pathname: string): string => {
    const match = pathname.match(/\/mcp-catalog\/tools\/([^/?]+)/);
    return match ? match[1] : '';
  };

  const name = params.name || extractNameFromPath(location.pathname);
  const searchParams = new URLSearchParams(location.search);
  const namespace = searchParams.get('namespace') || 'default';

  const stopPerfMonitor = usePerformanceMonitor('McpToolPage');

  // Permission check for mcp-admin role
  const { canEdit: canManageGuardrails, loaded: authLoaded } = useCanEditCatalog();

  // State for alternative description editing (T024-T026)
  const [isEditingDescription, setIsEditingDescription] = React.useState(false);
  const [descriptionEditValue, setDescriptionEditValue] = React.useState('');
  const [descriptionSaveError, setDescriptionSaveError] = React.useState<string | null>(null);
  const [isSavingDescription, setIsSavingDescription] = React.useState(false);

  // State for attach modal
  const [isAttachModalOpen, setIsAttachModalOpen] = React.useState(false);
  const [selectedGuardrailNs, setSelectedGuardrailNs] = React.useState('');
  const [selectedGuardrailName, setSelectedGuardrailName] = React.useState('');
  const [selectedTiming, setSelectedTiming] = React.useState<ExecutionTiming>('pre-execution');
  const [selectedParameters, setSelectedParameters] = React.useState('');
  const [attachError, setAttachError] = React.useState<string | null>(null);
  const [isAttaching, setIsAttaching] = React.useState(false);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  // State for detach operations
  const [detachError, setDetachError] = React.useState<string | null>(null);
  const [isDetaching, setIsDetaching] = React.useState<string | null>(null);

  // State for detach confirmation modal
  const [isDetachModalOpen, setIsDetachModalOpen] = React.useState(false);
  const [detachGuardrailNs, setDetachGuardrailNs] = React.useState('');
  const [detachGuardrailName, setDetachGuardrailName] = React.useState('');

  // State for edit modal
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editGuardrailNs, setEditGuardrailNs] = React.useState('');
  const [editGuardrailName, setEditGuardrailName] = React.useState('');
  const [editTiming, setEditTiming] = React.useState<ExecutionTiming>('pre-execution');
  const [editParameters, setEditParameters] = React.useState('');
  const [editError, setEditError] = React.useState<string | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);

  // State for dropdown menus
  const [openDropdownKey, setOpenDropdownKey] = React.useState<string | null>(null);

  const shouldFetch = Boolean(name);

  // Fetch tool entity
  const [tool, toolLoaded, toolError] = useCatalogEntity<CatalogMcpTool>(
    CATALOG_MCP_TOOL_KIND,
    shouldFetch ? name : '__placeholder__',
    namespace,
    `${location.key}-${refreshTrigger}`, // Include refreshTrigger to refetch after updates
    'tool', // Explicitly fetch from tools endpoint
  );

  // Fetch all servers to find parent server
  const [servers, serversLoaded] = useCatalogEntities<CatalogMcpServer>(
    CATALOG_MCP_SERVER_KIND,
    'mcp-server', // ✅ Specify type to use MCP Entity API /servers endpoint
    undefined, // Don't filter by namespace - fetch from all namespaces
  );

  // Fetch all workloads to find ones that use this tool
  const [workloads, workloadsLoaded] = useCatalogEntities<CatalogMcpWorkload>(
    CATALOG_MCP_WORKLOAD_KIND,
    'mcp-workload', // ✅ Specify type to use MCP Entity API /workloads endpoint
    undefined, // Don't filter by namespace - fetch from all namespaces
  );

  // Fetch guardrails attached to this tool (US3)
  const [toolGuardrails, guardrailsLoaded] = useToolGuardrails(
    namespace,
    shouldFetch ? name : '__placeholder__',
    `${location.key}-${refreshTrigger}`,
  );

  // Fetch all guardrails for the attach dropdown
  const [allGuardrails, allGuardrailsLoaded] = useGuardrails();

  React.useEffect(() => {
    if (toolLoaded && serversLoaded && workloadsLoaded && guardrailsLoaded) {
      stopPerfMonitor();
    }
  }, [toolLoaded, serversLoaded, workloadsLoaded, guardrailsLoaded, stopPerfMonitor]);

  // Get parent server name from tool using subcomponentOf relation (standard Backstage pattern)
  // Priority: subcomponentOf > partOf > relations array > label
  const getParentServerName = (tool: CatalogMcpTool | null): string | null => {
    if (!tool) return null;

    // Check spec.subcomponentOf first (Component to Component relation)
    if (tool.spec.subcomponentOf) {
      return getEntityName(tool.spec.subcomponentOf);
    }

    // Check spec.partOf (Component to System, but might be used)
    if (tool.spec.partOf) {
      const partOf = Array.isArray(tool.spec.partOf) ? tool.spec.partOf[0] : tool.spec.partOf;
      if (partOf) {
        return getEntityName(partOf);
      }
    }

    // Check relations array for partOf type (generated from subcomponentOf)
    if (tool.relations) {
      const partOfRelation = tool.relations.find((rel) => rel.type === 'partOf');
      if (partOfRelation?.targetRef) {
        return getEntityName(partOfRelation.targetRef);
      }
    }

    // Fallback to spec.mcp.server (legacy)
    if (tool.spec.mcp?.server) {
      return getEntityName(tool.spec.mcp.server);
    }

    // Fallback to label
    return tool.metadata.labels?.['mcp-catalog.io/server'] || null;
  };

  // Find parent server entity
  const parentServerName = React.useMemo(() => {
    return getParentServerName(tool);
  }, [tool]);

  const parentServer = React.useMemo(() => {
    if (!parentServerName || !servers) return null;
    return servers.find((s) => s.metadata.name === parentServerName) || null;
  }, [servers, parentServerName]);

  // Validate server reference
  const serverReferenceValid = React.useMemo(() => {
    if (!tool || !servers) return true;
    return validateServerReference(tool, servers);
  }, [tool, servers]);

  // Find workloads that use this tool
  const workloadsUsingTool = React.useMemo(() => {
    if (!tool || !workloads) return [];

    const toolRef = `component:${namespace}/${name}`;

    return workloads.filter((workload) => {
      // Check spec.dependsOn array (primary field for tool dependencies, used by API-created workloads)
      const dependsOn = workload.spec.dependsOn || [];
      if (dependsOn.includes(toolRef) || dependsOn.includes(name)) {
        return true;
      }

      // Check spec.consumes array (used by YAML-defined workloads)
      const consumes = workload.spec.consumes || [];
      if (consumes.includes(toolRef) || consumes.includes(name)) {
        return true;
      }

      // Check spec.mcp.tools array (legacy field, used by YAML-defined workloads)
      const mcpTools = (workload.spec as any).mcp?.tools || [];
      if (mcpTools.includes(toolRef) || mcpTools.includes(name)) {
        return true;
      }

      // Check relations
      const relations = workload.relations || [];
      return relations.some(
        (rel) =>
          rel.targetRef === toolRef ||
          rel.targetRef === name ||
          rel.targetRef?.endsWith(`/${name}`),
      );
    });
  }, [tool, workloads, name, namespace]);

  // Get hierarchical name (server/tool format)
  const hierarchicalName = React.useMemo(() => {
    if (!tool || !parentServerName) return tool?.metadata.name || '';
    return formatToolName(parentServerName, tool.metadata.name);
  }, [tool, parentServerName]);

  // Calculate available guardrails (not already attached to this tool)
  const availableGuardrails = React.useMemo(() => {
    if (!allGuardrails) return [];
    const attachedKeys = new Set(
      toolGuardrails.map(
        (tg) => `${tg.guardrail?.metadata?.namespace || 'default'}/${tg.guardrail?.metadata?.name}`,
      ),
    );
    return allGuardrails.filter(
      (g) => !attachedKeys.has(`${g.metadata.namespace}/${g.metadata.name}`),
    );
  }, [allGuardrails, toolGuardrails]);

  // Handlers for alternative description editing (T024-T026)
  const handleStartEditDescription = () => {
    const currentDescription =
      (tool as any)?.alternativeDescription || tool?.metadata.description || '';
    setDescriptionEditValue(currentDescription);
    setDescriptionSaveError(null);
    setIsEditingDescription(true);
  };

  const handleCancelEditDescription = () => {
    setIsEditingDescription(false);
    setDescriptionEditValue('');
    setDescriptionSaveError(null);
  };

  const handleSaveDescription = async () => {
    setIsSavingDescription(true);
    setDescriptionSaveError(null);

    try {
      // Trim whitespace and set to null if empty
      const trimmedValue = descriptionEditValue.trim();
      const valueToSave = trimmedValue.length > 0 ? trimmedValue : null;

      await updateToolAlternativeDescription(namespace, name, valueToSave);

      // Refresh the tool data
      setRefreshTrigger((prev) => prev + 1);
      setIsEditingDescription(false);
    } catch (err) {
      setDescriptionSaveError(
        err instanceof Error ? err.message : 'Failed to save alternative description',
      );
    } finally {
      setIsSavingDescription(false);
    }
  };

  // Get display description: alternativeDescription if set, otherwise metadata.description
  const displayDescription = React.useMemo(() => {
    if (!tool) return '';
    const altDesc = (tool as any)?.alternativeDescription;
    return altDesc || tool.metadata.description || 'No description available';
  }, [tool]);

  // Check if alternative description is set
  const hasAlternativeDescription = React.useMemo(() => {
    return !!(tool && (tool as any)?.alternativeDescription);
  }, [tool]);

  // Handlers for attach modal
  const handleOpenAttachModal = () => {
    setAttachError(null);
    setSelectedGuardrailNs('');
    setSelectedGuardrailName('');
    setSelectedTiming('pre-execution');
    setSelectedParameters('');
    setIsAttachModalOpen(true);
  };

  const handleCloseAttachModal = () => {
    setIsAttachModalOpen(false);
    setAttachError(null);
  };

  const handleGuardrailSelect = (value: string) => {
    // Value format: "namespace/name"
    const [ns, ...nameParts] = value.split('/');
    const guardrailName = nameParts.join('/');
    setSelectedGuardrailNs(ns || 'default');
    setSelectedGuardrailName(guardrailName);
  };

  const handleAttachGuardrail = async () => {
    if (!selectedGuardrailName) {
      setAttachError('Please select a guardrail');
      return;
    }

    setIsAttaching(true);
    setAttachError(null);

    try {
      await attachGuardrailToTool(namespace, name, {
        guardrailNamespace: selectedGuardrailNs || 'default',
        guardrailName: selectedGuardrailName,
        executionTiming: selectedTiming,
        parameters: selectedParameters || undefined,
      });
      setRefreshTrigger((prev) => prev + 1);
      handleCloseAttachModal();
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Failed to attach guardrail');
    } finally {
      setIsAttaching(false);
    }
  };

  // Open detach confirmation modal
  const handleOpenDetachModal = (guardrailNs: string, guardrailName: string) => {
    setDetachGuardrailNs(guardrailNs);
    setDetachGuardrailName(guardrailName);
    setIsDetachModalOpen(true);
    setOpenDropdownKey(null);
  };

  const handleCloseDetachModal = () => {
    setIsDetachModalOpen(false);
    setDetachGuardrailNs('');
    setDetachGuardrailName('');
  };

  // Confirm and execute detach
  const handleConfirmDetach = async () => {
    const guardrailNs = detachGuardrailNs;
    const guardrailName = detachGuardrailName;

    setIsDetaching(`${guardrailNs}/${guardrailName}`);
    setDetachError(null);
    handleCloseDetachModal();

    try {
      await detachGuardrailFromTool(namespace, name, guardrailNs, guardrailName);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setDetachError(err instanceof Error ? err.message : 'Failed to detach guardrail');
    } finally {
      setIsDetaching(null);
    }
  };

  // Handlers for edit modal
  const handleOpenEditModal = (
    guardrailNs: string,
    guardrailName: string,
    timing: ExecutionTiming,
    parameters?: string,
  ) => {
    setEditError(null);
    setEditGuardrailNs(guardrailNs);
    setEditGuardrailName(guardrailName);
    setEditTiming(timing);
    setEditParameters(parameters || '');
    setIsEditModalOpen(true);
    setOpenDropdownKey(null);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    setIsEditing(true);
    setEditError(null);

    try {
      // To update, we detach and reattach with new values
      await detachGuardrailFromTool(namespace, name, editGuardrailNs, editGuardrailName);
      await attachGuardrailToTool(namespace, name, {
        guardrailNamespace: editGuardrailNs,
        guardrailName: editGuardrailName,
        executionTiming: editTiming,
        parameters: editParameters || undefined,
      });
      setRefreshTrigger((prev) => prev + 1);
      handleCloseEditModal();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update association');
    } finally {
      setIsEditing(false);
    }
  };

  if (!toolLoaded || !serversLoaded || !workloadsLoaded || !guardrailsLoaded) {
    return (
      <Bullseye>
        <Spinner size="xl" />
      </Bullseye>
    );
  }

  if (!name) {
    return (
      <PageSection>
        <EmptyState icon={WrenchIcon}>
          <Title headingLevel="h1" size="lg">
            Invalid Tool URL
          </Title>
          <EmptyStateBody>
            No tool name provided in the URL. Please navigate from the tools list.
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  if (toolError || !tool) {
    return (
      <PageSection>
        <EmptyState icon={WrenchIcon}>
          <Title headingLevel="h1" size="lg">
            Tool Not Found
          </Title>
          <EmptyStateBody>
            {toolError?.message || `MCP Tool "${name}" not found in namespace "${namespace}".`}
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  return (
    <>
      <PageSection>
        <Breadcrumbs items={createMcpCatalogBreadcrumbs('tool', tool.metadata.name)} />
      </PageSection>
      <PageSection>
        <Title headingLevel="h1" size="lg">
          MCP Tool: {hierarchicalName}
        </Title>
        {!serverReferenceValid && (
          <Alert
            variant="warning"
            isInline
            title="Server Reference Invalid"
            style={{ marginTop: '1rem' }}
          >
            The referenced server &quot;{parentServerName}&quot; could not be found in the catalog.
          </Alert>
        )}
      </PageSection>

      <PageSection>
        <Card>
          <CardBody>
            <Title headingLevel="h2" size="md" style={{ marginBottom: '1rem' }}>
              Tool Details
            </Title>
            <DescriptionList columnModifier={{ lg: '2Col' }}>
              <DescriptionListGroup>
                <DescriptionListTerm>Name</DescriptionListTerm>
                <DescriptionListDescription>{tool.metadata.name}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Hierarchical Name</DescriptionListTerm>
                <DescriptionListDescription>
                  <code>{hierarchicalName}</code>
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Namespace</DescriptionListTerm>
                <DescriptionListDescription>
                  {tool.metadata.namespace || 'default'}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>
                  <Flex
                    alignItems={{ default: 'alignItemsCenter' }}
                    spaceItems={{ default: 'spaceItemsSm' }}
                  >
                    <FlexItem>
                      Description
                      {hasAlternativeDescription && (
                        <Label color="blue" style={{ marginLeft: '0.5rem' }} isCompact>
                          Custom
                        </Label>
                      )}
                    </FlexItem>
                    {authLoaded && canManageGuardrails && !isEditingDescription && (
                      <FlexItem>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={handleStartEditDescription}
                          aria-label="Edit alternative description"
                        >
                          Edit
                        </Button>
                      </FlexItem>
                    )}
                  </Flex>
                </DescriptionListTerm>
                <DescriptionListDescription>
                  {isEditingDescription ? (
                    <Form>
                      <FormGroup fieldId="alternative-description-edit">
                        <TextArea
                          id="alternative-description-edit"
                          value={descriptionEditValue}
                          onChange={(_event, value) => setDescriptionEditValue(value)}
                          rows={4}
                          maxLength={2000}
                          aria-label="Alternative description"
                        />
                        <div
                          style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6a6e73' }}
                        >
                          This description will override the catalog description. Leave empty to use
                          the catalog description.
                        </div>
                        {descriptionSaveError && (
                          <Alert
                            variant="danger"
                            isInline
                            title={descriptionSaveError}
                            style={{ marginTop: '0.5rem' }}
                          />
                        )}
                        <Flex
                          spaceItems={{ default: 'spaceItemsSm' }}
                          style={{ marginTop: '0.5rem' }}
                        >
                          <FlexItem>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={handleSaveDescription}
                              isDisabled={isSavingDescription}
                              isLoading={isSavingDescription}
                            >
                              Save
                            </Button>
                          </FlexItem>
                          <FlexItem>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={handleCancelEditDescription}
                              isDisabled={isSavingDescription}
                            >
                              Cancel
                            </Button>
                          </FlexItem>
                        </Flex>
                      </FormGroup>
                    </Form>
                  ) : (
                    displayDescription
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Type</DescriptionListTerm>
                <DescriptionListDescription>
                  <Label color="blue">{tool.spec.type}</Label>
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Tool Type</DescriptionListTerm>
                <DescriptionListDescription>
                  {(tool.spec as any).mcp?.toolType || 'N/A'}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Lifecycle</DescriptionListTerm>
                <DescriptionListDescription>{tool.spec.lifecycle}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Owner</DescriptionListTerm>
                <DescriptionListDescription>{tool.spec.owner}</DescriptionListDescription>
              </DescriptionListGroup>
              {tool.spec.inputSchema && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Input Schema</DescriptionListTerm>
                  <DescriptionListDescription>
                    <pre style={{ fontSize: '0.875rem', maxHeight: '200px', overflow: 'auto' }}>
                      {JSON.stringify(tool.spec.inputSchema, null, 2)}
                    </pre>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
            </DescriptionList>
          </CardBody>
        </Card>
      </PageSection>

      <PageSection>
        <Card>
          <CardBody>
            <Title headingLevel="h2" size="md" style={{ marginBottom: '1rem' }}>
              Parent Server
            </Title>
            {parentServer ? (
              <DescriptionList>
                <DescriptionListGroup>
                  <DescriptionListTerm>Server</DescriptionListTerm>
                  <DescriptionListDescription>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        history.push(
                          `/mcp-catalog/servers/${parentServerName}?namespace=${namespace}`,
                        );
                      }}
                    >
                      {parentServerName}
                    </a>
                  </DescriptionListDescription>
                </DescriptionListGroup>
                {parentServer.metadata.description && (
                  <DescriptionListGroup>
                    <DescriptionListTerm>Description</DescriptionListTerm>
                    <DescriptionListDescription>
                      {parentServer.metadata.description}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                )}
              </DescriptionList>
            ) : parentServerName ? (
              <EmptyState variant="xs" icon={ServerIcon}>
                <Title headingLevel="h4" size="md">
                  Server Not Found
                </Title>
                <EmptyStateBody>
                  The referenced server &quot;{parentServerName}&quot; could not be found in the
                  catalog.
                </EmptyStateBody>
              </EmptyState>
            ) : (
              <EmptyState variant="xs" icon={ServerIcon}>
                <Title headingLevel="h4" size="md">
                  No Server Reference
                </Title>
                <EmptyStateBody>This tool does not reference a parent server.</EmptyStateBody>
              </EmptyState>
            )}
          </CardBody>
        </Card>
      </PageSection>

      <PageSection>
        <Card>
          <CardBody>
            <Title headingLevel="h2" size="md" style={{ marginBottom: '1rem' }}>
              Used By Workloads ({workloadsUsingTool.length})
            </Title>
            {workloadsUsingTool.length === 0 ? (
              <EmptyState variant="xs" icon={CubeIcon}>
                <Title headingLevel="h4" size="md">
                  Not used by any workloads
                </Title>
                <EmptyStateBody>
                  This tool is not currently referenced by any MCP workloads.
                </EmptyStateBody>
              </EmptyState>
            ) : (
              <Table aria-label="Used By Workloads Table" variant="compact">
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Type</Th>
                    <Th>Lifecycle</Th>
                    <Th>Owner</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {workloadsUsingTool.map((workload) => (
                    <Tr key={workload.metadata.uid || workload.metadata.name}>
                      <Td dataLabel="Name">
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            history.push(
                              `/mcp-catalog/workloads/${workload.metadata.name}?namespace=${
                                workload.metadata.namespace || 'default'
                              }`,
                            );
                          }}
                        >
                          {workload.metadata.name}
                        </a>
                      </Td>
                      <Td dataLabel="Type">{workload.spec.type}</Td>
                      <Td dataLabel="Lifecycle">{workload.spec.lifecycle}</Td>
                      <Td dataLabel="Owner">{workload.spec.owner}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </PageSection>

      <PageSection>
        <Card>
          <CardBody>
            <Flex
              justifyContent={{ default: 'justifyContentSpaceBetween' }}
              alignItems={{ default: 'alignItemsCenter' }}
              style={{ marginBottom: '1rem' }}
            >
              <FlexItem>
                <Title headingLevel="h2" size="md">
                  Guardrails ({toolGuardrails.length})
                </Title>
              </FlexItem>
              {authLoaded && canManageGuardrails && (
                <FlexItem>
                  <Button
                    variant="primary"
                    onClick={handleOpenAttachModal}
                    isDisabled={availableGuardrails.length === 0 && allGuardrailsLoaded}
                  >
                    Attach Guardrail
                  </Button>
                </FlexItem>
              )}
            </Flex>
            {detachError && (
              <Alert
                variant={AlertVariant.danger}
                isInline
                title="Detach Error"
                style={{ marginBottom: '1rem' }}
              >
                {detachError}
              </Alert>
            )}
            {toolGuardrails.length === 0 ? (
              <EmptyState variant="xs" icon={ShieldAltIcon}>
                <Title headingLevel="h4" size="md">
                  No guardrails attached
                </Title>
                <EmptyStateBody>
                  This tool does not have any guardrails attached.
                  {authLoaded && canManageGuardrails && availableGuardrails.length > 0 && (
                    <> Click &quot;Attach Guardrail&quot; to add one.</>
                  )}
                </EmptyStateBody>
              </EmptyState>
            ) : (
              <Table aria-label="Tool Guardrails Table" variant="compact">
                <Thead>
                  <Tr>
                    <Th>Guardrail</Th>
                    <Th>Execution Timing</Th>
                    <Th>Parameters</Th>
                    <Th>Status</Th>
                    {authLoaded && canManageGuardrails && <Th>Actions</Th>}
                  </Tr>
                </Thead>
                <Tbody>
                  {toolGuardrails.map((association) => {
                    const guardrail = association.guardrail;
                    const isDisabled = guardrail?.spec?.disabled;
                    const guardrailNs = guardrail?.metadata?.namespace || 'default';
                    const guardrailName = guardrail?.metadata?.name || '';
                    const dropdownKey = `${guardrailNs}/${guardrailName}`;
                    const isDropdownOpen = openDropdownKey === dropdownKey;
                    return (
                      <Tr key={dropdownKey} style={isDisabled ? { opacity: 0.6 } : undefined}>
                        <Td dataLabel="Guardrail">
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              history.push(
                                `/mcp-catalog/guardrails/${guardrailName}?namespace=${guardrailNs}`,
                              );
                            }}
                          >
                            {guardrailName}
                          </a>
                        </Td>
                        <Td dataLabel="Execution Timing">
                          <Label
                            color={
                              association.executionTiming === 'pre-execution' ? 'blue' : 'green'
                            }
                          >
                            {association.executionTiming}
                          </Label>
                        </Td>
                        <Td dataLabel="Parameters">
                          {association.parameters ? (
                            <pre
                              style={{
                                margin: 0,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontSize: '0.875rem',
                                maxWidth: '200px',
                              }}
                            >
                              {association.parameters}
                            </pre>
                          ) : (
                            <span style={{ color: '#6a6e73' }}>—</span>
                          )}
                        </Td>
                        <Td dataLabel="Status">
                          <Label color={isDisabled ? 'orange' : 'green'}>
                            {isDisabled ? 'Disabled' : 'Enabled'}
                          </Label>
                        </Td>
                        {authLoaded && canManageGuardrails && (
                          <Td dataLabel="Actions">
                            {isDetaching === dropdownKey ? (
                              <Spinner size="sm" aria-label="Detaching" />
                            ) : (
                              <Dropdown
                                isOpen={isDropdownOpen}
                                onSelect={() => setOpenDropdownKey(null)}
                                onOpenChange={(isOpen) =>
                                  setOpenDropdownKey(isOpen ? dropdownKey : null)
                                }
                                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                                  <MenuToggle
                                    ref={toggleRef}
                                    aria-label="Actions"
                                    variant="plain"
                                    onClick={() =>
                                      setOpenDropdownKey(isDropdownOpen ? null : dropdownKey)
                                    }
                                    isExpanded={isDropdownOpen}
                                    isDisabled={isDetaching !== null}
                                  >
                                    <EllipsisVIcon />
                                  </MenuToggle>
                                )}
                                popperProps={{ position: 'right' }}
                              >
                                <DropdownList>
                                  <DropdownItem
                                    key="edit"
                                    onClick={() =>
                                      handleOpenEditModal(
                                        guardrailNs,
                                        guardrailName,
                                        association.executionTiming,
                                        association.parameters,
                                      )
                                    }
                                  >
                                    Edit
                                  </DropdownItem>
                                  <DropdownItem
                                    key="detach"
                                    onClick={() =>
                                      handleOpenDetachModal(guardrailNs, guardrailName)
                                    }
                                    style={{ color: 'var(--pf-v5-global--danger-color--100)' }}
                                  >
                                    Detach
                                  </DropdownItem>
                                </DropdownList>
                              </Dropdown>
                            )}
                          </Td>
                        )}
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </PageSection>

      {/* Attach Guardrail Modal */}
      <Modal
        variant={ModalVariant.small}
        isOpen={isAttachModalOpen}
        onClose={handleCloseAttachModal}
      >
        <ModalHeader title="Attach Guardrail" labelId="attach-guardrail-title" />
        <ModalBody id="attach-guardrail-body">
          <Form>
            {attachError && (
              <Alert
                variant={AlertVariant.danger}
                isInline
                title="Error"
                style={{ marginBottom: '1rem' }}
              >
                {attachError}
              </Alert>
            )}
            <FormGroup label="Guardrail" isRequired fieldId="guardrail-select">
              <FormSelect
                id="guardrail-select"
                value={
                  selectedGuardrailName
                    ? `${selectedGuardrailNs || 'default'}/${selectedGuardrailName}`
                    : ''
                }
                onChange={(_event, value) => handleGuardrailSelect(value)}
                aria-label="Select guardrail"
              >
                <FormSelectOption key="" value="" label="Select a guardrail..." isPlaceholder />
                {availableGuardrails.map((g) => (
                  <FormSelectOption
                    key={`${g.metadata.namespace}/${g.metadata.name}`}
                    value={`${g.metadata.namespace}/${g.metadata.name}`}
                    label={`${g.metadata.name} - ${
                      g.metadata.description?.substring(0, 50) || 'No description'
                    }${g.metadata.description && g.metadata.description.length > 50 ? '...' : ''}`}
                  />
                ))}
              </FormSelect>
            </FormGroup>
            <FormGroup label="Execution Timing" isRequired fieldId="timing-select">
              <FormSelect
                id="timing-select"
                value={selectedTiming}
                onChange={(_event, value) => setSelectedTiming(value as ExecutionTiming)}
                aria-label="Select execution timing"
              >
                <FormSelectOption value="pre-execution" label="Pre-execution (before tool runs)" />
                <FormSelectOption value="post-execution" label="Post-execution (after tool runs)" />
              </FormSelect>
            </FormGroup>
            <FormGroup label="Parameters" fieldId="parameters-input">
              <TextArea
                id="parameters-input"
                value={selectedParameters}
                onChange={(_event, value) => setSelectedParameters(value)}
                aria-label="Optional parameters"
                placeholder="Optional: Enter parameters for this guardrail (JSON, YAML, or plain text)"
                rows={3}
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            onClick={handleAttachGuardrail}
            isLoading={isAttaching}
            isDisabled={!selectedGuardrailName || isAttaching}
          >
            Attach
          </Button>
          <Button variant="link" onClick={handleCloseAttachModal} isDisabled={isAttaching}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Guardrail Association Modal */}
      <Modal variant={ModalVariant.small} isOpen={isEditModalOpen} onClose={handleCloseEditModal}>
        <ModalHeader title="Edit Guardrail Association" labelId="edit-guardrail-title" />
        <ModalBody id="edit-guardrail-body">
          <Form>
            {editError && (
              <Alert
                variant={AlertVariant.danger}
                isInline
                title="Error"
                style={{ marginBottom: '1rem' }}
              >
                {editError}
              </Alert>
            )}
            <FormGroup label="Guardrail" fieldId="edit-guardrail-name">
              <div style={{ padding: '0.5rem 0', fontWeight: 500 }}>{editGuardrailName}</div>
            </FormGroup>
            <FormGroup label="Execution Timing" isRequired fieldId="edit-timing-select">
              <FormSelect
                id="edit-timing-select"
                value={editTiming}
                onChange={(_event, value) => setEditTiming(value as ExecutionTiming)}
                aria-label="Select execution timing"
              >
                <FormSelectOption value="pre-execution" label="Pre-execution (before tool runs)" />
                <FormSelectOption value="post-execution" label="Post-execution (after tool runs)" />
              </FormSelect>
            </FormGroup>
            <FormGroup label="Parameters" fieldId="edit-parameters-input">
              <TextArea
                id="edit-parameters-input"
                value={editParameters}
                onChange={(_event, value) => setEditParameters(value)}
                aria-label="Optional parameters"
                placeholder="Optional: Enter parameters for this guardrail (JSON, YAML, or plain text)"
                rows={3}
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            onClick={handleSaveEdit}
            isLoading={isEditing}
            isDisabled={isEditing}
          >
            Save
          </Button>
          <Button variant="link" onClick={handleCloseEditModal} isDisabled={isEditing}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Detach Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        isOpen={isDetachModalOpen}
        onClose={handleCloseDetachModal}
      >
        <ModalHeader title="Detach Guardrail" labelId="detach-guardrail-title" />
        <ModalBody id="detach-guardrail-body">
          <Alert
            variant={AlertVariant.warning}
            isInline
            title="Confirm Detach"
            style={{ marginBottom: '1rem' }}
          >
            Are you sure you want to detach the guardrail <strong>{detachGuardrailName}</strong>{' '}
            from this tool?
          </Alert>
          <p style={{ color: '#6a6e73' }}>
            This will remove the guardrail protection from this tool. You can reattach it later if
            needed.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleConfirmDetach}>
            Detach
          </Button>
          <Button variant="link" onClick={handleCloseDetachModal}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default McpToolPage;
