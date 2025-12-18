import {
  createPlugin,
  createApiFactory,
  discoveryApiRef,
  identityApiRef,
  createRouteRef,
  createComponentExtension,
} from '@backstage/core-plugin-api';
import { McpCatalogClient, mcpCatalogApiRef } from './api/McpCatalogApi';

/**
 * Route references for MCP Tools Catalog pages
 */
export const mcpServerPageRouteRef = createRouteRef({
  id: 'mcp-server-page',
});

export const mcpToolPageRouteRef = createRouteRef({
  id: 'mcp-tool-page',
});

export const mcpWorkloadPageRouteRef = createRouteRef({
  id: 'mcp-workload-page',
});

export const mcpCatalogRouteRef = createRouteRef({
  id: 'mcp-catalog',
});

/**
 * Main MCP Tools Catalog plugin definition
 */
export const mcpToolsCatalogPlugin = createPlugin({
  id: 'mcp-tools-catalog',
  routes: {
    catalog: mcpCatalogRouteRef,
    server: mcpServerPageRouteRef,
    tool: mcpToolPageRouteRef,
    workload: mcpWorkloadPageRouteRef,
  },
  apis: [
    createApiFactory({
      api: mcpCatalogApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        identityApi: identityApiRef,
      },
      factory: ({ discoveryApi, identityApi }) =>
        new McpCatalogClient({
          discoveryApi,
          identityApi,
        }),
    }),
  ],
});

/**
 * Component extensions for MCP entity pages
 */
export const McpServerPage = mcpToolsCatalogPlugin.provide(
  createComponentExtension({
    name: 'McpServerPage',
    component: {
      lazy: () => import('./components/McpServerPage').then(m => m.McpServerPage),
    },
  }),
);

export const McpToolPage = mcpToolsCatalogPlugin.provide(
  createComponentExtension({
    name: 'McpToolPage',
    component: {
      lazy: () => import('./components/McpToolPage').then(m => m.McpToolPage),
    },
  }),
);

export const McpWorkloadPage = mcpToolsCatalogPlugin.provide(
  createComponentExtension({
    name: 'McpWorkloadPage',
    component: {
      lazy: () => import('./components/McpWorkloadPage').then(m => m.McpWorkloadPage),
    },
  }),
);

/**
 * Catalog extensions for MCP entity cards and lists
 */
export const McpServerCard = mcpToolsCatalogPlugin.provide(
  createComponentExtension({
    name: 'McpServerCard',
    component: {
      lazy: () => import('./components/McpServerCard').then(m => m.McpServerCard),
    },
  }),
);

export const McpToolCard = mcpToolsCatalogPlugin.provide(
  createComponentExtension({
    name: 'McpToolCard',
    component: {
      lazy: () => import('./components/McpToolCard').then(m => m.McpToolCard),
    },
  }),
);

export const McpWorkloadCard = mcpToolsCatalogPlugin.provide(
  createComponentExtension({
    name: 'McpWorkloadCard',
    component: {
      lazy: () => import('./components/McpWorkloadCard').then(m => m.McpWorkloadCard),
    },
  }),
);

export const McpCatalogPage = mcpToolsCatalogPlugin.provide(
  createComponentExtension({
    name: 'McpCatalogPage',
    component: {
      lazy: () => import('./components/McpCatalogPage').then(m => m.McpCatalogPage),
    },
  }),
);

/**
 * Plugin exports for external usage
 */
export {
  mcpCatalogApiRef,
  type McpCatalogApi,
} from './api/McpCatalogApi';

export {
  type McpServerEntityV1alpha1,
  type McpToolEntityV1alpha1,
  type McpWorkloadEntityV1alpha1,
  type McpEntity,
  isMcpServerEntity,
  isMcpToolEntity,
  isMcpWorkloadEntity,
  MCP_ENTITY_KINDS,
  MCP_API_VERSION,
} from './schemas/entity-schemas';

export { RelationshipService } from './services/RelationshipService';
export { McpEntityProcessor } from './processors/McpEntityProcessor';
export { 
  type McpCatalogConfig,
  readMcpCatalogConfig,
  validateMcpCatalogConfig,
} from './config/plugin-config';