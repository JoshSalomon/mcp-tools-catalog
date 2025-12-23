/**
 * MCP Entity API - Auth Module Unit Tests (T032)
 *
 * Tests for OCP RBAC integration including:
 * - Token extraction from requests
 * - SubjectAccessReview checks
 * - Role requirement resolution
 * - Fail-closed behavior
 */

import { Request, Response, NextFunction } from 'express';
import {
  extractOCPToken,
  createSubjectAccessReviewChecker,
  getRoleRequirement,
  createRBACMiddleware,
  OCPAuthError,
} from '../auth';
import type { MCPEntityApiConfig } from '../types';

// Mock @kubernetes/client-node
jest.mock('@kubernetes/client-node', () => {
  const mockCreateSubjectAccessReview = jest.fn();
  const mockCreateTokenReview = jest.fn();
  return {
    KubeConfig: jest.fn().mockImplementation(() => ({
      loadFromCluster: jest.fn(),
      loadFromDefault: jest.fn(),
      makeApiClient: jest.fn().mockImplementation((ApiClass) => {
        // Return different mock based on API class
        if (ApiClass.name === 'AuthorizationV1Api') {
          return {
            createSubjectAccessReview: mockCreateSubjectAccessReview,
          };
        }
        if (ApiClass.name === 'AuthenticationV1Api') {
          return {
            createTokenReview: mockCreateTokenReview,
          };
        }
        return {};
      }),
    })),
    AuthorizationV1Api: Object.assign(jest.fn(), { name: 'AuthorizationV1Api' }),
    AuthenticationV1Api: Object.assign(jest.fn(), { name: 'AuthenticationV1Api' }),
    V1SubjectAccessReview: jest.fn().mockImplementation((obj) => obj),
    __mockCreateSubjectAccessReview: mockCreateSubjectAccessReview,
    __mockCreateTokenReview: mockCreateTokenReview,
  };
});

// Get the mock functions for assertions
const getMockSAR = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@kubernetes/client-node').__mockCreateSubjectAccessReview;
};

const getMockTokenReview = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@kubernetes/client-node').__mockCreateTokenReview;
};

