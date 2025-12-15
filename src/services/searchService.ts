import { Entity } from '@backstage/catalog-model';
import { CatalogMcpTool } from '../models/CatalogMcpTool';

export const filterResources = <T extends Entity>(resources: T[], searchTerm: string): T[] => {
  if (!searchTerm) return resources;
  const lowerTerm = searchTerm.toLowerCase();
  return resources.filter(resource => {
    const name = resource.metadata.name.toLowerCase();
    const namespace = resource.metadata.namespace?.toLowerCase() || '';
    // Check labels/annotations if available
    const labels = resource.metadata.labels 
      ? Object.values(resource.metadata.labels).join(' ').toLowerCase() 
      : '';
    const tags = resource.metadata.tags
      ? resource.metadata.tags.join(' ').toLowerCase()
      : '';
    
    return name.includes(lowerTerm) || namespace.includes(lowerTerm) || labels.includes(lowerTerm) || tags.includes(lowerTerm);
  });
};

export const filterToolsByServer = (tools: CatalogMcpTool[], serverName: string): CatalogMcpTool[] => {
  return tools.filter(tool => {
    // In Backstage, relationships are usually stored in 'relations'
    // But we can also check for a 'partOf' spec field or annotation if we define it that way
    // For now, let's check spec.partOf which we defined in our model
    const partOf = tool.spec.partOf;
    if (!partOf) return false;
    
    return partOf.includes(serverName);
  });
};
