/**
 * MCP Entity Management API - Service Layer
 *
 * Business logic layer for MCP entity operations.
 * Uses CatalogClient for reading entities from the Backstage Catalog,
 * and a database for persistence of API-created entities.
 */

import type { Logger } from 'winston';
import type { CatalogApi } from '@backstage/catalog-client';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from './errors';
import { buildEntityRef } from './validation';
import { MCPEntityDatabase } from './database';
import { MCPEntityProvider } from './entityProvider';
import type {
  MCPServerInput,
  MCPServerEntity,
  MCPToolInput,
  MCPToolEntity,
  MCPWorkloadInput,
  MCPWorkloadEntity,
  EntityListResponse,
  EntityListParams,
} from './types';

export interface MCPEntityServiceOptions {
  catalog: CatalogApi;
  database: MCPEntityDatabase;
  entityProvider: MCPEntityProvider;
  logger: Logger;
}

/**
 * Service layer for MCP Entity operations.
 * 
 * Uses CatalogClient for reading entities from Backstage Catalog,
 * and database + EntityProvider for writes:
 * - Entity validation (FR-006)
 * - Uniqueness checks (FR-009, FR-010)
 * - Cascade delete for servers (FR-007)
 * - Orphan behavior for tools/workloads (FR-008)
 * - Last write wins for updates (FR-013)
 */
export class MCPEntityService {
  private readonly catalog: CatalogApi;
  private readonly database: MCPEntityDatabase;
  private readonly entityProvider: MCPEntityProvider;
  private readonly logger: Logger;

  constructor(options: MCPEntityServiceOptions) {
    this.catalog = options.catalog;
    this.database = options.database;
    this.entityProvider = options.entityProvider;
    this.logger = options.logger.child({ service: 'MCPEntityService' });
  }

  // ===========================================================================
  // Server Operations
  // ===========================================================================

  /**
   * Create a new MCP Server entity (FR-001, FR-002)
   */
  async createServer(input: MCPServerInput): Promise<MCPServerEntity> {
    this.logger.info('Creating MCP Server', { name: input.metadata.name });

    // Note: Validation handled by Backstage catalog when entity is saved
    const namespace = input.metadata.namespace || 'default';
    const entityRef = buildEntityRef('component', namespace, input.metadata.name);

    // Check uniqueness (FR-009)
    const existing = await this.database.exists(entityRef);
    if (existing) {
      throw new ConflictError(entityRef);
    }

    // Build full entity
    const entity = this.buildServerEntity(input);

    // Save to database
    await this.database.upsertEntity(entity);

    // Add entity to catalog immediately (delta mutation)
    await this.entityProvider.updateEntity(entity);

    return entity;
  }

  /**
   * Get a single MCP Server by namespace and name
   * Merges catalog entity (source of truth) with database state (runtime overrides)
   */
  async getServer(namespace: string, name: string): Promise<MCPServerEntity> {
    const entityRef = buildEntityRef('component', namespace, name);
    
    // Get entity from catalog (YAML source of truth)
    const catalogEntity = await this.catalog.getEntityByRef({
      kind: 'Component',
      namespace,
      name,
    });

    if (!catalogEntity || (catalogEntity.spec as any)?.type !== 'mcp-server') {
      throw new NotFoundError(entityRef);
    }

    // Get any database overrides (disabled state, etc.)
    const dbEntity = await this.database.getEntity(entityRef);
    
    // Merge: catalog as base, database annotations overlay
    if (dbEntity) {
      return {
        ...catalogEntity,
        metadata: {
          ...catalogEntity.metadata,
          annotations: {
            ...catalogEntity.metadata.annotations,
            ...dbEntity.metadata.annotations, // Database wins for annotations
          },
        },
      } as unknown as MCPServerEntity;
    }

    return catalogEntity as unknown as MCPServerEntity;
  }

