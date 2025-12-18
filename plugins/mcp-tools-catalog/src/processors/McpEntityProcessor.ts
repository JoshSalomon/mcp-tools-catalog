import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
  CatalogProcessorCache,
  LocationSpec,
} from '@backstage/plugin-catalog-node';
import { Entity, parseEntityRef } from '@backstage/catalog-model';
import {
  McpEntity,
  McpServerEntityV1alpha1,
  McpToolEntityV1alpha1,
  McpWorkloadEntityV1alpha1,
  isMcpServerEntity,
  isMcpToolEntity,
  isMcpWorkloadEntity,
} from '../schemas/entity-schemas';

/**
 * Catalog processor for MCP entities
 * Handles validation, relationship processing, and metadata enrichment
 */
export class McpEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'McpEntityProcessor';
  }

  async validateEntityKind(entity: Entity): Promise<boolean> {
    return isMcpServerEntity(entity) || isMcpToolEntity(entity) || isMcpWorkloadEntity(entity);
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
    _cache: CatalogProcessorCache,
  ): Promise<Entity> {
    if (!this.validateEntityKind(entity)) {
      return entity;
    }

    const mcpEntity = entity as McpEntity;

    // Process relationships based on entity type
    await this.processEntityRelationships(mcpEntity, emit);

    // Enrich entity metadata
    await this.enrichEntityMetadata(mcpEntity, emit);

    return entity;
  }

  private async processEntityRelationships(
    entity: McpEntity,
    emit: CatalogProcessorEmit,
  ): Promise<void> {
    if (isMcpToolEntity(entity)) {
      await this.processToolRelationships(entity, emit);
    } else if (isMcpWorkloadEntity(entity)) {
      await this.processWorkloadRelationships(entity, emit);
    }
  }

  private async processToolRelationships(
    tool: McpToolEntityV1alpha1,
    emit: CatalogProcessorEmit,
  ): Promise<void> {
    // Create dependsOn relationship to parent server
    if (tool.spec.server) {
      emit(processingResult.relation({
        type: 'dependsOn',
        source: {
          kind: tool.kind,
          namespace: tool.metadata.namespace || 'default',
          name: tool.metadata.name,
        },
        target: parseEntityRef(tool.spec.server),
      }));
    }
  }

  private async processWorkloadRelationships(
    workload: McpWorkloadEntityV1alpha1,
    emit: CatalogProcessorEmit,
  ): Promise<void> {
    // Create dependsOn relationships to referenced tools
    if (workload.spec.tools) {
      for (const toolRef of workload.spec.tools) {
        emit(processingResult.relation({
          type: 'dependsOn',
          source: {
            kind: workload.kind,
            namespace: workload.metadata.namespace || 'default',
            name: workload.metadata.name,
          },
          target: parseEntityRef(toolRef),
        }));
      }
    }
  }

  private async enrichEntityMetadata(
    entity: McpEntity,
    emit: CatalogProcessorEmit,
  ): Promise<void> {
    // Add computed metadata based on entity type
    if (isMcpServerEntity(entity)) {
      await this.enrichServerMetadata(entity, emit);
    } else if (isMcpToolEntity(entity)) {
      await this.enrichToolMetadata(entity, emit);
    } else if (isMcpWorkloadEntity(entity)) {
      await this.enrichWorkloadMetadata(entity, emit);
    }
  }

  private async enrichServerMetadata(
    server: McpServerEntityV1alpha1,
    _emit: CatalogProcessorEmit,
  ): Promise<void> {
    // Update status with current timestamp
    if (!server.status) {
      server.status = {};
    }
    server.status.lastUpdated = new Date().toISOString();

    // Initialize tool count (will be updated by external processes)
    if (server.status.toolCount === undefined) {
      server.status.toolCount = 0;
    }
  }

  private async enrichToolMetadata(
    tool: McpToolEntityV1alpha1,
    _emit: CatalogProcessorEmit,
  ): Promise<void> {
    // Validate server reference format
    if (tool.spec.server && !tool.spec.server.startsWith('mcpserver:')) {
      throw new Error(
        `Invalid server reference format: ${tool.spec.server}. Expected format: mcpserver:namespace/name`,
      );
    }

    // Ensure tool has required metadata labels
    if (!tool.metadata.labels) {
      tool.metadata.labels = {};
    }
    
    // Extract server name from reference for label
    if (tool.spec.server) {
      const serverName = tool.spec.server.split('/').pop();
      if (serverName) {
        tool.metadata.labels['mcp-catalog.io/server'] = serverName;
      }
    }
  }

  private async enrichWorkloadMetadata(
    workload: McpWorkloadEntityV1alpha1,
    _emit: CatalogProcessorEmit,
  ): Promise<void> {
    // Validate tool references format
    if (workload.spec.tools) {
      for (const toolRef of workload.spec.tools) {
        if (!toolRef.startsWith('mcptool:')) {
          throw new Error(
            `Invalid tool reference format: ${toolRef}. Expected format: mcptool:namespace/server/tool`,
          );
        }
      }
    }

    // Add workload type to labels
    if (!workload.metadata.labels) {
      workload.metadata.labels = {};
    }
    workload.metadata.labels['mcp-catalog.io/category'] = workload.spec.type;
  }
}