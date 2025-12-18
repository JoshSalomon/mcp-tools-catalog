import { Entity } from '@backstage/catalog-model';
import {
  McpServerEntityV1alpha1,
  McpToolEntityV1alpha1,
  McpWorkloadEntityV1alpha1,
  isMcpServerEntity,
  isMcpToolEntity,
  isMcpWorkloadEntity,
  MCP_API_VERSION,
} from '../schemas/entity-schemas';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

/**
 * Validate MCP Server entity
 */
export function validateMcpServerEntity(entity: Entity): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Check basic entity structure
  const basicValidation = validateBasicEntity(entity, 'MCPServer');
  result.errors.push(...basicValidation.errors);
  result.warnings.push(...basicValidation.warnings);

  if (!isMcpServerEntity(entity)) {
    result.errors.push({
      field: 'kind',
      message: 'Entity is not a valid MCP Server',
      code: 'INVALID_KIND',
    });
    result.valid = false;
    return result;
  }

  const server = entity as McpServerEntityV1alpha1;

  // Validate required spec fields
  if (!server.spec.type) {
    result.errors.push({
      field: 'spec.type',
      message: 'Server type is required',
      code: 'MISSING_REQUIRED_FIELD',
    });
  } else if (!['stdio', 'sse', 'websocket'].includes(server.spec.type)) {
    result.errors.push({
      field: 'spec.type',
      message: 'Server type must be one of: stdio, sse, websocket',
      code: 'INVALID_VALUE',
    });
  }

  if (!server.spec.version) {
    result.errors.push({
      field: 'spec.version',
      message: 'Server version is required',
      code: 'MISSING_REQUIRED_FIELD',
    });
  } else if (!isValidSemanticVersion(server.spec.version)) {
    result.errors.push({
      field: 'spec.version',
      message: 'Server version must follow semantic versioning (e.g., 1.0.0)',
      code: 'INVALID_FORMAT',
    });
  }

  // Validate endpoint based on type
  if (server.spec.type !== 'stdio' && !server.spec.endpoint) {
    result.errors.push({
      field: 'spec.endpoint',
      message: `Endpoint is required for ${server.spec.type} server type`,
      code: 'MISSING_REQUIRED_FIELD',
    });
  }

  if (server.spec.type === 'stdio' && !server.spec.command && !server.spec.endpoint) {
    result.errors.push({
      field: 'spec.command',
      message: 'Command or endpoint is required for stdio server type',
      code: 'MISSING_REQUIRED_FIELD',
    });
  }

  // Validate capabilities
  if (server.spec.capabilities) {
    const validCapabilities = ['tools', 'resources', 'prompts', 'sampling'];
    for (const capability of server.spec.capabilities) {
      if (!validCapabilities.includes(capability)) {
        result.warnings.push({
          field: 'spec.capabilities',
          message: `Unknown capability: ${capability}. Valid capabilities are: ${validCapabilities.join(', ')}`,
          code: 'UNKNOWN_CAPABILITY',
        });
      }
    }
  }

  result.valid = result.errors.length === 0;
  return result;
}

/**
 * Validate MCP Tool entity
 */
export function validateMcpToolEntity(entity: Entity): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Check basic entity structure
  const basicValidation = validateBasicEntity(entity, 'MCPTool');
  result.errors.push(...basicValidation.errors);
  result.warnings.push(...basicValidation.warnings);

  if (!isMcpToolEntity(entity)) {
    result.errors.push({
      field: 'kind',
      message: 'Entity is not a valid MCP Tool',
      code: 'INVALID_KIND',
    });
    result.valid = false;
    return result;
  }

  const tool = entity as McpToolEntityV1alpha1;

  // Validate required spec fields
  if (!tool.spec.server) {
    result.errors.push({
      field: 'spec.server',
      message: 'Server reference is required',
      code: 'MISSING_REQUIRED_FIELD',
    });
  } else if (!isValidEntityRef(tool.spec.server, 'mcpserver')) {
    result.errors.push({
      field: 'spec.server',
      message: 'Server reference must be in format: mcpserver:namespace/name',
      code: 'INVALID_FORMAT',
    });
  }

  if (!tool.spec.type) {
    result.errors.push({
      field: 'spec.type',
      message: 'Tool type is required',
      code: 'MISSING_REQUIRED_FIELD',
    });
  }

  // Validate input schema if provided
  if (tool.spec.inputSchema) {
    try {
      // Basic JSON Schema validation
      if (typeof tool.spec.inputSchema !== 'object') {
        result.errors.push({
          field: 'spec.inputSchema',
          message: 'Input schema must be a valid JSON Schema object',
          code: 'INVALID_FORMAT',
        });
      }
    } catch (error) {
      result.errors.push({
        field: 'spec.inputSchema',
        message: 'Invalid JSON Schema format',
        code: 'INVALID_FORMAT',
      });
    }
  }

  result.valid = result.errors.length === 0;
  return result;
}