  /**
   * List all MCP Servers with optional filtering
   * Merges catalog entities with database state (runtime overrides)
   */
  async listServers(params?: EntityListParams): Promise<EntityListResponse<MCPServerEntity>> {
    const filter: Record<string, string>[] = [
      { kind: 'component', 'spec.type': 'mcp-server' },
    ];
    if (params?.namespace) {
      filter[0]['metadata.namespace'] = params.namespace;
    }

    const response = await this.catalog.getEntities({ filter });
    const catalogEntities = response.items;

    // Merge database state into catalog entities
    const mergedEntities = await Promise.all(
      catalogEntities.map(async (catalogEntity) => {
        const entityRef = buildEntityRef(
          'component',
          catalogEntity.metadata.namespace || 'default',
          catalogEntity.metadata.name,
        );
        const dbEntity = await this.database.getEntity(entityRef);
        
        if (dbEntity) {
          return {
            ...catalogEntity,
            metadata: {
              ...catalogEntity.metadata,
              annotations: {
                ...catalogEntity.metadata.annotations,
                ...dbEntity.metadata.annotations,
              },
            },
          };
        }
        return catalogEntity;
      }),
    );

    return {
      items: mergedEntities as unknown as MCPServerEntity[],
      totalCount: mergedEntities.length,
    };
  }

  /**
   * Update an existing MCP Server (FR-013: last write wins)
   */
  async updateServer(
    namespace: string,
    name: string,
    input: MCPServerInput,
  ): Promise<MCPServerEntity> {
    this.logger.info('Updating MCP Server', { namespace, name });

    // Note: Validation handled by Backstage catalog when entity is saved
    const entityRef = buildEntityRef('component', namespace, name);

    // Verify entity exists in catalog (checks both YAML and API-created entities)
    const existing = await this.catalog.getEntityByRef({
      kind: 'Component',
      namespace,
      name,
    });
    if (!existing || (existing.spec as any)?.type !== 'mcp-server') {
      throw new NotFoundError(entityRef);
    }

    // Build and save updated entity (last write wins - FR-013)
    const entity = this.buildServerEntity(input, namespace, name);
    await this.database.upsertEntity(entity);

    // Update entity in catalog immediately (delta mutation)
    await this.entityProvider.updateEntity(entity);

    return entity;
  }

  /**
   * Delete an MCP Server with cascade delete of tools (FR-007)
   */
  async deleteServer(namespace: string, name: string): Promise<void> {
    this.logger.info('Deleting MCP Server with cascade', { namespace, name });

    const entityRef = buildEntityRef('component', namespace, name);

    // Verify entity exists in catalog (checks both YAML and API-created entities)
    const existing = await this.catalog.getEntityByRef({
      kind: 'Component',
      namespace,
      name,
    });
    if (!existing || (existing.spec as any)?.type !== 'mcp-server') {
      throw new NotFoundError(entityRef);
    }

    // Cascade delete tools (FR-007)
    const deletedTools = await this.database.deleteByParent(entityRef);
    this.logger.info('Cascade deleted tools', { count: deletedTools });

    // Delete server
    await this.database.deleteEntity(entityRef);

    // Remove entity from catalog immediately (delta mutation)
    await this.entityProvider.removeEntity(entityRef);

    this.logger.info('Server deleted', { entityRef, toolsDeleted: deletedTools });
  }

  // ===========================================================================
  // Tool Operations
  // ===========================================================================

  /**
   * Create a new MCP Tool entity (FR-001, FR-002)
   */
  async createTool(input: MCPToolInput): Promise<MCPToolEntity> {
    this.logger.info('Creating MCP Tool', { name: input.metadata.name });

    // Note: Validation handled by Backstage catalog when entity is saved
    const namespace = input.metadata.namespace || 'default';
    const entityRef = buildEntityRef('component', namespace, input.metadata.name);

    // Check global uniqueness first
    const existing = await this.database.exists(entityRef);
    if (existing) {
      throw new ConflictError(entityRef);
    }

    // Verify parent server exists
    const parentRef = input.spec.subcomponentOf;
    const parentServer = await this.database.getEntity(parentRef);
    if (!parentServer) {
      throw new ValidationError(`Parent server '${parentRef}' not found`);
    }

    // Check per-server uniqueness (FR-010)
    const existingTools = await this.database.listEntitiesByType('mcp-tool', {
      parentRef,
    });
    const duplicate = existingTools.find(
      t => t.metadata.name === input.metadata.name,
    );
    if (duplicate) {
      throw new ConflictError(
        `Tool '${input.metadata.name}' already exists under server '${parentRef}'`,
      );
    }

    // Build full entity
    const entity = this.buildToolEntity(input);

    // Save to database
    await this.database.upsertEntity(entity);

    // Add entity to catalog immediately (delta mutation)
    await this.entityProvider.updateEntity(entity);

    return entity;
  }

