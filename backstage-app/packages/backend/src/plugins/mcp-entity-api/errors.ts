/**
 * MCP Entity Management API - Error Types and Response Helpers
 *
 * Standardized error handling following FR-011:
 * HTTP status codes (4xx/5xx) + JSON error object with descriptive message.
 */

import type { Response } from 'express';

// =============================================================================
// Error Types
// =============================================================================

export type ErrorType =
  | 'ValidationError'
  | 'NotFoundError'
  | 'ConflictError'
  | 'UnauthorizedError'
  | 'ForbiddenError'
  | 'InternalError';

export interface ErrorResponse {
  error: ErrorType;
  message: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// Custom Error Classes
// =============================================================================

export abstract class MCPApiError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorType: ErrorType;
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }

  toResponse(): ErrorResponse {
    return {
      error: this.errorType,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}

export class ValidationError extends MCPApiError {
  readonly statusCode = 400;
  readonly errorType: ErrorType = 'ValidationError';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class NotFoundError extends MCPApiError {
  readonly statusCode = 404;
  readonly errorType: ErrorType = 'NotFoundError';

  constructor(entityRef: string) {
    super(`Entity '${entityRef}' not found`);
  }
}

export class ConflictError extends MCPApiError {
  readonly statusCode = 409;
  readonly errorType: ErrorType = 'ConflictError';

  constructor(entityRef: string) {
    super(`Entity '${entityRef}' already exists`);
  }
}

export class UnauthorizedError extends MCPApiError {
  readonly statusCode = 401;
  readonly errorType: ErrorType = 'UnauthorizedError';

  constructor(message = 'Authentication token required') {
    super(message);
  }
}

export class ForbiddenError extends MCPApiError {
  readonly statusCode = 403;
  readonly errorType: ErrorType = 'ForbiddenError';

  constructor(role: string, operation: string) {
    super(`User lacks required role '${role}' for ${operation} operation`);
  }
}

export class InternalError extends MCPApiError {
  readonly statusCode = 500;
  readonly errorType: ErrorType = 'InternalError';

  constructor(message = 'An unexpected error occurred') {
    super(message);
  }
}

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Send a standardized error response
 */
export function sendErrorResponse(res: Response, error: MCPApiError): void {
  res.status(error.statusCode).json(error.toResponse());
}

/**
 * Send a standardized success response with data
 */
export function sendSuccessResponse<T>(
  res: Response,
  data: T,
  statusCode = 200,
): void {
  res.status(statusCode).json(data);
}

/**
 * Send a 201 Created response
 */
export function sendCreatedResponse<T>(res: Response, data: T): void {
  sendSuccessResponse(res, data, 201);
}

/**
 * Send a 204 No Content response
 */
export function sendNoContentResponse(res: Response): void {
  res.status(204).send();
}

// =============================================================================
// Error Handler Middleware Helper
// =============================================================================

/**
 * Wrap async route handlers to catch errors
 */
export function asyncHandler(
  fn: (
    req: Parameters<import('express').RequestHandler>[0],
    res: Parameters<import('express').RequestHandler>[1],
    next: Parameters<import('express').RequestHandler>[2],
  ) => Promise<void>,
): import('express').RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Convert unknown errors to MCPApiError
 */
export function toMCPApiError(error: unknown): MCPApiError {
  if (error instanceof MCPApiError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('not found')) {
      return new NotFoundError(error.message);
    }
    if (error.message.includes('already exists')) {
      return new ConflictError(error.message);
    }
    if (error.message.includes('validation')) {
      return new ValidationError(error.message);
    }
    return new InternalError(error.message);
  }

  return new InternalError('An unexpected error occurred');
}
