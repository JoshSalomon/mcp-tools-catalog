import { Config } from '@backstage/config';

/**
 * Configuration interface for MCP Tools Catalog plugin
 */
export interface McpCatalogConfig {
  /** Whether the plugin is enabled */
  enabled?: boolean;
  
  /** Custom entity kinds to support beyond the defaults */
  customEntityKinds?: string[];
  
  /** Configuration for entity processing */
  processing?: {
    /** Batch size for entity processing operations */
    batchSize?: number;
    
    /** Interval in minutes for relationship validation */
    validationInterval?: number;
    
    /** Whether to auto-fix broken references */
    autoFixReferences?: boolean;
  };
  
  /** UI display configuration */
  ui?: {
    /** Whether to show entity relationship graphs */
    showRelationshipGraphs?: boolean;
    
    /** Maximum number of entities to display in lists */
    maxEntitiesPerPage?: number;
    
    /** Default view for entity pages */
    defaultView?: 'card' | 'table' | 'graph';
  };
  
  /** Integration settings */
  integrations?: {
    /** OpenShift integration settings */
    openshift?: {
      enabled?: boolean;
      baseUrl?: string;
      namespace?: string;
    };
    
    /** External MCP registry settings */
    registry?: {
      enabled?: boolean;
      url?: string;
      apiKey?: string;
    };
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_MCP_CATALOG_CONFIG: Required<McpCatalogConfig> = {
  enabled: true,
  customEntityKinds: [],
  processing: {
    batchSize: 100,
    validationInterval: 30,
    autoFixReferences: false,
  },
  ui: {
    showRelationshipGraphs: true,
    maxEntitiesPerPage: 50,
    defaultView: 'card',
  },
  integrations: {
    openshift: {
      enabled: false,
      baseUrl: '',
      namespace: 'default',
    },
    registry: {
      enabled: false,
      url: '',
      apiKey: '',
    },
  },
};

/**
 * Read and validate MCP Catalog configuration from Backstage config
 */
export function readMcpCatalogConfig(config: Config): McpCatalogConfig {
  const mcpConfig = config.getOptionalConfig('mcpCatalog') ?? config.getOptionalConfig('mcp');
  
  if (!mcpConfig) {
    return DEFAULT_MCP_CATALOG_CONFIG;
  }

  return {
    enabled: mcpConfig.getOptionalBoolean('enabled') ?? DEFAULT_MCP_CATALOG_CONFIG.enabled,
    
    customEntityKinds: mcpConfig.getOptionalStringArray('customEntityKinds') ?? 
      DEFAULT_MCP_CATALOG_CONFIG.customEntityKinds,
    
    processing: {
      batchSize: mcpConfig.getOptionalNumber('processing.batchSize') ?? 
        DEFAULT_MCP_CATALOG_CONFIG.processing.batchSize,
      validationInterval: mcpConfig.getOptionalNumber('processing.validationInterval') ?? 
        DEFAULT_MCP_CATALOG_CONFIG.processing.validationInterval,
      autoFixReferences: mcpConfig.getOptionalBoolean('processing.autoFixReferences') ?? 
        DEFAULT_MCP_CATALOG_CONFIG.processing.autoFixReferences,
    },
    
    ui: {
      showRelationshipGraphs: mcpConfig.getOptionalBoolean('ui.showRelationshipGraphs') ?? 
        DEFAULT_MCP_CATALOG_CONFIG.ui.showRelationshipGraphs,
      maxEntitiesPerPage: mcpConfig.getOptionalNumber('ui.maxEntitiesPerPage') ?? 
        DEFAULT_MCP_CATALOG_CONFIG.ui.maxEntitiesPerPage,
      defaultView: (mcpConfig.getOptionalString('ui.defaultView') as 'card' | 'table' | 'graph') ?? 
        DEFAULT_MCP_CATALOG_CONFIG.ui.defaultView,
    },
    
    integrations: {
      openshift: {
        enabled: mcpConfig.getOptionalBoolean('integrations.openshift.enabled') ?? 
          DEFAULT_MCP_CATALOG_CONFIG.integrations.openshift?.enabled ?? false,
        baseUrl: mcpConfig.getOptionalString('integrations.openshift.baseUrl') ?? 
          DEFAULT_MCP_CATALOG_CONFIG.integrations.openshift?.baseUrl ?? '',
        namespace: mcpConfig.getOptionalString('integrations.openshift.namespace') ?? 
          DEFAULT_MCP_CATALOG_CONFIG.integrations.openshift?.namespace ?? 'default',
      },
      registry: {
        enabled: mcpConfig.getOptionalBoolean('integrations.registry.enabled') ?? 
          DEFAULT_MCP_CATALOG_CONFIG.integrations.registry?.enabled ?? false,
        url: mcpConfig.getOptionalString('integrations.registry.url') ?? 
          DEFAULT_MCP_CATALOG_CONFIG.integrations.registry?.url ?? '',
        apiKey: mcpConfig.getOptionalString('integrations.registry.apiKey') ?? 
          DEFAULT_MCP_CATALOG_CONFIG.integrations.registry?.apiKey ?? '',
      },
    },
  };
}

/**
 * Validate MCP Catalog configuration
 */
export function validateMcpCatalogConfig(config: McpCatalogConfig): string[] {
  const errors: string[] = [];
  
  if (config.processing?.batchSize && config.processing.batchSize <= 0) {
    errors.push('processing.batchSize must be greater than 0');
  }
  
  if (config.processing?.validationInterval && config.processing.validationInterval <= 0) {
    errors.push('processing.validationInterval must be greater than 0');
  }
  
  if (config.ui?.maxEntitiesPerPage && config.ui.maxEntitiesPerPage <= 0) {
    errors.push('ui.maxEntitiesPerPage must be greater than 0');
  }
  
  if (config.ui?.defaultView && !['card', 'table', 'graph'].includes(config.ui.defaultView)) {
    errors.push('ui.defaultView must be one of: card, table, graph');
  }
  
  if (config.integrations?.openshift?.enabled && !config.integrations.openshift.baseUrl) {
    errors.push('integrations.openshift.baseUrl is required when OpenShift integration is enabled');
  }
  
  if (config.integrations?.registry?.enabled && !config.integrations.registry.url) {
    errors.push('integrations.registry.url is required when registry integration is enabled');
  }
  
  return errors;
}