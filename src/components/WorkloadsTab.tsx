import * as React from 'react';
import { useHistory } from 'react-router-dom';
import {
  Bullseye,
  Spinner,
  EmptyState,
  EmptyStateBody,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  SearchInput,
  Button,
  Menu,
  MenuContent,
  MenuList,
  MenuItem,
  Popover,
  PageSection,
  Alert,
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td, ActionsColumn } from '@patternfly/react-table';
import { CubeIcon, SearchIcon, PlusIcon } from '@patternfly/react-icons';
import { filterResources } from '../services/searchService';
import { usePerformanceMonitor } from '../utils/performanceMonitor';
import { Pagination } from './shared/Pagination';
import { CatalogMcpWorkload, CATALOG_MCP_WORKLOAD_KIND } from '../models/CatalogMcpWorkload';
import { CatalogMcpTool, CATALOG_MCP_TOOL_KIND, CATALOG_MCP_TOOL_TYPE } from '../models/CatalogMcpTool';
import { CatalogMcpServer, CATALOG_MCP_SERVER_KIND, CATALOG_MCP_SERVER_TYPE } from '../models/CatalogMcpServer';
import { useCatalogEntities, createWorkload, updateWorkload, deleteWorkload } from '../services/catalogService';
import { useCanEditWorkloads } from '../services/authService';
import { getEntityName } from '../utils/hierarchicalNaming';
import { WorkloadForm } from './WorkloadForm';

interface WorkloadsTabProps {
  /** Initial search term from parent component */
  initialSearch?: string;
}

