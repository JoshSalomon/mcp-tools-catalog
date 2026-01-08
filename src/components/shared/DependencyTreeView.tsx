import * as React from 'react';
import { useHistory } from 'react-router-dom';
import {
  TreeView,
  TreeViewDataItem,
  SearchInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  EmptyState,
  EmptyStateBody,
  Title,
  Label,
} from '@patternfly/react-core';
import { CubeIcon, ServerIcon, WrenchIcon } from '@patternfly/react-icons';
import { CatalogMcpWorkload } from '../../models/CatalogMcpWorkload';
import { CatalogMcpTool } from '../../models/CatalogMcpTool';
import { CatalogMcpServer } from '../../models/CatalogMcpServer';
import { getEntityName } from '../../utils/hierarchicalNaming';

export interface DependencyTreeViewProps {
  /**
   * The workload entity to display dependencies for
   */
  workload: CatalogMcpWorkload;
  /**
   * All tools available in the catalog
   */
  tools: CatalogMcpTool[];
  /**
   * All servers available in the catalog
   */
  servers: CatalogMcpServer[];
  /**
   * Default namespace for navigation
   */
  namespace?: string;
}

interface TreeNodeData {
  type: 'workload' | 'server' | 'tool';
  name: string;
  namespace: string;
  exists: boolean;
}

/**
 * DependencyTreeView - Displays hierarchical workload → server → tool dependencies
 * with expandable nodes, clickable navigation, and search/filter capability.
 */
