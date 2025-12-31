/**
 * MCP Entity Management API - Express Router
 *
 * RESTful endpoints for managing MCP entities (Servers, Tools, Workloads).
 * Base path: /api/mcp-entity-api
 *
 * @openapi
 * components:
 *   schemas:
 *     MCPServerEntity:
 *       type: object
 *       required: [apiVersion, kind, metadata, spec]
 *       properties:
 *         apiVersion:
 *           type: string
 *           example: backstage.io/v1alpha1
 *         kind:
 *           type: string
 *           example: Component
 *         metadata:
 *           $ref: '#/components/schemas/MCPEntityMetadata'
 *         spec:
 *           $ref: '#/components/schemas/MCPServerSpec'
 *     MCPToolEntity:
 *       type: object
 *       required: [apiVersion, kind, metadata, spec]
 *       properties:
 *         apiVersion:
 *           type: string
 *         kind:
 *           type: string
 *         metadata:
 *           $ref: '#/components/schemas/MCPEntityMetadata'
 *         spec:
 *           $ref: '#/components/schemas/MCPToolSpec'
 *     MCPWorkloadEntity:
 *       type: object
 *       required: [apiVersion, kind, metadata, spec]
 *       properties:
 *         apiVersion:
 *           type: string
 *         kind:
 *           type: string
 *         metadata:
 *           $ref: '#/components/schemas/MCPEntityMetadata'
 *         spec:
 *           $ref: '#/components/schemas/MCPWorkloadSpec'
 *     MCPEntityMetadata:
 *       type: object
 *       required: [name]
 *       properties:
 *         name:
 *           type: string
 *         namespace:
 *           type: string
 *           default: default
 *         title:
 *           type: string
 *         description:
 *           type: string
 *     EntityListResponse:
 *       type: object
 *       properties:
 *         items:
 *           type: array
 *         totalCount:
 *           type: integer
 *         cursor:
 *           type: string
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *         message:
 *           type: string
 *         details:
 *           type: object
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       description: OCP Bearer token for RBAC authentication
 */

import { Router, json, Request, Response, NextFunction } from 'express';
import type { Logger } from 'winston';
import type { Config } from '@backstage/config';
import {
  asyncHandler,
  sendSuccessResponse,
  sendCreatedResponse,
  sendNoContentResponse,
  MCPApiError,
  toMCPApiError,
} from './errors';
import { MCPEntityService } from './service';
import { createRBACMiddlewareFactory, extractOCPToken } from './auth';
import type { MCPEntityApiConfig, EntityListParams } from './types';

export interface RouterOptions {
  logger: Logger;
  config: Config;
  service: MCPEntityService;
}

/**
 * Load MCP Entity API configuration from app-config.yaml
 */
function loadConfig(config: Config): MCPEntityApiConfig {
  const mcpConfig = config.getOptionalConfig('mcpEntityApi');

  return {
    roles: {
      server: mcpConfig?.getOptionalString('roles.server') ?? 'mcp-admin',
      tool: mcpConfig?.getOptionalString('roles.tool') ?? 'mcp-admin',
      workload: mcpConfig?.getOptionalString('roles.workload') ?? 'mcp-user',
    },
  };
}

/**
 * Parse list query parameters
 */
function parseListParams(query: Record<string, unknown>): EntityListParams {
  return {
    namespace: query.namespace as string | undefined,
    server: query.server as string | undefined,
    limit: query.limit ? parseInt(query.limit as string, 10) : undefined,
    cursor: query.cursor as string | undefined,
  };
}

/**
 * Create the Express router for MCP Entity API
 */
