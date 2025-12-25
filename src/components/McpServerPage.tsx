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
import { Breadcrumbs, createMcpCatalogBreadcrumbs } from './shared/Breadcrumbs';
import { CatalogMcpServer, CATALOG_MCP_SERVER_KIND } from '../models/CatalogMcpServer';
import { CatalogMcpTool, CATALOG_MCP_TOOL_KIND, CATALOG_MCP_TOOL_TYPE, isToolDisabled } from '../models/CatalogMcpTool';
import { useCatalogEntity, useCatalogEntities } from '../services/catalogService';
import { useBatchToolState } from '../hooks/useBatchToolState';
import { useCanEditCatalog } from '../services/authService';
import { DisabledCheckbox } from './shared/DisabledCheckbox';
import { Button, Alert, Flex, FlexItem } from '@patternfly/react-core';
import { CheckCircleIcon, TimesCircleIcon } from '@patternfly/react-icons';

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

  // Check if user has mcp-admin role for tool state editing
  const { canEdit: canEditToolStates, loaded: authLoaded } = useCanEditCatalog();
  
  // Batch tool state management
  const handleToolStateSaveComplete = React.useCallback((updatedTools: CatalogMcpTool[]) => {
    // Force a refresh by triggering a re-fetch
    // The useCatalogEntities hook will automatically refetch when dependencies change
    // For now, we'll rely on the component re-rendering after save
    window.location.reload(); // Simple approach - could be optimized with state management
  }, []);
  
  const batchToolState = useBatchToolState(serverTools, handleToolStateSaveComplete);
  
  // Handle tool toggle for batch editing
  const handleToolToggle = React.useCallback((tool: CatalogMcpTool) => {
    batchToolState.toggleTool(tool);
  }, [batchToolState]);
  
  // Handle save
  const handleSave = React.useCallback(async () => {
    await batchToolState.save();
  }, [batchToolState]);
  
  // Handle cancel
  const handleCancel = React.useCallback(() => {
    batchToolState.cancel();
  }, [batchToolState]);

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
        <Breadcrumbs items={createMcpCatalogBreadcrumbs('server', server.metadata.name)} />
      </PageSection>
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
              <>
                {/* Error display for batch editing */}
                {authLoaded && canEditToolStates && batchToolState.error && (
                  <Alert
                    variant="danger"
                    title="Failed to save tool state changes"
                    isInline
                    actionClose={<Button variant="plain" onClick={batchToolState.clearError}>×</Button>}
                    style={{ marginBottom: '1rem' }}
                  >
                    {batchToolState.error.message}
                  </Alert>
                )}
                
                {/* Save/Cancel buttons for batch editing */}
                {authLoaded && canEditToolStates && (
                  <Flex
                    alignItems={{ default: 'alignItemsCenter' }}
                    spaceItems={{ default: 'spaceItemsMd' }}
                    style={{ marginBottom: '1rem' }}
                  >
                    <FlexItem>
                      <Button
                        variant="primary"
                        onClick={handleSave}
                        isDisabled={!batchToolState.hasChanges() || batchToolState.isSaving}
                        icon={batchToolState.isSaving ? <Spinner size="sm" /> : <CheckCircleIcon />}
                      >
                        {batchToolState.isSaving ? 'Saving...' : 'Save'}
                      </Button>
                    </FlexItem>
                    <FlexItem>
                      <Button
                        variant="secondary"
                        onClick={handleCancel}
                        isDisabled={!batchToolState.hasChanges() || batchToolState.isSaving}
                        icon={<TimesCircleIcon />}
                      >
                        Cancel
                      </Button>
                    </FlexItem>
                    {batchToolState.hasChanges() && (
                      <FlexItem>
                        <span style={{ fontSize: '0.875rem', color: '#6a6e73' }}>
                          {batchToolState.pendingChanges.size} change{batchToolState.pendingChanges.size !== 1 ? 's' : ''} pending
                        </span>
                      </FlexItem>
                    )}
                  </Flex>
                )}
                
                <Table aria-label="Provided Tools Table" variant="compact">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Type</Th>
                      <Th>Lifecycle</Th>
                      <Th>Owner</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {serverTools.map((tool: CatalogMcpTool, index: number) => {
                      const currentDisabledState = authLoaded && canEditToolStates 
                        ? batchToolState.getToolState(tool)
                        : isToolDisabled(tool);
                      const rowStyle = currentDisabledState ? { opacity: 0.6, backgroundColor: '#f5f5f5' } : undefined;
                      
                      // Create tool with current state for DisabledCheckbox
                      // Use destructuring to ensure React sees new object reference
                      // See CHECKBOX-UI-FIX.md for why we use this pattern instead of delete
                      const baseAnnotations = { ...tool.metadata.annotations };
                      const { 'mcp-catalog.io/disabled': _, ...annotationsWithoutDisabled } = baseAnnotations;
                      
                      const annotations = currentDisabledState
                        ? { ...annotationsWithoutDisabled, 'mcp-catalog.io/disabled': 'true' }
                        : annotationsWithoutDisabled;
                      
                      const toolWithState: CatalogMcpTool = {
                        ...tool,
                        metadata: {
                          ...tool.metadata,
                          annotations,
                        },
                      };
                      
                      // Ensure all values are strings to avoid type errors
                      const uidStr: string = String(tool.metadata.uid ?? '');
                      const nameStr: string = String(tool.metadata.name ?? '');
                      const fallbackKey: string = `tool-${index}`;
                      const toolKey: string = uidStr || nameStr || fallbackKey || `tool-${index}`;
                      const toolName: string = nameStr || '';
                      return (
                        <Tr key={toolKey} style={rowStyle}>
                          <Td dataLabel="Name">
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                const toolNamespace = String(tool.metadata.namespace || 'default');
                                if (toolName) {
                                  history.push(
                                    `/mcp-catalog/tools/${toolName}?namespace=${toolNamespace}`
                                  );
                                }
                              }}
                            >
                              {toolName}
                            </a>
                          </Td>
                          <Td dataLabel="Type">{String(tool.spec.type || '')}</Td>
                          <Td dataLabel="Lifecycle">{String(tool.spec.lifecycle || '')}</Td>
                          <Td dataLabel="Owner">{String(tool.spec.owner || '')}</Td>
                          <Td dataLabel="Status">
                            {authLoaded && canEditToolStates ? (
                              <DisabledCheckbox 
                                tool={toolWithState} 
                                readOnly={false}
                                onToggle={handleToolToggle}
                              />
                            ) : (
                              <span>{currentDisabledState ? 'Disabled' : 'Enabled'}</span>
                            )}
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </>
            )}
          </CardBody>
        </Card>
      </PageSection>
    </>
  );
};

export default McpServerPage;
