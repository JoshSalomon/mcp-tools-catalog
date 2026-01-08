import { filterResources, filterToolsByServer } from './searchService';
import { CatalogMcpServer } from '../models/CatalogMcpServer';
import { CatalogMcpTool } from '../models/CatalogMcpTool';

describe('searchService', () => {
  describe('filterResources', () => {
    const mockServers: CatalogMcpServer[] = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'github-mcp',
          namespace: 'default',
          description: 'GitHub API integration server',
          labels: {
            'mcp-catalog.io/type': 'server',
            environment: 'production',
          },
          tags: ['api', 'github'],
        },
        spec: {
          type: 'mcp-server',
          lifecycle: 'production',
          owner: 'platform-team',
        },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'kubernetes-mcp',
          namespace: 'infrastructure',
          description: 'Kubernetes cluster management',
          labels: {
            'mcp-catalog.io/type': 'server',
            environment: 'staging',
          },
          tags: ['kubernetes', 'infrastructure'],
        },
        spec: {
          type: 'mcp-server',
          lifecycle: 'experimental',
          owner: 'ops-team',
        },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'database-mcp',
          namespace: 'default',
          description: 'Database operations server',
        },
        spec: {
          type: 'mcp-server',
          lifecycle: 'production',
          owner: 'data-team',
        },
      },
    ];

    it('returns all resources when search term is empty', () => {
      const result = filterResources(mockServers, '');
      expect(result).toHaveLength(3);
    });

    it('filters by name', () => {
      const result = filterResources(mockServers, 'github');
      expect(result).toHaveLength(1);
      expect(result[0].metadata.name).toBe('github-mcp');
    });

    it('filters by namespace', () => {
      const result = filterResources(mockServers, 'infrastructure');
      expect(result).toHaveLength(1);
      expect(result[0].metadata.name).toBe('kubernetes-mcp');
    });

    it('filters by description', () => {
      const result = filterResources(mockServers, 'cluster management');
      expect(result).toHaveLength(1);
      expect(result[0].metadata.name).toBe('kubernetes-mcp');
    });

    it('filters by label value', () => {
      const result = filterResources(mockServers, 'production');
      expect(result).toHaveLength(1);
      expect(result[0].metadata.name).toBe('github-mcp');
    });

    it('filters by tag', () => {
      const result = filterResources(mockServers, 'api');
      expect(result).toHaveLength(1);
      expect(result[0].metadata.name).toBe('github-mcp');
    });

    it('is case insensitive', () => {
      const result = filterResources(mockServers, 'GITHUB');
      expect(result).toHaveLength(1);
      expect(result[0].metadata.name).toBe('github-mcp');
    });

    it('returns empty array when no matches', () => {
      const result = filterResources(mockServers, 'nonexistent');
      expect(result).toHaveLength(0);
    });

    it('handles resources without optional fields', () => {
      const result = filterResources(mockServers, 'database');
      expect(result).toHaveLength(1);
      expect(result[0].metadata.name).toBe('database-mcp');
    });

    it('matches partial strings', () => {
      const result = filterResources(mockServers, 'mcp');
      expect(result).toHaveLength(3);
    });
  });

  describe('filterToolsByServer', () => {
    const mockTools: CatalogMcpTool[] = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'create-issue',
          namespace: 'default',
        },
        spec: {
          type: 'mcp-tool',
          lifecycle: 'production',
          owner: 'platform-team',
          subcomponentOf: 'component:default/github-mcp',
        },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'list-issues',
          namespace: 'default',
        },
        spec: {
          type: 'mcp-tool',
          lifecycle: 'production',
          owner: 'platform-team',
          subcomponentOf: 'component:default/github-mcp',
        },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'list-pods',
          namespace: 'default',
        },
        spec: {
          type: 'mcp-tool',
          lifecycle: 'production',
          owner: 'ops-team',
          subcomponentOf: 'component:default/kubernetes-mcp',
        },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'legacy-tool',
          namespace: 'default',
          labels: {
            'mcp-catalog.io/server': 'legacy-mcp',
          },
        },
        spec: {
          type: 'mcp-tool',
          lifecycle: 'production',
          owner: 'legacy-team',
        },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'relation-tool',
          namespace: 'default',
        },
        spec: {
          type: 'mcp-tool',
          lifecycle: 'production',
          owner: 'ops-team',
        },
        relations: [{ type: 'partOf', targetRef: 'component:default/relation-mcp' }],
      },
    ];

    it('filters tools by subcomponentOf', () => {
      const result = filterToolsByServer(mockTools, 'github-mcp');
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.metadata.name)).toEqual(['create-issue', 'list-issues']);
    });

    it('returns different tools for different servers', () => {
      const result = filterToolsByServer(mockTools, 'kubernetes-mcp');
      expect(result).toHaveLength(1);
      expect(result[0].metadata.name).toBe('list-pods');
    });

    it('filters tools by label fallback', () => {
      const result = filterToolsByServer(mockTools, 'legacy-mcp');
      expect(result).toHaveLength(1);
      expect(result[0].metadata.name).toBe('legacy-tool');
    });

    it('filters tools by relations partOf', () => {
      const result = filterToolsByServer(mockTools, 'relation-mcp');
      expect(result).toHaveLength(1);
      expect(result[0].metadata.name).toBe('relation-tool');
    });

    it('returns empty array when no tools match server', () => {
      const result = filterToolsByServer(mockTools, 'nonexistent-mcp');
      expect(result).toHaveLength(0);
    });

    it('handles empty tools array', () => {
      const result = filterToolsByServer([], 'github-mcp');
      expect(result).toHaveLength(0);
    });
  });
});
