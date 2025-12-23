/**
 * MCP Entity Management API - Backend Plugin Registration
 *
 * Wires together the database, EntityProvider, service, and router.
 */

import {
  coreServices,
  createBackendPlugin,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { CatalogClient } from '@backstage/catalog-client';
import { createRouter } from './router';
import { MCPEntityDatabase } from './database';
import { MCPEntityProvider } from './entityProvider';
import { MCPEntityService } from './service';

// Shared state between plugin and catalog module
interface MCPSharedState {
  database?: MCPEntityDatabase;
  entityProvider?: MCPEntityProvider;
  initialized: boolean;
}

const sharedState: MCPSharedState = { initialized: false };

/**
 * Initialize shared resources (database and entity provider)
 * Called by whichever module initializes first
 */
async function initSharedResources(
  knex: any,
  logger: any,
): Promise<{ database: MCPEntityDatabase; entityProvider: MCPEntityProvider }> {
  if (sharedState.initialized && sharedState.database && sharedState.entityProvider) {
    logger.info('MCP: Reusing existing shared resources');
    return {
      database: sharedState.database,
      entityProvider: sharedState.entityProvider,
    };
  }

  logger.info('MCP: Initializing shared resources');

  const database = new MCPEntityDatabase({
    database: knex,
    logger,
  });

  await database.migrate();

  const entityProvider = MCPEntityProvider.create({
    database,
    logger,
  });

  sharedState.database = database;
  sharedState.entityProvider = entityProvider;
  sharedState.initialized = true;

  return { database, entityProvider };
}

/**
 * MCP Entity API Backend Plugin
 *
 * Provides REST endpoints for CRUD operations on MCP entities.
 * Uses a database for persistence and EntityProvider for catalog integration.
 */
export const mcpEntityApiPlugin = createBackendPlugin({
  pluginId: 'mcp-entity-api',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        database: coreServices.database,
        discovery: coreServices.discovery,
        auth: coreServices.auth,
      },
      async init({ httpRouter, logger, config, database, discovery, auth }) {
        logger.info('MCP Entity API: Starting initialization');

        // Get database client
        const knex = await database.getClient();

        // Get or create shared resources
        const { database: mcpDatabase, entityProvider } = await initSharedResources(
          knex,
          logger as any,
        );

        logger.info('MCP Entity API: Database initialized');

        // Create CatalogClient for reading entities from Backstage Catalog
        const catalogClient = new CatalogClient({
          discoveryApi: discovery,
          fetchApi: {
            fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
              const { token } = await auth.getPluginRequestToken({
                onBehalfOf: await auth.getOwnServiceCredentials(),
                targetPluginId: 'catalog',
              });
              const headers = new Headers(init?.headers);
              headers.set('Authorization', `Bearer ${token}`);
              return fetch(input, { ...init, headers });
            },
          },
        });

        // Create service layer
        const service = new MCPEntityService({
          catalog: catalogClient,
          database: mcpDatabase,
          entityProvider,
          logger: logger as any,
        });

        logger.info('MCP Entity API: Service created');

        // Create router
        const router = await createRouter({
          logger: logger as any,
          config,
          service,
        });

        logger.info('MCP Entity API: Router created');

        // Register auth policies
        const unauthenticatedPaths = [
          '/health',
          '/servers',
          '/tools',
          '/workloads',
        ];

        for (const path of unauthenticatedPaths) {
          httpRouter.addAuthPolicy({
            path,
            allow: 'unauthenticated',
          });
        }

        httpRouter.use(router);

        logger.info('MCP Entity API: Plugin initialized successfully');
      },
    });
  },
});

/**
 * Catalog module that registers the MCPEntityProvider
 *
 * This module connects the EntityProvider to the catalog processing system.
 * Uses shared resources with the API plugin to ensure the same provider instance.
 */
export const catalogModuleMcpEntityProvider = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'mcp-entity-provider',
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        logger: coreServices.logger,
        database: coreServices.database,
      },
      async init({ catalog, logger, database }) {
        logger.info('MCP Entity Provider: Registering with catalog');

        // Get database client
        const knex = await database.getClient();

        // Get or create shared resources (same instance as API plugin)
        const { entityProvider } = await initSharedResources(knex, logger as any);

        // Register with catalog
        catalog.addEntityProvider(entityProvider);

        logger.info('MCP Entity Provider: Registered with catalog');
      },
    });
  },
});
