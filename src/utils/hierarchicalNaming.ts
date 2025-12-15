export const formatToolName = (serverName: string, toolName: string): string => {
  return `${serverName}/${toolName}`;
};

export const parseToolName = (fullToolName: string): { serverName: string; toolName: string } | null => {
  const parts = fullToolName.split('/');
  if (parts.length !== 2) return null;
  return { serverName: parts[0], toolName: parts[1] };
};

export const getEntityName = (entityRef: string): string => {
  // Assuming entityRef is like "kind:namespace/name" or just "name"
  const parts = entityRef.split('/');
  return parts[parts.length - 1];
};