const WorkloadsTab: React.FC<WorkloadsTabProps> = ({ initialSearch = '' }) => {
  const history = useHistory();
  const [searchTerm, setSearchTerm] = React.useState(initialSearch);
  const [toolFilter, setToolFilter] = React.useState<string>('');
  const [isToolFilterOpen, setIsToolFilterOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(100);
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [editingWorkload, setEditingWorkload] = React.useState<CatalogMcpWorkload | null>(null);
  const [deleteError, setDeleteError] = React.useState<Error | null>(null);
  
  // Check if user can edit workloads
  const { canEdit: canEditWorkloads, loaded: authLoaded } = useCanEditWorkloads();
  
  // Sync with parent search term
  React.useEffect(() => {
    setSearchTerm(initialSearch);
    setPage(1);
  }, [initialSearch]);

  const stopPerfMonitor = usePerformanceMonitor('WorkloadsTab');

  // Fetch MCP workload entities from Backstage Catalog
  // Workloads can have spec.type = 'workflow', 'service', or 'mcp-workload'
  const [allEntities, workloadsLoaded, workloadsError] = useCatalogEntities<CatalogMcpWorkload>(
    CATALOG_MCP_WORKLOAD_KIND,
    undefined // Don't filter by type here, we'll do client-side filtering
  );

  // Fetch all tools for the filter dropdown and form
  const [allTools, toolsLoaded] = useCatalogEntities<CatalogMcpTool>(
    CATALOG_MCP_TOOL_KIND,
    CATALOG_MCP_TOOL_TYPE
  );

  // Fetch all servers for the form
  const [allServers, serversLoaded] = useCatalogEntities<CatalogMcpServer>(
    CATALOG_MCP_SERVER_KIND,
    CATALOG_MCP_SERVER_TYPE
  );

  React.useEffect(() => {
    if (workloadsLoaded && toolsLoaded && serversLoaded) {
      stopPerfMonitor();
    }
  }, [workloadsLoaded, toolsLoaded, serversLoaded, stopPerfMonitor]);

  // Handle create workload
  const handleCreateWorkload = React.useCallback(async (formData: any) => {
    const workloadData = {
      metadata: {
        name: formData.name,
        namespace: formData.namespace,
        description: formData.description || undefined,
      },
      spec: {
        type: 'mcp-workload',
        lifecycle: formData.lifecycle || undefined,
        owner: formData.owner || undefined,
        dependsOn: Array.from(formData.selectedTools) as string[],
      },
    };

    await createWorkload(workloadData);
    setShowCreateForm(false);
    
    // Navigate with timestamp to force cache invalidation (faster than full page reload)
    history.push(
      `/mcp-catalog/workloads/${formData.name}?namespace=${formData.namespace}&t=${Date.now()}`
    );
  }, [history]);

  // Handle cancel create
  const handleCancelCreate = React.useCallback(() => {
    setShowCreateForm(false);
  }, []);

  // Handle edit workload
  const handleEditWorkload = React.useCallback(async (formData: any) => {
    if (!editingWorkload) return;

    const workloadData = {
      metadata: {
        description: formData.description || undefined,
      },
      spec: {
        type: editingWorkload.spec.type || 'mcp-workload',
        lifecycle: formData.lifecycle || undefined,
        owner: formData.owner || undefined,
        dependsOn: Array.from(formData.selectedTools) as string[],
      },
    };

    await updateWorkload(
      editingWorkload.metadata.namespace || 'default',
      editingWorkload.metadata.name,
      workloadData
    );
    
    // Navigate with timestamp to force cache invalidation (faster than full page reload)
    history.push(
      `/mcp-catalog/workloads/${editingWorkload.metadata.name}?namespace=${editingWorkload.metadata.namespace || 'default'}&t=${Date.now()}`
    );
    setEditingWorkload(null);
  }, [editingWorkload, history]);

  // Handle cancel edit
  const handleCancelEdit = React.useCallback(() => {
    setEditingWorkload(null);
  }, []);

  // Handle delete workload
  const handleDeleteWorkload = React.useCallback(async (workload: CatalogMcpWorkload) => {
    setDeleteError(null);
    try {
      await deleteWorkload(
        workload.metadata.namespace || 'default',
        workload.metadata.name
      );
      // Refresh the list by reloading
      window.location.reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  // Filter to only show entities with spec.type = 'workflow', 'service', or 'mcp-workload'
  // Also check label mcp-catalog.io/type === 'workload' as fallback
  const workloads = React.useMemo(() => {
    if (!allEntities || allEntities.length === 0) return [];
    
    return allEntities.filter(entity => {
      const entityType = entity.spec?.type || '';
      const labelType = entity.metadata.labels?.['mcp-catalog.io/type'] || '';
      
      // Check spec.type for workload types
      return entityType === 'mcp-workload' || 
             entityType === 'workflow' ||
             entityType === 'service' ||
             labelType === 'workload';
    });
  }, [allEntities]);

  // Get tool references from a workload (deduplicated by tool name)
  const getWorkloadToolRefs = (workload: CatalogMcpWorkload): string[] => {
    const refs: string[] = [];
    
    // Check spec.consumes array
    if (workload.spec.consumes) {
      refs.push(...workload.spec.consumes);
    }
    
    // Check spec.dependsOn array (standard Backstage field)
    if (workload.spec.dependsOn) {
      refs.push(...workload.spec.dependsOn);
    }
    
    // Check spec.mcp.tools array
    if ((workload.spec as any).mcp?.tools) {
      refs.push(...(workload.spec as any).mcp.tools);
    }
    
    // Check relations for dependsOn (only if spec.dependsOn is not present to avoid duplicates)
    if (!workload.spec.dependsOn && workload.relations) {
      workload.relations
        .filter(rel => rel.type === 'dependsOn')
        .forEach(rel => refs.push(rel.targetRef));
    }
    
    // Deduplicate by extracting tool names and keeping unique entries
    const uniqueToolNames = new Set<string>();
    const uniqueRefs: string[] = [];
    
    refs.forEach(ref => {
      const toolName = getEntityName(ref);
      if (toolName && !uniqueToolNames.has(toolName)) {
        uniqueToolNames.add(toolName);
        uniqueRefs.push(ref);
      }
    });
    
    return uniqueRefs;
  };

  // Get unique tool names for filter dropdown (from workload references)
  const toolNames = React.useMemo(() => {
    const names = new Set<string>();
    
    // Add tools from workloads' references
    workloads?.forEach(workload => {
      const toolRefs = getWorkloadToolRefs(workload);
      toolRefs.forEach(ref => {
        const toolName = getEntityName(ref);
        if (toolName) {
          names.add(toolName);
        }
      });
    });
    
    // Also add actual tool entities
    allTools?.forEach(tool => {
      if (tool.metadata.name) {
        names.add(tool.metadata.name);
      }
    });
    
    return Array.from(names).sort();
  }, [workloads, allTools]);

  // Filter workloads by search term and tool reference
  const filteredWorkloads = React.useMemo(() => {
    let result = filterResources(workloads || [], searchTerm);
    
    if (toolFilter) {
      result = result.filter(workload => {
        const toolRefs = getWorkloadToolRefs(workload);
        return toolRefs.some(ref => {
          const toolName = getEntityName(ref);
          return toolName === toolFilter;
        });
      });
    }
    
    return result;
  }, [workloads, searchTerm, toolFilter]);

  const paginatedWorkloads = React.useMemo(() => {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return filteredWorkloads.slice(start, end);
  }, [filteredWorkloads, page, perPage]);

  const onSetPage = (_event: any, newPage: number) => {
    setPage(newPage);
  };

  const onPerPageSelect = (_event: any, newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1);
  };

  const onToolFilterToggle = () => {
    setIsToolFilterOpen(!isToolFilterOpen);
  };

  const onToolFilterSelect = (toolName: string) => {
    setToolFilter(toolName === 'All Tools' ? '' : toolName);
    setIsToolFilterOpen(false);
    setPage(1);
  };

  // Get tools count for a workload
  const getToolsCount = (workload: CatalogMcpWorkload): number => {
    return getWorkloadToolRefs(workload).length;
  };

  if (!workloadsLoaded || !toolsLoaded || !serversLoaded || !authLoaded) {
    return (
      <Bullseye>
        <Spinner size="xl" />
      </Bullseye>
    );
  }

  // Show create form if requested
  if (showCreateForm) {
    return (
      <PageSection>
        <WorkloadForm
          servers={allServers}
          tools={allTools}
          onSave={handleCreateWorkload}
          onCancel={handleCancelCreate}
          isEditMode={false}
        />
      </PageSection>
    );
  }

  // Show edit form if requested
  if (editingWorkload) {
    return (
      <PageSection>
        <WorkloadForm
          initialWorkload={editingWorkload}
          servers={allServers}
          tools={allTools}
          onSave={handleEditWorkload}
          onCancel={handleCancelEdit}
          isEditMode={true}
        />
      </PageSection>
    );
  }

  if (workloadsError) {
    return (
      <EmptyState icon={CubeIcon}>
        <Title headingLevel="h2" size="lg">
          Error Loading Workloads
        </Title>
        <EmptyStateBody>
          {workloadsError.message || 'Failed to load MCP workloads from Catalog.'}
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            {canEditWorkloads && (
              <Button
                variant="primary"
                icon={<PlusIcon />}
                onClick={() => setShowCreateForm(true)}
                aria-label="Create new workload"
              >
                Create
              </Button>
            )}
          </ToolbarItem>
          <ToolbarItem>
            <SearchInput
              placeholder="Find workload by name..."
              value={searchTerm}
              onChange={(_event, value) => {
                setSearchTerm(value);
                setPage(1);
              }}
              onClear={() => {
                setSearchTerm('');
                setPage(1);
              }}
              aria-label="Search MCP workloads by name or description"
            />
          </ToolbarItem>
          <ToolbarItem>
            <Popover
              position="left"
              isVisible={isToolFilterOpen}
              shouldClose={() => setIsToolFilterOpen(false)}
              bodyContent={
                <Menu aria-label="Select tool filter">
                  <MenuContent>
                    <MenuList>
                      <MenuItem onClick={() => onToolFilterSelect('All Tools')}>
                        All Tools
                      </MenuItem>
                      {toolNames.map(toolName => (
                        <MenuItem key={toolName} onClick={() => onToolFilterSelect(toolName)}>
                          {toolName}
                        </MenuItem>
                      ))}
                    </MenuList>
                  </MenuContent>
                </Menu>
              }
            >
              <Button 
                variant="secondary" 
                onClick={onToolFilterToggle}
                aria-label={`Filter by tool: ${toolFilter || 'All tools'}`}
                aria-expanded={isToolFilterOpen}
                aria-haspopup="listbox"
              >
                Tool: {toolFilter || 'All'}
              </Button>
            </Popover>
          </ToolbarItem>
          <ToolbarItem variant="pagination">
            <Pagination
              itemCount={filteredWorkloads.length}
              page={page}
              perPage={perPage}
              onSetPage={onSetPage}
              onPerPageSelect={onPerPageSelect}
            />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {filteredWorkloads.length === 0 ? (
        <EmptyState icon={searchTerm || toolFilter ? SearchIcon : CubeIcon}>
          <Title headingLevel="h2" size="lg">
            {searchTerm || toolFilter ? 'No results found' : 'No MCP Workloads Found'}
          </Title>
          <EmptyStateBody>
            {searchTerm || toolFilter
              ? 'No workloads match your search criteria.'
              : 'No MCP workloads have been found in the catalog.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <>
          {deleteError && (
            <Alert
              variant="danger"
              title="Failed to delete workload"
              isInline
              actionClose={<Button variant="plain" onClick={() => setDeleteError(null)}>×</Button>}
              style={{ marginBottom: '1rem' }}
            >
              {deleteError.message}
            </Alert>
          )}
          
          <Table aria-label="MCP Workloads Table" variant="compact">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Namespace</Th>
                <Th>Type</Th>
                <Th>Lifecycle</Th>
                <Th>Owner</Th>
                <Th>Tools</Th>
                {canEditWorkloads && <Th>Actions</Th>}
              </Tr>
            </Thead>
            <Tbody>
              {paginatedWorkloads.map((workload) => {
                const toolsCount = getToolsCount(workload);
                
                return (
                  <Tr key={workload.metadata.uid || `${workload.metadata.namespace}/${workload.metadata.name}`}>
                    <Td dataLabel="Name">
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          history.push(
                            `/mcp-catalog/workloads/${workload.metadata.name}?namespace=${workload.metadata.namespace || 'default'}`
                          );
                        }}
                      >
                        {workload.metadata.name}
                      </a>
                    </Td>
                    <Td dataLabel="Namespace">{workload.metadata.namespace || 'default'}</Td>
                    <Td dataLabel="Type">{workload.spec.type}</Td>
                    <Td dataLabel="Lifecycle">{workload.spec.lifecycle}</Td>
                    <Td dataLabel="Owner">{workload.spec.owner}</Td>
                    <Td dataLabel="Tools">{toolsCount}</Td>
                    {canEditWorkloads && (
                      <Td dataLabel="Actions">
                        <ActionsColumn
                          items={[
                            {
                              title: 'Edit',
                              onClick: () => setEditingWorkload(workload),
                            },
                            {
                              title: 'Delete',
                              onClick: () => {
                                if (window.confirm(`Are you sure you want to delete workload "${workload.metadata.name}"?`)) {
                                  handleDeleteWorkload(workload);
                                }
                              },
                              isSeparator: false,
                            },
                          ]}
                        />
                      </Td>
                    )}
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </>
      )}
    </>
  );
};

export default WorkloadsTab;
