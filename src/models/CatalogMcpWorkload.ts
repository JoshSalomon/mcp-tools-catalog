import { Entity } from '@backstage/catalog-model';

export const CATALOG_MCP_WORKLOAD_KIND = 'Component';
export const CATALOG_MCP_WORKLOAD_TYPE = 'service'; // or other standard types

export interface CatalogMcpWorkload extends Entity {
  kind: 'Component';
  spec: {
    type: string;
    lifecycle: string;
    owner: string;
    system?: string;
    consumes?: string[]; // Relation to servers/tools
    [key: string]: any;
  };
}
