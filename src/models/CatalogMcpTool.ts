/**
 * TypeScript models for MCP Tool entities in the Backstage Catalog.
 * @module CatalogMcpTool
 */

import { Entity } from '@backstage/catalog-model';

/** Backstage entity kind for MCP tools */
export const CATALOG_MCP_TOOL_KIND = 'Component';

/** Backstage spec.type value for MCP tools */
export const CATALOG_MCP_TOOL_TYPE = 'mcp-tool';

/** Annotation key for disabled state */
export const MCP_TOOL_DISABLED_ANNOTATION = 'mcp-catalog.io/disabled';

/**
 * MCP Tool entity interface.
 * Represents an MCP tool provided by an MCP server in the Backstage Catalog.
 *
 * Tools are linked to their parent server using `spec.subcomponentOf`, which
 * generates bidirectional `partOf`/`hasPart` relations in Backstage.
 *
 * @extends Entity - Backstage base entity type
 *
 * @example
 * ```yaml
 * apiVersion: backstage.io/v1alpha1
 * kind: Component
 * metadata:
 *   name: get-user-info
 * spec:
 *   type: mcp-tool
 *   lifecycle: production
 *   owner: platform-team
 *   subcomponentOf: component:default/my-mcp-server
 *   inputSchema:
 *     type: object
 *     properties:
 *       userId:
 *         type: string
 * ```
 */
export interface CatalogMcpTool extends Entity {
  kind: 'Component';
  spec: {
    /** Entity type - always 'mcp-tool' for tools */
    type: string;
    /** Lifecycle stage (e.g., 'production', 'experimental') */
    lifecycle: string;
    /** Owner team or user */
    owner: string;
    /** Optional system this tool belongs to */
    system?: string;
    /** Reference to parent server (Component to Component relation) */
    subcomponentOf?: string;
    /** Reference to system (Component to System relation) */
    partOf?: string | string[];
    /** JSON Schema for tool input parameters */
    inputSchema?: Record<string, any>;
    /** Allow additional properties */
    [key: string]: any;
  };
  /**
   * Alternative description that overrides metadata.description when set.
   * Stored in database, merged with catalog entity at query time.
   * @since 007-server-tools-view
   */
  alternativeDescription?: string;
  /**
   * Whether the tool is disabled.
   * Merged from database at query time.
   */
  disabled?: boolean;
}

/**
 * Check if a tool entity is disabled.
 * @param entity - The tool entity to check
 * @returns true if the tool is disabled, false otherwise
 */
export const isToolDisabled = (entity: CatalogMcpTool): boolean => {
  const annotations = entity.metadata.annotations as Record<string, string> | undefined;
  return annotations?.[MCP_TOOL_DISABLED_ANNOTATION] === 'true';
};
