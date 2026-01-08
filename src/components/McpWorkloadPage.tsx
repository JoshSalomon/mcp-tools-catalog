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
  AlertVariant,
  ExpandableSection,
  Button,
  Flex,
  FlexItem,
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
  Dropdown,
  DropdownList,
  DropdownItem,
  MenuToggle,
  MenuToggleElement,
} from '@patternfly/react-core';
import {
  CubeIcon,
  WrenchIcon,
  ServerIcon,
  ShieldAltIcon,
  EllipsisVIcon,
} from '@patternfly/react-icons';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { usePerformanceMonitor } from '../utils/performanceMonitor';
import { Breadcrumbs, createMcpCatalogBreadcrumbs } from './shared/Breadcrumbs';
import { CatalogMcpWorkload, CATALOG_MCP_WORKLOAD_KIND } from '../models/CatalogMcpWorkload';
import {
  CatalogMcpTool,
  CATALOG_MCP_TOOL_KIND,
  CATALOG_MCP_TOOL_TYPE,
  isToolDisabled,
} from '../models/CatalogMcpTool';
import {
  CatalogMcpServer,
  CATALOG_MCP_SERVER_KIND,
  CATALOG_MCP_SERVER_TYPE,
} from '../models/CatalogMcpServer';
import {
  useCatalogEntity,
  useCatalogEntities,
  useWorkloadToolGuardrails,
  useGuardrails,
  addGuardrailToWorkloadTool,
  removeGuardrailFromWorkloadTool,
  updateWorkloadToolGuardrail,
} from '../services/catalogService';
import { getEntityName } from '../utils/hierarchicalNaming';
import { validateToolReferences } from '../services/validationService';
import { useCanEditCatalog } from '../services/authService';
import { ExecutionTiming, WorkloadToolGuardrailAssociation } from '../models/CatalogMcpGuardrail';

/**
 * MCP Workload Detail Page for OpenShift Console
 */
/**
 * Helper component to display guardrails for a specific workload-tool relationship.
 * This component fetches and manages guardrails for one tool within the workload.
 */
interface ToolGuardrailsSectionProps {
  workloadNamespace: string;
  workloadName: string;
  toolNamespace: string;
  toolName: string;
  canManageGuardrails: boolean;
  authLoaded: boolean;
  allGuardrails: Array<{ metadata: { name: string; namespace: string; description: string } }>;
  allGuardrailsLoaded: boolean;
  refreshTrigger: number;
  onRefresh: () => void;
  history: ReturnType<typeof useHistory>;
}

