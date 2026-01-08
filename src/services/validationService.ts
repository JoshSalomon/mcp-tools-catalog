import { Entity } from '@backstage/catalog-model';
import { CatalogMcpTool } from '../models/CatalogMcpTool';
import { getEntityName } from '../utils/hierarchicalNaming';

/**
 * Validates that a tool's server reference points to an existing server
 * Priority: subcomponentOf > partOf > relations array > label
 */
export const validateServerReference = (tool: Entity, servers: Entity[]): boolean => {
  const mcpTool = tool as CatalogMcpTool;

  // Get server name from various possible locations
  let serverName: string | null = null;

  // Check spec.subcomponentOf first (Component to Component relation)
  if (mcpTool.spec.subcomponentOf) {
    serverName = getEntityName(mcpTool.spec.subcomponentOf);
  }

  // Check spec.partOf (Component to System, but might be used)
  if (!serverName && mcpTool.spec.partOf) {
    const partOf = Array.isArray(mcpTool.spec.partOf)
      ? mcpTool.spec.partOf[0]
      : mcpTool.spec.partOf;
    if (partOf) {
      serverName = getEntityName(partOf);
    }
  }

  // Check relations array for partOf type (generated from subcomponentOf)
  if (!serverName && mcpTool.relations) {
    const partOfRelation = mcpTool.relations.find((rel) => rel.type === 'partOf');
    if (partOfRelation?.targetRef) {
      serverName = getEntityName(partOfRelation.targetRef);
    }
  }

  // Fallback to spec.mcp.server (legacy)
  if (!serverName && mcpTool.spec.mcp?.server) {
    serverName = getEntityName(mcpTool.spec.mcp.server);
  }

  // Fallback to label
  if (!serverName) {
    serverName = mcpTool.metadata.labels?.['mcp-catalog.io/server'] || null;
  }

  // Fallback to annotation (legacy)
  if (!serverName) {
    serverName = tool.metadata.annotations?.['mcp-catalog.openshift.io/provided-by'] || null;
  }

  if (!serverName) return false;

  return servers.some((server) => server.metadata.name === serverName);
};

export const validateToolReferences = (workload: Entity, tools: Entity[]): string[] => {
  const consumedTools = (workload as any).spec?.consumesTools || [];
  const invalidRefs: string[] = [];
  const toolNames = new Set(tools.map((t) => t.metadata.name));

  consumedTools.forEach((ref: string) => {
    // Tool reference format: mcptool:default/server-name/tool-name or just tool-name if simplified
    // Assuming for now we check against tool metadata.name.
    // The spec says tool names are "server/toolname".
    // Let's assume the ref needs to match a tool's name.
    if (!toolNames.has(ref)) {
      invalidRefs.push(ref);
    }
  });
  return invalidRefs;
};
