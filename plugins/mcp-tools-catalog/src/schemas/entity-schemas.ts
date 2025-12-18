import { EntityMeta, Entity } from '@backstage/catalog-model';

/**
 * Entity schema definitions for MCP Tools Catalog
 * Based on the data model specifications in data-model.md
 */

// Common entity metadata for all MCP entities
export interface McpEntityMeta extends EntityMeta {
  labels?: {
    [key: string]: string;
  } & {
    'mcp-catalog.io/type'?: string;
    'mcp-catalog.io/category'?: string;
    'mcp-catalog.io/server'?: string;
    'mcp-catalog.io/status'?: string;
  };
  annotations?: {
    [key: string]: string;
  } & {
    'mcp-catalog.io/version'?: string;
  };
}

// MCP Server Entity Schema
export interface McpServerEntityV1alpha1 extends Entity {
  apiVersion: 'mcp-catalog.io/v1alpha1';
  kind: 'MCPServer';
  metadata: McpEntityMeta;
  spec: {
    type: 'stdio' | 'sse' | 'websocket';
    endpoint?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    version: string;
    capabilities?: Array<'tools' | 'resources' | 'prompts' | 'sampling'>;
  };
  status?: {
    lastUpdated?: string;
    toolCount?: number;
  };
}

// MCP Tool Entity Schema
export interface McpToolEntityV1alpha1 extends Entity {
  apiVersion: 'mcp-catalog.io/v1alpha1';
  kind: 'MCPTool';
  metadata: McpEntityMeta;
  spec: {
    server: string; // EntityRef to parent MCP Server
    type: string;
    inputSchema?: object; // JSON Schema for tool parameters
    capabilities?: string[];
    parameters?: string[];
  };
}

// MCP Workload Entity Schema
export interface McpWorkloadEntityV1alpha1 extends Entity {
  apiVersion: 'mcp-catalog.io/v1alpha1';
  kind: 'MCPWorkload';
  metadata: McpEntityMeta;
  spec: {
    type: string;
    purpose: string;
    tools?: string[]; // Array of MCPTool entity references
    deploymentInfo?: {
      schedule?: string;
      runtime?: string;
      environment?: string;
    };
    dependencies?: string[];
  };
}

// Union type for all MCP entities
export type McpEntity = 
  | McpServerEntityV1alpha1
  | McpToolEntityV1alpha1
  | McpWorkloadEntityV1alpha1;

// Type guards for entity type checking
export function isMcpServerEntity(entity: Entity): entity is McpServerEntityV1alpha1 {
  return entity.apiVersion === 'mcp-catalog.io/v1alpha1' && entity.kind === 'MCPServer';
}

export function isMcpToolEntity(entity: Entity): entity is McpToolEntityV1alpha1 {
  return entity.apiVersion === 'mcp-catalog.io/v1alpha1' && entity.kind === 'MCPTool';
}

export function isMcpWorkloadEntity(entity: Entity): entity is McpWorkloadEntityV1alpha1 {
  return entity.apiVersion === 'mcp-catalog.io/v1alpha1' && entity.kind === 'MCPWorkload';
}

export function isMcpEntity(entity: Entity): entity is McpEntity {
  return isMcpServerEntity(entity) || isMcpToolEntity(entity) || isMcpWorkloadEntity(entity);
}

// Entity kind constants
export const MCP_ENTITY_KINDS = {
  SERVER: 'MCPServer',
  TOOL: 'MCPTool', 
  WORKLOAD: 'MCPWorkload',
} as const;

// API version constant
export const MCP_API_VERSION = 'mcp-catalog.io/v1alpha1';

// Label and annotation constants
export const MCP_LABELS = {
  TYPE: 'mcp-catalog.io/type',
  CATEGORY: 'mcp-catalog.io/category',
  SERVER: 'mcp-catalog.io/server',
  STATUS: 'mcp-catalog.io/status',
} as const;

export const MCP_ANNOTATIONS = {
  VERSION: 'mcp-catalog.io/version',
} as const;