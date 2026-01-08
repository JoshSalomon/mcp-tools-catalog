/**
 * MCP Entity Management API - Database Layer
 *
 * Stores MCP entities in a database table for persistence.
 * The EntityProvider reads from this table to populate the catalog.
 */

import { Knex } from 'knex';
import { v4 as uuid } from 'uuid';
import type { Entity } from '@backstage/catalog-model';
import type { Logger } from 'winston';
import type {
  Guardrail,
  GuardrailWithUsage,
  ToolGuardrailAssociation,
  WorkloadToolGuardrailAssociation,
  ExecutionTiming,
} from './types';

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

export interface MCPGuardrailRow {
  id: string;
  namespace: string;
  name: string;
  description: string;
  deployment: string;
  parameters: string | null;
  disabled: number; // 0 = enabled, 1 = disabled (SQLite boolean)
  created_at: Date;
  updated_at: Date;
}

export interface MCPToolGuardrailRow {
  id: string;
  tool_namespace: string;
  tool_name: string;
  guardrail_id: string;
  execution_timing: string; // 'pre-execution' or 'post-execution'
  parameters: string | null; // Optional parameters for this tool-guardrail association
  created_at: Date;
}

export interface MCPWorkloadToolGuardrailRow {
  id: string;
  workload_namespace: string;
  workload_name: string;
  tool_namespace: string;
  tool_name: string;
  guardrail_id: string;
  execution_timing: string; // 'pre-execution' or 'post-execution'
  source: string; // 'tool' (inherited) or 'workload' (added)
  parameters: string | null; // Optional parameters for this workload-tool-guardrail association
  created_at: Date;
}

export interface MCPEntityDatabaseOptions {
  database: Knex;
  logger: Logger;
}

