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
} from '@patternfly/react-core';
import { ServerIcon, WrenchIcon } from '@patternfly/react-icons';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { filterToolsByServer } from '../services/searchService';
import { usePerformanceMonitor } from '../utils/performanceMonitor';
import { OfflineIndicator } from './shared/OfflineIndicator';
import { CatalogMcpServer, CATALOG_MCP_SERVER_KIND } from '../models/CatalogMcpServer';
import { CatalogMcpTool, CATALOG_MCP_TOOL_KIND, CATALOG_MCP_TOOL_TYPE } from '../models/CatalogMcpTool';
import { useCatalogEntity, useCatalogEntities } from '../services/catalogService';

const McpServerPage: React.FC = () => {
  const params = useParams<{ name: string }>();
  const location = useLocation();
  const history = useHistory();
  
  // OpenShift Console dynamic plugins may not populate useParams correctly
  // Extract name from pathname as fallback: /mcp-catalog/servers/:name
  const extractNameFromPath = (pathname: string): string => {
    const match = pathname.match(/\/mcp-catalog\/servers\/([^/?]+)/);
    return match ? match[1] : '';
  };
  
  // Try params first, then fall back to pathname parsing
  const name = params.name || extractNameFromPath(location.pathname);
  
  // Debug logging
  React.useEffect(() => {
    console.log('McpServerPage - params:', params);
    console.log('McpServerPage - pathname:', location.pathname);
    console.log('McpServerPage - extracted name:', name);
  }, [params, location.pathname, name]);
  
  const searchParams = new URLSearchParams(location.search);
  const namespace = searchParams.get('namespace') || 'default';
  
  const stopPerfMonitor = usePerformanceMonitor('McpServerPage');

  // Don't fetch if name is not available yet
  const shouldFetch = Boolean(name);

  // Fetch server entity
  const [server, serverLoaded, serverError] = useCatalogEntity<CatalogMcpServer>(
    CATALOG_MCP_SERVER_KIND, 
    shouldFetch ? name : '__placeholder__', 
    namespace
  );

  // Fetch all tools to find ones provided by this server
  // In a more optimized version, we might use relations to fetch only relevant tools
  const [tools, toolsLoaded] = useCatalogEntities<CatalogMcpTool>(
    CATALOG_MCP_TOOL_KIND,
    CATALOG_MCP_TOOL_TYPE,
    namespace
  );

  React.useEffect(() => {
    if (serverLoaded && toolsLoaded) {
      stopPerfMonitor();
    }
  }, [serverLoaded, toolsLoaded, stopPerfMonitor]);

  const serverTools = React.useMemo(() => {
    if (!tools) return [];
    return filterToolsByServer(tools, name);
  }, [tools, name]);

  if (!serverLoaded || !toolsLoaded) {
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
        <EmptyState icon={ServerIcon}>
          <Title headingLevel="h1" size="lg">
            Invalid Server URL
          </Title>
          <EmptyStateBody>
            No server name provided in the URL. Please navigate from the servers list.
            <br />
            <small>Debug: params = {JSON.stringify(params)}, pathname = {location.pathname}</small>
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  if (serverError || !server) {
    return (
      <PageSection>
        <EmptyState icon={ServerIcon}>
          <Title headingLevel="h1" size="lg">
            Server Not Found
          </Title>
          <EmptyStateBody>
            {serverError?.message || `MCP Server "${name}" not found in namespace "${namespace}".`}
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  // Determine offline status
  const isOffline = false; 

  return (
    <>
      <PageSection>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title headingLevel="h1" size="lg">
            MCP Server: {server.metadata.name}
          </Title>
          <OfflineIndicator isOffline={isOffline} />
        </div>
      </PageSection>
      
      <PageSection>
        <Card>
          <CardBody>
            <Title headingLevel="h2" size="md" style={{ marginBottom: '1rem' }}>
              Server Details
            </Title>
            <DescriptionList columnModifier={{ lg: '2Col' }}>
              <DescriptionListGroup>
                <DescriptionListTerm>Name</DescriptionListTerm>
                <DescriptionListDescription>{server.metadata.name}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Namespace</DescriptionListTerm>
                <DescriptionListDescription>{server.metadata.namespace || 'default'}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Type</DescriptionListTerm>
                <DescriptionListDescription>
                  <Label color="blue">{server.spec.type}</Label>
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Lifecycle</DescriptionListTerm>
                <DescriptionListDescription>{server.spec.lifecycle}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Owner</DescriptionListTerm>
                <DescriptionListDescription>{server.spec.owner}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Transport</DescriptionListTerm>
                <DescriptionListDescription>
                  {server.spec.transport?.type || 'Unknown'} 
                  {server.spec.transport?.url && ` (${server.spec.transport.url})`}
                </DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
          </CardBody>
        </Card>
      </PageSection>

      <PageSection>
        <Card>
          <CardBody>
            <Title headingLevel="h2" size="md" style={{ marginBottom: '1rem' }}>
              Provided Tools ({serverTools.length})
            </Title>
            {serverTools.length === 0 ? (
               <EmptyState variant="xs" icon={WrenchIcon}>
                <Title headingLevel="h4" size="md">
                  No tools available
                </Title>
                <EmptyStateBody>
                  This server does not currently provide any tools.
                </EmptyStateBody>
              </EmptyState>
            ) : (
              <Table aria-label="Provided Tools Table" variant="compact">
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Type</Th>
                    <Th>Lifecycle</Th>
                    <Th>Owner</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {serverTools.map((tool) => (
                    <Tr key={tool.metadata.uid || tool.metadata.name}>
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
                      <Td dataLabel="Type">{tool.spec.type}</Td>
                      <Td dataLabel="Lifecycle">{tool.spec.lifecycle}</Td>
                      <Td dataLabel="Owner">{tool.spec.owner}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </PageSection>
    </>
  );
};

export default McpServerPage;