export async function createRouter(
  options: RouterOptions,
): Promise<Router> {
  const { logger, config, service } = options;
  const apiConfig = loadConfig(config);
  const router = Router();

  logger.info('Creating MCP Entity API router', {
    roles: apiConfig.roles,
  });

  // Create RBAC middleware factory for protecting write endpoints (T038-T041)
  const rbac = createRBACMiddlewareFactory({
    logger: logger as unknown as import('winston').Logger,
    config: apiConfig,
  });

  // Add JSON body parsing middleware
  router.use(json());

  // T042: Enhanced request logging middleware with timing
  router.use((req, res, next) => {
    const startTime = Date.now();

    logger.info('MCP Entity API request started', {
      method: req.method,
      path: req.path,
      url: req.url,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
    });

    // Log response on finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info('MCP Entity API request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
      });
    });

    next();
  });

  // Health check endpoint
  router.get('/health', (_req, res) => {
    sendSuccessResponse(res, { status: 'ok' });
  });

  // ==========================================================================
  // Catalog API Proxy Endpoint - /catalog-proxy/* (Option 3)
  // ==========================================================================
  // Proxies requests to Backstage catalog API with proper authentication handling.
  // This allows the frontend to use a single proxy endpoint that handles both
  // catalog API (read) and MCP Entity API (write) calls with consistent auth.
  //
  // Frontend usage: /api/mcp-entity-api/catalog-proxy/entities?filter=...
  // Backend forwards to: /api/catalog/entities?filter=...
  
  // Manual proxy to Backstage Catalog API
  // This endpoint forwards requests from the frontend to the catalog API with proper authentication
  router.all('/catalog-proxy/*', asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    // Extract the path after /catalog-proxy/
    const catalogPath = req.url.replace(/^\/catalog-proxy/, '');
    const catalogUrl = `http://localhost:7007/api/catalog${catalogPath}`;
    
    // Extract token from request
    const token = extractOCPToken(req);
    
    logger.info('Catalog proxy: Request received', {
      method: req.method,
      originalUrl: req.url,
      catalogUrl,
      hasAuthHeader: !!req.headers.authorization,
      hasForwardedToken: !!req.headers['x-forwarded-access-token'],
      tokenExtracted: !!token,
    });
    
    // Prepare headers for catalog API request
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    
    // Forward auth token if available
    // Note: Catalog API has dangerouslyDisableDefaultAuthPolicy: true, so it accepts
    // requests without authentication, but we forward the token for consistency
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      logger.debug('Catalog proxy: Forwarding token to catalog API');
    } else {
      logger.debug('Catalog proxy: No token found, forwarding without auth');
    }
    
    try {
      // Forward the request to catalog API
      const catalogResponse = await fetch(catalogUrl, {
        method: req.method,
        headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
      });
      
      const duration = Date.now() - startTime;
      
      logger.info('Catalog proxy: Response received', {
        method: req.method,
        path: req.url,
        statusCode: catalogResponse.status,
        duration: `${duration}ms`,
      });
      
      // Forward the catalog API response to the client
      const data = await catalogResponse.json();
      res.status(catalogResponse.status).json(data);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Catalog proxy: Error forwarding request', {
        method: req.method,
        path: req.url,
        error: errorMessage,
        duration: `${duration}ms`,
      });
      
      res.status(502).json({
        error: {
          name: 'BadGateway',
          message: `Failed to forward request to catalog API: ${errorMessage}`,
        },
      });
    }
  }));

  // ==========================================================================
  // Server Endpoints - /servers (T019-T022)
  // ==========================================================================

  /**
   * @openapi
   * /api/mcp-entity-api/servers:
   *   get:
   *     summary: List all MCP Servers
   *     description: Returns a paginated list of all MCP Server entities. No authentication required (FR-012).
   *     tags: [Servers]
   *     parameters:
   *       - in: query
   *         name: namespace
   *         schema:
   *           type: string
   *         description: Filter by namespace
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Maximum number of results (T043)
   *       - in: query
   *         name: cursor
   *         schema:
   *           type: string
   *         description: Pagination cursor for next page (T043)
   *     responses:
   *       200:
   *         description: List of servers
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/EntityListResponse'
   */
  // GET /servers - List all MCP Servers (T020, T041)
  // No RBAC required - public read per FR-012
  router.get(
    '/servers',
    asyncHandler(async (req, res) => {
      const params = parseListParams(req.query as Record<string, unknown>);
      const result = await service.listServers(params);
      sendSuccessResponse(res, result);
    }),
  );

  /**
   * @openapi
   * /api/mcp-entity-api/servers:
   *   post:
   *     summary: Create an MCP Server
   *     description: Creates a new MCP Server entity. Requires mcp-admin role (FR-005).
   *     tags: [Servers]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/MCPServerEntity'
   *     responses:
   *       201:
   *         description: Server created
   *       400:
   *         description: Validation error
   *       401:
   *         description: No authentication token provided
   *       403:
   *         description: User lacks mcp-admin role
   */
  // POST /servers - Create an MCP Server (T019, T038)
  // Requires mcp-admin role per FR-005
  // Note: Validation handled by Backstage catalog when entity is saved
  router.post(
    '/servers',
    rbac('mcp-server', 'create'),
    asyncHandler(async (req, res) => {
      const result = await service.createServer(req.body);
      sendCreatedResponse(res, result);
    }),
  );

  /**
   * @openapi
   * /api/mcp-entity-api/servers/{namespace}/{name}:
   *   get:
   *     summary: Get a specific MCP Server
   *     description: Returns a single MCP Server entity by namespace and name. No authentication required (FR-012).
   *     tags: [Servers]
   *     parameters:
   *       - in: path
   *         name: namespace
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: name
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Server details
   *       404:
   *         description: Server not found
   */
  // GET /servers/:namespace/:name - Get a specific server (T020, T041)
  // No RBAC required - public read per FR-012
  router.get(
    '/servers/:namespace/:name',
    asyncHandler(async (req, res) => {
      const { namespace, name } = req.params;
      const result = await service.getServer(namespace, name);
      sendSuccessResponse(res, result);
    }),
  );

  // PUT /servers/:namespace/:name - Update a server (T021, T038)
  // Requires mcp-admin role per FR-005
  // Note: Validation handled by Backstage catalog when entity is saved
  router.put(
    '/servers/:namespace/:name',
    rbac('mcp-server', 'update'),
    asyncHandler(async (req, res) => {
      const { namespace, name } = req.params;
      const result = await service.updateServer(namespace, name, req.body);
      sendSuccessResponse(res, result);
    }),
  );

  /**
   * @openapi
   * /api/mcp-entity-api/servers/{namespace}/{name}:
   *   delete:
   *     summary: Delete an MCP Server with cascade
   *     description: |
   *       Deletes an MCP Server and all its child Tools (FR-007 cascade delete).
   *       Requires mcp-admin role (FR-005).
   *     tags: [Servers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: namespace
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: name
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Server deleted
   *       401:
   *         description: No authentication token
   *       403:
   *         description: User lacks mcp-admin role
   *       404:
   *         description: Server not found
   */
  // DELETE /servers/:namespace/:name - Delete a server with cascade (T022, T038)
  // Requires mcp-admin role per FR-005
  router.delete(
    '/servers/:namespace/:name',
    rbac('mcp-server', 'delete'),
    asyncHandler(async (req, res) => {
      const { namespace, name } = req.params;
      await service.deleteServer(namespace, name);
      sendNoContentResponse(res);
    }),
  );

  // ==========================================================================
  // Tool Endpoints - /tools (T023-T026)
  // ==========================================================================

  // GET /tools - List all MCP Tools (T024, T041)
  // No RBAC required - public read per FR-012
  router.get(
    '/tools',
    asyncHandler(async (req, res) => {
      const params = parseListParams(req.query as Record<string, unknown>);
      const result = await service.listTools(params);
      sendSuccessResponse(res, result);
    }),
  );

  // POST /tools - Create an MCP Tool (T023, T039)
  // Requires mcp-admin role per FR-005
  // Note: Validation handled by Backstage catalog when entity is saved
  router.post(
    '/tools',
    rbac('mcp-tool', 'create'),
    asyncHandler(async (req, res) => {
      const result = await service.createTool(req.body);
      sendCreatedResponse(res, result);
    }),
  );

  // GET /tools/:namespace/:name - Get a specific tool (T024, T041)
  // No RBAC required - public read per FR-012
  router.get(
    '/tools/:namespace/:name',
    asyncHandler(async (req, res) => {
      const { namespace, name } = req.params;
      const result = await service.getTool(namespace, name);
      sendSuccessResponse(res, result);
    }),
  );

  // PUT /tools/:namespace/:name - Update a tool (T025, T039)
  // Requires mcp-admin role per FR-005
  // Note: Validation handled by Backstage catalog when entity is saved
  router.put(
    '/tools/:namespace/:name',
    rbac('mcp-tool', 'update'),
    asyncHandler(async (req, res) => {
      const { namespace, name } = req.params;
      const result = await service.updateTool(namespace, name, req.body);
      sendSuccessResponse(res, result);
    }),
  );

  // DELETE /tools/:namespace/:name - Delete a tool (T026, T039)
  // Requires mcp-admin role per FR-005
  // Note: Orphan behavior - workload dependsOn refs become dangling per FR-008
  router.delete(
    '/tools/:namespace/:name',
    rbac('mcp-tool', 'delete'),
    asyncHandler(async (req, res) => {
      const { namespace, name } = req.params;
      await service.deleteTool(namespace, name);
      sendNoContentResponse(res);
    }),
  );

  // ==========================================================================
  // Workload Endpoints - /workloads (T027-T030)
  // ==========================================================================

  // GET /workloads - List all MCP Workloads (T028, T041)
  // No RBAC required - public read per FR-012
  // Note: Missing tools with dependsOn ref generate a warning (not an error)
  router.get(
    '/workloads',
    asyncHandler(async (req, res) => {
      const params = parseListParams(req.query as Record<string, unknown>);
      const result = await service.listWorkloads(params);
      sendSuccessResponse(res, result);
    }),
  );

  // POST /workloads - Create an MCP Workload (T027, T040)
  // Requires mcp-user role per FR-005
  // Note: Validation handled by Backstage catalog when entity is saved
  router.post(
    '/workloads',
    rbac('mcp-workload', 'create'),
    asyncHandler(async (req, res) => {
      const result = await service.createWorkload(req.body);
      sendCreatedResponse(res, result);
    }),
  );

  // GET /workloads/:namespace/:name - Get a specific workload (T028, T041)
  // No RBAC required - public read per FR-012
  router.get(
    '/workloads/:namespace/:name',
    asyncHandler(async (req, res) => {
      const { namespace, name } = req.params;
      const result = await service.getWorkload(namespace, name);
      sendSuccessResponse(res, result);
    }),
  );

  // PUT /workloads/:namespace/:name - Update a workload (T029, T040)
  // Requires mcp-user role per FR-005
  // Note: Validation handled by Backstage catalog when entity is saved
  router.put(
    '/workloads/:namespace/:name',
    rbac('mcp-workload', 'update'),
    asyncHandler(async (req, res) => {
      const { namespace, name } = req.params;
      const result = await service.updateWorkload(namespace, name, req.body);
      sendSuccessResponse(res, result);
    }),
  );

  // DELETE /workloads/:namespace/:name - Delete a workload (T030, T040)
  // Requires mcp-user role per FR-005
  router.delete(
    '/workloads/:namespace/:name',
    rbac('mcp-workload', 'delete'),
    asyncHandler(async (req, res) => {
      const { namespace, name } = req.params;
      await service.deleteWorkload(namespace, name);
      sendNoContentResponse(res);
    }),
  );

  // ==========================================================================
  // Error Handling Middleware (T031)
  // ==========================================================================

  // Error handler - converts errors to standardized JSON responses (FR-011)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) {
      return;
    }

    const apiError: MCPApiError = toMCPApiError(err);
    logger.error('API Error', {
      error: apiError.errorType,
      message: apiError.message,
      statusCode: apiError.statusCode,
    });

    res.status(apiError.statusCode).json(apiError.toResponse());
  });

  return router;
}
