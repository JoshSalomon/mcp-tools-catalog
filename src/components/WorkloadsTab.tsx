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
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { CubeIcon, SearchIcon } from '@patternfly/react-icons';
import { filterResources } from '../services/searchService';
import { usePerformanceMonitor } from '../utils/performanceMonitor';
import { Pagination } from './shared/Pagination';
import { CatalogMcpWorkload, CATALOG_MCP_WORKLOAD_KIND } from '../models/CatalogMcpWorkload';
import { CatalogMcpTool, CATALOG_MCP_TOOL_KIND, CATALOG_MCP_TOOL_TYPE } from '../models/CatalogMcpTool';
import { useCatalogEntities } from '../services/catalogService';
import { getEntityName } from '../utils/hierarchicalNaming';

const WorkloadsTab: React.FC = () => {
  const history = useHistory();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [toolFilter, setToolFilter] = React.useState<string>('');
  const [isToolFilterOpen, setIsToolFilterOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(100);

  const stopPerfMonitor = usePerformanceMonitor('WorkloadsTab');

  // Fetch MCP workload entities from Backstage Catalog
  // Workloads can have spec.type = 'workflow', 'service', or 'mcp-workload'
  const [allEntities, workloadsLoaded, workloadsError] = useCatalogEntities<CatalogMcpWorkload>(
    CATALOG_MCP_WORKLOAD_KIND,
    undefined // Don't filter by type here, we'll do client-side filtering
  );

  // Fetch all tools for the filter dropdown
  const [allTools, toolsLoaded] = useCatalogEntities<CatalogMcpTool>(
    CATALOG_MCP_TOOL_KIND,
    CATALOG_MCP_TOOL_TYPE
  );

  React.useEffect(() => {
    if (workloadsLoaded && toolsLoaded) {
      stopPerfMonitor();
    }
  }, [workloadsLoaded, toolsLoaded, stopPerfMonitor]);

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

  // Get tool references from a workload
  const getWorkloadToolRefs = (workload: CatalogMcpWorkload): string[] => {
    const refs: string[] = [];
    
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
        .filter(rel => rel.type === 'consumesApi' || rel.type === 'dependsOn')
        .forEach(rel => refs.push(rel.targetRef));
    }
    
    return refs;
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

  if (!workloadsLoaded || !toolsLoaded) {
    return (
      <Bullseye>
        <Spinner size="xl" />
      </Bullseye>
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
            />
          </ToolbarItem>
          <ToolbarItem>
            <Popover
              position="left"
              isVisible={isToolFilterOpen}
              shouldClose={() => setIsToolFilterOpen(false)}
              bodyContent={
                <Menu>
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
              <Button variant="secondary" onClick={onToolFilterToggle}>
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
        <Table aria-label="MCP Workloads Table" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Namespace</Th>
              <Th>Type</Th>
              <Th>Lifecycle</Th>
              <Th>Owner</Th>
              <Th>Tools</Th>
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
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      )}
    </>
  );
};

export default WorkloadsTab;
