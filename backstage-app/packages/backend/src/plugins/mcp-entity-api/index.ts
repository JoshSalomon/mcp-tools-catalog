/**
 * MCP Entity Management API - Plugin Entry Point
 *
 * Backend plugin for managing MCP entities (Servers, Tools, Workloads)
 * with OCP role-based access control.
 */

export { createRouter } from './router';
export { 
  mcpEntityApiPlugin, 
  mcpEntityApiPlugin as default,
  catalogModuleMcpEntityProvider,
} from './plugin';
export { MCPEntityDatabase } from './database';
export { MCPEntityProvider } from './entityProvider';
export { MCPEntityService } from './service';
