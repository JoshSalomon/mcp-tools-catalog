import { Entity } from '@backstage/catalog-model';

export const CATALOG_MCP_TOOL_KIND = 'Component';
export const CATALOG_MCP_TOOL_TYPE = 'mcp-tool';

export interface CatalogMcpTool extends Entity {
  kind: 'Component';
  spec: {
    type: string; // 'mcp-tool'
    lifecycle: string;
    owner: string;
    system?: string;
    partOf?: string; // Ref to server
    inputSchema?: Record<string, any>;
    [key: string]: any;
  };
}
