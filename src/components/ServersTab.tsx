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
  Label,
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td, ExpandableRowContent } from '@patternfly/react-table';
import { ServerIcon, SearchIcon, BanIcon, ToolsIcon } from '@patternfly/react-icons';
import { filterResources } from '../services/searchService';
import { usePerformanceMonitor } from '../utils/performanceMonitor';
import { Pagination } from './shared/Pagination';
import {
  CatalogMcpServer,
  CATALOG_MCP_SERVER_KIND,
  CATALOG_MCP_SERVER_TYPE,
} from '../models/CatalogMcpServer';
import { CatalogMcpTool, MCP_TOOL_DISABLED_ANNOTATION } from '../models/CatalogMcpTool';
import { useCatalogEntities, useServerTools } from '../services/catalogService';

interface ServersTabProps {
  /** Initial search term from parent component */
  initialSearch?: string;
}

/**
 * Component to render the expanded row content showing tools for a server.
 * Fetches tools lazily when the row is expanded.
 * (007-server-tools-view US1)
 */
const ServerToolsRow: React.FC<{
  serverNamespace: string;
  serverName: string;
  isExpanded: boolean;
}> = ({ serverNamespace, serverName, isExpanded }) => {
  const history = useHistory();
  // Only fetch when expanded (skip=true when not expanded)
  const [tools, toolsLoaded, toolsError] = useServerTools(serverNamespace, serverName, !isExpanded);

  if (!isExpanded) {
    return null;
  }

  if (!toolsLoaded) {
    return (
      <Bullseye>
        <Spinner size="md" />
      </Bullseye>
    );
  }

  if (toolsError) {
    return (
      <EmptyState variant="xs">
        <EmptyStateBody>Error loading tools: {toolsError.message}</EmptyStateBody>
      </EmptyState>
    );
  }

  // T013: Empty state for servers with no tools
  if (tools.length === 0) {
    return (
      <EmptyState variant="xs" icon={ToolsIcon}>
        <EmptyStateBody>No tools available for this server</EmptyStateBody>
      </EmptyState>
    );
  }

  // T014: Tools are already sorted alphabetically (A-Z) by the backend
  return (
    <Table aria-label={`Tools for server ${serverName}`} variant="compact" borders={false}>
      <Thead>
        <Tr>
          <Th>Tool Name</Th>
          <Th>Description</Th>
          <Th>Status</Th>
        </Tr>
      </Thead>
      <Tbody>
        {tools.map((tool: CatalogMcpTool) => {
          const isDisabled =
            tool.metadata.annotations?.[MCP_TOOL_DISABLED_ANNOTATION] === 'true' ||
            (tool as any).disabled === true;

          // Use alternativeDescription if set, otherwise use metadata.description
          const description =
            (tool as any).alternativeDescription || tool.metadata.description || '';

          return (
            <Tr key={`${tool.metadata.namespace}/${tool.metadata.name}`}>
              <Td dataLabel="Tool Name">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    history.push(
                      `/mcp-catalog/tools/${tool.metadata.name}?namespace=${
                        tool.metadata.namespace || 'default'
                      }`,
                    );
                  }}
                >
                  {tool.metadata.name}
                </a>
              </Td>
              <Td dataLabel="Description">
                {description.length > 100 ? `${description.substring(0, 100)}...` : description}
              </Td>
              <Td dataLabel="Status">
                {isDisabled ? (
                  <Label color="red" icon={<BanIcon />}>
                    Disabled
                  </Label>
                ) : (
                  <Label color="green">Enabled</Label>
                )}
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};

const ServersTab: React.FC<ServersTabProps> = ({ initialSearch = '' }) => {
  const history = useHistory();
  const [searchTerm, setSearchTerm] = React.useState(initialSearch);
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(100);

  // T010: Expandable row state management - track which server rows are expanded
  const [expandedServerIds, setExpandedServerIds] = React.useState<Set<string>>(new Set());

  // Sync with parent search term
  React.useEffect(() => {
    setSearchTerm(initialSearch);
    setPage(1);
  }, [initialSearch]);

  const stopPerfMonitor = usePerformanceMonitor('ServersTab');

  // Fetch CatalogMcpServer entities from Backstage Catalog
  const [allEntities, loaded, loadError] = useCatalogEntities<CatalogMcpServer>(
    CATALOG_MCP_SERVER_KIND,
    CATALOG_MCP_SERVER_TYPE,
  );

  React.useEffect(() => {
    if (loaded) {
      stopPerfMonitor();
    }
  }, [loaded, stopPerfMonitor]);

  // Filter to only show entities with spec.type === 'mcp-server' or 'server'
  // Also check label mcp-catalog.io/type === 'server' as fallback
  const servers = React.useMemo(() => {
    if (!allEntities || allEntities.length === 0) return [];

    return allEntities.filter((entity) => {
      const entityType = entity.spec?.type || '';
      const labelType = entity.metadata.labels?.['mcp-catalog.io/type'] || '';

      // Check spec.type: 'mcp-server' or 'server'
      // Also check label as fallback
      return entityType === 'mcp-server' || entityType === 'server' || labelType === 'server';
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

  // T011: Toggle expand/collapse for a server row
  const toggleServerExpanded = (serverId: string) => {
    setExpandedServerIds((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
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

  // Column count for expandable row (expand toggle + 6 data columns)
  const columnCount = 7;

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
              aria-label="Search MCP servers by name or description"
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
              <Th screenReaderText="Expand/Collapse" />
              <Th>Name</Th>
              <Th>Namespace</Th>
              <Th>Type</Th>
              <Th>Lifecycle</Th>
              <Th>Owner</Th>
              <Th>Tools</Th>
            </Tr>
          </Thead>
          {paginatedServers.map((server, rowIndex) => {
            // Generate unique ID for this server row
            const serverId =
              server.metadata.uid ||
              `${server.metadata.namespace || 'default'}/${server.metadata.name}`;
            const isExpanded = expandedServerIds.has(serverId);

            // Count tools based on 'hasPart' relations (standard Backstage pattern)
            // Check both relations array and spec.hasPart
            let toolCount = server.relations?.filter((r) => r.type === 'hasPart').length || 0;

            // Also check spec.hasPart if relations are not populated yet
            if (toolCount === 0 && server.spec.hasPart) {
              const hasPart = Array.isArray(server.spec.hasPart)
                ? server.spec.hasPart
                : [server.spec.hasPart];
              toolCount = hasPart.length;
            }

            return (
              <Tbody key={serverId} isExpanded={isExpanded}>
                {/* T011: Server row with expand control */}
                <Tr>
                  <Td
                    expand={{
                      rowIndex,
                      isExpanded,
                      onToggle: () => toggleServerExpanded(serverId),
                      expandId: `expand-${serverId}`,
                    }}
                  />
                  <Td dataLabel="Name">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        history.push(
                          `/mcp-catalog/servers/${server.metadata.name}?namespace=${
                            server.metadata.namespace || 'default'
                          }`,
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
                  <Td dataLabel="Tools">{toolCount}</Td>
                </Tr>
                {/* T012: Expanded row content showing tools */}
                <Tr isExpanded={isExpanded}>
                  <Td colSpan={columnCount}>
                    <ExpandableRowContent>
                      <ServerToolsRow
                        serverNamespace={server.metadata.namespace || 'default'}
                        serverName={server.metadata.name}
                        isExpanded={isExpanded}
                      />
                    </ExpandableRowContent>
                  </Td>
                </Tr>
              </Tbody>
            );
          })}
        </Table>
      )}
    </>
  );
};

export default ServersTab;
