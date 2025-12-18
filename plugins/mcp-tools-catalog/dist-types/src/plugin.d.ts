/// <reference types="react" />
/**
 * Route references for MCP Tools Catalog pages
 */
export declare const mcpServerPageRouteRef: import("@backstage/core-plugin-api").RouteRef<undefined>;
export declare const mcpToolPageRouteRef: import("@backstage/core-plugin-api").RouteRef<undefined>;
export declare const mcpWorkloadPageRouteRef: import("@backstage/core-plugin-api").RouteRef<undefined>;
export declare const mcpCatalogRouteRef: import("@backstage/core-plugin-api").RouteRef<undefined>;
/**
 * Main MCP Tools Catalog plugin definition
 */
export declare const mcpToolsCatalogPlugin: import("@backstage/core-plugin-api").BackstagePlugin<{
    catalog: import("@backstage/core-plugin-api").RouteRef<undefined>;
    server: import("@backstage/core-plugin-api").RouteRef<undefined>;
    tool: import("@backstage/core-plugin-api").RouteRef<undefined>;
    workload: import("@backstage/core-plugin-api").RouteRef<undefined>;
}, {}, {}>;
/**
 * Component extensions for MCP entity pages
 */
export declare const McpServerPage: () => import("react").JSX.Element;
export declare const McpToolPage: () => import("react").JSX.Element;
export declare const McpWorkloadPage: () => import("react").JSX.Element;
/**
 * Catalog extensions for MCP entity cards and lists
 */
export declare const McpServerCard: ({ entity }: import("./components/McpServerCard/McpServerCard").McpServerCardProps) => import("react").JSX.Element;
export declare const McpToolCard: ({ entity }: import("./components/McpToolCard/McpToolCard").McpToolCardProps) => import("react").JSX.Element;
export declare const McpWorkloadCard: ({ entity }: import("./components/McpWorkloadCard/McpWorkloadCard").McpWorkloadCardProps) => import("react").JSX.Element;
export declare const McpCatalogPage: () => import("react").JSX.Element;
/**
 * Plugin exports for external usage
 */
export { mcpCatalogApiRef, type McpCatalogApi, } from './api/McpCatalogApi';
export { type McpServerEntityV1alpha1, type McpToolEntityV1alpha1, type McpWorkloadEntityV1alpha1, type McpEntity, isMcpServerEntity, isMcpToolEntity, isMcpWorkloadEntity, MCP_ENTITY_KINDS, MCP_API_VERSION, } from './schemas/entity-schemas';
export { RelationshipService } from './services/RelationshipService';
export { McpEntityProcessor } from './processors/McpEntityProcessor';
export { type McpCatalogConfig, readMcpCatalogConfig, validateMcpCatalogConfig, } from './config/plugin-config';
//# sourceMappingURL=plugin.d.ts.map