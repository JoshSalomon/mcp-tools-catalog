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
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { ServerIcon, SearchIcon } from '@patternfly/react-icons';
import { filterResources } from '../services/searchService';
import { usePerformanceMonitor } from '../utils/performanceMonitor';
import { Pagination } from './shared/Pagination';
import { CatalogMcpServer, CATALOG_MCP_SERVER_KIND, CATALOG_MCP_SERVER_TYPE } from '../models/CatalogMcpServer';
import { useCatalogEntities } from '../services/catalogService';

const ServersTab: React.FC = () => {
  const history = useHistory();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(100);

  const stopPerfMonitor = usePerformanceMonitor('ServersTab');

  // Fetch CatalogMcpServer entities from Backstage Catalog
  const [allEntities, loaded, loadError] = useCatalogEntities<CatalogMcpServer>(CATALOG_MCP_SERVER_KIND, CATALOG_MCP_SERVER_TYPE);

  React.useEffect(() => {
    if (loaded) {
      stopPerfMonitor();
    }
  }, [loaded, stopPerfMonitor]);

  // Filter to only show entities with spec.type === 'mcp-server' or 'server'
  // Also check label mcp-catalog.io/type === 'server' as fallback
  const servers = React.useMemo(() => {
    if (!allEntities || allEntities.length === 0) return [];
    
    return allEntities.filter(entity => {
      const entityType = entity.spec?.type || '';
      const labelType = entity.metadata.labels?.['mcp-catalog.io/type'] || '';
      
      // Check spec.type: 'mcp-server' or 'server'
      // Also check label as fallback
      return entityType === 'mcp-server' || 
             entityType === 'server' ||
             labelType === 'server';
    });
  }, [allEntities]);

  const filteredServers = React.useMemo(() => {
    return filterResources(servers || [], searchTerm);
  }, [servers, searchTerm]);

  const paginatedServers = React.useMemo(() => {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return filteredServers.slice(start, end);
  }, [filteredServers, page, perPage]);

  const onSetPage = (_event: any, newPage: number) => {
    setPage(newPage);
  };

  const onPerPageSelect = (_event: any, newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1);
  };

  if (!loaded) {
    return (
      <Bullseye>
        <Spinner size="xl" />
      </Bullseye>
    );
  }

  if (loadError) {
    return (
      <EmptyState icon={ServerIcon}>
        <Title headingLevel="h2" size="lg">
          Error Loading Servers
        </Title>
        <EmptyStateBody>
          {loadError.message || 'Failed to load MCP servers from Catalog.'}
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
              placeholder="Find server by name..."
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
          <ToolbarItem variant="pagination">
            <Pagination
              itemCount={filteredServers.length}
              page={page}
              perPage={perPage}
              onSetPage={onSetPage}
              onPerPageSelect={onPerPageSelect}
            />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {filteredServers.length === 0 ? (
        <EmptyState icon={searchTerm ? SearchIcon : ServerIcon}>
          <Title headingLevel="h2" size="lg">
            {searchTerm ? 'No results found' : 'No MCP Servers Found'}
          </Title>
          <EmptyStateBody>
            {searchTerm
              ? `No servers match "${searchTerm}"`
              : 'No MCP servers have been found in the catalog.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label="MCP Servers Table" variant="compact">
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
            {paginatedServers.map((server) => {
              // Count tools based on 'hasPart' relations (standard Backstage pattern)
              // Check both relations array and spec.hasPart
              let toolCount = server.relations?.filter(r => r.type === 'hasPart').length || 0;
              
              // Also check spec.hasPart if relations are not populated yet
              if (toolCount === 0 && server.spec.hasPart) {
                const hasPart = Array.isArray(server.spec.hasPart) ? server.spec.hasPart : [server.spec.hasPart];
                toolCount = hasPart.length;
              }
              
              return (
                <Tr key={server.metadata.uid || `${server.metadata.namespace}/${server.metadata.name}`}>
                  <Td dataLabel="Name">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        history.push(
                          `/mcp-catalog/servers/${server.metadata.name}?namespace=${server.metadata.namespace || 'default'}`
                        );
                      }}
                    >
                      {server.metadata.name}
                    </a>
                  </Td>
                  <Td dataLabel="Namespace">{server.metadata.namespace || 'default'}</Td>
                  <Td dataLabel="Type">{server.spec.type}</Td>
                  <Td dataLabel="Lifecycle">{server.spec.lifecycle}</Td>
                  <Td dataLabel="Owner">{server.spec.owner}</Td>
                  <Td dataLabel="Tools">
                    {toolCount}
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      )}
    </>
  );
};

export default ServersTab;