export const DependencyTreeView: React.FC<DependencyTreeViewProps> = ({
  workload,
  tools,
  servers,
  namespace = 'default',
}) => {
  const history = useHistory();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filteredItems, setFilteredItems] = React.useState<TreeViewDataItem[]>([]);

  // Get tool references from workload
  const getToolRefs = (workload: CatalogMcpWorkload): string[] => {
    const refs: string[] = [];

    if (workload.spec.consumes) {
      refs.push(...workload.spec.consumes);
    }

    if ((workload.spec as any).mcp?.tools) {
      refs.push(...(workload.spec as any).mcp.tools);
    }

    if (workload.relations) {
      workload.relations
        .filter((rel) => rel.type === 'consumesApi' || rel.type === 'dependsOn')
        .forEach((rel) => refs.push(rel.targetRef));
    }

    return [...new Set(refs)];
  };

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

  // Find tool entity by name
  const findTool = (toolName: string): CatalogMcpTool | null => {
    return tools.find((t) => t.metadata.name === toolName) || null;
  };

  // Find server entity by name
  const findServer = (serverName: string): CatalogMcpServer | null => {
    return servers.find((s) => s.metadata.name === serverName) || null;
  };

  // Handle node click for navigation
  const handleNodeClick = (nodeData: TreeNodeData) => {
    if (!nodeData.exists) return;

    const ns = nodeData.namespace || namespace;

    switch (nodeData.type) {
      case 'workload':
        history.push(`/mcp-catalog/workloads/${nodeData.name}?namespace=${ns}`);
        break;
      case 'server':
        history.push(`/mcp-catalog/servers/${nodeData.name}?namespace=${ns}`);
        break;
      case 'tool':
        history.push(`/mcp-catalog/tools/${nodeData.name}?namespace=${ns}`);
        break;
    }
  };

  // Build tree data structure
  const buildTreeData = React.useCallback((): TreeViewDataItem[] => {
    const toolRefs = getToolRefs(workload);

    // Group tools by server
    const serverToolMap: Map<string, { tool: CatalogMcpTool | null; toolName: string }[]> =
      new Map();

    toolRefs.forEach((ref) => {
      const toolName = getEntityName(ref);
      const tool = findTool(toolName);
      const serverName = tool ? getToolServerName(tool) || 'Unknown Server' : 'Unknown Server';

      if (!serverToolMap.has(serverName)) {
        serverToolMap.set(serverName, []);
      }
      serverToolMap.get(serverName)!.push({ tool, toolName });
    });

    // Build server nodes with tool children
    const serverNodes: TreeViewDataItem[] = Array.from(serverToolMap.entries()).map(
      ([serverName, toolInfos]) => {
        const serverEntity = findServer(serverName);
        const serverExists = !!serverEntity;

        const toolChildren: TreeViewDataItem[] = toolInfos.map(({ tool, toolName }) => {
          const toolExists = !!tool;
          const toolNodeData: TreeNodeData = {
            type: 'tool',
            name: toolName,
            namespace: tool?.metadata.namespace || namespace,
            exists: toolExists,
          };

          return {
            name: toolName,
            id: `tool-${toolName}`,
            icon: <WrenchIcon />,
            customBadgeContent: !toolExists ? (
              <Label color="red" isCompact>
                Not Found
              </Label>
            ) : undefined,
            action: toolExists ? (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNodeClick(toolNodeData);
                }}
                style={{ fontSize: '0.75rem' }}
              >
                View →
              </a>
            ) : undefined,
          };
        });

        const serverNodeData: TreeNodeData = {
          type: 'server',
          name: serverName,
          namespace: serverEntity?.metadata.namespace || namespace,
          exists: serverExists,
        };

        return {
          name: serverName,
          id: `server-${serverName}`,
          icon: <ServerIcon />,
          children: toolChildren,
          defaultExpanded: true,
          customBadgeContent:
            !serverExists && serverName !== 'Unknown Server' ? (
              <Label color="orange" isCompact>
                Not Found
              </Label>
            ) : (
              <Label isCompact>{toolChildren.length}</Label>
            ),
          action: serverExists ? (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleNodeClick(serverNodeData);
              }}
              style={{ fontSize: '0.75rem' }}
            >
              View →
            </a>
          ) : undefined,
        };
      },
    );

    // Build workload root node
    const workloadNodeData: TreeNodeData = {
      type: 'workload',
      name: workload.metadata.name,
      namespace: workload.metadata.namespace || namespace,
      exists: true,
    };

    const rootNode: TreeViewDataItem = {
      name: workload.metadata.name,
      id: `workload-${workload.metadata.name}`,
      icon: <CubeIcon />,
      children: serverNodes,
      defaultExpanded: true,
      customBadgeContent: (
        <Label color="blue" isCompact>
          {workload.spec.type}
        </Label>
      ),
      action: (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleNodeClick(workloadNodeData);
          }}
          style={{ fontSize: '0.75rem' }}
        >
          View →
        </a>
      ),
    };

    return [rootNode];
  }, [workload, tools, servers, namespace, history]);

  // Filter tree by search term
  const filterTree = React.useCallback(
    (items: TreeViewDataItem[], term: string): TreeViewDataItem[] => {
      if (!term) return items;

      const lowerTerm = term.toLowerCase();

      const filterNode = (node: TreeViewDataItem): TreeViewDataItem | null => {
        // node.name can be ReactNode, so convert to string safely
        const nodeName = typeof node.name === 'string' ? node.name : String(node.name || '');
        const nameMatches = nodeName.toLowerCase().includes(lowerTerm);

        // Filter children recursively
        const filteredChildren = node.children
          ? node.children
              .map((child) => filterNode(child))
              .filter((child): child is TreeViewDataItem => child !== null)
          : undefined;

        // Include node if name matches or has matching children
        if (nameMatches || (filteredChildren && filteredChildren.length > 0)) {
          return {
            ...node,
            children: filteredChildren,
            defaultExpanded: true,
          };
        }

        return null;
      };

      return items
        .map((item) => filterNode(item))
        .filter((item): item is TreeViewDataItem => item !== null);
    },
    [],
  );

  // Update filtered items when search term or data changes
  React.useEffect(() => {
    const treeData = buildTreeData();
    setFilteredItems(filterTree(treeData, searchTerm));
  }, [buildTreeData, filterTree, searchTerm]);

  const toolRefs = getToolRefs(workload);

  if (toolRefs.length === 0) {
    return (
      <EmptyState variant="xs" icon={CubeIcon}>
        <Title headingLevel="h4" size="md">
          No Dependencies
        </Title>
        <EmptyStateBody>This workload does not have any tool dependencies.</EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <div role="region" aria-label="Dependency tree view">
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <SearchInput
              placeholder="Filter dependencies..."
              value={searchTerm}
              onChange={(_event, value) => setSearchTerm(value)}
              onClear={() => setSearchTerm('')}
              style={{ minWidth: '250px' }}
              aria-label="Filter dependencies by name"
            />
          </ToolbarItem>
          <ToolbarItem>
            <span style={{ color: '#666', fontSize: '0.875rem' }} role="status" aria-live="polite">
              {searchTerm && filteredItems[0]?.children?.length !== undefined
                ? `Showing ${
                    filteredItems[0]?.children?.reduce(
                      (acc, s) => acc + (s.children?.length || 0),
                      0,
                    ) || 0
                  } tools`
                : `${toolRefs.length} total dependencies`}
            </span>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {filteredItems.length === 0 ? (
        <EmptyState variant="xs">
          <Title headingLevel="h4" size="md">
            No matches found
          </Title>
          <EmptyStateBody>No dependencies match &quot;{searchTerm}&quot;.</EmptyStateBody>
        </EmptyState>
      ) : (
        <TreeView
          data={filteredItems}
          hasGuides
          hasSelectableNodes={false}
          aria-label="Workload dependency hierarchy"
        />
      )}
    </div>
  );
};

export default DependencyTreeView;
