import { EntityMeta, Entity } from '@backstage/catalog-model';
/**
 * Entity schema definitions for MCP Tools Catalog
 * Based on the data model specifications in data-model.md
 */
export interface McpEntityMeta extends EntityMeta {
    labels?: {
        [key: string]: string;
    } & {
        'mcp-catalog.io/type'?: string;
        'mcp-catalog.io/category'?: string;
        'mcp-catalog.io/server'?: string;
        'mcp-catalog.io/status'?: string;
    };
    annotations?: {
        [key: string]: string;
    } & {
        'mcp-catalog.io/version'?: string;
    };
}
export interface McpServerEntityV1alpha1 extends Entity {
    apiVersion: 'mcp-catalog.io/v1alpha1';
    kind: 'MCPServer';
    metadata: McpEntityMeta;
    spec: {
        type: 'stdio' | 'sse' | 'websocket';
        endpoint?: string;
        command?: string;
        args?: string[];
        env?: Record<string, string>;
        version: string;
        capabilities?: Array<'tools' | 'resources' | 'prompts' | 'sampling'>;
    };
    status?: {
        lastUpdated?: string;
        toolCount?: number;
    };
}
export interface McpToolEntityV1alpha1 extends Entity {
    apiVersion: 'mcp-catalog.io/v1alpha1';
    kind: 'MCPTool';
    metadata: McpEntityMeta;
    spec: {
        server: string;
        type: string;
        inputSchema?: object;
        capabilities?: string[];
        parameters?: string[];
    };
}
export interface McpWorkloadEntityV1alpha1 extends Entity {
    apiVersion: 'mcp-catalog.io/v1alpha1';
    kind: 'MCPWorkload';
    metadata: McpEntityMeta;
    spec: {
        type: string;
        purpose: string;
        tools?: string[];
        deploymentInfo?: {
            schedule?: string;
            runtime?: string;
            environment?: string;
        };
        dependencies?: string[];
    };
}
export type McpEntity = McpServerEntityV1alpha1 | McpToolEntityV1alpha1 | McpWorkloadEntityV1alpha1;
export declare function isMcpServerEntity(entity: Entity): entity is McpServerEntityV1alpha1;
export declare function isMcpToolEntity(entity: Entity): entity is McpToolEntityV1alpha1;
export declare function isMcpWorkloadEntity(entity: Entity): entity is McpWorkloadEntityV1alpha1;
export declare function isMcpEntity(entity: Entity): entity is McpEntity;
export declare const MCP_ENTITY_KINDS: {
    readonly SERVER: "MCPServer";
    readonly TOOL: "MCPTool";
    readonly WORKLOAD: "MCPWorkload";
};
export declare const MCP_API_VERSION = "mcp-catalog.io/v1alpha1";
export declare const MCP_LABELS: {
    readonly TYPE: "mcp-catalog.io/type";
    readonly CATEGORY: "mcp-catalog.io/category";
    readonly SERVER: "mcp-catalog.io/server";
    readonly STATUS: "mcp-catalog.io/status";
};
export declare const MCP_ANNOTATIONS: {
    readonly VERSION: "mcp-catalog.io/version";
};
//# sourceMappingURL=entity-schemas.d.ts.map