  /**
   * Get a single MCP Tool by namespace and name
   * Merges catalog entity (source of truth) with database state (runtime overrides)
   */
  async getTool(namespace: string, name: string): Promise<MCPToolEntity> {
    const entityRef = buildEntityRef('component', namespace, name);
    
    // Get entity from catalog (YAML source of truth)
    const catalogEntity = await this.catalog.getEntityByRef({
      kind: 'Component',
      namespace,
      name,
    });

    if (!catalogEntity || (catalogEntity.spec as any)?.type !== 'mcp-tool') {
      throw new NotFoundError(entityRef);
    }

    // Get any database overrides (disabled state, etc.)
    const dbEntity = await this.database.getEntity(entityRef);
    
    // Merge: catalog as base, database annotations overlay
    if (dbEntity) {
      return {
        ...catalogEntity,
        metadata: {
          ...catalogEntity.metadata,
          annotations: {
            ...catalogEntity.metadata.annotations,
            ...dbEntity.metadata.annotations, // Database wins for annotations
          },
        },
      } as unknown as MCPToolEntity;
    }

    return catalogEntity as unknown as MCPToolEntity;
  }

  /**
   * List all MCP Tools with optional filtering
   * Merges catalog entities with database state (runtime overrides)
   */
  async listTools(params?: EntityListParams): Promise<EntityListResponse<MCPToolEntity>> {
    const filter: Record<string, string>[] = [
      { kind: 'component', 'spec.type': 'mcp-tool' },
    ];
    if (params?.namespace) {
      filter[0]['metadata.namespace'] = params.namespace;
    }
    if (params?.server) {
      filter[0]['spec.subcomponentOf'] = params.server;
    }

    const response = await this.catalog.getEntities({ filter });
    const catalogEntities = response.items;

    // Merge database state into catalog entities
    const mergedEntities = await Promise.all(
      catalogEntities.map(async (catalogEntity) => {
        const entityRef = buildEntityRef(
          'component',
          catalogEntity.metadata.namespace || 'default',
          catalogEntity.metadata.name,
        );
        const dbEntity = await this.database.getEntity(entityRef);
        
        if (dbEntity) {
          return {
            ...catalogEntity,
            metadata: {
              ...catalogEntity.metadata,
              annotations: {
                ...catalogEntity.metadata.annotations,
                ...dbEntity.metadata.annotations,
              },
            },
          };
        }
        return catalogEntity;
      }),
    );

    return {
      items: mergedEntities as unknown as MCPToolEntity[],
      totalCount: mergedEntities.length,
    };
  }

  /**
   * Update an existing MCP Tool
   */
  async updateTool(
    namespace: string,
    name: string,
    input: MCPToolInput,
  ): Promise<MCPToolEntity> {
    this.logger.info('Updating MCP Tool', { namespace, name });

    // Note: Validation handled by Backstage catalog when entity is saved
    const entityRef = buildEntityRef('component', namespace, name);
    
    // Verify entity exists in catalog (checks both YAML and API-created entities)
    const existing = await this.catalog.getEntityByRef({
      kind: 'Component',
      namespace,
      name,
    });
    if (!existing || (existing.spec as any)?.type !== 'mcp-tool') {
      throw new NotFoundError(entityRef);
    }

    // Verify parent server exists (check catalog for YAML entities)
    const parentRef = input.spec.subcomponentOf;
    const parentParts = parentRef.split(':');
    const parentNamespace = parentParts[1]?.split('/')[0] || 'default';
    const parentName = parentParts[1]?.split('/')[1] || parentParts[1];
    
    const parentServer = await this.catalog.getEntityByRef({
      kind: 'Component',
      namespace: parentNamespace,
      name: parentName,
    });
    if (!parentServer || (parentServer.spec as any)?.type !== 'mcp-server') {
      throw new ValidationError(`Parent server '${parentRef}' not found`);
    }

    const entity = this.buildToolEntity(input, namespace, name);
    await this.database.upsertEntity(entity);

    // Update entity in catalog immediately (delta mutation)
    await this.entityProvider.updateEntity(entity);

    return entity;
  }

