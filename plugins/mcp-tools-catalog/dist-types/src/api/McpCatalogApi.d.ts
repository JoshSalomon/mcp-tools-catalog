import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import { McpServerEntityV1alpha1, McpToolEntityV1alpha1, McpWorkloadEntityV1alpha1 } from '../schemas/entity-schemas';
/**
 * API definition for MCP Tools Catalog operations
 * Extends the standard Backstage catalog API with MCP-specific functionality
 */
export interface McpCatalogApi {
    /**
     * Get all tools provided by a specific MCP server
     */
    getServerTools(serverName: string, namespace?: string): Promise<{
        server: McpServerEntityV1alpha1;
        tools: McpToolEntityV1alpha1[];
    }>;
    /**
     * Get all workloads that use a specific MCP tool
     */
    getToolWorkloads(toolName: string, namespace?: string): Promise<{
        tool: McpToolEntityV1alpha1;
        workloads: McpWorkloadEntityV1alpha1[];
    }>;
    /**
     * Get all tools used by a specific MCP workload
     */
    getWorkloadTools(workloadName: string, namespace?: string): Promise<{
        workload: McpWorkloadEntityV1alpha1;
        tools: McpToolEntityV1alpha1[];
    }>;
    /**
     * Add a tool reference to an MCP workload
     */
    addToolToWorkload(workloadName: string, toolReference: string, namespace?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Remove a tool reference from an MCP workload
     */
    removeToolFromWorkload(workloadName: string, toolReference: string, namespace?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Get health status of MCP catalog
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        entities: {
            servers: number;
            tools: number;
            workloads: number;
        };
        lastUpdate: string;
        issues: Array<{
            type: 'broken-reference' | 'validation-error' | 'orphaned-entity';
            entity: string;
            message: string;
        }>;
    }>;
    /**
     * Validate all MCP entity relationships
     */
    validateRelationships(): Promise<{
        valid: boolean;
        errors: Array<{
            entity: string;
            error: string;
            severity: 'error' | 'warning';
        }>;
        summary: {
            totalEntities: number;
            validEntities: number;
            brokenReferences: number;
            orphanedEntities: number;
        };
    }>;
}
/**
 * API reference for MCP Catalog API
 */
export declare const mcpCatalogApiRef: import("@backstage/core-plugin-api").ApiRef<McpCatalogApi>;
/**
 * Default implementation of the MCP Catalog API
 */
export declare class McpCatalogClient implements McpCatalogApi {
    private readonly discoveryApi;
    private readonly identityApi;
    constructor(options: {
        discoveryApi: DiscoveryApi;
        identityApi: IdentityApi;
    });
    getServerTools(serverName: string, namespace?: string): Promise<{
        server: McpServerEntityV1alpha1;
        tools: McpToolEntityV1alpha1[];
    }>;
    getToolWorkloads(toolName: string, namespace?: string): Promise<{
        tool: McpToolEntityV1alpha1;
        workloads: McpWorkloadEntityV1alpha1[];
    }>;
    getWorkloadTools(workloadName: string, namespace?: string): Promise<{
        workload: McpWorkloadEntityV1alpha1;
        tools: McpToolEntityV1alpha1[];
    }>;
    addToolToWorkload(workloadName: string, toolReference: string, namespace?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    removeToolFromWorkload(workloadName: string, toolReference: string, namespace?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        entities: {
            servers: number;
            tools: number;
            workloads: number;
        };
        lastUpdate: string;
        issues: Array<{
            type: 'broken-reference' | 'validation-error' | 'orphaned-entity';
            entity: string;
            message: string;
        }>;
    }>;
    validateRelationships(): Promise<{
        valid: boolean;
        errors: Array<{
            entity: string;
            error: string;
            severity: 'error' | 'warning';
        }>;
        summary: {
            totalEntities: number;
            validEntities: number;
            brokenReferences: number;
            orphanedEntities: number;
        };
    }>;
    private getApiUrl;
    private fetch;
}
//# sourceMappingURL=McpCatalogApi.d.ts.map