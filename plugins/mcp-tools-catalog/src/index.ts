/**
 * MCP Tools Catalog Plugin
 * 
 * A Backstage plugin for managing Model Context Protocol (MCP) infrastructure
 * including servers, tools, and workloads.
 */

export {
  mcpToolsCatalogPlugin,
  McpServerPage,
  McpToolPage,
  McpWorkloadPage,
  McpServerCard,
  McpToolCard,
  McpWorkloadCard,
  McpCatalogPage,
  mcpServerPageRouteRef,
  mcpToolPageRouteRef,
  mcpWorkloadPageRouteRef,
  mcpCatalogRouteRef,
} from './plugin';

export {
  mcpCatalogApiRef,
  type McpCatalogApi,
} from './api/McpCatalogApi';

export {
  type McpServerEntityV1alpha1,
  type McpToolEntityV1alpha1,
  type McpWorkloadEntityV1alpha1,
  type McpEntity,
  isMcpServerEntity,
  isMcpToolEntity,
  isMcpWorkloadEntity,
  MCP_ENTITY_KINDS,
  MCP_API_VERSION,
  MCP_LABELS,
  MCP_ANNOTATIONS,
} from './schemas/entity-schemas';

export { RelationshipService } from './services/RelationshipService';
export { McpEntityProcessor } from './processors/McpEntityProcessor';

export { 
  type McpCatalogConfig,
  readMcpCatalogConfig,
  validateMcpCatalogConfig,
} from './config/plugin-config';

export {
  validateMcpEntity,
  validateMcpServerEntity,
  validateMcpToolEntity,
  validateMcpWorkloadEntity,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
} from './utils/validation';