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

import { Router, json, text, Request, Response, NextFunction } from 'express';
import type { Logger } from 'winston';
import type { Config } from '@backstage/config';
import YAML from 'yaml';
import {
  asyncHandler,
  sendSuccessResponse,
  sendCreatedResponse,
  sendNoContentResponse,
  ValidationError,
  toMCPApiError,
  MCPApiError,
} from './errors';
import { MCPEntityService } from './service';
import { createRBACMiddlewareFactory, extractOCPToken, createSubjectAccessReviewChecker } from './auth';
import type { MCPEntityApiConfig, EntityListParams, CreateGuardrailInput, Guardrail, MCPEntityType, AttachGuardrailInput } from './types';

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
      guardrail: mcpConfig?.getOptionalString('roles.guardrail') ?? 'mcp-admin',
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
  // Permission Check Endpoint - /auth/can-edit/:entityType
  // ==========================================================================
  // Allows frontend to check if the current user has permission to edit
  // a specific entity type before showing edit buttons.

  router.get(
    '/auth/can-edit/:entityType',
    asyncHandler(async (req, res) => {
      const { entityType } = req.params;
      const token = extractOCPToken(req);

      if (!token) {
        sendSuccessResponse(res, { canEdit: false, reason: 'no-token' });
        return;
      }

      // Validate entity type
      const validTypes: MCPEntityType[] = ['mcp-server', 'mcp-tool', 'mcp-workload', 'mcp-guardrail'];
      if (!validTypes.includes(entityType as MCPEntityType)) {
        sendSuccessResponse(res, { canEdit: false, reason: 'invalid-type' });
        return;
      }

      try {
        const checker = createSubjectAccessReviewChecker();
        const canEdit = await checker(token, entityType as MCPEntityType, 'create');
        sendSuccessResponse(res, { canEdit });
      } catch (error) {
        logger.warn('Permission check failed', {
          entityType,
          error: error instanceof Error ? error.message : String(error),
        });
        sendSuccessResponse(res, { canEdit: false, reason: 'check-failed' });
      }
    }),
  );

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
  // Tool-Guardrail Association Endpoints - /tools/:ns/:name/guardrails (US3)
  // ==========================================================================

  /**
   * @openapi
   * /api/mcp-entity-api/tools/{namespace}/{name}/guardrails:
   *   get:
   *     summary: List guardrails attached to a tool
   *     description: Returns all guardrails attached to a specific tool. No authentication required.
   *     tags: [Tool Guardrails]
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
   *         description: List of guardrail associations
   *       404:
   *         description: Tool not found
   */
  // GET /tools/:namespace/:name/guardrails - List guardrails for a tool (T041)
  // No RBAC required - public read
  router.get(
    '/tools/:namespace/:name/guardrails',
    asyncHandler(async (req, res) => {
      const { namespace, name } = req.params;
      const result = await service.listToolGuardrails(namespace, name);
      sendSuccessResponse(res, { items: result, totalCount: result.length });
    }),
  );

  /**
   * @openapi
   * /api/mcp-entity-api/tools/{namespace}/{name}/guardrails:
   *   post:
   *     summary: Attach a guardrail to a tool
   *     description: Attaches a guardrail to a tool with specified execution timing. Requires mcp-admin role.
   *     tags: [Tool Guardrails]
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
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [guardrailNamespace, guardrailName, executionTiming]
   *             properties:
   *               guardrailNamespace:
   *                 type: string
   *               guardrailName:
   *                 type: string
   *               executionTiming:
   *                 type: string
   *                 enum: [pre-execution, post-execution]
   *     responses:
   *       201:
   *         description: Guardrail attached
   *       400:
   *         description: Invalid input
   *       401:
   *         description: No authentication token
   *       403:
   *         description: User lacks mcp-admin role
   *       404:
   *         description: Tool or guardrail not found
   *       409:
   *         description: Guardrail already attached
   */
  // POST /tools/:namespace/:name/guardrails - Attach a guardrail to a tool (T042)
  // Requires mcp-admin role
  router.post(
    '/tools/:namespace/:name/guardrails',
    rbac('mcp-tool', 'update'),
    asyncHandler(async (req, res) => {
      const { namespace, name } = req.params;
      const input = req.body as AttachGuardrailInput;

      // Basic validation
      if (!input.guardrailNamespace || !input.guardrailName || !input.executionTiming) {
        throw new ValidationError('Missing required fields: guardrailNamespace, guardrailName, executionTiming');
      }
      if (input.executionTiming !== 'pre-execution' && input.executionTiming !== 'post-execution') {
        throw new ValidationError('executionTiming must be "pre-execution" or "post-execution"');
      }

      const result = await service.attachGuardrailToTool(namespace, name, input);
      sendCreatedResponse(res, result);
    }),
  );

  /**
   * @openapi
   * /api/mcp-entity-api/tools/{namespace}/{name}/guardrails/{guardrailNs}/{guardrailName}:
   *   delete:
   *     summary: Detach a guardrail from a tool
   *     description: Removes a guardrail association from a tool. Requires mcp-admin role.
   *     tags: [Tool Guardrails]
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
   *       - in: path
   *         name: guardrailNs
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: guardrailName
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Guardrail detached
   *       401:
   *         description: No authentication token
   *       403:
   *         description: User lacks mcp-admin role
   *       404:
   *         description: Tool, guardrail, or association not found
   */
  // DELETE /tools/:namespace/:name/guardrails/:guardrailNs/:guardrailName - Detach a guardrail (T043)
  // Requires mcp-admin role
  router.delete(
    '/tools/:namespace/:name/guardrails/:guardrailNs/:guardrailName',
    rbac('mcp-tool', 'delete'),
    asyncHandler(async (req, res) => {
      const { namespace, name, guardrailNs, guardrailName } = req.params;
      await service.detachGuardrailFromTool(namespace, name, guardrailNs, guardrailName);
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
  // Workload-Tool-Guardrail Endpoints - /workloads/.../tools/.../guardrails (US4)
  // ==========================================================================

  /**
   * @openapi
   * /api/mcp-entity-api/workloads/{wNs}/{wName}/tools/{tNs}/{tName}/guardrails:
   *   get:
   *     summary: List guardrails for a workload-tool relationship
   *     description: Returns all guardrails (inherited and workload-specific) for a workload-tool combination. No authentication required.
   *     tags: [Workload-Tool Guardrails]
   *     parameters:
   *       - in: path
   *         name: wNs
   *         required: true
   *         schema:
   *           type: string
   *         description: Workload namespace
   *       - in: path
   *         name: wName
   *         required: true
   *         schema:
   *           type: string
   *         description: Workload name
   *       - in: path
   *         name: tNs
   *         required: true
   *         schema:
   *           type: string
   *         description: Tool namespace
   *       - in: path
   *         name: tName
   *         required: true
   *         schema:
   *           type: string
   *         description: Tool name
   *     responses:
   *       200:
   *         description: List of guardrail associations
   *       404:
   *         description: Workload or tool not found
   */
  // GET /workloads/:wNs/:wName/tools/:tNs/:tName/guardrails - List guardrails
  // No RBAC required - public read
  router.get(
    '/workloads/:wNs/:wName/tools/:tNs/:tName/guardrails',
    asyncHandler(async (req, res) => {
      const { wNs, wName, tNs, tName } = req.params;
      const result = await service.listWorkloadToolGuardrails(wNs, wName, tNs, tName);
      sendSuccessResponse(res, { items: result, totalCount: result.length });
    }),
  );

  /**
   * @openapi
   * /api/mcp-entity-api/workloads/{wNs}/{wName}/tools/{tNs}/{tName}/guardrails:
   *   post:
   *     summary: Add a guardrail to a workload-tool relationship
   *     description: Adds a guardrail to a specific workload-tool combination (workload-level). Requires mcp-user role.
   *     tags: [Workload-Tool Guardrails]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: wNs
   *         required: true
   *         schema:
   *           type: string
   *         description: Workload namespace
   *       - in: path
   *         name: wName
   *         required: true
   *         schema:
   *           type: string
   *         description: Workload name
   *       - in: path
   *         name: tNs
   *         required: true
   *         schema:
   *           type: string
   *         description: Tool namespace
   *       - in: path
   *         name: tName
   *         required: true
   *         schema:
   *           type: string
   *         description: Tool name
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [guardrailNamespace, guardrailName, executionTiming]
   *             properties:
   *               guardrailNamespace:
   *                 type: string
   *               guardrailName:
   *                 type: string
   *               executionTiming:
   *                 type: string
   *                 enum: [pre-execution, post-execution]
   *     responses:
   *       201:
   *         description: Guardrail added
   *       400:
   *         description: Invalid input
   *       401:
   *         description: No authentication token
   *       403:
   *         description: User lacks mcp-user role
   *       404:
   *         description: Workload, tool, or guardrail not found
   *       409:
   *         description: Guardrail already attached
   */
  // POST /workloads/:wNs/:wName/tools/:tNs/:tName/guardrails - Add a guardrail
  // Requires mcp-user role (workload-level operations)
  router.post(
    '/workloads/:wNs/:wName/tools/:tNs/:tName/guardrails',
    rbac('mcp-workload', 'update'),
    asyncHandler(async (req, res) => {
      const { wNs, wName, tNs, tName } = req.params;
      const input = req.body as AttachGuardrailInput;

      // Basic validation
      if (!input.guardrailNamespace || !input.guardrailName || !input.executionTiming) {
        throw new ValidationError('Missing required fields: guardrailNamespace, guardrailName, executionTiming');
      }
      if (input.executionTiming !== 'pre-execution' && input.executionTiming !== 'post-execution') {
        throw new ValidationError('executionTiming must be "pre-execution" or "post-execution"');
      }

      const result = await service.addGuardrailToWorkloadTool(wNs, wName, tNs, tName, input);
      sendCreatedResponse(res, result);
    }),
  );

  /**
   * @openapi
   * /api/mcp-entity-api/workloads/{wNs}/{wName}/tools/{tNs}/{tName}/guardrails/{gNs}/{gName}:
   *   delete:
   *     summary: Remove a guardrail from a workload-tool relationship
   *     description: Removes a guardrail association from a workload-tool combination. Requires mcp-user role.
   *     tags: [Workload-Tool Guardrails]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: wNs
   *         required: true
   *         schema:
   *           type: string
   *         description: Workload namespace
   *       - in: path
   *         name: wName
   *         required: true
   *         schema:
   *           type: string
   *         description: Workload name
   *       - in: path
   *         name: tNs
   *         required: true
   *         schema:
   *           type: string
   *         description: Tool namespace
   *       - in: path
   *         name: tName
   *         required: true
   *         schema:
   *           type: string
   *         description: Tool name
   *       - in: path
   *         name: gNs
   *         required: true
   *         schema:
   *           type: string
   *         description: Guardrail namespace
   *       - in: path
   *         name: gName
   *         required: true
   *         schema:
   *           type: string
   *         description: Guardrail name
   *     responses:
   *       204:
   *         description: Guardrail removed
   *       401:
   *         description: No authentication token
   *       403:
   *         description: User lacks mcp-user role
   *       404:
   *         description: Workload, tool, guardrail, or association not found
   */
  // DELETE /workloads/:wNs/:wName/tools/:tNs/:tName/guardrails/:gNs/:gName - Remove a guardrail
  // Requires mcp-user role (workload-level operations)
  router.delete(
    '/workloads/:wNs/:wName/tools/:tNs/:tName/guardrails/:gNs/:gName',
    rbac('mcp-workload', 'delete'),
    asyncHandler(async (req, res) => {
      const { wNs, wName, tNs, tName, gNs, gName } = req.params;
      await service.removeGuardrailFromWorkloadTool(wNs, wName, tNs, tName, gNs, gName);
      sendNoContentResponse(res);
    }),
  );

  /**
   * @openapi
   * /api/mcp-entity-api/workloads/{wNs}/{wName}/tools/{tNs}/{tName}/guardrails/{gNs}/{gName}:
   *   put:
   *     summary: Update a guardrail in a workload-tool relationship
   *     description: Updates the executionTiming and/or parameters for a guardrail association. Requires mcp-user role.
   *     tags: [Workload-Tool Guardrails]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: wNs
   *         required: true
   *         schema:
   *           type: string
   *         description: Workload namespace
   *       - in: path
   *         name: wName
   *         required: true
   *         schema:
   *           type: string
   *         description: Workload name
   *       - in: path
   *         name: tNs
   *         required: true
   *         schema:
   *           type: string
   *         description: Tool namespace
   *       - in: path
   *         name: tName
   *         required: true
   *         schema:
   *           type: string
   *         description: Tool name
   *       - in: path
   *         name: gNs
   *         required: true
   *         schema:
   *           type: string
   *         description: Guardrail namespace
   *       - in: path
   *         name: gName
   *         required: true
   *         schema:
   *           type: string
   *         description: Guardrail name
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               executionTiming:
   *                 type: string
   *                 enum: [pre-execution, post-execution]
   *               parameters:
   *                 type: string
   *                 nullable: true
   *     responses:
   *       200:
   *         description: Guardrail association updated
   *       400:
   *         description: Invalid input
   *       401:
   *         description: No authentication token
   *       403:
   *         description: User lacks mcp-user role
   *       404:
   *         description: Workload, tool, guardrail, or association not found
   */
  // PUT /workloads/:wNs/:wName/tools/:tNs/:tName/guardrails/:gNs/:gName - Update a guardrail
  // Requires mcp-user role (workload-level operations)
  router.put(
    '/workloads/:wNs/:wName/tools/:tNs/:tName/guardrails/:gNs/:gName',
    rbac('mcp-workload', 'update'),
    asyncHandler(async (req, res) => {
      const { wNs, wName, tNs, tName, gNs, gName } = req.params;
      const { executionTiming, parameters } = req.body;

      // Validate executionTiming if provided
      if (executionTiming !== undefined && executionTiming !== 'pre-execution' && executionTiming !== 'post-execution') {
        throw new ValidationError('executionTiming must be "pre-execution" or "post-execution"');
      }

      const result = await service.updateWorkloadToolGuardrail(
        wNs,
        wName,
        tNs,
        tName,
        gNs,
        gName,
        { executionTiming, parameters },
      );
      sendSuccessResponse(res, result);
    }),
  );

  // ==========================================================================
  // Guardrail Endpoints - /guardrails (006-mcp-guardrails)
  // ==========================================================================

  /**
   * @openapi
   * /api/mcp-entity-api/guardrails:
   *   get:
   *     summary: List all MCP Guardrails
   *     description: Returns a paginated list of all MCP Guardrail entities. No authentication required.
   *     tags: [Guardrails]
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
   *         description: Maximum number of results
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *         description: Pagination offset
   *     responses:
   *       200:
   *         description: List of guardrails
   */
  // GET /guardrails - List all MCP Guardrails
  // No RBAC required - public read
  router.get(
    '/guardrails',
    asyncHandler(async (req, res) => {
      const params = {
        namespace: req.query.namespace as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      };
      const result = await service.listGuardrails(params);
      sendSuccessResponse(res, result);
    }),
  );

  /**
   * @openapi
   * /api/mcp-entity-api/guardrails:
   *   post:
   *     summary: Create an MCP Guardrail
   *     description: Creates a new MCP Guardrail entity. Requires mcp-admin role.
   *     tags: [Guardrails]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [metadata, spec]
   *             properties:
   *               metadata:
   *                 type: object
   *                 required: [name, description]
   *                 properties:
   *                   name:
   *                     type: string
   *                     minLength: 1
   *                     maxLength: 63
   *                   namespace:
   *                     type: string
   *                     default: default
   *                   description:
   *                     type: string
   *                     maxLength: 1000
   *               spec:
   *                 type: object
   *                 required: [deployment]
   *                 properties:
   *                   deployment:
   *                     type: string
   *                     maxLength: 2000
   *                   parameters:
   *                     type: string
   *                     maxLength: 10000
   *     responses:
   *       201:
   *         description: Guardrail created
   *       400:
   *         description: Validation error
   *       401:
   *         description: No authentication token provided
   *       403:
   *         description: User lacks mcp-admin role
   *       409:
   *         description: Guardrail already exists
   */
  // POST /guardrails - Create an MCP Guardrail (T030)
  // Requires mcp-admin role
  router.post(
    '/guardrails',
    rbac('mcp-guardrail', 'create'),
    asyncHandler(async (req, res) => {
      const result = await service.createGuardrail(req.body);
      sendCreatedResponse(res, result);
    }),
  );

  /**
   * @openapi
   * /api/mcp-entity-api/guardrails/import:
   *   post:
   *     summary: Import MCP Guardrail(s) from YAML
   *     description: |
   *       Creates MCP Guardrail entities from YAML content. Supports multi-document YAML
   *       (multiple guardrails separated by ---). Use ?preview=true to validate without creating.
   *       Accepts YAML text in request body with Content-Type: text/yaml or application/x-yaml.
   *       Requires mcp-admin role.
   *     tags: [Guardrails]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: preview
   *         schema:
   *           type: boolean
   *         description: If true, returns parsed guardrails without creating them
   *     requestBody:
   *       required: true
   *       content:
   *         text/yaml:
   *           schema:
   *             type: string
   *           example: |
   *             metadata:
   *               name: my-guardrail
   *               description: My guardrail description
   *             spec:
   *               deployment: Check for PII in output
   *         application/x-yaml:
   *           schema:
   *             type: string
   *     responses:
   *       200:
   *         description: Preview of guardrails to be imported (when preview=true)
   *       201:
   *         description: Guardrail(s) created from YAML
   *       400:
   *         description: Invalid YAML or validation error
   *       401:
   *         description: No authentication token provided
   *       403:
   *         description: User lacks mcp-admin role
   *       409:
   *         description: Guardrail already exists
   */
  // POST /guardrails/import - Import MCP Guardrail(s) from YAML (T031)
  // Supports multi-document YAML and preview mode
  // Requires mcp-admin role
  router.post(
    '/guardrails/import',
    rbac('mcp-guardrail', 'create'),
    text({ type: ['text/yaml', 'application/x-yaml', 'text/plain'] }),
    asyncHandler(async (req, res) => {
      // Parse YAML content from request body
      const yamlContent = req.body;
      if (!yamlContent || typeof yamlContent !== 'string') {
        throw new ValidationError('Request body must contain YAML content');
      }

      const isPreview = req.query.preview === 'true';

      // Parse all YAML documents (supports multi-document YAML with ---)
      let documents: YAML.Document.Parsed[];
      try {
        documents = YAML.parseAllDocuments(yamlContent);
      } catch (yamlError) {
        throw new ValidationError(
          `Invalid YAML: ${yamlError instanceof Error ? yamlError.message : 'Parse error'}`,
        );
      }

      // Extract and validate guardrail inputs from documents
      const guardrailInputs: CreateGuardrailInput[] = [];
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        if (doc.errors.length > 0) {
          throw new ValidationError(
            `Invalid YAML in document ${i + 1}: ${doc.errors[0].message}`,
          );
        }
        const parsed = doc.toJSON();
        if (parsed && typeof parsed === 'object') {
          guardrailInputs.push(parsed as CreateGuardrailInput);
        }
      }

      if (guardrailInputs.length === 0) {
        throw new ValidationError('YAML must contain at least one guardrail with metadata and spec');
      }

      // Preview mode - return list without creating
      if (isPreview) {
        res.json({
          preview: true,
          count: guardrailInputs.length,
          guardrails: guardrailInputs.map(g => ({
            name: g.metadata?.name || 'unnamed',
            namespace: g.metadata?.namespace || 'default',
            description: g.metadata?.description || '',
          })),
        });
        return;
      }

      // Create all guardrails
      const results: Guardrail[] = [];
      const errors: Array<{ name: string; error: string }> = [];
      for (const input of guardrailInputs) {
        try {
          const result = await service.createGuardrail(input);
          results.push(result);
        } catch (err) {
          errors.push({
            name: input.metadata?.name || 'unnamed',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      // For single document with no errors, return the single result (backward compatible)
      if (guardrailInputs.length === 1 && results.length === 1 && errors.length === 0) {
        sendCreatedResponse(res, results[0]);
        return;
      }

      // If all documents failed, return 400 with errors
      if (results.length === 0 && errors.length > 0) {
        res.status(400).json({
          error: 'ValidationError',
          message: errors.length === 1
            ? errors[0].error
            : `All ${errors.length} guardrails failed validation`,
          imported: 0,
          failed: errors.length,
          guardrails: [],
          errors,
        });
        return;
      }

      // For multi-document with partial success, return summary
      res.status(201).json({
        imported: results.length,
        failed: errors.length,
        guardrails: results,
        errors,
      });
    }),
  );

  /**
   * @openapi
   * /api/mcp-entity-api/guardrails/{namespace}/{name}:
   *   get:
   *     summary: Get a specific MCP Guardrail
   *     description: Returns a single MCP Guardrail entity with usage information. No authentication required.
   *     tags: [Guardrails]
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
   *         description: Guardrail details with usage information
   *       404:
   *         description: Guardrail not found
   */
  // GET /guardrails/:namespace/:name - Get a specific guardrail with usage
  // No RBAC required - public read
  router.get(
    '/guardrails/:namespace/:name',
    asyncHandler(async (req, res) => {
      const { namespace, name } = req.params;
      const result = await service.getGuardrail(namespace, name);
      sendSuccessResponse(res, result);
    }),
  );

  /**
   * @openapi
   * /api/mcp-entity-api/guardrails/{namespace}/{name}:
   *   put:
   *     summary: Update an MCP Guardrail
   *     description: Updates an existing MCP Guardrail entity. Requires mcp-admin role.
   *     tags: [Guardrails]
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
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Guardrail updated
   *       401:
   *         description: No authentication token provided
   *       403:
   *         description: User lacks mcp-admin role
   *       404:
   *         description: Guardrail not found
   *       409:
   *         description: Name conflict (if renaming)
   */
  // PUT /guardrails/:namespace/:name - Update a guardrail
  // Requires mcp-admin role
  router.put(
    '/guardrails/:namespace/:name',
    rbac('mcp-guardrail', 'update'),
    asyncHandler(async (req, res) => {
      const { namespace, name } = req.params;
      const result = await service.updateGuardrail(namespace, name, req.body);
      sendSuccessResponse(res, result);
    }),
  );

  /**
   * @openapi
   * /api/mcp-entity-api/guardrails/{namespace}/{name}:
   *   delete:
   *     summary: Delete an MCP Guardrail
   *     description: |
   *       Deletes an MCP Guardrail entity. Fails if guardrail has associations.
   *       Requires mcp-admin role.
   *     tags: [Guardrails]
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
   *         description: Guardrail deleted
   *       401:
   *         description: No authentication token
   *       403:
   *         description: User lacks mcp-admin role
   *       404:
   *         description: Guardrail not found
   *       409:
   *         description: Cannot delete - guardrail has associations
   */
  // DELETE /guardrails/:namespace/:name - Delete a guardrail
  // Requires mcp-admin role
  // Fails if guardrail has tool or workload-tool associations
  router.delete(
    '/guardrails/:namespace/:name',
    rbac('mcp-guardrail', 'delete'),
    asyncHandler(async (req, res) => {
      const { namespace, name } = req.params;
      await service.deleteGuardrail(namespace, name);
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