describe('Auth Module', () => {
  // ==========================================================================
  // Token Extraction Tests
  // ==========================================================================
  describe('extractOCPToken', () => {
    it('should extract Bearer token from Authorization header', () => {
      const mockReq = {
        headers: {
          authorization: 'Bearer test-token-12345',
        },
      } as Request;

      const token = extractOCPToken(mockReq);
      expect(token).toBe('test-token-12345');
    });

    it('should return undefined when no Authorization header', () => {
      const mockReq = {
        headers: {},
      } as Request;

      const token = extractOCPToken(mockReq);
      expect(token).toBeUndefined();
    });

    it('should return undefined for non-Bearer auth schemes', () => {
      const mockReq = {
        headers: {
          authorization: 'Basic dXNlcjpwYXNz',
        },
      } as Request;

      const token = extractOCPToken(mockReq);
      expect(token).toBeUndefined();
    });

    it('should handle malformed Bearer header', () => {
      const mockReq = {
        headers: {
          authorization: 'Bearer',
        },
      } as Request;

      const token = extractOCPToken(mockReq);
      expect(token).toBeUndefined();
    });

    it('should extract token from X-Forwarded-Access-Token header', () => {
      const mockReq = {
        headers: {
          'x-forwarded-access-token': 'forwarded-token-xyz',
        },
      } as unknown as Request;

      const token = extractOCPToken(mockReq);
      expect(token).toBe('forwarded-token-xyz');
    });

    it('should prefer Authorization header over X-Forwarded-Access-Token', () => {
      const mockReq = {
        headers: {
          authorization: 'Bearer auth-token',
          'x-forwarded-access-token': 'forwarded-token',
        },
      } as unknown as Request;

      const token = extractOCPToken(mockReq);
      expect(token).toBe('auth-token');
    });
  });

  // ==========================================================================
  // SubjectAccessReview Tests
  // ==========================================================================
  describe('createSubjectAccessReviewChecker', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    // Helper to set up valid token response
    const setupValidToken = (username = 'test-user', groups = ['system:authenticated']) => {
      const mockTokenReview = getMockTokenReview();
      mockTokenReview.mockResolvedValueOnce({
        body: {
          status: {
            authenticated: true,
            user: { username, groups },
          },
        },
      });
    };

    it('should return true when SubjectAccessReview is allowed', async () => {
      setupValidToken();
      const mockSAR = getMockSAR();
      mockSAR.mockResolvedValueOnce({
        body: {
          status: { allowed: true },
        },
      });

      const checker = createSubjectAccessReviewChecker();
      const result = await checker('test-token', 'mcp-server', 'create');

      expect(result).toBe(true);
      expect(mockSAR).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: expect.objectContaining({
            user: 'test-user',
            groups: ['system:authenticated'],
            resourceAttributes: expect.objectContaining({
              group: 'mcp-catalog.io',
              resource: 'mcpservers',
              verb: 'create',
            }),
          }),
        }),
      );
    });

    it('should return false when SubjectAccessReview is denied', async () => {
      setupValidToken();
      const mockSAR = getMockSAR();
      mockSAR.mockResolvedValueOnce({
        body: {
          status: { allowed: false },
        },
      });

      const checker = createSubjectAccessReviewChecker();
      const result = await checker('test-token', 'mcp-tool', 'delete');

      expect(result).toBe(false);
    });

    it('should return false when token is invalid', async () => {
      const mockTokenReview = getMockTokenReview();
      mockTokenReview.mockResolvedValueOnce({
        body: {
          status: { authenticated: false },
        },
      });

      const checker = createSubjectAccessReviewChecker();
      const result = await checker('invalid-token', 'mcp-server', 'create');

      expect(result).toBe(false);
      // SAR should not be called for invalid token
      expect(getMockSAR()).not.toHaveBeenCalled();
    });

    it('should return false when token has no user info', async () => {
      const mockTokenReview = getMockTokenReview();
      mockTokenReview.mockResolvedValueOnce({
        body: {
          status: { authenticated: true, user: {} },
        },
      });

      const checker = createSubjectAccessReviewChecker();
      const result = await checker('test-token', 'mcp-server', 'create');

      expect(result).toBe(false);
    });

    it('should map entity types to correct resource names', async () => {
      const mockSAR = getMockSAR();
      mockSAR.mockResolvedValue({ body: { status: { allowed: true } } });

      const checker = createSubjectAccessReviewChecker();

      setupValidToken();
      await checker('token', 'mcp-server', 'create');
      expect(mockSAR).toHaveBeenLastCalledWith(
        expect.objectContaining({
          spec: expect.objectContaining({
            resourceAttributes: expect.objectContaining({
              resource: 'mcpservers',
            }),
          }),
        }),
      );

      setupValidToken();
      await checker('token', 'mcp-tool', 'update');
      expect(mockSAR).toHaveBeenLastCalledWith(
        expect.objectContaining({
          spec: expect.objectContaining({
            resourceAttributes: expect.objectContaining({
              resource: 'mcptools',
            }),
          }),
        }),
      );

      setupValidToken();
      await checker('token', 'mcp-workload', 'delete');
      expect(mockSAR).toHaveBeenLastCalledWith(
        expect.objectContaining({
          spec: expect.objectContaining({
            resourceAttributes: expect.objectContaining({
              resource: 'mcpworkloads',
            }),
          }),
        }),
      );
    });
  });

  // ==========================================================================
  // Role Requirement Resolution Tests
  // ==========================================================================
  describe('getRoleRequirement', () => {
    const config: MCPEntityApiConfig = {
      roles: {
        server: 'mcp-admin',
        tool: 'mcp-admin',
        workload: 'mcp-user',
      },
    };

    it('should return correct role for mcp-server', () => {
      const role = getRoleRequirement('mcp-server', config);
      expect(role).toBe('mcp-admin');
    });

    it('should return correct role for mcp-tool', () => {
      const role = getRoleRequirement('mcp-tool', config);
      expect(role).toBe('mcp-admin');
    });

    it('should return correct role for mcp-workload', () => {
      const role = getRoleRequirement('mcp-workload', config);
      expect(role).toBe('mcp-user');
    });

    it('should use custom roles from config', () => {
      const customConfig: MCPEntityApiConfig = {
        roles: {
          server: 'custom-server-role',
          tool: 'custom-tool-role',
          workload: 'custom-workload-role',
        },
      };

      expect(getRoleRequirement('mcp-server', customConfig)).toBe('custom-server-role');
      expect(getRoleRequirement('mcp-tool', customConfig)).toBe('custom-tool-role');
      expect(getRoleRequirement('mcp-workload', customConfig)).toBe('custom-workload-role');
    });
  });

  // ==========================================================================
  // RBAC Middleware Tests
  // ==========================================================================
  describe('createRBACMiddleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockLogger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock };
    let mockChecker: jest.Mock;

    beforeEach(() => {
      mockReq = {
        headers: {
          authorization: 'Bearer valid-token',
        },
        method: 'POST',
        path: '/servers',
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      mockNext = jest.fn();
      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      mockChecker = jest.fn();
    });

    it('should call next() when authorization succeeds', async () => {
      mockChecker.mockResolvedValueOnce(true);

      const middleware = createRBACMiddleware({
        entityType: 'mcp-server',
        operation: 'create',
        checker: mockChecker,
        logger: mockLogger as unknown as import('winston').Logger,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockChecker).toHaveBeenCalledWith('valid-token', 'mcp-server', 'create');
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 when no token provided', async () => {
      mockReq.headers = {};

      const middleware = createRBACMiddleware({
        entityType: 'mcp-server',
        operation: 'create',
        checker: mockChecker,
        logger: mockLogger as unknown as import('winston').Logger,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when authorization denied', async () => {
      mockChecker.mockResolvedValueOnce(false);

      const middleware = createRBACMiddleware({
        entityType: 'mcp-tool',
        operation: 'delete',
        checker: mockChecker,
        logger: mockLogger as unknown as import('winston').Logger,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Forbidden',
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should fail closed when OCP API is unavailable (T037)', async () => {
      mockChecker.mockRejectedValueOnce(new Error('OCP API unreachable'));

      const middleware = createRBACMiddleware({
        entityType: 'mcp-server',
        operation: 'create',
        checker: mockChecker,
        logger: mockLogger as unknown as import('winston').Logger,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'ServiceUnavailable',
          message: expect.stringContaining('Authorization service unavailable'),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // OCPAuthError Tests
  // ==========================================================================
  describe('OCPAuthError', () => {
    it('should create error with correct properties', () => {
      const error = new OCPAuthError('Test message', 403, 'Forbidden');

      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(403);
      expect(error.errorType).toBe('Forbidden');
      expect(error.name).toBe('OCPAuthError');
    });

    it('should be instanceof Error', () => {
      const error = new OCPAuthError('Test', 401, 'Unauthorized');
      expect(error).toBeInstanceOf(Error);
    });
  });
});