  /**
   * Delete an MCP Tool (orphan behavior - FR-008)
   */
  async deleteTool(namespace: string, name: string): Promise<void> {
    this.logger.info('Deleting MCP Tool (orphan behavior)', { namespace, name });

    const entityRef = buildEntityRef('component', namespace, name);
    
    // Verify entity exists in catalog (checks both YAML and API-created entities)
    const existing = await this.catalog.getEntityByRef({
      kind: 'Component',
      namespace,
      name,
    });
    if (!existing || (existing.spec as any)?.type !== 'mcp-tool') {
      throw new NotFoundError(entityRef);
    }

    // Simply delete - workload dependsOn refs become dangling (FR-008)
    await this.database.deleteEntity(entityRef);

    // Remove entity from catalog immediately (delta mutation)
    await this.entityProvider.removeEntity(entityRef);

    this.logger.info('Tool deleted (dependents orphaned)', { entityRef });
  }

  // ===========================================================================
  // Workload Operations
  // ===========================================================================

  /**
   * Create a new MCP Workload entity
   */
  async createWorkload(input: MCPWorkloadInput): Promise<MCPWorkloadEntity> {
    this.logger.info('Creating MCP Workload', { name: input.metadata.name });

    // Note: Validation handled by Backstage catalog when entity is saved
    const namespace = input.metadata.namespace || 'default';
    const entityRef = buildEntityRef('component', namespace, input.metadata.name);

    // Check uniqueness (FR-009)
    const existing = await this.database.exists(entityRef);
    if (existing) {
      throw new ConflictError(entityRef);
    }

    // Warn about missing tool dependencies (but don't block creation)
    if (input.spec.dependsOn) {
      for (const toolRef of input.spec.dependsOn) {
        const tool = await this.database.getEntity(toolRef);
        if (!tool) {
          this.logger.warn('Workload references missing tool dependency', {
            workload: input.metadata.name,
            missingTool: toolRef,
          });
        }
      }
    }

    const entity = this.buildWorkloadEntity(input);
    await this.database.upsertEntity(entity);

    // Add entity to catalog immediately (delta mutation)
    await this.entityProvider.updateEntity(entity);

    return entity;
  }

  /**
   * Get a single MCP Workload by namespace and name
   * Merges catalog entity (source of truth) with database state (runtime overrides)
   * If entity doesn't exist in catalog yet (newly created via API), returns database entity
   * Returns 404 for soft-deleted workloads
   */
  async getWorkload(namespace: string, name: string): Promise<MCPWorkloadEntity> {
    const entityRef = buildEntityRef('component', namespace, name);
    
    // Get entity from catalog (YAML source of truth)
    const catalogEntity = await this.catalog.getEntityByRef({
      kind: 'Component',
      namespace,
      name,
    });

    // Check for mcp-workload or compatible types (service, workflow)
    const entityType = (catalogEntity?.spec as any)?.type;
    const validTypes = ['mcp-workload', 'service', 'workflow'];
    
    // If not found in catalog, check if it exists in database only (newly created via API)
    if (!catalogEntity || !validTypes.includes(entityType)) {
      const dbEntity = await this.database.getEntity(entityRef);
      if (dbEntity) {
        // Entity exists in database but not yet propagated to catalog
        // This is expected for newly created entities via API
        const dbEntityType = (dbEntity.spec as any)?.type;
        if (validTypes.includes(dbEntityType)) {
          // Check if soft-deleted
          const annotations = dbEntity.metadata.annotations || {};
          if (annotations['mcp-catalog.io/deleted'] === 'true') {
            throw new NotFoundError(entityRef);  // Treat soft-deleted as not found
          }
          
          this.logger.debug('Returning database-only workload (not yet in catalog)', { 
            entityRef,
            type: dbEntityType
          });
          return dbEntity as unknown as MCPWorkloadEntity;
        }
      }
      // Entity doesn't exist in catalog or database
      throw new NotFoundError(entityRef);
    }

    // Get any database overrides (user edits, runtime state, etc.)
    const dbEntity = await this.database.getEntity(entityRef);
    
    // Merge: catalog as base, database fields overlay
    if (dbEntity) {
      const merged = {
        ...catalogEntity,
        metadata: {
          ...catalogEntity.metadata,
          // Database wins for description (user edits)
          ...(dbEntity.metadata.description !== undefined && { description: dbEntity.metadata.description }),
          annotations: {
            ...catalogEntity.metadata.annotations,
            ...dbEntity.metadata.annotations, // Database wins for annotations
          },
        },
        spec: {
          ...(catalogEntity.spec as any),
          // Database wins for user-editable fields
          ...(dbEntity.spec?.lifecycle !== undefined && { lifecycle: (dbEntity.spec as any).lifecycle }),
          ...(dbEntity.spec?.owner !== undefined && { owner: (dbEntity.spec as any).owner }),
          // Always use database dependsOn if dbEntity exists (even if empty array)
          ...('dependsOn' in (dbEntity.spec || {}) && { dependsOn: (dbEntity.spec as any).dependsOn }),
        },
      } as unknown as MCPWorkloadEntity;
      
      // Check if soft-deleted
      const annotations = merged.metadata.annotations || {};
      if (annotations['mcp-catalog.io/deleted'] === 'true') {
        throw new NotFoundError(entityRef);  // Treat soft-deleted as not found
      }
      
      return merged;
    }

    return catalogEntity as unknown as MCPWorkloadEntity;
  }

