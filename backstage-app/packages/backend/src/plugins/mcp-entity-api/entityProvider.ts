/**
 * MCP Entity Provider
 *
 * Provides MCP entities from the database to the Backstage catalog.
 * This is the bridge between our API-managed entities and the catalog.
 */

import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import type { Entity } from '@backstage/catalog-model';
import type { Logger } from 'winston';
import type { SchedulerService, SchedulerServiceTaskScheduleDefinition } from '@backstage/backend-plugin-api';
import { MCPEntityDatabase } from './database';

export interface MCPEntityProviderOptions {
  database: MCPEntityDatabase;
  logger: Logger;
  schedule?: SchedulerServiceTaskScheduleDefinition;
  scheduler?: SchedulerService;
}

/**
 * Entity provider that reads MCP entities from the database
 * and provides them to the Backstage catalog.
 */
export class MCPEntityProvider implements EntityProvider {
  private readonly database: MCPEntityDatabase;
  private readonly logger: Logger;
  private readonly scheduleFn?: () => Promise<void>;
  private connection?: EntityProviderConnection;

  static create(options: MCPEntityProviderOptions): MCPEntityProvider {
    return new MCPEntityProvider(options);
  }

  private constructor(options: MCPEntityProviderOptions) {
    this.database = options.database;
    this.logger = options.logger.child({ component: 'MCPEntityProvider' });

    // Set up scheduled refresh if scheduler is provided
    if (options.scheduler && options.schedule) {
      this.scheduleFn = this.createScheduleFn(options);
    }
  }

  private createScheduleFn(options: MCPEntityProviderOptions): () => Promise<void> {
    return async () => {
      const taskRunner = options.scheduler!.createScheduledTaskRunner(options.schedule!);
      await taskRunner.run({
        id: 'mcp-entity-provider-refresh',
        fn: async () => {
          await this.refresh();
        },
      });
    };
  }

  getProviderName(): string {
    return 'mcp-entity-provider';
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
    this.logger.info('MCPEntityProvider connected to catalog');

    // Start scheduled refresh if configured
    if (this.scheduleFn) {
      await this.scheduleFn();
    }

    // Do initial refresh
    await this.refresh();
  }

  /**
   * Refresh the catalog with current entities from the database
   */
  async refresh(): Promise<void> {
    if (!this.connection) {
      this.logger.warn('Cannot refresh: not connected to catalog');
      return;
    }

    try {
      const entities = await this.database.getAllEntities();
      this.logger.info('Refreshing MCP entities in catalog', { count: entities.length });

      // Apply full mutation - this replaces all entities from this provider
      await this.connection.applyMutation({
        type: 'full',
        entities: entities.map(entity => ({
          entity: this.addProviderMetadata(entity),
          locationKey: this.getProviderName(),
        })),
      });

      this.logger.info('MCP entities refreshed successfully', { count: entities.length });
    } catch (error) {
      this.logger.error('Failed to refresh MCP entities', { error });
    }
  }

  /**
   * Trigger an immediate refresh (called after entity changes)
   */
  async triggerRefresh(): Promise<void> {
    await this.refresh();
  }

  /**
   * Add provider metadata to entity
   */
  private addProviderMetadata(entity: Entity): Entity {
    return {
      ...entity,
      metadata: {
        ...entity.metadata,
        annotations: {
          ...entity.metadata.annotations,
          'backstage.io/managed-by-location': `${this.getProviderName()}:mcp-entity-api`,
          'backstage.io/managed-by-origin-location': `${this.getProviderName()}:mcp-entity-api`,
        },
      },
    };
  }
}
