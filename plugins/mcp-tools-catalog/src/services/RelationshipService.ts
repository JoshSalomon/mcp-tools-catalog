import { Entity, parseEntityRef } from '@backstage/catalog-model';
import type { CatalogApi } from '@backstage/catalog-client';
import {
  McpServerEntityV1alpha1,
  McpToolEntityV1alpha1,
  McpWorkloadEntityV1alpha1,
  isMcpServerEntity,
  isMcpToolEntity,
  isMcpWorkloadEntity,
} from '../schemas/entity-schemas';

/**
 * Service for managing relationships between MCP entities
 * Handles bidirectional relationship queries and cascade operations
 */
export class RelationshipService {
  constructor(private readonly catalogApi: CatalogApi) {}

  /**
   * Get all tools provided by a specific MCP server
   */
  async getServerTools(serverRef: string): Promise<McpToolEntityV1alpha1[]> {
    const entities = await this.catalogApi.getEntities({
      filter: {
        kind: 'MCPTool',
        'spec.server': serverRef,
      },
    });

    return entities.items.filter(isMcpToolEntity);
  }

  /**
   * Get all workloads that use a specific MCP tool
   */
  async getToolWorkloads(toolRef: string): Promise<McpWorkloadEntityV1alpha1[]> {
    const entities = await this.catalogApi.getEntities({
      filter: {
        kind: 'MCPWorkload',
      },
    });

    return entities.items
      .filter(isMcpWorkloadEntity)
      .filter(workload => 
        workload.spec.tools?.includes(toolRef)
      );
  }

  /**
   * Get all tools used by a specific MCP workload
   */
  async getWorkloadTools(workloadRef: string): Promise<McpToolEntityV1alpha1[]> {
    const workload = await this.getEntity(workloadRef);
    if (!isMcpWorkloadEntity(workload)) {
      throw new Error(`Entity ${workloadRef} is not an MCP workload`);
    }

    if (!workload.spec.tools) {
      return [];
    }

    const tools: McpToolEntityV1alpha1[] = [];
    for (const toolRef of workload.spec.tools) {
      try {
        const tool = await this.getEntity(toolRef);
        if (isMcpToolEntity(tool)) {
          tools.push(tool);
        }
      } catch (error) {
        // Tool reference may be broken - log but continue
        console.warn(`Failed to resolve tool reference: ${toolRef}`, error);
      }
    }

    return tools;
  }

  /**
   * Get the parent server for a specific MCP tool
   */
  async getToolServer(toolRef: string): Promise<McpServerEntityV1alpha1 | null> {
    const tool = await this.getEntity(toolRef);
    if (!isMcpToolEntity(tool)) {
      throw new Error(`Entity ${toolRef} is not an MCP tool`);
    }

    if (!tool.spec.server) {
      return null;
    }

    try {
      const server = await this.getEntity(tool.spec.server);
      return isMcpServerEntity(server) ? server : null;
    } catch (error) {
      console.warn(`Failed to resolve server reference: ${tool.spec.server}`, error);
      return null;
    }
  }

  /**
   * Get entity relationships for visualization
   */
  async getEntityRelationships(entityRef: string): Promise<{
    entity: Entity;
    relations: Array<{
      type: string;
      target: Entity;
      direction: 'outbound' | 'inbound';
    }>;
  }> {
    const entity = await this.getEntity(entityRef);
    const relations: Array<{
      type: string;
      target: Entity;
      direction: 'outbound' | 'inbound';
    }> = [];

    // Get outbound relationships
    if (entity.relations) {
      for (const relation of entity.relations) {
        try {
          const target = await this.getEntity(relation.targetRef);
          relations.push({
            type: relation.type,
            target,
            direction: 'outbound',
          });
        } catch (error) {
          console.warn(`Failed to resolve relation target: ${relation.targetRef}`, error);
        }
      }
    }

    // Get inbound relationships based on entity type
    if (isMcpServerEntity(entity)) {
      const tools = await this.getServerTools(entityRef);
      for (const tool of tools) {
        relations.push({
          type: 'dependsOn',
          target: tool,
          direction: 'inbound',
        });
      }
    } else if (isMcpToolEntity(entity)) {
      const workloads = await this.getToolWorkloads(entityRef);
      for (const workload of workloads) {
        relations.push({
          type: 'dependsOn',
          target: workload,
          direction: 'inbound',
        });
      }
    }

    return { entity, relations };
  }

  /**
   * Validate that all entity references in a workload are valid
   */
  async validateWorkloadReferences(workload: McpWorkloadEntityV1alpha1): Promise<{
    valid: boolean;
    brokenReferences: string[];
  }> {
    if (!workload.spec.tools) {
      return { valid: true, brokenReferences: [] };
    }

    const brokenReferences: string[] = [];
    
    for (const toolRef of workload.spec.tools) {
      try {
        const tool = await this.getEntity(toolRef);
        if (!isMcpToolEntity(tool)) {
          brokenReferences.push(toolRef);
        }
      } catch (error) {
        brokenReferences.push(toolRef);
      }
    }

    return {
      valid: brokenReferences.length === 0,
      brokenReferences,
    };
  }

  /**
   * Validate that a tool's server reference is valid
   */
  async validateToolServerReference(tool: McpToolEntityV1alpha1): Promise<{
    valid: boolean;
    serverExists: boolean;
  }> {
    if (!tool.spec.server) {
      return { valid: false, serverExists: false };
    }

    try {
      const server = await this.getEntity(tool.spec.server);
      return {
        valid: isMcpServerEntity(server),
        serverExists: true,
      };
    } catch (error) {
      return { valid: false, serverExists: false };
    }
  }

  /**
   * Update workload tool references (add or remove tools)
   */
  async updateWorkloadTools(
    workloadRef: string,
    operation: 'add' | 'remove',
    toolRef: string,
  ): Promise<void> {
    // Note: This would typically integrate with the Backstage catalog API
    // to update entity definitions. For now, we define the interface.
    
    const workload = await this.getEntity(workloadRef);
    if (!isMcpWorkloadEntity(workload)) {
      throw new Error(`Entity ${workloadRef} is not an MCP workload`);
    }

    // Validate tool reference exists
    if (operation === 'add') {
      const tool = await this.getEntity(toolRef);
      if (!isMcpToolEntity(tool)) {
        throw new Error(`Entity ${toolRef} is not an MCP tool`);
      }
    }

    // This would update the entity in the catalog
    // Implementation depends on Backstage catalog backend integration
    throw new Error('Entity updates not yet implemented - requires catalog backend integration');
  }

  private async getEntity(entityRef: string): Promise<Entity> {
    const parsed = parseEntityRef(entityRef);
    const entity = await this.catalogApi.getEntityByRef(parsed);
    
    if (!entity) {
      throw new Error(`Entity not found: ${entityRef}`);
    }
    
    return entity;
  }
}