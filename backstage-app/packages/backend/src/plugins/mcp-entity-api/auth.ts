/**
 * MCP Entity Management API - OCP RBAC Authentication Module
 *
 * Implements OpenShift RBAC integration:
 * - T034: OCP token extraction from request headers
 * - T035: SubjectAccessReview check using Kubernetes API
 * - T036: Role requirement resolution per entity type
 * - T037: Fail-closed behavior when OCP API is unavailable
 */

import { Request, Response, NextFunction } from 'express';
import {
  KubeConfig,
  AuthorizationV1Api,
  AuthenticationV1Api,
} from '@kubernetes/client-node';
import type { Logger } from 'winston';
import type { MCPEntityType, MCPEntityApiConfig } from './types';

// =============================================================================
// Types
// =============================================================================

export type OCPOperation = 'create' | 'update' | 'delete';

export interface RBACMiddlewareOptions {
  entityType: MCPEntityType;
  operation: OCPOperation;
  checker: SubjectAccessReviewChecker;
  logger: Logger;
}

export type SubjectAccessReviewChecker = (
  token: string,
  entityType: MCPEntityType,
  operation: OCPOperation,
) => Promise<boolean>;

// =============================================================================
// Error Types
// =============================================================================

/**
 * Custom error for OCP authentication/authorization failures
 */
export class OCPAuthError extends Error {
  public readonly statusCode: number;
  public readonly errorType: string;

  constructor(message: string, statusCode: number, errorType: string) {
    super(message);
    this.name = 'OCPAuthError';
    this.statusCode = statusCode;
    this.errorType = errorType;
  }
}

// =============================================================================
// T034: Token Extraction
// =============================================================================

/**
 * Extract OCP bearer token from request headers.
 *
 * Checks in order:
 * 1. Authorization: Bearer <token>
 * 2. X-Forwarded-Access-Token header (from console proxy)
 *
 * @param req - Express request object
 * @returns Token string or undefined if not found
 */
export function extractOCPToken(req: Request): string | undefined {
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      return token;
    }
  }

  // Check X-Forwarded-Access-Token (used by OpenShift console proxy)
  // Note: Header names are case-insensitive, but Express normalizes them to lowercase
  const forwardedToken = req.headers['x-forwarded-access-token'];
  if (typeof forwardedToken === 'string' && forwardedToken.trim()) {
    return forwardedToken.trim();
  }
  
  // Also check uppercase variant (some proxies might not normalize)
  const forwardedTokenUpper = req.headers['X-Forwarded-Access-Token'];
  if (typeof forwardedTokenUpper === 'string' && forwardedTokenUpper.trim()) {
    return forwardedTokenUpper.trim();
  }

  return undefined;
}

// =============================================================================
// T035: SubjectAccessReview Check
// =============================================================================

/**
 * Map entity types to Kubernetes resource names for SubjectAccessReview
 */
const ENTITY_TYPE_TO_RESOURCE: Record<MCPEntityType, string> = {
  'mcp-server': 'mcpservers',
  'mcp-tool': 'mcptools',
  'mcp-workload': 'mcpworkloads',
  'mcp-guardrail': 'mcpguardrails',
};

/**
 * Map operations to Kubernetes verbs
 */
const OPERATION_TO_VERB: Record<OCPOperation, string> = {
  create: 'create',
  update: 'update',
  delete: 'delete',
};

/**
 * Create a SubjectAccessReview checker function that validates
 * whether a user has permission to perform an operation on an entity type.
 *
 * Uses the Kubernetes SubjectAccessReview API to check permissions
 * against custom resource definitions in the 'mcp-catalog.io' API group.
 *
 * Flow:
 * 1. Validate the user's token via TokenReview to get user identity
 * 2. Check the user's permissions via SubjectAccessReview
 *
 * @returns Checker function for authorization checks
 */
export function createSubjectAccessReviewChecker(): SubjectAccessReviewChecker {
  // Initialize Kubernetes client
  const kc = new KubeConfig();

  // Try to load config from cluster (in-cluster) or default kubeconfig (local dev)
  try {
    kc.loadFromCluster();
  } catch {
    // Fall back to default kubeconfig for local development
    kc.loadFromDefault();
  }

  const authApi = kc.makeApiClient(AuthorizationV1Api);
  const authnApi = kc.makeApiClient(AuthenticationV1Api);

  return async (
    token: string,
    entityType: MCPEntityType,
    operation: OCPOperation,
  ): Promise<boolean> => {
    const resource = ENTITY_TYPE_TO_RESOURCE[entityType];
    const verb = OPERATION_TO_VERB[operation];

    // Step 1: Validate token and get user identity via TokenReview
    const tokenReview = {
      apiVersion: 'authentication.k8s.io/v1',
      kind: 'TokenReview',
      spec: {
        token: token,
      },
    };

    const tokenResponse = await authnApi.createTokenReview(tokenReview);

    // Check if token is valid
    if (!tokenResponse.body.status?.authenticated) {
      // Token is invalid or expired
      return false;
    }

    const userInfo = tokenResponse.body.status.user;
    if (!userInfo?.username) {
      // No user information in token
      return false;
    }

    // Step 2: Check user permissions via SubjectAccessReview
    const review = {
      apiVersion: 'authorization.k8s.io/v1',
      kind: 'SubjectAccessReview',
      spec: {
        // Include user identity from the validated token
        user: userInfo.username,
        groups: userInfo.groups || [],
        resourceAttributes: {
          group: 'mcp-catalog.io',
          resource: resource,
          verb: verb,
          namespace: 'default', // Could be parameterized
        },
      },
    };

    // Perform the SubjectAccessReview for the specific user
    const response = await authApi.createSubjectAccessReview(review);

    return response.body.status?.allowed === true;
  };
}

