import { Entity } from '@backstage/catalog-model';

export const validateServerReference = (tool: Entity, servers: Entity[]): boolean => {
  const providedBy = tool.metadata.annotations?.['mcp-catalog.openshift.io/provided-by'];
  if (!providedBy) return false;
  return servers.some(server => server.metadata.name === providedBy);
};

export const validateToolReferences = (workload: Entity, tools: Entity[]): string[] => {
  const consumedTools = (workload as any).spec?.consumesTools || [];
  const invalidRefs: string[] = [];
  const toolNames = new Set(tools.map(t => t.metadata.name));

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
