/**
 * MCP Entity Management API - Type Definitions
 *
 * TypeScript interfaces for MCP entities (Servers, Tools, Workloads)
 * following Backstage catalog-model conventions.
 */

import type { JsonValue } from '@backstage/types';

// =============================================================================
// Entity Metadata Types
// =============================================================================

export interface MCPEntityMetadata {
  name: string;
  namespace?: string;
  title?: string;
  description?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  tags?: string[];
  // Index signature for JsonObject compatibility with Backstage Entity types
  [key: string]: JsonValue | undefined;
}

// =============================================================================
// MCP Server Types
// =============================================================================

export type MCPConnectionType = 'stdio' | 'sse' | 'websocket';
export type MCPCapability = 'tools' | 'resources' | 'prompts' | 'sampling';
export type MCPLifecycle = 'production' | 'experimental' | 'deprecated';

export interface MCPServerSpec {
  type: 'mcp-server';
  lifecycle: MCPLifecycle;
  owner: string;
  mcp: {
    connectionType: MCPConnectionType;
    endpoint?: string;
    command?: string;
    version: string;
    capabilities?: MCPCapability[];
  };
}

export interface MCPServerInput {
  metadata: MCPEntityMetadata;
  spec: Omit<MCPServerSpec, 'type'> & { type?: 'mcp-server' };
}

export interface MCPServerEntity {
  apiVersion: 'backstage.io/v1alpha1';
  kind: 'Component';
  metadata: MCPEntityMetadata & { uid?: string };
  spec: MCPServerSpec;
}

// =============================================================================
// MCP Tool Types
// =============================================================================

export interface MCPToolSpec {
  type: 'mcp-tool';
  lifecycle: MCPLifecycle;
  owner: string;
  subcomponentOf: string;
  mcp?: {
    inputSchema?: Record<string, unknown>;
    category?: string;
    parameters?: string[];
  };
}

export interface MCPToolInput {
  metadata: MCPEntityMetadata;
  spec: Omit<MCPToolSpec, 'type'> & { type?: 'mcp-tool' };
}

export interface MCPToolEntity {
  apiVersion: 'backstage.io/v1alpha1';
  kind: 'Component';
  metadata: MCPEntityMetadata & { uid?: string };
  spec: MCPToolSpec;
  /** Alternative description that overrides metadata.description when set (007-server-tools-view) */
  alternativeDescription?: string;
  /** Whether the tool is disabled */
  disabled?: boolean;
}

// =============================================================================
// MCP Workload Types
// =============================================================================

export type MCPWorkloadType = 'mcp-workload' | 'service' | 'workflow';
export type MCPSchedule = 'on-demand' | 'daily' | 'weekly';

export interface MCPWorkloadSpec {
  type: MCPWorkloadType;
  lifecycle: MCPLifecycle;
  owner: string;
  dependsOn?: string[];
  mcp?: {
    purpose?: string;
    schedule?: MCPSchedule;
    runtime?: string;
  };
}

export interface MCPWorkloadInput {
  metadata: MCPEntityMetadata;
  spec: Omit<MCPWorkloadSpec, 'type'> & { type?: MCPWorkloadType };
}

export interface MCPWorkloadEntity {
  apiVersion: 'backstage.io/v1alpha1';
  kind: 'Component';
  metadata: MCPEntityMetadata & { uid?: string };
  spec: MCPWorkloadSpec;
}

// =============================================================================
// MCP Guardrail Types
// =============================================================================

export type ExecutionTiming = 'pre-execution' | 'post-execution';
export type GuardrailSource = 'tool' | 'workload';

export interface Guardrail {
  id: string;
  namespace: string;
  name: string;
  description: string;
  deployment: string;
  parameters?: string;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GuardrailWithUsage extends Guardrail {
  usage: {
    tools: ToolGuardrailAssociation[];
    workloadTools: WorkloadToolGuardrailAssociation[];
  };
}

export interface ToolGuardrailAssociation {
  id: string;
  toolNamespace: string;
  toolName: string;
  guardrailId: string;
  guardrail?: Guardrail;
  executionTiming: ExecutionTiming;
  parameters?: string;
  createdAt: string;
}

export interface WorkloadToolGuardrailAssociation {
  id: string;
  workloadNamespace: string;
  workloadName: string;
  toolNamespace: string;
  toolName: string;
  guardrailId: string;
  guardrail?: Guardrail;
  executionTiming: ExecutionTiming;
  source: GuardrailSource;
  parameters?: string;
  createdAt: string;
}

export interface CreateGuardrailInput {
  metadata: {
    name: string;
    namespace?: string;
    description: string;
  };
  spec: {
    deployment: string;
    parameters?: string;
    disabled?: boolean;
  };
}

export interface UpdateGuardrailInput {
  metadata?: {
    name?: string;
    description?: string;
  };
  spec?: {
    deployment?: string;
    parameters?: string;
    disabled?: boolean;
  };
}

export interface AttachGuardrailInput {
  guardrailNamespace: string;
  guardrailName: string;
  executionTiming: ExecutionTiming;
  parameters?: string;
}

// =============================================================================
// Unified Types
// =============================================================================

export type MCPEntityType = 'mcp-server' | 'mcp-tool' | 'mcp-workload' | 'mcp-guardrail';
export type MCPEntity = MCPServerEntity | MCPToolEntity | MCPWorkloadEntity;
export type MCPEntityInput = MCPServerInput | MCPToolInput | MCPWorkloadInput;

// =============================================================================
// API Response Types
// =============================================================================

export interface EntityListResponse<T = MCPEntity> {
  items: T[];
  totalCount: number;
  cursor?: string;
}

export interface EntityListParams {
  namespace?: string;
  server?: string; // For tools: filter by parent server
  limit?: number;
  cursor?: string;
}

// =============================================================================
// Role Configuration Types
// =============================================================================

export interface RoleMapping {
  entityType: MCPEntityType;
  requiredRole: string;
}

export interface MCPEntityApiConfig {
  roles: {
    server: string;
    tool: string;
    workload: string;
    guardrail: string;
  };
}
