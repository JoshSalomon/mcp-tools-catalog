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
import { WrenchIcon, SearchIcon } from '@patternfly/react-icons';
import { filterResources } from '../services/searchService';
import { usePerformanceMonitor } from '../utils/performanceMonitor';
import { Pagination } from './shared/Pagination';
import { CatalogMcpTool, CATALOG_MCP_TOOL_KIND, CATALOG_MCP_TOOL_TYPE } from '../models/CatalogMcpTool';
import { useCatalogEntities } from '../services/catalogService';
import { getEntityName } from '../utils/hierarchicalNaming';

interface ToolsTabProps {
  /** Initial search term from parent component */
  initialSearch?: string;
}

const ToolsTab: React.FC<ToolsTabProps> = ({ initialSearch = '' }) => {
  const history = useHistory();
  const [searchTerm, setSearchTerm] = React.useState(initialSearch);
  const [serverFilter, setServerFilter] = React.useState<string>('');
  const [isServerFilterOpen, setIsServerFilterOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(100);
  
  // Sync with parent search term
  React.useEffect(() => {
    setSearchTerm(initialSearch);
    setPage(1);
  }, [initialSearch]);

  const stopPerfMonitor = usePerformanceMonitor('ToolsTab');

  // Fetch MCP tool entities from Backstage Catalog
  const [allEntities, toolsLoaded, toolsError] = useCatalogEntities<CatalogMcpTool>(
    CATALOG_MCP_TOOL_KIND,
    CATALOG_MCP_TOOL_TYPE
  );

  // Server names are extracted from tools themselves, no need to fetch servers separately

  React.useEffect(() => {
    if (toolsLoaded) {
      stopPerfMonitor();
    }
  }, [toolsLoaded, stopPerfMonitor]);

  // Filter to only show entities with spec.type === 'mcp-tool' or 'tool'
  // Also check label mcp-catalog.io/type === 'tool' as fallback
  const tools = React.useMemo(() => {
    if (!allEntities || allEntities.length === 0) return [];
    
    return allEntities.filter(entity => {
      const entityType = entity.spec?.type || '';
      const labelType = entity.metadata.labels?.['mcp-catalog.io/type'] || '';
      
      // Check spec.type: 'mcp-tool' or 'tool'
      // Also check label as fallback
      return entityType === 'mcp-tool' || 
             entityType === 'tool' ||
             labelType === 'tool';
    });
  }, [allEntities]);

  // Get server name from tool's subcomponentOf relation (standard Backstage pattern)
  // Priority: subcomponentOf > partOf > relations array > label
  const getToolServerName = (tool: CatalogMcpTool): string => {
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
      const partOfRelation = tool.relations.find(rel => rel.type === 'partOf');
      if (partOfRelation?.targetRef) {
        return getEntityName(partOfRelation.targetRef);
      }
    }
    
    // Fallback to spec.mcp.server (legacy)
    if (tool.spec.mcp?.server) {
      return getEntityName(tool.spec.mcp.server);
    }
    
    // Fallback to label
    return tool.metadata.labels?.['mcp-catalog.io/server'] || 'Unknown';
  };

  // Filter tools by search term and server
  const filteredTools = React.useMemo(() => {
    let result = filterResources(tools || [], searchTerm);
    
    if (serverFilter) {
      result = result.filter(tool => {
        const toolServerName = getToolServerName(tool);
        return toolServerName === serverFilter;
      });
    }
    
    return result;
  }, [tools, searchTerm, serverFilter]);

  const paginatedTools = React.useMemo(() => {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return filteredTools.slice(start, end);
  }, [filteredTools, page, perPage]);

  const onSetPage = (_event: any, newPage: number) => {
    setPage(newPage);
  };

  const onPerPageSelect = (_event: any, newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1);
  };

  const onServerFilterToggle = () => {
    setIsServerFilterOpen(!isServerFilterOpen);
  };

  const onServerFilterSelect = (serverName: string) => {
    setServerFilter(serverName === 'All Servers' ? '' : serverName);
    setIsServerFilterOpen(false);
    setPage(1);
  };

  // Get unique server names for filter dropdown
  const serverNames = React.useMemo(() => {
    const names = new Set<string>();
    tools?.forEach(tool => {
      const serverName = getToolServerName(tool);
      if (serverName && serverName !== 'Unknown') {
        names.add(serverName);
      }
    });
    return Array.from(names).sort();
  }, [tools]);

  if (!toolsLoaded) {
    return (
      <Bullseye>
        <Spinner size="xl" />
      </Bullseye>
    );
  }

  if (toolsError) {
    return (
      <EmptyState icon={WrenchIcon}>
        <Title headingLevel="h2" size="lg">
          Error Loading Tools
        </Title>
        <EmptyStateBody>
          {toolsError.message || 'Failed to load MCP tools from Catalog.'}
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
              placeholder="Find tool by name..."
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
              isVisible={isServerFilterOpen}
              shouldClose={() => setIsServerFilterOpen(false)}
              bodyContent={
                <Menu>
                  <MenuContent>
                    <MenuList>
                      <MenuItem onClick={() => onServerFilterSelect('All Servers')}>
                        All Servers
                      </MenuItem>
                      {serverNames.map(serverName => (
                        <MenuItem key={serverName} onClick={() => onServerFilterSelect(serverName)}>
                          {serverName}
                        </MenuItem>
                      ))}
                    </MenuList>
                  </MenuContent>
                </Menu>
              }
            >
              <Button variant="secondary" onClick={onServerFilterToggle}>
                Server: {serverFilter || 'All'}
              </Button>
            </Popover>
          </ToolbarItem>
          <ToolbarItem variant="pagination">
            <Pagination
              itemCount={filteredTools.length}
              page={page}
              perPage={perPage}
              onSetPage={onSetPage}
              onPerPageSelect={onPerPageSelect}
            />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {filteredTools.length === 0 ? (
        <EmptyState icon={searchTerm || serverFilter ? SearchIcon : WrenchIcon}>
          <Title headingLevel="h2" size="lg">
            {searchTerm || serverFilter ? 'No results found' : 'No MCP Tools Found'}
          </Title>
          <EmptyStateBody>
            {searchTerm || serverFilter
              ? `No tools match your search criteria.`
              : 'No MCP tools have been found in the catalog.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label="MCP Tools Table" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Namespace</Th>
              <Th>Type</Th>
              <Th>Server</Th>
              <Th>Lifecycle</Th>
              <Th>Owner</Th>
            </Tr>
          </Thead>
          <Tbody>
            {paginatedTools.map((tool) => {
              const serverName = getToolServerName(tool);
              
              return (
                <Tr key={tool.metadata.uid || `${tool.metadata.namespace}/${tool.metadata.name}`}>
                  <Td dataLabel="Name">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        history.push(
                          `/mcp-catalog/tools/${tool.metadata.name}?namespace=${tool.metadata.namespace || 'default'}`
                        );
                      }}
                    >
                      {tool.metadata.name}
                    </a>
                  </Td>
                  <Td dataLabel="Namespace">{tool.metadata.namespace || 'default'}</Td>
                  <Td dataLabel="Type">{tool.spec.type}</Td>
                  <Td dataLabel="Server">
                    {serverName && serverName !== 'Unknown' ? (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          history.push(
                            `/mcp-catalog/servers/${serverName}?namespace=${tool.metadata.namespace || 'default'}`
                          );
                        }}
                      >
                        {serverName}
                      </a>
                    ) : (
                      <span style={{ color: '#999' }}>Unknown</span>
                    )}
                  </Td>
                  <Td dataLabel="Lifecycle">{tool.spec.lifecycle}</Td>
                  <Td dataLabel="Owner">{tool.spec.owner}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      )}
    </>
  );
};

export default ToolsTab;
