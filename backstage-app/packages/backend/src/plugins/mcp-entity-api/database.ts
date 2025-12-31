/**
 * MCP Entity Management API - Database Layer
 *
 * Stores MCP entities in a database table for persistence.
 * The EntityProvider reads from this table to populate the catalog.
 */

import { Knex } from 'knex';
import type { Entity } from '@backstage/catalog-model';
import type { Logger } from 'winston';

export interface MCPEntityRow {
  id: string;
  entity_ref: string;
  entity_type: string; // mcp-server, mcp-tool, mcp-workload
  namespace: string;
  name: string;
  entity_json: string;
  created_at: Date;
  updated_at: Date;
}

export interface MCPEntityDatabaseOptions {
  database: Knex;
  logger: Logger;
}

const TABLE_NAME = 'mcp_entities';

/**
 * Database operations for MCP entities
 */
export class MCPEntityDatabase {
  private readonly db: Knex;
  private readonly logger: Logger;

  constructor(options: MCPEntityDatabaseOptions) {
    this.db = options.database;
    this.logger = options.logger.child({ component: 'MCPEntityDatabase' });
  }

  /**
   * Run database migrations
   */
  async migrate(): Promise<void> {
    const hasTable = await this.db.schema.hasTable(TABLE_NAME);
    
    if (!hasTable) {
      this.logger.info('Creating mcp_entities table');
      await this.db.schema.createTable(TABLE_NAME, table => {
        table.string('id').primary();
        table.string('entity_ref').notNullable().unique();
        table.string('entity_type').notNullable();
        table.string('namespace').notNullable();
        table.string('name').notNullable();
        table.text('entity_json').notNullable();
        table.timestamp('created_at').defaultTo(this.db.fn.now());
        table.timestamp('updated_at').defaultTo(this.db.fn.now());
        
        // Indexes for common queries
        table.index(['entity_type']);
        table.index(['namespace', 'name']);
      });
      this.logger.info('Created mcp_entities table');
    }
  }

  /**
   * Insert or update an entity
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async upsertEntity(entity: any): Promise<void> {
    const namespace = entity.metadata.namespace || 'default';
    const entityRef = `${entity.kind.toLowerCase()}:${namespace}/${entity.metadata.name}`;
    const entityType = entity.spec?.type || 'unknown';
    const id = `${entityType}-${namespace}-${entity.metadata.name}`;

    const row: Partial<MCPEntityRow> = {
      id,
      entity_ref: entityRef,
      entity_type: entityType,
      namespace,
      name: entity.metadata.name,
      entity_json: JSON.stringify(entity),
      updated_at: new Date(),
    };

    // Try to update first, then insert if not exists
    const updated = await this.db(TABLE_NAME)
      .where({ id })
      .update({
        entity_json: row.entity_json,
        updated_at: row.updated_at,
      });

    if (updated === 0) {
      await this.db(TABLE_NAME).insert({
        ...row,
        created_at: new Date(),
      });
      this.logger.info('Entity inserted', { entityRef });
    } else {
      this.logger.info('Entity updated', { entityRef });
    }
  }

  /**
   * Get an entity by reference
   */
  async getEntity(entityRef: string): Promise<Entity | undefined> {
    const row = await this.db<MCPEntityRow>(TABLE_NAME)
      .where({ entity_ref: entityRef })
      .first();

    if (!row) {
      return undefined;
    }

    return JSON.parse(row.entity_json) as Entity;
  }

  /**
   * Get an entity by namespace and name
   */
  async getEntityByName(
    namespace: string,
    name: string,
    entityType?: string,
  ): Promise<Entity | undefined> {
    let query = this.db<MCPEntityRow>(TABLE_NAME)
      .where({ namespace, name });

    if (entityType) {
      query = query.andWhere({ entity_type: entityType });
    }

    const row = await query.first();

    if (!row) {
      return undefined;
    }

    return JSON.parse(row.entity_json) as Entity;
  }

  /**
   * List entities by type
   */
  async listEntities(entityType?: string): Promise<Entity[]> {
    let query = this.db<MCPEntityRow>(TABLE_NAME);

    if (entityType) {
      query = query.where({ entity_type: entityType });
    }

    const rows = await query.select('entity_json');
    return rows.map(row => JSON.parse(row.entity_json) as Entity);
  }

  /**
   * List entities by type with filtering
   */
  async listEntitiesByType(
    entityType: string,
    filters?: { namespace?: string; parentRef?: string },
  ): Promise<Entity[]> {
    let query = this.db<MCPEntityRow>(TABLE_NAME).where({ entity_type: entityType });

    if (filters?.namespace) {
      query = query.andWhere({ namespace: filters.namespace });
    }

    const rows = await query.select('entity_json');
    let entities = rows.map(row => JSON.parse(row.entity_json) as Entity);

    // Filter by parent reference if needed (for tools)
    if (filters?.parentRef) {
      entities = entities.filter(e => {
        const spec = e.spec as any;
        return spec?.subcomponentOf === filters.parentRef;
      });
    }

    return entities;
  }

  /**
   * Delete an entity
   */
  async deleteEntity(entityRef: string): Promise<boolean> {
    const deleted = await this.db(TABLE_NAME)
      .where({ entity_ref: entityRef })
      .delete();

    if (deleted > 0) {
      this.logger.info('Entity deleted', { entityRef });
      return true;
    }

    return false;
  }

  /**
   * Delete entities by parent (for cascade delete)
   * Returns the entity refs of deleted entities for entityProvider cleanup
   */
  async deleteByParent(parentRef: string): Promise<string[]> {
    // Get all tools that belong to this parent
    const rows = await this.db<MCPEntityRow>(TABLE_NAME)
      .where({ entity_type: 'mcp-tool' })
      .select('id', 'entity_ref', 'entity_json');

    const toDelete: { id: string; entityRef: string }[] = [];
    for (const row of rows) {
      const entity = JSON.parse(row.entity_json) as Entity;
      if ((entity.spec as any)?.subcomponentOf === parentRef) {
        toDelete.push({ id: row.id, entityRef: row.entity_ref });
      }
    }

    const deletedRefs: string[] = [];
    if (toDelete.length > 0) {
      await this.db(TABLE_NAME).whereIn('id', toDelete.map(t => t.id)).delete();
      deletedRefs.push(...toDelete.map(t => t.entityRef));
      this.logger.info('Cascade deleted entities', { parentRef, count: toDelete.length });
    }

    return deletedRefs;
  }

  /**
   * Check if an entity exists
   */
  async exists(entityRef: string): Promise<boolean> {
    const row = await this.db<MCPEntityRow>(TABLE_NAME)
      .where({ entity_ref: entityRef })
      .first('id');

    return !!row;
  }

  /**
   * Get all entities (for EntityProvider)
   */
  async getAllEntities(): Promise<Entity[]> {
    const rows = await this.db<MCPEntityRow>(TABLE_NAME).select('entity_json');
    return rows.map(row => JSON.parse(row.entity_json) as Entity);
  }
}
