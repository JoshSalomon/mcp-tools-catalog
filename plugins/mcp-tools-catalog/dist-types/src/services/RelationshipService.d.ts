import { Entity } from '@backstage/catalog-model';
import type { CatalogApi } from '@backstage/catalog-client';
import { McpServerEntityV1alpha1, McpToolEntityV1alpha1, McpWorkloadEntityV1alpha1 } from '../schemas/entity-schemas';
/**
 * Service for managing relationships between MCP entities
 * Handles bidirectional relationship queries and cascade operations
 */
export declare class RelationshipService {
    private readonly catalogApi;
    constructor(catalogApi: CatalogApi);
    /**
     * Get all tools provided by a specific MCP server
     */
    getServerTools(serverRef: string): Promise<McpToolEntityV1alpha1[]>;
    /**
     * Get all workloads that use a specific MCP tool
     */
    getToolWorkloads(toolRef: string): Promise<McpWorkloadEntityV1alpha1[]>;
    /**
     * Get all tools used by a specific MCP workload
     */
    getWorkloadTools(workloadRef: string): Promise<McpToolEntityV1alpha1[]>;
    /**
     * Get the parent server for a specific MCP tool
     */
    getToolServer(toolRef: string): Promise<McpServerEntityV1alpha1 | null>;
    /**
     * Get entity relationships for visualization
     */
    getEntityRelationships(entityRef: string): Promise<{
        entity: Entity;
        relations: Array<{
            type: string;
            target: Entity;
            direction: 'outbound' | 'inbound';
        }>;
    }>;
    /**
     * Validate that all entity references in a workload are valid
     */
    validateWorkloadReferences(workload: McpWorkloadEntityV1alpha1): Promise<{
        valid: boolean;
        brokenReferences: string[];
    }>;
    /**
     * Validate that a tool's server reference is valid
     */
    validateToolServerReference(tool: McpToolEntityV1alpha1): Promise<{
        valid: boolean;
        serverExists: boolean;
    }>;
    /**
     * Update workload tool references (add or remove tools)
     */
    updateWorkloadTools(workloadRef: string, operation: 'add' | 'remove', toolRef: string): Promise<void>;
    private getEntity;
}
//# sourceMappingURL=RelationshipService.d.ts.map