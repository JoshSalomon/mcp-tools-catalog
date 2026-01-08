/**
 * Search and filtering utilities for MCP Catalog entities.
 * @module searchService
 */

import { Entity } from '@backstage/catalog-model';
import { CatalogMcpTool } from '../models/CatalogMcpTool';
import { getEntityName } from '../utils/hierarchicalNaming';

/**
 * Filters an array of entities by a search term.
 * Searches across name, namespace, description, labels, and tags.
 *
 * @template T - Entity type extending Backstage Entity
 * @param resources - Array of entities to filter
 * @param searchTerm - Search term to match against entity metadata
 * @returns Filtered array of entities matching the search term
 *
 * @example
 * ```ts
 * const filtered = filterResources(servers, 'production');
 * ```
 */
export const filterResources = <T extends Entity>(resources: T[], searchTerm: string): T[] => {
  if (!searchTerm) return resources;
  const lowerTerm = searchTerm.toLowerCase();
  return resources.filter((resource) => {
    const name = resource.metadata.name.toLowerCase();
    const namespace = resource.metadata.namespace?.toLowerCase() || '';
    const description = (resource.metadata.description || '').toLowerCase();
    // Check labels/annotations if available
    const labels = resource.metadata.labels
      ? Object.values(resource.metadata.labels).join(' ').toLowerCase()
      : '';
    const tags = resource.metadata.tags ? resource.metadata.tags.join(' ').toLowerCase() : '';

    return (
      name.includes(lowerTerm) ||
      namespace.includes(lowerTerm) ||
      description.includes(lowerTerm) ||
      labels.includes(lowerTerm) ||
      tags.includes(lowerTerm)
    );
  });
};

/**
 * Get the server name for a tool from various possible locations
 * Priority: subcomponentOf > partOf relation > relations array > label
 */
const getToolServerName = (tool: CatalogMcpTool): string | null => {
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

/**
 * Filters tools to only those belonging to a specific server.
 * Uses the tool's subcomponentOf, partOf, relations, or label to determine server membership.
 *
 * @param tools - Array of tool entities to filter
 * @param serverName - Name of the server to filter by
 * @returns Filtered array of tools belonging to the specified server
 *
 * @example
 * ```ts
 * const serverTools = filterToolsByServer(allTools, 'my-mcp-server');
 * ```
 */
export const filterToolsByServer = (
  tools: CatalogMcpTool[],
  serverName: string,
): CatalogMcpTool[] => {
  return tools.filter((tool) => {
    const toolServerName = getToolServerName(tool);
    return toolServerName === serverName;
  });
};