  /**
   * List all MCP Workloads with optional filtering
   * Merges catalog entities with database state (runtime overrides)
   * Includes database-only entities (newly created via API, not yet in catalog)
   */
  async listWorkloads(params?: EntityListParams): Promise<EntityListResponse<MCPWorkloadEntity>> {
    // Query for all workload types: mcp-workload, service, workflow
    const filters: Record<string, string>[] = [
      { kind: 'component', 'spec.type': 'mcp-workload' },
      { kind: 'component', 'spec.type': 'service' },
      { kind: 'component', 'spec.type': 'workflow' },
    ];

    if (params?.namespace) {
      filters.forEach(f => (f['metadata.namespace'] = params.namespace!));
    }

    const response = await this.catalog.getEntities({ filter: filters });
    const catalogEntities = response.items;

    // Merge database state into catalog entities
    const mergedEntities = await Promise.all(
      catalogEntities.map(async (catalogEntity) => {
        const entityRef = buildEntityRef(
          'component',
          catalogEntity.metadata.namespace || 'default',
          catalogEntity.metadata.name,
        );
        const dbEntity = await this.database.getEntity(entityRef);
        
        if (dbEntity) {
          const merged = {
            ...catalogEntity,
            metadata: {
              ...catalogEntity.metadata,
              // Database wins for description (user edits)
              ...(dbEntity.metadata.description !== undefined && { description: dbEntity.metadata.description }),
              annotations: {
                ...catalogEntity.metadata.annotations,
                ...dbEntity.metadata.annotations,
              },
            },
            spec: {
              ...(catalogEntity.spec as any),
              // Database wins for user-editable fields
              ...(dbEntity.spec?.lifecycle !== undefined && { lifecycle: (dbEntity.spec as any).lifecycle }),
              ...(dbEntity.spec?.owner !== undefined && { owner: (dbEntity.spec as any).owner }),
              // Always use database dependsOn if dbEntity exists (even if empty array)
              ...('dependsOn' in (dbEntity.spec || {}) && { dependsOn: (dbEntity.spec as any).dependsOn }),
            },
          };
          
          // Filter out soft-deleted entities
          const annotations = merged.metadata.annotations || {};
          if (annotations['mcp-catalog.io/deleted'] === 'true') {
            return null;  // Exclude soft-deleted workloads
          }
          
          return merged;
        }
        return catalogEntity;
      }),
    );

    // Filter out nulls (soft-deleted entities)
    const filteredMergedEntities = mergedEntities.filter(e => e !== null);

    // Also include database-only entities (newly created via API, not yet in catalog)
    const catalogEntityRefs = new Set(
      catalogEntities.map(e => 
        buildEntityRef('component', e.metadata.namespace || 'default', e.metadata.name)
      )
    );
    
    const allDbEntities = await this.database.listEntities();
    const validTypes = ['mcp-workload', 'service', 'workflow'];
    const dbOnlyWorkloads = allDbEntities
      .filter(dbEntity => {
        const entityRef = buildEntityRef(
          'component',
          dbEntity.metadata.namespace || 'default',
          dbEntity.metadata.name
        );
        const dbEntityType = (dbEntity.spec as any)?.type;
        const annotations = dbEntity.metadata.annotations || {};
        
        // Include if: not in catalog, is a workload type, matches namespace filter (if any), and not soft-deleted
        return !catalogEntityRefs.has(entityRef) &&
               validTypes.includes(dbEntityType) &&
               (!params?.namespace || dbEntity.metadata.namespace === params.namespace) &&
               annotations['mcp-catalog.io/deleted'] !== 'true';  // Exclude soft-deleted
      });

    if (dbOnlyWorkloads.length > 0) {
      this.logger.debug('Including database-only workloads in list', {
        count: dbOnlyWorkloads.length,
        workloads: dbOnlyWorkloads.map(e => e.metadata.name)
      });
    }

    const allEntities = [...filteredMergedEntities, ...dbOnlyWorkloads];

    return {
      items: allEntities as unknown as MCPWorkloadEntity[],
      totalCount: allEntities.length,
    };
  }

