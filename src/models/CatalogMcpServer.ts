/**
 * TypeScript models for MCP Server entities in the Backstage Catalog.
 * @module CatalogMcpServer
 */

import { Entity } from '@backstage/catalog-model';

/** Backstage entity kind for MCP servers */
export const CATALOG_MCP_SERVER_KIND = 'Component';

/** Backstage spec.type value for MCP servers */
export const CATALOG_MCP_SERVER_TYPE = 'mcp-server';

/**
 * MCP Server entity interface.
 * Represents an MCP (Model Context Protocol) server in the Backstage Catalog.
 * 
 * @extends Entity - Backstage base entity type
 * 
 * @example
 * ```yaml
 * apiVersion: backstage.io/v1alpha1
 * kind: Component
 * metadata:
 *   name: my-mcp-server
 * spec:
 *   type: mcp-server
 *   lifecycle: production
 *   owner: platform-team
 *   transport:
 *     type: stdio
 *     command: docker
 *     args: ["run", "-i", "my-server:latest"]
 * ```
 */
export interface CatalogMcpServer extends Entity {
  kind: 'Component';
  spec: {
    type: string;
    lifecycle: string;
    owner: string;
    system?: string;
    dependsOn?: string[];
    dependencyOf?: string[];
    hasPart?: string | string[]; // Tools that are part of this server
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
