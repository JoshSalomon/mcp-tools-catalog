import { Config } from '@backstage/config';
/**
 * Configuration interface for MCP Tools Catalog plugin
 */
export interface McpCatalogConfig {
    /** Whether the plugin is enabled */
    enabled?: boolean;
    /** Custom entity kinds to support beyond the defaults */
    customEntityKinds?: string[];
    /** Configuration for entity processing */
    processing?: {
        /** Batch size for entity processing operations */
        batchSize?: number;
        /** Interval in minutes for relationship validation */
        validationInterval?: number;
        /** Whether to auto-fix broken references */
        autoFixReferences?: boolean;
    };
    /** UI display configuration */
    ui?: {
        /** Whether to show entity relationship graphs */
        showRelationshipGraphs?: boolean;
        /** Maximum number of entities to display in lists */
        maxEntitiesPerPage?: number;
        /** Default view for entity pages */
        defaultView?: 'card' | 'table' | 'graph';
    };
    /** Integration settings */
    integrations?: {
        /** OpenShift integration settings */
        openshift?: {
            enabled?: boolean;
            baseUrl?: string;
            namespace?: string;
        };
        /** External MCP registry settings */
        registry?: {
            enabled?: boolean;
            url?: string;
            apiKey?: string;
        };
    };
}
/**
 * Default configuration values
 */
export declare const DEFAULT_MCP_CATALOG_CONFIG: Required<McpCatalogConfig>;
/**
 * Read and validate MCP Catalog configuration from Backstage config
 */
export declare function readMcpCatalogConfig(config: Config): McpCatalogConfig;
/**
 * Validate MCP Catalog configuration
 */
export declare function validateMcpCatalogConfig(config: McpCatalogConfig): string[];
//# sourceMappingURL=plugin-config.d.ts.map