  /**
   * Update an existing MCP Workload
   * Supports both YAML-defined and API-created (database-only) workloads
   */
  async updateWorkload(
    namespace: string,
    name: string,
    input: MCPWorkloadInput,
  ): Promise<MCPWorkloadEntity> {
    this.logger.info('Updating MCP Workload', { namespace, name });

    const entityRef = buildEntityRef('component', namespace, name);
    const validTypes = ['mcp-workload', 'service', 'workflow'];
    
    // Try to get entity from catalog (YAML-defined workloads)
    const catalogEntity = await this.catalog.getEntityByRef({
      kind: 'Component',
      namespace,
      name,
    });
    
    const catalogEntityType = (catalogEntity?.spec as any)?.type;
    
    // If not found in catalog or wrong type, check database (API-created workloads)
    if (!catalogEntity || !validTypes.includes(catalogEntityType)) {
      const dbEntity = await this.database.getEntity(entityRef);
      if (dbEntity) {
        const dbEntityType = (dbEntity.spec as any)?.type;
        if (validTypes.includes(dbEntityType)) {
          // Database-only entity - update it
          this.logger.debug('Updating database-only workload', { entityRef });
          
          // Merge input with existing database entity
          const updatedEntity: MCPWorkloadEntity = {
            apiVersion: dbEntity.apiVersion || 'backstage.io/v1alpha1',
            kind: dbEntity.kind || 'Component',
            metadata: {
              ...dbEntity.metadata,
              name: name,
              namespace: namespace || 'default',
              // Only update fields that are provided in input
              ...(input.metadata?.description !== undefined && { description: input.metadata.description }),
              ...(input.metadata?.title !== undefined && { title: input.metadata.title }),
              ...(input.metadata?.labels !== undefined && { labels: input.metadata.labels }),
              ...(input.metadata?.annotations !== undefined && { annotations: input.metadata.annotations }),
              ...(input.metadata?.tags !== undefined && { tags: input.metadata.tags }),
            },
            spec: {
              ...(dbEntity.spec as any),
              // Only update fields that are provided in input
              ...(input.spec?.type !== undefined && { type: input.spec.type }),
              ...(input.spec?.lifecycle !== undefined && { lifecycle: input.spec.lifecycle }),
              ...(input.spec?.owner !== undefined && { owner: input.spec.owner }),
              ...(input.spec?.dependsOn !== undefined && { dependsOn: input.spec.dependsOn }),
              ...(input.spec?.mcp !== undefined && { mcp: input.spec.mcp }),
            },
            ...(dbEntity.relations && { relations: dbEntity.relations }),
          };

          await this.database.upsertEntity(updatedEntity);
          await this.entityProvider.updateEntity(updatedEntity);
          
          return updatedEntity;
        }
      }
      // Entity doesn't exist in catalog or database
      throw new NotFoundError(entityRef);
    }

    // YAML-defined workload - merge input and save to database as override
    const entity: MCPWorkloadEntity = {
      apiVersion: catalogEntity.apiVersion || 'backstage.io/v1alpha1',
      kind: catalogEntity.kind || 'Component',
      metadata: {
        ...catalogEntity.metadata,
        name: name,
        namespace: namespace || 'default',
        // Only update fields that are provided in input
        ...(input.metadata?.description !== undefined && { description: input.metadata.description }),
        ...(input.metadata?.title !== undefined && { title: input.metadata.title }),
        ...(input.metadata?.labels !== undefined && { labels: input.metadata.labels }),
        ...(input.metadata?.annotations !== undefined && { annotations: input.metadata.annotations }),
        ...(input.metadata?.tags !== undefined && { tags: input.metadata.tags }),
      },
      spec: {
        ...(catalogEntity.spec as any),
        // Only update fields that are provided in input
        ...(input.spec?.type !== undefined && { type: input.spec.type }),
        ...(input.spec?.lifecycle !== undefined && { lifecycle: input.spec.lifecycle }),
        ...(input.spec?.owner !== undefined && { owner: input.spec.owner }),
        ...(input.spec?.dependsOn !== undefined && { dependsOn: input.spec.dependsOn }),
        ...(input.spec?.mcp !== undefined && { mcp: input.spec.mcp }),
      },
      ...(catalogEntity.relations && { relations: catalogEntity.relations }),
    };

    await this.database.upsertEntity(entity);

    // Update entity in catalog immediately (delta mutation)
    await this.entityProvider.updateEntity(entity);

    return entity;
  }