const TABLE_NAME = 'mcp_entities';
const GUARDRAILS_TABLE = 'mcp_guardrails';
const TOOL_GUARDRAILS_TABLE = 'mcp_tool_guardrails';
const WORKLOAD_TOOL_GUARDRAILS_TABLE = 'mcp_workload_tool_guardrails';

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

    // Guardrails table migration
    await this.migrateGuardrailsTables();
  }

  /**
   * Migrate guardrails-related tables
   */
  private async migrateGuardrailsTables(): Promise<void> {
    // Create mcp_guardrails table
    const hasGuardrailsTable = await this.db.schema.hasTable(GUARDRAILS_TABLE);
    if (!hasGuardrailsTable) {
      this.logger.info('Creating mcp_guardrails table');
      await this.db.schema.createTable(GUARDRAILS_TABLE, table => {
        table.string('id').primary();
        table.string('namespace').notNullable().defaultTo('default');
        table.string('name').notNullable();
        table.text('description').notNullable();
        table.text('deployment').notNullable();
        table.text('parameters').nullable();
        table.integer('disabled').notNullable().defaultTo(0);
        table.timestamp('created_at').defaultTo(this.db.fn.now());
        table.timestamp('updated_at').defaultTo(this.db.fn.now());

        // Unique constraint on namespace + name
        table.unique(['namespace', 'name']);
        // Index for efficient lookups
        table.index(['namespace', 'name'], 'idx_mcp_guardrails_namespace_name');
      });
      this.logger.info('Created mcp_guardrails table');
    }

    // Create mcp_tool_guardrails table
    const hasToolGuardrailsTable = await this.db.schema.hasTable(TOOL_GUARDRAILS_TABLE);
    if (!hasToolGuardrailsTable) {
      this.logger.info('Creating mcp_tool_guardrails table');
      await this.db.schema.createTable(TOOL_GUARDRAILS_TABLE, table => {
        table.string('id').primary();
        table.string('tool_namespace').notNullable();
        table.string('tool_name').notNullable();
        table.string('guardrail_id').notNullable();
        table.string('execution_timing').notNullable(); // 'pre-execution' or 'post-execution'
        table.text('parameters').nullable(); // Optional parameters for this tool-guardrail association
        table.timestamp('created_at').defaultTo(this.db.fn.now());

        // Foreign key to guardrails (RESTRICT on delete)
        table.foreign('guardrail_id')
          .references('id')
          .inTable(GUARDRAILS_TABLE)
          .onDelete('RESTRICT');

        // Unique constraint: one guardrail per tool
        table.unique(['tool_namespace', 'tool_name', 'guardrail_id']);
        // Indexes for efficient lookups
        table.index(['tool_namespace', 'tool_name'], 'idx_mcp_tool_guardrails_tool');
        table.index(['guardrail_id'], 'idx_mcp_tool_guardrails_guardrail');
      });
      this.logger.info('Created mcp_tool_guardrails table');
    } else {
      // Migration: Add parameters column if it doesn't exist (for existing installations)
      const hasParametersColumn = await this.db.schema.hasColumn(TOOL_GUARDRAILS_TABLE, 'parameters');
      if (!hasParametersColumn) {
        this.logger.info('Adding parameters column to mcp_tool_guardrails table');
        await this.db.schema.alterTable(TOOL_GUARDRAILS_TABLE, table => {
          table.text('parameters').nullable();
        });
        this.logger.info('Added parameters column to mcp_tool_guardrails table');
      }
    }

    // Create mcp_workload_tool_guardrails table
    const hasWorkloadToolGuardrailsTable = await this.db.schema.hasTable(WORKLOAD_TOOL_GUARDRAILS_TABLE);
    if (!hasWorkloadToolGuardrailsTable) {
      this.logger.info('Creating mcp_workload_tool_guardrails table');
      await this.db.schema.createTable(WORKLOAD_TOOL_GUARDRAILS_TABLE, table => {
        table.string('id').primary();
        table.string('workload_namespace').notNullable();
        table.string('workload_name').notNullable();
        table.string('tool_namespace').notNullable();
        table.string('tool_name').notNullable();
        table.string('guardrail_id').notNullable();
        table.string('execution_timing').notNullable(); // 'pre-execution' or 'post-execution'
        table.string('source').notNullable(); // 'tool' (inherited) or 'workload' (added)
        table.text('parameters').nullable(); // Optional parameters for this workload-tool-guardrail association
        table.timestamp('created_at').defaultTo(this.db.fn.now());

        // Foreign key to guardrails (RESTRICT on delete)
        table.foreign('guardrail_id')
          .references('id')
          .inTable(GUARDRAILS_TABLE)
          .onDelete('RESTRICT');

        // Unique constraint: one guardrail per workload-tool pair
        table.unique(['workload_namespace', 'workload_name', 'tool_namespace', 'tool_name', 'guardrail_id']);
        // Indexes for efficient lookups
        table.index(['workload_namespace', 'workload_name'], 'idx_mcp_wtg_workload');
        table.index(['tool_namespace', 'tool_name'], 'idx_mcp_wtg_tool');
        table.index(['guardrail_id'], 'idx_mcp_wtg_guardrail');
      });
      this.logger.info('Created mcp_workload_tool_guardrails table');
    } else {
      // Migration: Add parameters column if it doesn't exist (for existing installations)
      const hasParametersColumn = await this.db.schema.hasColumn(WORKLOAD_TOOL_GUARDRAILS_TABLE, 'parameters');
      if (!hasParametersColumn) {
        this.logger.info('Adding parameters column to mcp_workload_tool_guardrails table');
        await this.db.schema.alterTable(WORKLOAD_TOOL_GUARDRAILS_TABLE, table => {
          table.text('parameters').nullable();
        });
        this.logger.info('Added parameters column to mcp_workload_tool_guardrails table');
      }
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

  // ===========================================================================
  // Guardrail Operations (Database-Only - 006-mcp-guardrails)
  // ===========================================================================

  /**
   * List all guardrails with optional namespace filter
   */
  async listGuardrails(params?: { namespace?: string; limit?: number; offset?: number }): Promise<{ items: Guardrail[]; totalCount: number }> {
    let query = this.db<MCPGuardrailRow>(GUARDRAILS_TABLE);

    if (params?.namespace) {
      query = query.where({ namespace: params.namespace });
    }

    // Get total count first
    const countResult = await query.clone().count('* as count').first() as { count: number | string } | undefined;
    const totalCount = Number(countResult?.count ?? 0);

    // Apply pagination
    if (params?.limit) {
      query = query.limit(params.limit);
    }
    if (params?.offset) {
      query = query.offset(params.offset);
    }

    const rows = await query.orderBy('created_at', 'desc');

    const items: Guardrail[] = rows.map(row => this.rowToGuardrail(row));

    return { items, totalCount };
  }

  /**
   * Get a guardrail by namespace and name
   */
  async getGuardrail(namespace: string, name: string): Promise<Guardrail | null> {
    const row = await this.db<MCPGuardrailRow>(GUARDRAILS_TABLE)
      .where({ namespace, name })
      .first();

    if (!row) {
      return null;
    }

    return this.rowToGuardrail(row);
  }

  /**
   * Get a guardrail by ID
   */
  async getGuardrailById(id: string): Promise<Guardrail | null> {
    const row = await this.db<MCPGuardrailRow>(GUARDRAILS_TABLE)
      .where({ id })
      .first();

    if (!row) {
      return null;
    }

    return this.rowToGuardrail(row);
  }

  /**
   * Get a guardrail with usage information
   */
  async getGuardrailWithUsage(namespace: string, name: string): Promise<GuardrailWithUsage | null> {
    const guardrail = await this.getGuardrail(namespace, name);
    if (!guardrail) {
      return null;
    }

    // Get tool-guardrail associations
    const toolAssociations = await this.db<MCPToolGuardrailRow>(TOOL_GUARDRAILS_TABLE)
      .where({ guardrail_id: guardrail.id });

    const tools: ToolGuardrailAssociation[] = toolAssociations.map(row => ({
      id: row.id,
      toolNamespace: row.tool_namespace,
      toolName: row.tool_name,
      guardrailId: row.guardrail_id,
      executionTiming: row.execution_timing as 'pre-execution' | 'post-execution',
      parameters: row.parameters || undefined,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));

    // Get workload-tool-guardrail associations
    const workloadToolAssociations = await this.db<MCPWorkloadToolGuardrailRow>(WORKLOAD_TOOL_GUARDRAILS_TABLE)
      .where({ guardrail_id: guardrail.id });

    const workloadTools: WorkloadToolGuardrailAssociation[] = workloadToolAssociations.map(row => ({
      id: row.id,
      workloadNamespace: row.workload_namespace,
      workloadName: row.workload_name,
      toolNamespace: row.tool_namespace,
      toolName: row.tool_name,
      guardrailId: row.guardrail_id,
      executionTiming: row.execution_timing as 'pre-execution' | 'post-execution',
      source: row.source as 'tool' | 'workload',
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));

    return {
      ...guardrail,
      usage: {
        tools,
        workloadTools,
      },
    };
  }

  /**
   * Create a new guardrail
   */
  async createGuardrail(input: {
    namespace: string;
    name: string;
    description: string;
    deployment: string;
    parameters?: string;
    disabled?: boolean;
  }): Promise<Guardrail> {
    const id = uuid();
    const now = new Date();

    await this.db<MCPGuardrailRow>(GUARDRAILS_TABLE).insert({
      id,
      namespace: input.namespace,
      name: input.name,
      description: input.description,
      deployment: input.deployment,
      parameters: input.parameters ?? null,
      disabled: input.disabled ? 1 : 0,
      created_at: now,
      updated_at: now,
    });

    this.logger.info('Guardrail created', { id, namespace: input.namespace, name: input.name });

    return {
      id,
      namespace: input.namespace,
      name: input.name,
      description: input.description,
      deployment: input.deployment,
      parameters: input.parameters,
      disabled: input.disabled ?? false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  /**
   * Update an existing guardrail
   */
  async updateGuardrail(
    namespace: string,
    name: string,
    input: {
      name?: string;
      description?: string;
      deployment?: string;
      parameters?: string;
      disabled?: boolean;
    },
  ): Promise<Guardrail | null> {
    const existing = await this.getGuardrail(namespace, name);
    if (!existing) {
      return null;
    }

    const now = new Date();
    const updates: Partial<MCPGuardrailRow> = {
      updated_at: now,
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.deployment !== undefined) updates.deployment = input.deployment;
    if (input.parameters !== undefined) updates.parameters = input.parameters;
    if (input.disabled !== undefined) updates.disabled = input.disabled ? 1 : 0;

    await this.db<MCPGuardrailRow>(GUARDRAILS_TABLE)
      .where({ id: existing.id })
      .update(updates);

    this.logger.info('Guardrail updated', { id: existing.id, namespace, name });

    // Return updated guardrail
    const updated = await this.getGuardrailById(existing.id);
    return updated;
  }

  /**
   * Delete a guardrail (fails if has associations)
   */
  async deleteGuardrail(namespace: string, name: string): Promise<{ deleted: boolean; error?: string }> {
    const existing = await this.getGuardrail(namespace, name);
    if (!existing) {
      return { deleted: false, error: 'Guardrail not found' };
    }

    // Check for tool associations
    const toolCount = await this.db<MCPToolGuardrailRow>(TOOL_GUARDRAILS_TABLE)
      .where({ guardrail_id: existing.id })
      .count('* as count')
      .first() as { count: number | string } | undefined;

    const toolAssociations = Number(toolCount?.count ?? 0);

    // Check for workload-tool associations
    const wtgCount = await this.db<MCPWorkloadToolGuardrailRow>(WORKLOAD_TOOL_GUARDRAILS_TABLE)
      .where({ guardrail_id: existing.id })
      .count('* as count')
      .first() as { count: number | string } | undefined;

    const workloadToolAssociations = Number(wtgCount?.count ?? 0);

    if (toolAssociations > 0 || workloadToolAssociations > 0) {
      const totalRefs = toolAssociations + workloadToolAssociations;
      return {
        deleted: false,
        error: `Cannot delete: guardrail has ${totalRefs} reference(s) (${toolAssociations} tool(s), ${workloadToolAssociations} workload-tool relationship(s))`,
      };
    }

    await this.db<MCPGuardrailRow>(GUARDRAILS_TABLE)
      .where({ id: existing.id })
      .delete();

    this.logger.info('Guardrail deleted', { id: existing.id, namespace, name });

    return { deleted: true };
  }

  /**
   * Check if a guardrail exists by namespace and name
   */
  async guardrailExists(namespace: string, name: string): Promise<boolean> {
    const row = await this.db<MCPGuardrailRow>(GUARDRAILS_TABLE)
      .where({ namespace, name })
      .first('id');

    return !!row;
  }

  /**
   * Set guardrail disabled state
   */
  async setGuardrailDisabled(namespace: string, name: string, disabled: boolean): Promise<Guardrail | null> {
    return this.updateGuardrail(namespace, name, { disabled });
  }

  /**
   * Convert database row to Guardrail type
   */
  private rowToGuardrail(row: MCPGuardrailRow): Guardrail {
    return {
      id: row.id,
      namespace: row.namespace,
      name: row.name,
      description: row.description,
      deployment: row.deployment,
      parameters: row.parameters ?? undefined,
      disabled: row.disabled === 1,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  // ===========================================================================
  // Tool-Guardrail Association Operations (US3)
  // ===========================================================================

  /**
   * List all guardrail associations for a tool
   */
  async listToolGuardrails(toolNamespace: string, toolName: string): Promise<ToolGuardrailAssociation[]> {
    const rows = await this.db<MCPToolGuardrailRow>(TOOL_GUARDRAILS_TABLE)
      .where({ tool_namespace: toolNamespace, tool_name: toolName });

    // Get guardrail details for each association
    const associations: ToolGuardrailAssociation[] = [];
    for (const row of rows) {
      const guardrail = await this.getGuardrailById(row.guardrail_id);
      associations.push({
        id: row.id,
        toolNamespace: row.tool_namespace,
        toolName: row.tool_name,
        guardrailId: row.guardrail_id,
        guardrail: guardrail || undefined,
        executionTiming: row.execution_timing as ExecutionTiming,
        parameters: row.parameters || undefined,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      });
    }
    return associations;
  }

  /**
   * Attach a guardrail to a tool
   */
  async attachGuardrailToTool(
    toolNamespace: string,
    toolName: string,
    guardrailId: string,
    executionTiming: ExecutionTiming,
    parameters?: string,
  ): Promise<ToolGuardrailAssociation> {
    const id = uuid();
    const now = new Date();

    await this.db<MCPToolGuardrailRow>(TOOL_GUARDRAILS_TABLE).insert({
      id,
      tool_namespace: toolNamespace,
      tool_name: toolName,
      guardrail_id: guardrailId,
      execution_timing: executionTiming,
      parameters: parameters || null,
      created_at: now,
    });

    this.logger.info('Attached guardrail to tool', { toolNamespace, toolName, guardrailId, hasParameters: !!parameters });

    const guardrail = await this.getGuardrailById(guardrailId);
    return {
      id,
      toolNamespace,
      toolName,
      guardrailId,
      guardrail: guardrail || undefined,
      executionTiming,
      parameters: parameters || undefined,
      createdAt: now.toISOString(),
    };
  }

  /**
   * Check if a tool-guardrail association exists
   */
  async toolGuardrailExists(
    toolNamespace: string,
    toolName: string,
    guardrailId: string,
  ): Promise<boolean> {
    const row = await this.db<MCPToolGuardrailRow>(TOOL_GUARDRAILS_TABLE)
      .where({ tool_namespace: toolNamespace, tool_name: toolName, guardrail_id: guardrailId })
      .first('id');
    return !!row;
  }

  /**
   * Detach a guardrail from a tool
   */
  async detachGuardrailFromTool(
    toolNamespace: string,
    toolName: string,
    guardrailId: string,
  ): Promise<boolean> {
    const deleted = await this.db<MCPToolGuardrailRow>(TOOL_GUARDRAILS_TABLE)
      .where({ tool_namespace: toolNamespace, tool_name: toolName, guardrail_id: guardrailId })
      .delete();

    if (deleted > 0) {
      this.logger.info('Detached guardrail from tool', { toolNamespace, toolName, guardrailId });
      return true;
    }
    return false;
  }

  // ===========================================================================
  // Workload-Tool-Guardrail Association Operations (US4)
  // ===========================================================================

  /**
   * List all guardrail associations for a workload-tool relationship
   */
  async listWorkloadToolGuardrails(
    workloadNamespace: string,
    workloadName: string,
    toolNamespace: string,
    toolName: string,
  ): Promise<WorkloadToolGuardrailAssociation[]> {
    const rows = await this.db<MCPWorkloadToolGuardrailRow>(WORKLOAD_TOOL_GUARDRAILS_TABLE)
      .where({
        workload_namespace: workloadNamespace,
        workload_name: workloadName,
        tool_namespace: toolNamespace,
        tool_name: toolName,
      });

    // Get guardrail details for each association
    const associations: WorkloadToolGuardrailAssociation[] = [];
    for (const row of rows) {
      const guardrail = await this.getGuardrailById(row.guardrail_id);
      associations.push({
        id: row.id,
        workloadNamespace: row.workload_namespace,
        workloadName: row.workload_name,
        toolNamespace: row.tool_namespace,
        toolName: row.tool_name,
        guardrailId: row.guardrail_id,
        guardrail: guardrail || undefined,
        executionTiming: row.execution_timing as ExecutionTiming,
        source: row.source as 'tool' | 'workload',
        parameters: row.parameters || undefined,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      });
    }
    return associations;
  }

  /**
   * Add a guardrail to a workload-tool relationship
   */
  async addGuardrailToWorkloadTool(
    workloadNamespace: string,
    workloadName: string,
    toolNamespace: string,
    toolName: string,
    guardrailId: string,
    executionTiming: ExecutionTiming,
    source: 'tool' | 'workload',
    parameters?: string,
  ): Promise<WorkloadToolGuardrailAssociation> {
    const id = uuid();
    const now = new Date();

    await this.db<MCPWorkloadToolGuardrailRow>(WORKLOAD_TOOL_GUARDRAILS_TABLE).insert({
      id,
      workload_namespace: workloadNamespace,
      workload_name: workloadName,
      tool_namespace: toolNamespace,
      tool_name: toolName,
      guardrail_id: guardrailId,
      execution_timing: executionTiming,
      source,
      parameters: parameters || null,
      created_at: now,
    });

    this.logger.info('Added guardrail to workload-tool', {
      workloadNamespace,
      workloadName,
      toolNamespace,
      toolName,
      guardrailId,
      source,
      hasParameters: !!parameters,
    });

    const guardrail = await this.getGuardrailById(guardrailId);
    return {
      id,
      workloadNamespace,
      workloadName,
      toolNamespace,
      toolName,
      guardrailId,
      guardrail: guardrail || undefined,
      executionTiming,
      source,
      parameters: parameters || undefined,
      createdAt: now.toISOString(),
    };
  }

  /**
   * Check if a workload-tool-guardrail association exists
   */
  async workloadToolGuardrailExists(
    workloadNamespace: string,
    workloadName: string,
    toolNamespace: string,
    toolName: string,
    guardrailId: string,
  ): Promise<boolean> {
    const row = await this.db<MCPWorkloadToolGuardrailRow>(WORKLOAD_TOOL_GUARDRAILS_TABLE)
      .where({
        workload_namespace: workloadNamespace,
        workload_name: workloadName,
        tool_namespace: toolNamespace,
        tool_name: toolName,
        guardrail_id: guardrailId,
      })
      .first('id');
    return !!row;
  }

  /**
   * Remove a guardrail from a workload-tool relationship
   */
  async removeGuardrailFromWorkloadTool(
    workloadNamespace: string,
    workloadName: string,
    toolNamespace: string,
    toolName: string,
    guardrailId: string,
  ): Promise<boolean> {
    const deleted = await this.db<MCPWorkloadToolGuardrailRow>(WORKLOAD_TOOL_GUARDRAILS_TABLE)
      .where({
        workload_namespace: workloadNamespace,
        workload_name: workloadName,
        tool_namespace: toolNamespace,
        tool_name: toolName,
        guardrail_id: guardrailId,
      })
      .delete();

    if (deleted > 0) {
      this.logger.info('Removed guardrail from workload-tool', {
        workloadNamespace,
        workloadName,
        toolNamespace,
        toolName,
        guardrailId,
      });
      return true;
    }
    return false;
  }

  /**
   * Update a workload-tool-guardrail association (executionTiming and/or parameters)
   */
  async updateWorkloadToolGuardrail(
    workloadNamespace: string,
    workloadName: string,
    toolNamespace: string,
    toolName: string,
    guardrailId: string,
    updates: { executionTiming?: ExecutionTiming; parameters?: string | null },
  ): Promise<WorkloadToolGuardrailAssociation | null> {
    // Build update object with only provided fields
    const updateData: Partial<MCPWorkloadToolGuardrailRow> = {};
    if (updates.executionTiming !== undefined) {
      updateData.execution_timing = updates.executionTiming;
    }
    if (updates.parameters !== undefined) {
      updateData.parameters = updates.parameters;
    }

    // If no fields to update, just return the existing row
    if (Object.keys(updateData).length === 0) {
      const existing = await this.db<MCPWorkloadToolGuardrailRow>(WORKLOAD_TOOL_GUARDRAILS_TABLE)
        .where({
          workload_namespace: workloadNamespace,
          workload_name: workloadName,
          tool_namespace: toolNamespace,
          tool_name: toolName,
          guardrail_id: guardrailId,
        })
        .first();

      if (!existing) {
        return null;
      }

      const guardrail = await this.getGuardrailById(guardrailId);
      return {
        id: existing.id,
        workloadNamespace: existing.workload_namespace,
        workloadName: existing.workload_name,
        toolNamespace: existing.tool_namespace,
        toolName: existing.tool_name,
        guardrailId: existing.guardrail_id,
        guardrail: guardrail || undefined,
        executionTiming: existing.execution_timing as ExecutionTiming,
        source: existing.source as 'tool' | 'workload',
        parameters: existing.parameters || undefined,
        createdAt: existing.created_at instanceof Date ? existing.created_at.toISOString() : String(existing.created_at),
      };
    }

    const updated = await this.db<MCPWorkloadToolGuardrailRow>(WORKLOAD_TOOL_GUARDRAILS_TABLE)
      .where({
        workload_namespace: workloadNamespace,
        workload_name: workloadName,
        tool_namespace: toolNamespace,
        tool_name: toolName,
        guardrail_id: guardrailId,
      })
      .update(updateData);

    if (updated === 0) {
      return null;
    }

    this.logger.info('Updated workload-tool-guardrail', {
      workloadNamespace,
      workloadName,
      toolNamespace,
      toolName,
      guardrailId,
      updates,
    });

    // Fetch and return the updated row
    const row = await this.db<MCPWorkloadToolGuardrailRow>(WORKLOAD_TOOL_GUARDRAILS_TABLE)
      .where({
        workload_namespace: workloadNamespace,
        workload_name: workloadName,
        tool_namespace: toolNamespace,
        tool_name: toolName,
        guardrail_id: guardrailId,
      })
      .first();

    if (!row) {
      return null;
    }

    const guardrail = await this.getGuardrailById(guardrailId);
    return {
      id: row.id,
      workloadNamespace: row.workload_namespace,
      workloadName: row.workload_name,
      toolNamespace: row.tool_namespace,
      toolName: row.tool_name,
      guardrailId: row.guardrail_id,
      guardrail: guardrail || undefined,
      executionTiming: row.execution_timing as ExecutionTiming,
      source: row.source as 'tool' | 'workload',
      parameters: row.parameters || undefined,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  /**
   * Inherit tool guardrails to a workload-tool relationship
   * Copies all guardrails attached to a tool to the workload-tool association
   * with source='tool' (inherited)
   */
  async inheritToolGuardrailsToWorkload(
    workloadNamespace: string,
    workloadName: string,
    toolNamespace: string,
    toolName: string,
  ): Promise<WorkloadToolGuardrailAssociation[]> {
    // Get all guardrails attached to the tool
    const toolGuardrails = await this.listToolGuardrails(toolNamespace, toolName);

    const inherited: WorkloadToolGuardrailAssociation[] = [];

    for (const tg of toolGuardrails) {
      // Check if already exists (avoid duplicates)
      const exists = await this.workloadToolGuardrailExists(
        workloadNamespace,
        workloadName,
        toolNamespace,
        toolName,
        tg.guardrailId,
      );

      if (!exists) {
        const association = await this.addGuardrailToWorkloadTool(
          workloadNamespace,
          workloadName,
          toolNamespace,
          toolName,
          tg.guardrailId,
          tg.executionTiming,
          'tool', // inherited from tool
        );
        inherited.push(association);
      }
    }

    this.logger.info('Inherited tool guardrails to workload', {
      workloadNamespace,
      workloadName,
      toolNamespace,
      toolName,
      count: inherited.length,
    });

    return inherited;
  }
}
