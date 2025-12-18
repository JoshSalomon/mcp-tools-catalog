import { CatalogProcessor, CatalogProcessorEmit, CatalogProcessorCache, LocationSpec } from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
/**
 * Catalog processor for MCP entities
 * Handles validation, relationship processing, and metadata enrichment
 */
export declare class McpEntityProcessor implements CatalogProcessor {
    getProcessorName(): string;
    validateEntityKind(entity: Entity): Promise<boolean>;
    postProcessEntity(entity: Entity, _location: LocationSpec, emit: CatalogProcessorEmit, _cache: CatalogProcessorCache): Promise<Entity>;
    private processEntityRelationships;
    private processToolRelationships;
    private processWorkloadRelationships;
    private enrichEntityMetadata;
    private enrichServerMetadata;
    private enrichToolMetadata;
    private enrichWorkloadMetadata;
}
//# sourceMappingURL=McpEntityProcessor.d.ts.map