import { Entity } from '@backstage/catalog-model';

export const CATALOG_MCP_SERVER_KIND = 'Component';
export const CATALOG_MCP_SERVER_TYPE = 'mcp-server';

export interface CatalogMcpServer extends Entity {
  kind: 'Component';
  spec: {
    type: string;
    lifecycle: string;
    owner: string;
    system?: string;
    dependsOn?: string[];
    dependencyOf?: string[];
    // Custom MCP fields
    transport?: {
      type: 'stdio' | 'sse' | 'http';
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      url?: string;
    };
    [key: string]: any;
  };
}
