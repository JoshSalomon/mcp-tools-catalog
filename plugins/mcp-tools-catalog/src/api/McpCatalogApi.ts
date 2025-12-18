import { createApiRef, DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import {
  McpServerEntityV1alpha1,
  McpToolEntityV1alpha1,
  McpWorkloadEntityV1alpha1,
} from '../schemas/entity-schemas';

/**
 * API definition for MCP Tools Catalog operations
 * Extends the standard Backstage catalog API with MCP-specific functionality
 */
export interface McpCatalogApi {
  /**
   * Get all tools provided by a specific MCP server
   */
  getServerTools(serverName: string, namespace?: string): Promise<{
    server: McpServerEntityV1alpha1;
    tools: McpToolEntityV1alpha1[];
  }>;

  /**
   * Get all workloads that use a specific MCP tool
   */
  getToolWorkloads(toolName: string, namespace?: string): Promise<{
    tool: McpToolEntityV1alpha1;
    workloads: McpWorkloadEntityV1alpha1[];
  }>;

  /**
   * Get all tools used by a specific MCP workload
   */
  getWorkloadTools(workloadName: string, namespace?: string): Promise<{
    workload: McpWorkloadEntityV1alpha1;
    tools: McpToolEntityV1alpha1[];
  }>;

  /**
   * Add a tool reference to an MCP workload
   */
  addToolToWorkload(
    workloadName: string,
    toolReference: string,
    namespace?: string,
  ): Promise<{ success: boolean; message: string }>;

  /**
   * Remove a tool reference from an MCP workload
   */
  removeToolFromWorkload(
    workloadName: string,
    toolReference: string,
    namespace?: string,
  ): Promise<{ success: boolean; message: string }>;

  /**
   * Get health status of MCP catalog
   */
  getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    entities: {
      servers: number;
      tools: number;
      workloads: number;
    };
    lastUpdate: string;
    issues: Array<{
      type: 'broken-reference' | 'validation-error' | 'orphaned-entity';
      entity: string;
      message: string;
    }>;
  }>;

  /**
   * Validate all MCP entity relationships
   */
  validateRelationships(): Promise<{
    valid: boolean;
    errors: Array<{
      entity: string;
      error: string;
      severity: 'error' | 'warning';
    }>;
    summary: {
      totalEntities: number;
      validEntities: number;
      brokenReferences: number;
      orphanedEntities: number;
    };
  }>;
}

/**
 * API reference for MCP Catalog API
 */
export const mcpCatalogApiRef = createApiRef<McpCatalogApi>({
  id: 'plugin.mcp-catalog.service',
});

/**
 * Default implementation of the MCP Catalog API
 */
export class McpCatalogClient implements McpCatalogApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly identityApi: IdentityApi;

  constructor(options: {
    discoveryApi: DiscoveryApi;
    identityApi: IdentityApi;
  }) {
    this.discoveryApi = options.discoveryApi;
    this.identityApi = options.identityApi;
  }

  async getServerTools(serverName: string, namespace = 'default'): Promise<{
    server: McpServerEntityV1alpha1;
    tools: McpToolEntityV1alpha1[];
  }> {
    const url = await this.getApiUrl(`/mcp/servers/${serverName}/tools`);
    const response = await this.fetch(url + `?namespace=${namespace}`);
    return response.json();
  }

  async getToolWorkloads(toolName: string, namespace = 'default'): Promise<{
    tool: McpToolEntityV1alpha1;
    workloads: McpWorkloadEntityV1alpha1[];
  }> {
    const url = await this.getApiUrl(`/mcp/tools/${toolName}/workloads`);
    const response = await this.fetch(url + `?namespace=${namespace}`);
    return response.json();
  }

  async getWorkloadTools(workloadName: string, namespace = 'default'): Promise<{
    workload: McpWorkloadEntityV1alpha1;
    tools: McpToolEntityV1alpha1[];
  }> {
    const url = await this.getApiUrl(`/mcp/workloads/${workloadName}/tools`);
    const response = await this.fetch(url + `?namespace=${namespace}`);
    return response.json();
  }

  async addToolToWorkload(
    workloadName: string,
    toolReference: string,
    namespace = 'default',
  ): Promise<{ success: boolean; message: string }> {
    const url = await this.getApiUrl(`/mcp/workloads/${workloadName}/tools/${encodeURIComponent(toolReference)}`);
    const response = await this.fetch(url + `?namespace=${namespace}`, {
      method: 'PUT',
    });
    return response.json();
  }

  async removeToolFromWorkload(
    workloadName: string,
    toolReference: string,
    namespace = 'default',
  ): Promise<{ success: boolean; message: string }> {
    const url = await this.getApiUrl(`/mcp/workloads/${workloadName}/tools/${encodeURIComponent(toolReference)}`);
    const response = await this.fetch(url + `?namespace=${namespace}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    entities: {
      servers: number;
      tools: number;
      workloads: number;
    };
    lastUpdate: string;
    issues: Array<{
      type: 'broken-reference' | 'validation-error' | 'orphaned-entity';
      entity: string;
      message: string;
    }>;
  }> {
    const url = await this.getApiUrl('/mcp/health');
    const response = await this.fetch(url);
    return response.json();
  }

  async validateRelationships(): Promise<{
    valid: boolean;
    errors: Array<{
      entity: string;
      error: string;
      severity: 'error' | 'warning';
    }>;
    summary: {
      totalEntities: number;
      validEntities: number;
      brokenReferences: number;
      orphanedEntities: number;
    };
  }> {
    const url = await this.getApiUrl('/mcp/validation');
    const response = await this.fetch(url, { method: 'POST' });
    return response.json();
  }

  private async getApiUrl(path: string): Promise<string> {
    const baseUrl = await this.discoveryApi.getBaseUrl('catalog');
    return `${baseUrl}${path}`;
  }

  private async fetch(url: string, init?: RequestInit): Promise<Response> {
    const { token } = await this.identityApi.getCredentials();
    
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }

    return response;
  }
}