  /**
   * Delete an MCP Workload (orphan behavior - FR-008)
   * Supports both YAML-defined and API-created (database-only) workloads
   * YAML-defined workloads are soft-deleted (marked as deleted) to prevent re-ingestion
   */
  async deleteWorkload(namespace: string, name: string): Promise<void> {
    this.logger.info('Deleting MCP Workload', { namespace, name });

    const entityRef = buildEntityRef('component', namespace, name);
    const validTypes = ['mcp-workload', 'service', 'workflow'];
    
    // Try to get entity from catalog (YAML-defined workloads)
    const catalogEntity = await this.catalog.getEntityByRef({
      kind: 'Component',
      namespace,
      name,
    });
    const catalogEntityType = (catalogEntity?.spec as any)?.type;
    
    // If not found in catalog or wrong type, check database (API-created workloads)
    if (!catalogEntity || !validTypes.includes(catalogEntityType)) {
      const dbEntity = await this.database.getEntity(entityRef);
      if (dbEntity) {
        const dbEntityType = (dbEntity.spec as any)?.type;
        if (validTypes.includes(dbEntityType)) {
          // Database-only entity - hard delete
          this.logger.debug('Hard deleting database-only workload', { entityRef });
          await this.database.deleteEntity(entityRef);
          await this.entityProvider.removeEntity(entityRef);
          this.logger.info('Workload deleted', { entityRef });
          return;
        }
      }
      // Entity doesn't exist in catalog or database
      throw new NotFoundError(entityRef);
    }

    // YAML-defined workload - check if managed by location (GitHub, etc.)
    const managedByLocation = catalogEntity.metadata.annotations?.['backstage.io/managed-by-location'];
    
    if (managedByLocation) {
      // Soft delete: mark as deleted in database to prevent re-appearance
      this.logger.info('Soft deleting YAML-managed workload', { 
        entityRef, 
        managedByLocation 
      });
      
      const softDeletedEntity = {
        ...catalogEntity,
        metadata: {
          ...catalogEntity.metadata,
          annotations: {
            ...catalogEntity.metadata.annotations,
            'mcp-catalog.io/deleted': 'true',
            'mcp-catalog.io/deleted-at': new Date().toISOString(),
          },
        },
      };
      
      await this.database.upsertEntity(softDeletedEntity);
      this.logger.info('Workload soft-deleted (marked as deleted, hidden from UI)', { entityRef });
    } else {
      // Not managed by location - hard delete (API-created without location)
      this.logger.info('Hard deleting non-location-managed workload', { entityRef });
      await this.database.deleteEntity(entityRef);
      await this.entityProvider.removeEntity(entityRef);
      this.logger.info('Workload deleted', { entityRef });
    }
  }

  // ===========================================================================
  // Admin Endpoints - For development/testing
  // ===========================================================================

  /**
   * List all soft-deleted workloads (admin only)
   */
  async listSoftDeletedWorkloads(): Promise<Array<{ entityRef: string; name: string; namespace: string; deletedAt: string }>> {
    this.logger.info('Listing soft-deleted workloads (admin)');
    
    const allDbEntities = await this.database.listEntities();
    const softDeleted = allDbEntities
      .filter(entity => {
        const annotations = entity.metadata.annotations || {};
        return annotations['mcp-catalog.io/deleted'] === 'true';
      })
      .map(entity => ({
        entityRef: buildEntityRef('component', entity.metadata.namespace || 'default', entity.metadata.name),
        name: entity.metadata.name,
        namespace: entity.metadata.namespace || 'default',
        deletedAt: entity.metadata.annotations?.['mcp-catalog.io/deleted-at'] || 'unknown',
      }));
    
    this.logger.info('Found soft-deleted workloads', { count: softDeleted.length });
    return softDeleted;
  }

