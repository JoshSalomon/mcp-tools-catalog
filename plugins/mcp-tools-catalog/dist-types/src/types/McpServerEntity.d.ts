import { McpServerEntityV1alpha1 } from '../schemas/entity-schemas';
/**
 * Type definitions specific to MCP Server entities
 * Re-export from schemas for convenience
 */
export type { McpServerEntityV1alpha1 };
/**
 * MCP Server connection types
 */
export type McpServerConnectionType = 'stdio' | 'sse' | 'websocket';
/**
 * MCP Server capabilities
 */
export type McpServerCapability = 'tools' | 'resources' | 'prompts' | 'sampling';
/**
 * Helper interface for server status display
 */
export interface McpServerStatus {
    connectionType: McpServerConnectionType;
    version: string;
    capabilities: McpServerCapability[];
    toolCount: number;
    lastUpdated?: string;
    isOnline?: boolean;
}
/**
 * Interface for server creation/editing forms
 */
export interface McpServerFormData {
    name: string;
    description?: string;
    type: McpServerConnectionType;
    endpoint?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    version: string;
    capabilities?: McpServerCapability[];
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
}
/**
 * Server display metadata for UI components
 */
export interface McpServerDisplayInfo {
    name: string;
    title?: string;
    description?: string;
    version: string;
    type: McpServerConnectionType;
    toolCount: number;
    capabilities: McpServerCapability[];
    tags?: string[];
    lastUpdated?: string;
}
//# sourceMappingURL=McpServerEntity.d.ts.map