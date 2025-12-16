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
} from '@patternfly/react-core';
import { WrenchIcon, ServerIcon, CubeIcon } from '@patternfly/react-icons';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { usePerformanceMonitor } from '../utils/performanceMonitor';
import { CatalogMcpTool, CATALOG_MCP_TOOL_KIND } from '../models/CatalogMcpTool';
import { CatalogMcpServer, CATALOG_MCP_SERVER_KIND } from '../models/CatalogMcpServer';
import { CatalogMcpWorkload, CATALOG_MCP_WORKLOAD_KIND } from '../models/CatalogMcpWorkload';
import { useCatalogEntity, useCatalogEntities } from '../services/catalogService';
import { getEntityName, formatToolName } from '../utils/hierarchicalNaming';
import { validateServerReference } from '../services/validationService';

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

  const shouldFetch = Boolean(name);

  // Fetch tool entity
  const [tool, toolLoaded, toolError] = useCatalogEntity<CatalogMcpTool>(
    CATALOG_MCP_TOOL_KIND,
    shouldFetch ? name : '__placeholder__',
    namespace
  );

  // Fetch all servers to find parent server
  const [servers, serversLoaded] = useCatalogEntities<CatalogMcpServer>(
    CATALOG_MCP_SERVER_KIND,
    undefined,
    namespace
  );

  // Fetch all workloads to find ones that use this tool
  const [workloads, workloadsLoaded] = useCatalogEntities<CatalogMcpWorkload>(
    CATALOG_MCP_WORKLOAD_KIND,
    undefined,
    namespace
  );

  React.useEffect(() => {
    if (toolLoaded && serversLoaded && workloadsLoaded) {
      stopPerfMonitor();
    }
  }, [toolLoaded, serversLoaded, workloadsLoaded, stopPerfMonitor]);

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

  // Find parent server entity
  const parentServerName = React.useMemo(() => {
    return getParentServerName(tool);
  }, [tool]);

  const parentServer = React.useMemo(() => {
    if (!parentServerName || !servers) return null;
    return servers.find(s => s.metadata.name === parentServerName) || null;
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
    
    return workloads.filter(workload => {
      // Check spec.consumes array
      const consumes = workload.spec.consumes || [];
      if (consumes.includes(toolRef) || consumes.includes(name)) {
        return true;
      }
      
      // Check spec.mcp.tools array
      const mcpTools = (workload.spec as any).mcp?.tools || [];
      if (mcpTools.includes(toolRef) || mcpTools.includes(name)) {
        return true;
      }
      
      // Check relations
      const relations = workload.relations || [];
      return relations.some(rel => 
        rel.targetRef === toolRef || 
        rel.targetRef === name ||
        rel.targetRef?.endsWith(`/${name}`)
      );
    });
  }, [tool, workloads, name, namespace]);

  // Get hierarchical name (server/tool format)
  const hierarchicalName = React.useMemo(() => {
    if (!tool || !parentServerName) return tool?.metadata.name || '';
    return formatToolName(parentServerName, tool.metadata.name);
  }, [tool, parentServerName]);

  if (!toolLoaded || !serversLoaded || !workloadsLoaded) {
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
            The referenced server "{parentServerName}" could not be found in the catalog.
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
                <DescriptionListDescription>{tool.metadata.namespace || 'default'}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Description</DescriptionListTerm>
                <DescriptionListDescription>
                  {tool.metadata.description || 'No description available'}
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
                          `/mcp-catalog/servers/${parentServerName}?namespace=${namespace}`
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
                  The referenced server "{parentServerName}" could not be found in the catalog.
                </EmptyStateBody>
              </EmptyState>
            ) : (
              <EmptyState variant="xs" icon={ServerIcon}>
                <Title headingLevel="h4" size="md">
                  No Server Reference
                </Title>
                <EmptyStateBody>
                  This tool does not reference a parent server.
                </EmptyStateBody>
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
                              `/mcp-catalog/workloads/${workload.metadata.name}?namespace=${workload.metadata.namespace || 'default'}`
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
    </>
  );
};

export default McpToolPage;
