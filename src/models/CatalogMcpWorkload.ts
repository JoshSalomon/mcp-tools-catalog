/**
 * TypeScript models for MCP Workload entities in the Backstage Catalog.
 * @module CatalogMcpWorkload
 */

import { Entity } from '@backstage/catalog-model';

/** Backstage entity kind for MCP workloads */
export const CATALOG_MCP_WORKLOAD_KIND = 'Component';

/** Default Backstage spec.type value for MCP workloads */
export const CATALOG_MCP_WORKLOAD_TYPE = 'mcp-workload';

/**
 * MCP Workload entity interface.
 * Represents a workload that consumes MCP tools in the Backstage Catalog.
 *
 * Workloads can have different types:
 * - `service`: A long-running service that uses MCP tools
 * - `workflow`: A scheduled or triggered workflow
 * - `mcp-workload`: Generic MCP workload type
 *
 * Tool dependencies are declared via `spec.dependsOn` or `spec.consumes`.
 *
 * @extends Entity - Backstage base entity type
 *
 * @example
 * ```yaml
 * apiVersion: backstage.io/v1alpha1
 * kind: Component
 * metadata:
 *   name: data-sync-service
 * spec:
 *   type: service
 *   lifecycle: production
 *   owner: platform-team
 *   dependsOn:
 *     - component:default/get-user-info
 *     - component:default/update-user-info
 *   mcp:
 *     purpose: "Synchronize user data across systems"
 * ```
 */
export interface CatalogMcpWorkload extends Entity {
  kind: 'Component';
  spec: {
    /** Entity type (e.g., 'service', 'workflow', 'mcp-workload') */
    type: string;
    /** Lifecycle stage (e.g., 'production', 'experimental') */
    lifecycle: string;
    /** Owner team or user */
    owner: string;
    /** Optional system this workload belongs to */
    system?: string;
    /** References to consumed tools/APIs */
    consumes?: string[];
    /** Allow additional properties */
    [key: string]: any;
  };
}
