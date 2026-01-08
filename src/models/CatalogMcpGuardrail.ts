/**
 * TypeScript models for MCP Guardrail entities.
 * @module CatalogMcpGuardrail
 *
 * Guardrails are database-only entities (not in Backstage catalog) that represent
 * protection mechanisms for workload-tool relationships.
 */

/** Default Backstage spec.type value for MCP guardrails */
export const CATALOG_MCP_GUARDRAIL_TYPE = 'mcp-guardrail';

/** Execution timing for guardrails */
export type ExecutionTiming = 'pre-execution' | 'post-execution';

/** Source of guardrail association */
export type GuardrailSource = 'tool' | 'workload';

/**
 * MCP Guardrail entity interface.
 * Represents a protection mechanism that can be attached to tools and workload-tool relationships.
 *
 * @example
 * ```typescript
 * const guardrail: CatalogMcpGuardrail = {
 *   metadata: {
 *     name: 'rate-limiter',
 *     namespace: 'default',
 *     description: 'Limits API calls to 100 per minute',
 *   },
 *   spec: {
 *     type: 'mcp-guardrail',
 *     deployment: 'sidecar-container',
 *     parameters: '{"maxCalls": 100, "window": "1m"}',
 *     disabled: false,
 *   },
 * };
 * ```
 */
export interface CatalogMcpGuardrail {
  metadata: {
    /** Unique name within namespace */
    name: string;
    /** Namespace for isolation */
    namespace: string;
    /** Human-readable description */
    description: string;
  };
  spec: {
    /** Entity type - always 'mcp-guardrail' */
    type: 'mcp-guardrail';
    /** Deployment information */
    deployment: string;
    /** Optional parameters (JSON or text) */
    parameters?: string;
    /** Global disable flag */
    disabled?: boolean;
  };
  /** Read-only usage information from API */
  usage?: {
    tools: ToolGuardrailAssociation[];
    workloadTools: WorkloadToolGuardrailAssociation[];
  };
}

/**
 * Tool-guardrail association.
 * Links a guardrail to a tool with execution timing.
 */
export interface ToolGuardrailAssociation {
  /** Tool namespace */
  toolNamespace: string;
  /** Tool name */
  toolName: string;
  /** Associated guardrail */
  guardrail: CatalogMcpGuardrail;
  /** When to execute: before or after tool execution */
  executionTiming: ExecutionTiming;
  /** Optional parameters specific to this tool-guardrail association */
  parameters?: string;
}

/**
 * Workload-tool-guardrail association.
 * Links a guardrail to a specific workload-tool relationship.
 */
export interface WorkloadToolGuardrailAssociation {
  /** Workload namespace */
  workloadNamespace: string;
  /** Workload name */
  workloadName: string;
  /** Tool namespace */
  toolNamespace: string;
  /** Tool name */
  toolName: string;
  /** Associated guardrail */
  guardrail: CatalogMcpGuardrail;
  /** When to execute: before or after tool execution */
  executionTiming: ExecutionTiming;
  /** Source of association: 'tool' = inherited from tool-level, 'workload' = added at workload level */
  source: GuardrailSource;
  /** Optional parameters specific to this workload-tool-guardrail association */
  parameters?: string;
}

/**
 * Input for creating a new guardrail.
 */
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

/**
 * Input for updating an existing guardrail.
 */
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

/**
 * Input for attaching a guardrail to a tool or workload-tool relationship.
 */
export interface AttachGuardrailInput {
  guardrailNamespace: string;
  guardrailName: string;
  executionTiming: ExecutionTiming;
  /** Optional parameters specific to this tool-guardrail association */
  parameters?: string;
}