const ToolGuardrailsSection: React.FC<ToolGuardrailsSectionProps> = ({
  workloadNamespace,
  workloadName,
  toolNamespace,
  toolName,
  canManageGuardrails,
  authLoaded,
  allGuardrails,
  allGuardrailsLoaded,
  refreshTrigger,
  onRefresh,
  history,
}) => {
  // Fetch guardrails for this workload-tool relationship
  const [guardrails, guardrailsLoaded, guardrailsError] = useWorkloadToolGuardrails(
    workloadNamespace,
    workloadName,
    toolNamespace,
    toolName,
    refreshTrigger,
  );

  // State for add modal
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [selectedGuardrailNs, setSelectedGuardrailNs] = React.useState('');
  const [selectedGuardrailName, setSelectedGuardrailName] = React.useState('');
  const [selectedTiming, setSelectedTiming] = React.useState<ExecutionTiming>('pre-execution');
  const [selectedParameters, setSelectedParameters] = React.useState('');
  const [addError, setAddError] = React.useState<string | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);

  // State for remove operations
  const [removeError, setRemoveError] = React.useState<string | null>(null);
  const [isRemoving, setIsRemoving] = React.useState<string | null>(null);

  // State for remove confirmation modal
  const [isRemoveModalOpen, setIsRemoveModalOpen] = React.useState(false);
  const [removeGuardrailNs, setRemoveGuardrailNs] = React.useState('');
  const [removeGuardrailName, setRemoveGuardrailName] = React.useState('');

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

  // Get available guardrails (not already attached to this workload-tool)
  const availableGuardrails = React.useMemo(() => {
    if (!allGuardrails) return [];
    const attachedKeys = new Set(
      guardrails.map(
        (g) => `${g.guardrail?.metadata?.namespace || 'default'}/${g.guardrail?.metadata?.name}`,
      ),
    );
    return allGuardrails.filter(
      (g) => !attachedKeys.has(`${g.metadata.namespace}/${g.metadata.name}`),
    );
  }, [allGuardrails, guardrails]);

  // Handlers
  const handleOpenAddModal = () => {
    setSelectedGuardrailNs('');
    setSelectedGuardrailName('');
    setSelectedTiming('pre-execution');
    setSelectedParameters('');
    setAddError(null);
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setAddError(null);
  };

  const handleGuardrailSelect = (value: string) => {
    const [ns, name] = value.split('/');
    setSelectedGuardrailNs(ns || 'default');
    setSelectedGuardrailName(name || '');
  };

  const handleAddGuardrail = async () => {
    if (!selectedGuardrailName) return;

    setIsAdding(true);
    setAddError(null);

    try {
      await addGuardrailToWorkloadTool(workloadNamespace, workloadName, toolNamespace, toolName, {
        guardrailNamespace: selectedGuardrailNs || 'default',
        guardrailName: selectedGuardrailName,
        executionTiming: selectedTiming,
        parameters: selectedParameters || undefined,
      });
      handleCloseAddModal();
      onRefresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenRemoveModal = (guardrailNs: string, guardrailName: string) => {
    setRemoveGuardrailNs(guardrailNs);
    setRemoveGuardrailName(guardrailName);
    setIsRemoveModalOpen(true);
  };

  const handleCloseRemoveModal = () => {
    setIsRemoveModalOpen(false);
    setRemoveGuardrailNs('');
    setRemoveGuardrailName('');
  };

  const handleRemoveGuardrail = async () => {
    const key = `${removeGuardrailNs}/${removeGuardrailName}`;
    setIsRemoving(key);
    setRemoveError(null);
    handleCloseRemoveModal();

    try {
      await removeGuardrailFromWorkloadTool(
        workloadNamespace,
        workloadName,
        toolNamespace,
        toolName,
        removeGuardrailNs,
        removeGuardrailName,
      );
      onRefresh();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRemoving(null);
    }
  };

  const handleOpenEditModal = (association: WorkloadToolGuardrailAssociation) => {
    const guardrailNs = association.guardrail?.metadata?.namespace || 'default';
    const guardrailName = association.guardrail?.metadata?.name || '';
    setEditGuardrailNs(guardrailNs);
    setEditGuardrailName(guardrailName);
    setEditTiming(association.executionTiming);
    setEditParameters(association.parameters || '');
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditGuardrailNs('');
    setEditGuardrailName('');
    setEditTiming('pre-execution');
    setEditParameters('');
    setEditError(null);
  };

  const handleEditGuardrail = async () => {
    setIsEditing(true);
    setEditError(null);

    try {
      await updateWorkloadToolGuardrail(
        workloadNamespace,
        workloadName,
        toolNamespace,
        toolName,
        editGuardrailNs,
        editGuardrailName,
        {
          executionTiming: editTiming,
          parameters: editParameters || null,
        },
      );
      handleCloseEditModal();
      onRefresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsEditing(false);
    }
  };

  if (!guardrailsLoaded) {
    return <Spinner size="sm" aria-label="Loading guardrails" />;
  }

  if (guardrailsError) {
    return <Alert variant="warning" isInline title="Failed to load guardrails" />;
  }

  return (
    <>
      <div style={{ marginTop: '1rem', marginLeft: '1rem' }}>
        <Flex
          justifyContent={{ default: 'justifyContentSpaceBetween' }}
          alignItems={{ default: 'alignItemsCenter' }}
          style={{ marginBottom: '0.5rem' }}
        >
          <FlexItem>
            <ShieldAltIcon style={{ marginRight: '0.5rem' }} />
            <strong>Guardrails ({guardrails.length})</strong>
          </FlexItem>
          {authLoaded && canManageGuardrails && (
            <FlexItem>
              <Button
                variant="link"
                onClick={handleOpenAddModal}
                isDisabled={availableGuardrails.length === 0 && allGuardrailsLoaded}
                size="sm"
              >
                Add Guardrail
              </Button>
            </FlexItem>
          )}
        </Flex>
        {removeError && (
          <Alert
            variant={AlertVariant.danger}
            isInline
            title="Remove Error"
            style={{ marginBottom: '0.5rem' }}
          >
            {removeError}
          </Alert>
        )}
        {guardrails.length === 0 ? (
          <div style={{ color: '#6a6e73', fontSize: '0.875rem', paddingLeft: '1.5rem' }}>
            No guardrails attached to this tool in this workload.
          </div>
        ) : (
          <Table
            aria-label={`Guardrails for ${toolName}`}
            variant="compact"
            style={{ marginLeft: '1rem' }}
          >
            <Thead>
              <Tr>
                <Th>Guardrail</Th>
                <Th>Timing</Th>
                <Th>Source</Th>
                <Th>Parameters</Th>
                <Th>Status</Th>
                {authLoaded && canManageGuardrails && <Th>Actions</Th>}
              </Tr>
            </Thead>
            <Tbody>
              {guardrails.map((association: WorkloadToolGuardrailAssociation) => {
                const guardrail = association.guardrail;
                const isDisabled = guardrail?.spec?.disabled;
                const guardrailNs = guardrail?.metadata?.namespace || 'default';
                const guardrailName = guardrail?.metadata?.name || '';
                const dropdownKey = `${workloadName}/${toolName}/${guardrailNs}/${guardrailName}`;
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
                    <Td dataLabel="Timing">
                      <Label
                        color={association.executionTiming === 'pre-execution' ? 'blue' : 'green'}
                        isCompact
                      >
                        {association.executionTiming}
                      </Label>
                    </Td>
                    <Td dataLabel="Source">
                      <Label color={association.source === 'tool' ? 'grey' : 'purple'} isCompact>
                        {association.source === 'tool' ? 'Inherited' : 'Workload'}
                      </Label>
                    </Td>
                    <Td dataLabel="Parameters">
                      {association.parameters ? (
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.85em',
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'inline-block',
                          }}
                          title={association.parameters}
                        >
                          {association.parameters}
                        </span>
                      ) : (
                        <span
                          style={{ color: 'var(--pf-v5-global--Color--200)', fontStyle: 'italic' }}
                        >
                          —
                        </span>
                      )}
                    </Td>
                    <Td dataLabel="Status">
                      <Label color={isDisabled ? 'orange' : 'green'} isCompact>
                        {isDisabled ? 'Disabled' : 'Enabled'}
                      </Label>
                    </Td>
                    {authLoaded && canManageGuardrails && (
                      <Td dataLabel="Actions">
                        {/* Hide actions for inherited guardrails */}
                        {association.source === 'tool' ? (
                          <span
                            style={{
                              color: 'var(--pf-v5-global--Color--200)',
                              fontStyle: 'italic',
                            }}
                          >
                            —
                          </span>
                        ) : isRemoving === `${guardrailNs}/${guardrailName}` ? (
                          <Spinner size="sm" aria-label="Removing" />
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
                                isDisabled={isRemoving !== null || isEditing}
                              >
                                <EllipsisVIcon />
                              </MenuToggle>
                            )}
                            popperProps={{ position: 'right' }}
                          >
                            <DropdownList>
                              <DropdownItem
                                key="edit"
                                onClick={() => handleOpenEditModal(association)}
                              >
                                Edit
                              </DropdownItem>
                              <DropdownItem
                                key="detach"
                                onClick={() => handleOpenRemoveModal(guardrailNs, guardrailName)}
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
      </div>

      {/* Add Guardrail Modal */}
      <Modal variant={ModalVariant.small} isOpen={isAddModalOpen} onClose={handleCloseAddModal}>
        <ModalHeader title={`Add Guardrail to ${toolName}`} labelId="add-guardrail-title" />
        <ModalBody id="add-guardrail-body">
          <Form>
            {addError && (
              <Alert
                variant={AlertVariant.danger}
                isInline
                title="Error"
                style={{ marginBottom: '1rem' }}
              >
                {addError}
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
            onClick={handleAddGuardrail}
            isLoading={isAdding}
            isDisabled={!selectedGuardrailName || isAdding}
          >
            Add
          </Button>
          <Button variant="link" onClick={handleCloseAddModal} isDisabled={isAdding}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Detach Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        isOpen={isRemoveModalOpen}
        onClose={handleCloseRemoveModal}
      >
        <ModalHeader title="Detach Guardrail" labelId="detach-guardrail-title" />
        <ModalBody>
          Are you sure you want to detach guardrail <strong>{removeGuardrailName}</strong> from tool{' '}
          <strong>{toolName}</strong> in this workload?
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleRemoveGuardrail}>
            Detach
          </Button>
          <Button variant="link" onClick={handleCloseRemoveModal}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Guardrail Modal */}
      <Modal variant={ModalVariant.small} isOpen={isEditModalOpen} onClose={handleCloseEditModal}>
        <ModalHeader
          title={`Edit Guardrail: ${editGuardrailName}`}
          labelId="edit-guardrail-title"
        />
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
            <FormGroup label="Execution Timing" isRequired fieldId="edit-timing-select">
              <FormSelect
                id="edit-timing-select"
                value={editTiming}
                onChange={(_event, value) => setEditTiming(value as ExecutionTiming)}
                aria-label="Select execution timing"
              >
                <FormSelectOption value="pre-execution" label="Pre-execution" />
                <FormSelectOption value="post-execution" label="Post-execution" />
              </FormSelect>
            </FormGroup>
            <FormGroup label="Parameters (optional)" fieldId="edit-parameters">
              <TextArea
                id="edit-parameters"
                value={editParameters}
                onChange={(_event, value) => setEditParameters(value)}
                placeholder="Optional parameters (JSON or text)"
                rows={4}
                aria-label="Parameters"
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            onClick={handleEditGuardrail}
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
    </>
  );
};

const McpWorkloadPage: React.FC = () => {
  const params = useParams<{ name: string }>();
  const location = useLocation();
  const history = useHistory();

  // OpenShift Console dynamic plugins may not populate useParams correctly
  // Extract name from pathname as fallback: /mcp-catalog/workloads/:name
  const extractNameFromPath = (pathname: string): string => {
    const match = pathname.match(/\/mcp-catalog\/workloads\/([^/?]+)/);
    return match ? match[1] : '';
  };

  const name = params.name || extractNameFromPath(location.pathname);
  const searchParams = new URLSearchParams(location.search);
  const namespace = searchParams.get('namespace') || 'default';

  const stopPerfMonitor = usePerformanceMonitor('McpWorkloadPage');

  // Permission check for mcp-user role
  const { canEdit: canManageGuardrails, loaded: authLoaded } = useCanEditCatalog();

  // State for guardrail refresh
  const [guardrailRefreshTrigger, setGuardrailRefreshTrigger] = React.useState(0);

  const handleGuardrailRefresh = () => {
    setGuardrailRefreshTrigger((prev) => prev + 1);
  };

  const shouldFetch = Boolean(name);

  // Fetch workload entity
  // Use full search string as cache key - timestamp parameter forces refetch after edits
  const [workload, workloadLoaded, workloadError] = useCatalogEntity<CatalogMcpWorkload>(
    CATALOG_MCP_WORKLOAD_KIND,
    shouldFetch ? name : '__placeholder__',
    namespace,
    location.search, // Full query string includes timestamp, forcing refetch when changed
    'workload', // Explicitly fetch from workloads endpoint
  );

  // Fetch all tools for reference resolution and validation
  const [tools, toolsLoaded] = useCatalogEntities<CatalogMcpTool>(
    CATALOG_MCP_TOOL_KIND,
    CATALOG_MCP_TOOL_TYPE,
  );

  // Fetch all servers for tools-by-server grouping
  const [servers, serversLoaded] = useCatalogEntities<CatalogMcpServer>(
    CATALOG_MCP_SERVER_KIND,
    CATALOG_MCP_SERVER_TYPE,
  );

  // Fetch all guardrails for add guardrail dropdown
  const [allGuardrails, allGuardrailsLoaded] = useGuardrails();

  React.useEffect(() => {
    if (workloadLoaded && toolsLoaded && serversLoaded && allGuardrailsLoaded) {
      stopPerfMonitor();
    }
  }, [workloadLoaded, toolsLoaded, serversLoaded, allGuardrailsLoaded, stopPerfMonitor]);

  // Get tool references from workload
  const getToolRefs = (workload: CatalogMcpWorkload | null): string[] => {
    if (!workload) return [];

    const refs: string[] = [];

    // Check spec.dependsOn first (primary source for tool dependencies)
    if (workload.spec.dependsOn) {
      refs.push(...workload.spec.dependsOn);
    }

    // Check spec.consumes array
    if (workload.spec.consumes) {
      refs.push(...workload.spec.consumes);
    }

    // Check spec.mcp.tools array
    if ((workload.spec as any).mcp?.tools) {
      refs.push(...(workload.spec as any).mcp.tools);
    }

    // Check relations for consumesApi
    if (workload.relations) {
      workload.relations
        .filter((rel) => rel.type === 'consumesApi' || rel.type === 'dependsOn')
        .forEach((rel) => refs.push(rel.targetRef));
    }

    return [...new Set(refs)]; // Remove duplicates
  };

  // Resolve tool references to actual tool entities
  const referencedTools = React.useMemo(() => {
    if (!workload || !tools) return [];

    const toolRefs = getToolRefs(workload);

    return toolRefs.map((ref) => {
      const toolName = getEntityName(ref);
      const tool = tools.find((t) => t.metadata.name === toolName);
      return {
        ref,
        name: toolName,
        tool: tool || null,
        isValid: !!tool,
      };
    });
  }, [workload, tools]);

  // Validate tool references
  const invalidToolRefs = React.useMemo(() => {
    if (!workload || !tools) return [];
    return validateToolReferences(workload, tools);
  }, [workload, tools]);

  // Get server name for a tool using subcomponentOf relation (standard Backstage pattern)
  // Priority: subcomponentOf > partOf > relations array > label
  const getToolServerName = (tool: CatalogMcpTool | null): string | null => {
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

  // Group tools by server
  const toolsByServer = React.useMemo(() => {
    const groups: Map<
      string,
      Array<{ ref: string; name: string; tool: CatalogMcpTool | null; isValid: boolean }>
    > = new Map();

    referencedTools.forEach((toolRef) => {
      const serverName = toolRef.tool
        ? getToolServerName(toolRef.tool) || 'Unknown Server'
        : 'Unknown Server';

      if (!groups.has(serverName)) {
        groups.set(serverName, []);
      }
      groups.get(serverName)!.push(toolRef);
    });

    // Sort by server name
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [referencedTools]);

  // Check if server exists in catalog
  const serverExists = (serverName: string): boolean => {
    if (!servers || serverName === 'Unknown Server') return false;
    return servers.some((s) => s.metadata.name === serverName);
  };

  // Track which server sections are expanded (default: all expanded)
  const [expandedServers, setExpandedServers] = React.useState<Set<string>>(new Set());
  const [initialized, setInitialized] = React.useState(false);

  // Initialize all servers as expanded when data loads
  React.useEffect(() => {
    if (toolsByServer.length > 0 && !initialized) {
      setExpandedServers(new Set(toolsByServer.map(([serverName]) => serverName)));
      setInitialized(true);
    }
  }, [toolsByServer, initialized]);

  const toggleServerExpanded = (serverName: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev);
      if (next.has(serverName)) {
        next.delete(serverName);
      } else {
        next.add(serverName);
      }
      return next;
    });
  };

  const expandAllServers = () => {
    setExpandedServers(new Set(toolsByServer.map(([serverName]) => serverName)));
  };

  const collapseAllServers = () => {
    setExpandedServers(new Set());
  };

  if (!workloadLoaded || !toolsLoaded || !serversLoaded || !allGuardrailsLoaded) {
    return (
      <Bullseye>
        <Spinner size="xl" />
      </Bullseye>
    );
  }

  if (!name) {
    return (
      <PageSection>
        <EmptyState icon={CubeIcon}>
          <Title headingLevel="h1" size="lg">
            Invalid Workload URL
          </Title>
          <EmptyStateBody>
            No workload name provided in the URL. Please navigate from the workloads list.
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  if (workloadError || !workload) {
    return (
      <PageSection>
        <EmptyState icon={CubeIcon}>
          <Title headingLevel="h1" size="lg">
            Workload Not Found
          </Title>
          <EmptyStateBody>
            {workloadError?.message ||
              `MCP Workload "${name}" not found in namespace "${namespace}".`}
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  return (
    <>
      <PageSection>
        <Breadcrumbs items={createMcpCatalogBreadcrumbs('workload', workload.metadata.name)} />
      </PageSection>
      <PageSection>
        <Title headingLevel="h1" size="lg">
          MCP Workload: {workload.metadata.name}
        </Title>
        {invalidToolRefs.length > 0 && (
          <Alert
            variant="warning"
            isInline
            title="Invalid Tool References"
            style={{ marginTop: '1rem' }}
          >
            The following tool references could not be resolved: {invalidToolRefs.join(', ')}
          </Alert>
        )}
      </PageSection>

      <PageSection>
        <Card>
          <CardBody>
            <Title headingLevel="h2" size="md" style={{ marginBottom: '1rem' }}>
              Workload Details
            </Title>
            <DescriptionList columnModifier={{ lg: '2Col' }}>
              <DescriptionListGroup>
                <DescriptionListTerm>Name</DescriptionListTerm>
                <DescriptionListDescription>{workload.metadata.name}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Namespace</DescriptionListTerm>
                <DescriptionListDescription>
                  {workload.metadata.namespace || 'default'}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Description</DescriptionListTerm>
                <DescriptionListDescription>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {workload.metadata.description || 'No description available'}
                  </div>
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Type</DescriptionListTerm>
                <DescriptionListDescription>
                  <Label color="blue">{workload.spec.type}</Label>
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Lifecycle</DescriptionListTerm>
                <DescriptionListDescription>{workload.spec.lifecycle}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Owner</DescriptionListTerm>
                <DescriptionListDescription>{workload.spec.owner}</DescriptionListDescription>
              </DescriptionListGroup>
              {workload.spec.system && (
                <DescriptionListGroup>
                  <DescriptionListTerm>System</DescriptionListTerm>
                  <DescriptionListDescription>{workload.spec.system}</DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {(workload.spec as any).purpose && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Purpose</DescriptionListTerm>
                  <DescriptionListDescription>
                    {(workload.spec as any).purpose}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {(workload.spec as any).deployment && (
                <DescriptionListGroup>
                  <DescriptionListTerm>Deployment</DescriptionListTerm>
                  <DescriptionListDescription>
                    <pre style={{ fontSize: '0.875rem', margin: 0 }}>
                      {typeof (workload.spec as any).deployment === 'object'
                        ? JSON.stringify((workload.spec as any).deployment, null, 2)
                        : (workload.spec as any).deployment}
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
            <Flex
              justifyContent={{ default: 'justifyContentSpaceBetween' }}
              alignItems={{ default: 'alignItemsCenter' }}
              style={{ marginBottom: '1rem' }}
            >
              <FlexItem>
                <Title headingLevel="h2" size="md">
                  Referenced Tools ({referencedTools.length}) - Grouped by Server
                </Title>
              </FlexItem>
              {toolsByServer.length > 1 && (
                <FlexItem>
                  <Button
                    variant="link"
                    onClick={expandAllServers}
                    style={{ marginRight: '0.5rem' }}
                  >
                    Expand All
                  </Button>
                  <Button variant="link" onClick={collapseAllServers}>
                    Collapse All
                  </Button>
                </FlexItem>
              )}
            </Flex>
            {referencedTools.length === 0 ? (
              <EmptyState variant="xs" icon={WrenchIcon}>
                <Title headingLevel="h4" size="md">
                  No tools referenced
                </Title>
                <EmptyStateBody>This workload does not reference any MCP tools.</EmptyStateBody>
              </EmptyState>
            ) : (
              toolsByServer.map(([serverName, serverTools]) => (
                <ExpandableSection
                  key={serverName}
                  toggleContent={
                    <Flex alignItems={{ default: 'alignItemsCenter' }} style={{ width: '100%' }}>
                      <FlexItem>
                        <ServerIcon style={{ marginRight: '0.5rem' }} />
                        {serverName} ({serverTools.length} tool{serverTools.length !== 1 ? 's' : ''}
                        )
                        {!serverExists(serverName) && serverName !== 'Unknown Server' && (
                          <Label color="orange" isCompact style={{ marginLeft: '0.5rem' }}>
                            Server Not Found
                          </Label>
                        )}
                      </FlexItem>
                      {serverExists(serverName) && (
                        <FlexItem align={{ default: 'alignRight' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              history.push(
                                `/mcp-catalog/servers/${serverName}?namespace=${namespace}`,
                              );
                            }}
                          >
                            Details
                          </Button>
                        </FlexItem>
                      )}
                    </Flex>
                  }
                  isExpanded={expandedServers.has(serverName)}
                  onToggle={() => toggleServerExpanded(serverName)}
                  style={{ marginBottom: '1rem' }}
                >
                  <div style={{ paddingLeft: '1rem' }}>
                    {serverTools.map((toolRef) => (
                      <Card key={toolRef.ref} style={{ marginBottom: '1rem' }}>
                        <CardBody>
                          <Flex
                            justifyContent={{ default: 'justifyContentSpaceBetween' }}
                            alignItems={{ default: 'alignItemsCenter' }}
                          >
                            <FlexItem>
                              <WrenchIcon style={{ marginRight: '0.5rem' }} />
                              {toolRef.isValid ? (
                                <a
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    history.push(
                                      `/mcp-catalog/tools/${toolRef.name}?namespace=${
                                        toolRef.tool?.metadata.namespace || namespace
                                      }`,
                                    );
                                  }}
                                  style={{ fontWeight: 'bold' }}
                                >
                                  {toolRef.name}
                                </a>
                              ) : (
                                <span style={{ color: '#999', fontWeight: 'bold' }}>
                                  {toolRef.name}
                                </span>
                              )}{' '}
                              {toolRef.isValid ? (
                                toolRef.tool && isToolDisabled(toolRef.tool) ? (
                                  <Label color="orange" isCompact style={{ marginLeft: '0.5rem' }}>
                                    Disabled
                                  </Label>
                                ) : (
                                  <Label color="green" isCompact style={{ marginLeft: '0.5rem' }}>
                                    Valid
                                  </Label>
                                )
                              ) : (
                                <Label color="red" isCompact style={{ marginLeft: '0.5rem' }}>
                                  Not Found
                                </Label>
                              )}
                            </FlexItem>
                            <FlexItem>
                              <span style={{ color: '#6a6e73', fontSize: '0.875rem' }}>
                                {toolRef.tool?.spec.lifecycle || 'N/A'}
                              </span>
                            </FlexItem>
                          </Flex>
                          {/* Guardrails section for this tool */}
                          {toolRef.isValid && toolRef.tool && (
                            <ToolGuardrailsSection
                              workloadNamespace={namespace}
                              workloadName={name}
                              toolNamespace={toolRef.tool.metadata.namespace || 'default'}
                              toolName={toolRef.name}
                              canManageGuardrails={canManageGuardrails}
                              authLoaded={authLoaded}
                              allGuardrails={allGuardrails}
                              allGuardrailsLoaded={allGuardrailsLoaded}
                              refreshTrigger={guardrailRefreshTrigger}
                              onRefresh={handleGuardrailRefresh}
                              history={history}
                            />
                          )}
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </ExpandableSection>
              ))
            )}
          </CardBody>
        </Card>
      </PageSection>
    </>
  );
};

export default McpWorkloadPage;
