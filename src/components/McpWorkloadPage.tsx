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
  ExpandableSection,
  Button,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { CubeIcon, WrenchIcon, ServerIcon } from '@patternfly/react-icons';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { usePerformanceMonitor } from '../utils/performanceMonitor';
import { Breadcrumbs, createMcpCatalogBreadcrumbs } from './shared/Breadcrumbs';
import { CatalogMcpWorkload, CATALOG_MCP_WORKLOAD_KIND } from '../models/CatalogMcpWorkload';
import { CatalogMcpTool, CATALOG_MCP_TOOL_KIND, CATALOG_MCP_TOOL_TYPE, isToolDisabled } from '../models/CatalogMcpTool';
import { CatalogMcpServer, CATALOG_MCP_SERVER_KIND, CATALOG_MCP_SERVER_TYPE } from '../models/CatalogMcpServer';
import { useCatalogEntity, useCatalogEntities } from '../services/catalogService';
import { getEntityName } from '../utils/hierarchicalNaming';
import { validateToolReferences } from '../services/validationService';
import { DependencyTreeView } from './shared/DependencyTreeView';

/**
 * MCP Workload Detail Page for OpenShift Console
 */
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

  const shouldFetch = Boolean(name);

  // Fetch workload entity
  const [workload, workloadLoaded, workloadError] = useCatalogEntity<CatalogMcpWorkload>(
    CATALOG_MCP_WORKLOAD_KIND,
    shouldFetch ? name : '__placeholder__',
    namespace
  );

  // Fetch all tools for reference resolution and validation
  const [tools, toolsLoaded] = useCatalogEntities<CatalogMcpTool>(
    CATALOG_MCP_TOOL_KIND,
    CATALOG_MCP_TOOL_TYPE
  );

  // Fetch all servers for tools-by-server grouping
  const [servers, serversLoaded] = useCatalogEntities<CatalogMcpServer>(
    CATALOG_MCP_SERVER_KIND,
    CATALOG_MCP_SERVER_TYPE
  );

  React.useEffect(() => {
    if (workloadLoaded && toolsLoaded && serversLoaded) {
      stopPerfMonitor();
    }
  }, [workloadLoaded, toolsLoaded, serversLoaded, stopPerfMonitor]);

  // Get tool references from workload
  const getToolRefs = (workload: CatalogMcpWorkload | null): string[] => {
    if (!workload) return [];
    
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
    
    return [...new Set(refs)]; // Remove duplicates
  };

  // Resolve tool references to actual tool entities
  const referencedTools = React.useMemo(() => {
    if (!workload || !tools) return [];
    
    const toolRefs = getToolRefs(workload);
    
    return toolRefs.map(ref => {
      const toolName = getEntityName(ref);
      const tool = tools.find(t => t.metadata.name === toolName);
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
    return tool.metadata.labels?.['mcp-catalog.io/server'] || null;
  };

  // Group tools by server
  const toolsByServer = React.useMemo(() => {
    const groups: Map<string, Array<{ ref: string; name: string; tool: CatalogMcpTool | null; isValid: boolean }>> = new Map();
    
    referencedTools.forEach(toolRef => {
      const serverName = toolRef.tool ? (getToolServerName(toolRef.tool) || 'Unknown Server') : 'Unknown Server';
      
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
    return servers.some(s => s.metadata.name === serverName);
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
    setExpandedServers(prev => {
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

  if (!workloadLoaded || !toolsLoaded || !serversLoaded) {
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
            {workloadError?.message || `MCP Workload "${name}" not found in namespace "${namespace}".`}
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
                <DescriptionListDescription>{workload.metadata.namespace || 'default'}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Description</DescriptionListTerm>
                <DescriptionListDescription>
                  {workload.metadata.description || 'No description available'}
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
                  <DescriptionListDescription>{(workload.spec as any).purpose}</DescriptionListDescription>
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
            <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }} style={{ marginBottom: '1rem' }}>
              <FlexItem>
                <Title headingLevel="h2" size="md">
                  Referenced Tools ({referencedTools.length}) - Grouped by Server
                </Title>
              </FlexItem>
              {toolsByServer.length > 1 && (
                <FlexItem>
                  <Button variant="link" onClick={expandAllServers} style={{ marginRight: '0.5rem' }}>
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
                <EmptyStateBody>
                  This workload does not reference any MCP tools.
                </EmptyStateBody>
              </EmptyState>
            ) : (
              toolsByServer.map(([serverName, serverTools]) => (
                <ExpandableSection
                  key={serverName}
                  toggleContent={
                    <span>
                      <ServerIcon style={{ marginRight: '0.5rem' }} />
                      {serverName} ({serverTools.length} tool{serverTools.length !== 1 ? 's' : ''})
                      {!serverExists(serverName) && serverName !== 'Unknown Server' && (
                        <Label color="orange" isCompact style={{ marginLeft: '0.5rem' }}>
                          Server Not Found
                        </Label>
                      )}
                    </span>
                  }
                  isExpanded={expandedServers.has(serverName)}
                  onToggle={() => toggleServerExpanded(serverName)}
                  style={{ marginBottom: '1rem' }}
                >
                  <div style={{ paddingLeft: '1rem' }}>
                    {serverExists(serverName) && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            history.push(`/mcp-catalog/servers/${serverName}?namespace=${namespace}`);
                          }}
                        >
                          View Server Details →
                        </a>
                      </div>
                    )}
                    <Table aria-label={`Tools from ${serverName}`} variant="compact">
                      <Thead>
                        <Tr>
                          <Th>Tool Name</Th>
                          <Th>Type</Th>
                          <Th>Lifecycle</Th>
                          <Th>Status</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {serverTools.map((toolRef) => (
                          <Tr key={toolRef.ref}>
                            <Td dataLabel="Tool Name">
                              {toolRef.isValid ? (
                                <a
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    history.push(
                                      `/mcp-catalog/tools/${toolRef.name}?namespace=${toolRef.tool?.metadata.namespace || namespace}`
                                    );
                                  }}
                                >
                                  {toolRef.name}
                                </a>
                              ) : (
                                <span style={{ color: '#999' }}>{toolRef.name}</span>
                              )}
                            </Td>
                            <Td dataLabel="Type">
                              {toolRef.tool?.spec.type || 'N/A'}
                            </Td>
                            <Td dataLabel="Lifecycle">
                              {toolRef.tool?.spec.lifecycle || 'N/A'}
                            </Td>
                            <Td dataLabel="Status">
                              {toolRef.isValid ? (
                                toolRef.tool && isToolDisabled(toolRef.tool) ? (
                                  <Label color="orange" isCompact>Disabled</Label>
                                ) : (
                                  <Label color="green" isCompact>Valid</Label>
                                )
                              ) : (
                                <Label color="red" isCompact>Not Found</Label>
                              )}
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </div>
                </ExpandableSection>
              ))
            )}
          </CardBody>
        </Card>
      </PageSection>

      <PageSection>
        <Card>
          <CardBody>
            <Title headingLevel="h2" size="md" style={{ marginBottom: '1rem' }}>
              Dependency Tree
            </Title>
            <DependencyTreeView
              workload={workload}
              tools={tools || []}
              servers={servers || []}
              namespace={namespace}
            />
          </CardBody>
        </Card>
      </PageSection>
    </>
  );
};

export default McpWorkloadPage;