/**
 * Validate MCP Workload entity
 */
export function validateMcpWorkloadEntity(entity: Entity): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Check basic entity structure
  const basicValidation = validateBasicEntity(entity, 'MCPWorkload');
  result.errors.push(...basicValidation.errors);
  result.warnings.push(...basicValidation.warnings);

  if (!isMcpWorkloadEntity(entity)) {
    result.errors.push({
      field: 'kind',
      message: 'Entity is not a valid MCP Workload',
      code: 'INVALID_KIND',
    });
    result.valid = false;
    return result;
  }

  const workload = entity as McpWorkloadEntityV1alpha1;

  // Validate required spec fields
  if (!workload.spec.type) {
    result.errors.push({
      field: 'spec.type',
      message: 'Workload type is required',
      code: 'MISSING_REQUIRED_FIELD',
    });
  }

  if (!workload.spec.purpose) {
    result.errors.push({
      field: 'spec.purpose',
      message: 'Workload purpose is required',
      code: 'MISSING_REQUIRED_FIELD',
    });
  }

  // Validate tool references
  if (workload.spec.tools) {
    for (let i = 0; i < workload.spec.tools.length; i++) {
      const toolRef = workload.spec.tools[i];
      if (!isValidEntityRef(toolRef, 'mcptool')) {
        result.errors.push({
          field: `spec.tools[${i}]`,
          message: 'Tool reference must be in format: mcptool:namespace/server/tool',
          code: 'INVALID_FORMAT',
        });
      }
    }

    // Check for duplicate tool references
    const uniqueTools = new Set(workload.spec.tools);
    if (uniqueTools.size !== workload.spec.tools.length) {
      result.warnings.push({
        field: 'spec.tools',
        message: 'Duplicate tool references found',
        code: 'DUPLICATE_REFERENCES',
      });
    }
  } else {
    result.warnings.push({
      field: 'spec.tools',
      message: 'Workload has no tool references',
      code: 'EMPTY_TOOLS',
    });
  }

  result.valid = result.errors.length === 0;
  return result;
}

/**
 * Validate basic entity structure common to all MCP entities
 */
function validateBasicEntity(entity: Entity, expectedKind: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Check API version
  if (entity.apiVersion !== MCP_API_VERSION) {
    result.errors.push({
      field: 'apiVersion',
      message: `API version must be ${MCP_API_VERSION}`,
      code: 'INVALID_API_VERSION',
    });
  }

  // Check kind
  if (entity.kind !== expectedKind) {
    result.errors.push({
      field: 'kind',
      message: `Kind must be ${expectedKind}`,
      code: 'INVALID_KIND',
    });
  }

  // Check metadata
  if (!entity.metadata?.name) {
    result.errors.push({
      field: 'metadata.name',
      message: 'Entity name is required',
      code: 'MISSING_REQUIRED_FIELD',
    });
  } else if (!isValidEntityName(entity.metadata.name)) {
    result.errors.push({
      field: 'metadata.name',
      message: 'Entity name must contain only lowercase letters, numbers, hyphens, and underscores',
      code: 'INVALID_FORMAT',
    });
  }

  // Check spec exists
  if (!entity.spec) {
    result.errors.push({
      field: 'spec',
      message: 'Entity spec is required',
      code: 'MISSING_REQUIRED_FIELD',
    });
  }

  result.valid = result.errors.length === 0;
  return result;
}

/**
 * Validate entity name format
 */
function isValidEntityName(name: string): boolean {
  return /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(name);
}

/**
 * Validate semantic version format
 */
function isValidSemanticVersion(version: string): boolean {
  return /^[0-9]+\.[0-9]+\.[0-9]+$/.test(version);
}

/**
 * Validate entity reference format
 */
function isValidEntityRef(ref: string, expectedKind: string): boolean {
  const pattern = new RegExp(`^${expectedKind}:[a-z0-9-_]*/[a-z0-9-_]+(/[a-z0-9-_]+)?$`);
  return pattern.test(ref);
}

/**
 * Validate any MCP entity based on its kind
 */
export function validateMcpEntity(entity: Entity): ValidationResult {
  if (isMcpServerEntity(entity)) {
    return validateMcpServerEntity(entity);
  } else if (isMcpToolEntity(entity)) {
    return validateMcpToolEntity(entity);
  } else if (isMcpWorkloadEntity(entity)) {
    return validateMcpWorkloadEntity(entity);
  } else {
    return {
      valid: false,
      errors: [{
        field: 'kind',
        message: 'Unknown MCP entity kind',
        code: 'UNKNOWN_KIND',
      }],
      warnings: [],
    };
  }
}