  /**
   * Undelete a soft-deleted workload (admin only)
   * Removes the soft-delete flags from the database
   */
  async undeleteWorkload(namespace: string, name: string): Promise<void> {
    this.logger.info('Undeleting soft-deleted workload (admin)', { namespace, name });
    
    const entityRef = buildEntityRef('component', namespace, name);
    const dbEntity = await this.database.getEntity(entityRef);
    
    if (!dbEntity) {
      throw new NotFoundError(entityRef);
    }
    
    const annotations = dbEntity.metadata.annotations || {};
    if (annotations['mcp-catalog.io/deleted'] !== 'true') {
      throw new Error(`Entity ${entityRef} is not soft-deleted`);
    }
    
    // Remove soft-delete flags
    const updatedEntity = {
      ...dbEntity,
      metadata: {
        ...dbEntity.metadata,
        annotations: {
          ...annotations,
        },
      },
    };
    
    delete updatedEntity.metadata.annotations!['mcp-catalog.io/deleted'];
    delete updatedEntity.metadata.annotations!['mcp-catalog.io/deleted-at'];
    
    await this.database.upsertEntity(updatedEntity);
    this.logger.info('Workload undeleted (soft-delete flags removed)', { entityRef });
  }

  /**
   * Hard delete a workload from database (admin only)
   * Completely removes the database record, allowing recreation with same name
   */
  async hardDeleteWorkload(namespace: string, name: string): Promise<void> {
    this.logger.info('Hard deleting workload from database (admin)', { namespace, name });
    
    const entityRef = buildEntityRef('component', namespace, name);
    const dbEntity = await this.database.getEntity(entityRef);
    
    if (!dbEntity) {
      throw new NotFoundError(`Entity ${entityRef} not found in database`);
    }
    
    // Delete from database and entity provider
    await this.database.deleteEntity(entityRef);
    await this.entityProvider.removeEntity(entityRef);
    
    this.logger.info('Workload hard deleted from database', { entityRef });
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private buildServerEntity(
    input: MCPServerInput,
    namespace?: string,
    name?: string,
  ): MCPServerEntity {
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: name || input.metadata.name,
        namespace: namespace || input.metadata.namespace || 'default',
        title: input.metadata.title,
        description: input.metadata.description,
        labels: input.metadata.labels,
        annotations: input.metadata.annotations,
        tags: input.metadata.tags,
      },
      spec: {
        type: 'mcp-server',
        lifecycle: input.spec.lifecycle,
        owner: input.spec.owner,
        mcp: input.spec.mcp,
      },
    };
  }

  private buildToolEntity(
    input: MCPToolInput,
    namespace?: string,
    name?: string,
  ): MCPToolEntity {
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: name || input.metadata.name,
        namespace: namespace || input.metadata.namespace || 'default',
        title: input.metadata.title,
        description: input.metadata.description,
        labels: input.metadata.labels,
        annotations: input.metadata.annotations,
        tags: input.metadata.tags,
      },
      spec: {
        type: 'mcp-tool',
        lifecycle: input.spec.lifecycle,
        owner: input.spec.owner,
        subcomponentOf: input.spec.subcomponentOf,
        mcp: input.spec.mcp,
      },
    };
  }

  private buildWorkloadEntity(
    input: MCPWorkloadInput,
    namespace?: string,
    name?: string,
  ): MCPWorkloadEntity {
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: name || input.metadata.name,
        namespace: namespace || input.metadata.namespace || 'default',
        title: input.metadata.title,
        description: input.metadata.description,
        labels: input.metadata.labels,
        annotations: input.metadata.annotations,
        tags: input.metadata.tags,
      },
      spec: {
        type: input.spec.type || 'mcp-workload',
        lifecycle: input.spec.lifecycle,
        owner: input.spec.owner,
        dependsOn: input.spec.dependsOn,
        mcp: input.spec.mcp,
      },
    };
  }
}