// =============================================================================
// T036: Role Requirement Resolution
// =============================================================================

/**
 * Get the required role for a given entity type from configuration.
 *
 * Mapping (per FR-005 defaults):
 * - mcp-server → mcp-admin
 * - mcp-tool → mcp-admin
 * - mcp-workload → mcp-user
 *
 * @param entityType - The type of MCP entity
 * @param config - API configuration with role mappings
 * @returns Required role name
 */
export function getRoleRequirement(
  entityType: MCPEntityType,
  config: MCPEntityApiConfig,
): string {
  switch (entityType) {
    case 'mcp-server':
      return config.roles.server;
    case 'mcp-tool':
      return config.roles.tool;
    case 'mcp-workload':
      return config.roles.workload;
    case 'mcp-guardrail':
      return config.roles.guardrail;
    default:
      // TypeScript exhaustive check
      const _exhaustive: never = entityType;
      throw new Error(`Unknown entity type: ${_exhaustive}`);
  }
}

// =============================================================================
// T037: RBAC Middleware with Fail-Closed Behavior
// =============================================================================

/**
 * Create Express middleware for RBAC enforcement.
 *
 * Behavior:
 * - Extracts token from request
 * - Performs SubjectAccessReview check
 * - Returns 401 if no token provided
 * - Returns 403 if authorization denied
 * - Returns 503 and denies access if OCP API is unavailable (fail-closed)
 *
 * @param options - Middleware configuration options
 * @returns Express middleware function
 */
export function createRBACMiddleware(
  options: RBACMiddlewareOptions,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const { entityType, operation, checker, logger } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Extract token from request
    const token = extractOCPToken(req);

    if (!token) {
      logger.warn('RBAC: No token provided', {
        entityType,
        operation,
        path: req.path,
        method: req.method,
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
      return;
    }

    try {
      // Perform authorization check
      const allowed = await checker(token, entityType, operation);

      if (!allowed) {
        logger.warn('RBAC: Authorization denied', {
          entityType,
          operation,
          path: req.path,
          method: req.method,
        });

        res.status(403).json({
          error: 'Forbidden',
          message: `User does not have permission to ${operation} ${entityType} entities`,
        });
        return;
      }

      // Authorization passed
      logger.info('RBAC: Authorization granted', {
        entityType,
        operation,
        path: req.path,
        method: req.method,
      });

      next();
    } catch (error) {
      // T037: Fail-closed behavior - deny access when OCP is unavailable
      const errorDetails: Record<string, unknown> = {
        entityType,
        operation,
        errorMessage: error instanceof Error ? error.message : String(error),
      };

      // Capture full error details for debugging
      if (error instanceof Error) {
        errorDetails.errorName = error.name;
        errorDetails.errorStack = error.stack;
        // Capture additional properties from Kubernetes client errors
        if ('response' in error && error.response) {
          errorDetails.httpStatus = (error.response as { status?: number }).status;
          errorDetails.httpBody = (error.response as { body?: unknown }).body;
        }
        if ('code' in error) {
          errorDetails.errorCode = error.code;
        }
      } else if (typeof error === 'object' && error !== null) {
        // Capture any additional error properties
        Object.keys(error).forEach((key) => {
          if (key !== 'message' && key !== 'stack') {
            errorDetails[key] = (error as Record<string, unknown>)[key];
          }
        });
      }

      logger.error('RBAC: Authorization service error - failing closed', errorDetails);

      res.status(503).json({
        error: 'ServiceUnavailable',
        message: 'Authorization service unavailable - access denied for security',
      });
    }
  };
}

// =============================================================================
// Factory for Router Integration
// =============================================================================

/**
 * Options for creating RBAC-protected routes
 */
export interface RBACRouterOptions {
  logger: Logger;
  config: MCPEntityApiConfig;
}

/**
 * Create a factory function that produces RBAC middleware for specific
 * entity types and operations.
 *
 * @param options - Router options with logger and config
 * @returns Factory function for creating middleware
 */
export function createRBACMiddlewareFactory(
  options: RBACRouterOptions,
): (entityType: MCPEntityType, operation: OCPOperation) => ReturnType<typeof createRBACMiddleware> {
  const { logger } = options;
  const checker = createSubjectAccessReviewChecker();

  return (entityType: MCPEntityType, operation: OCPOperation) => {
    return createRBACMiddleware({
      entityType,
      operation,
      checker,
      logger,
    });
  };
}
