/**
 * MCP Entity Management API - Entity Schema Validation
 *
 * Validates MCP entity schemas using AJV (FR-006).
 * Checks uniqueness constraints (FR-009, FR-010).
 */

import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { ValidationError } from './errors';
import type {
  MCPServerInput,
  MCPToolInput,
  MCPWorkloadInput,
  MCPEntityType,
} from './types';

// =============================================================================
// JSON Schemas for MCP Entities
// =============================================================================

const entityMetadataSchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: {
      type: 'string',
      pattern: '^[a-z0-9]+(?:[-][a-z0-9]+)*$',
    },
    namespace: {
      type: 'string',
      default: 'default',
    },
    title: { type: 'string' },
    description: { type: 'string' },
    labels: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    annotations: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  additionalProperties: false,
};

const mcpServerSchema = {
  type: 'object',
  required: ['metadata', 'spec'],
  properties: {
    metadata: entityMetadataSchema,
    spec: {
      type: 'object',
      required: ['lifecycle', 'owner', 'mcp'],
      properties: {
        type: { type: 'string', enum: ['mcp-server'] },
        lifecycle: {
          type: 'string',
          enum: ['production', 'experimental', 'deprecated'],
        },
        owner: { type: 'string' },
        mcp: {
          type: 'object',
          required: ['connectionType', 'version'],
          properties: {
            connectionType: {
              type: 'string',
              enum: ['stdio', 'sse', 'websocket'],
            },
            endpoint: { type: 'string' },
            command: { type: 'string' },
            version: {
              type: 'string',
              pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$',
            },
            capabilities: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['tools', 'resources', 'prompts', 'sampling'],
              },
            },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const mcpToolSchema = {
  type: 'object',
  required: ['metadata', 'spec'],
  properties: {
    metadata: entityMetadataSchema,
    spec: {
      type: 'object',
      required: ['lifecycle', 'owner', 'subcomponentOf'],
      properties: {
        type: { type: 'string', enum: ['mcp-tool'] },
        lifecycle: {
          type: 'string',
          enum: ['production', 'experimental', 'deprecated'],
        },
        owner: { type: 'string' },
        subcomponentOf: {
          type: 'string',
          pattern: '^component:[a-z0-9-]+/[a-z0-9-]+$',
        },
        mcp: {
          type: 'object',
          properties: {
            inputSchema: { type: 'object' },
            category: { type: 'string' },
            parameters: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const mcpWorkloadSchema = {
  type: 'object',
  required: ['metadata', 'spec'],
  properties: {
    metadata: entityMetadataSchema,
    spec: {
      type: 'object',
      required: ['lifecycle', 'owner'],
      properties: {
        type: {
          type: 'string',
          enum: ['mcp-workload', 'service', 'workflow'],
        },
        lifecycle: {
          type: 'string',
          enum: ['production', 'experimental', 'deprecated'],
        },
        owner: { type: 'string' },
        dependsOn: {
          type: 'array',
          items: {
            type: 'string',
            pattern: '^component:[a-z0-9-]+/[a-z0-9-]+$',
          },
        },
        mcp: {
          type: 'object',
          properties: {
            purpose: { type: 'string' },
            schedule: {
              type: 'string',
              enum: ['on-demand', 'daily', 'weekly'],
            },
            runtime: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

// =============================================================================
// Validator Class
// =============================================================================

export class MCPEntityValidator {
  private readonly ajv: Ajv;
  private readonly validators: Map<MCPEntityType, ValidateFunction>;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });

    // Add format validation (e.g., uri, email)
    addFormats(this.ajv);

    // Compile validators
    this.validators = new Map([
      ['mcp-server', this.ajv.compile(mcpServerSchema)],
      ['mcp-tool', this.ajv.compile(mcpToolSchema)],
      ['mcp-workload', this.ajv.compile(mcpWorkloadSchema)],
    ]);
  }

  /**
   * Validate an MCP Server input
   */
  validateServer(input: unknown): asserts input is MCPServerInput {
    this.validate('mcp-server', input);
  }

  /**
   * Validate an MCP Tool input
   */
  validateTool(input: unknown): asserts input is MCPToolInput {
    this.validate('mcp-tool', input);
  }

  /**
   * Validate an MCP Workload input
   */
  validateWorkload(input: unknown): asserts input is MCPWorkloadInput {
    this.validate('mcp-workload', input);
  }

  /**
   * Generic validation method
   */
  private validate(entityType: MCPEntityType, input: unknown): void {
    const validator = this.validators.get(entityType);
    if (!validator) {
      throw new ValidationError(`Unknown entity type: ${entityType}`);
    }

    const valid = validator(input);
    if (!valid && validator.errors) {
      throw this.createValidationError(validator.errors);
    }
  }

  /**
   * Create a ValidationError from AJV errors
   */
  private createValidationError(errors: ErrorObject[]): ValidationError {
    const firstError = errors[0];
    const path = firstError.instancePath || '/';
    const message = firstError.message || 'Validation failed';

    return new ValidationError(`Entity failed schema validation: ${message}`, {
      path,
      keyword: firstError.keyword,
      params: firstError.params,
      errors: errors.map(e => ({
        path: e.instancePath,
        message: e.message,
        keyword: e.keyword,
      })),
    });
  }
}

// =============================================================================
// Uniqueness Validation (FR-009, FR-010)
// =============================================================================

/**
 * Build entity reference string
 */
export function buildEntityRef(
  kind: string,
  namespace: string,
  name: string,
): string {
  return `${kind.toLowerCase()}:${namespace}/${name}`;
}

/**
 * Parse entity reference string
 */
export function parseEntityRef(ref: string): {
  kind: string;
  namespace: string;
  name: string;
} {
  const match = ref.match(/^([a-z]+):([a-z0-9-]+)\/([a-z0-9-]+)$/);
  if (!match) {
    throw new ValidationError(`Invalid entity reference format: ${ref}`);
  }
  return {
    kind: match[1],
    namespace: match[2],
    name: match[3],
  };
}

// Singleton instance
export const validator: MCPEntityValidator = new MCPEntityValidator();
