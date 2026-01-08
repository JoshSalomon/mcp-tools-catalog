import { validateServerReference, validateToolReferences } from './validationService';
import { CatalogMcpTool } from '../models/CatalogMcpTool';
import { CatalogMcpServer } from '../models/CatalogMcpServer';

describe('validationService', () => {
  describe('validateServerReference', () => {
    const mockServers: CatalogMcpServer[] = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'github-mcp',
          namespace: 'default',
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
          namespace: 'default',
        },
        spec: {
          type: 'mcp-server',
          lifecycle: 'production',
          owner: 'ops-team',
        },
      },
    ];

    it('validates tool with subcomponentOf pointing to existing server', () => {
      const tool: CatalogMcpTool = {
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
      };

      expect(validateServerReference(tool, mockServers)).toBe(true);
    });

    it('returns false for tool with subcomponentOf pointing to non-existent server', () => {
      const tool: CatalogMcpTool = {
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
          subcomponentOf: 'component:default/nonexistent-mcp',
        },
      };

      expect(validateServerReference(tool, mockServers)).toBe(false);
    });

    it('validates tool with partOf relation', () => {
      const tool: CatalogMcpTool = {
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
        },
        relations: [{ type: 'partOf', targetRef: 'component:default/kubernetes-mcp' }],
      };

      expect(validateServerReference(tool, mockServers)).toBe(true);
    });

    it('validates tool with label server reference', () => {
      const tool: CatalogMcpTool = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'legacy-tool',
          namespace: 'default',
          labels: {
            'mcp-catalog.io/server': 'github-mcp',
          },
        },
        spec: {
          type: 'mcp-tool',
          lifecycle: 'production',
          owner: 'legacy-team',
        },
      };

      expect(validateServerReference(tool, mockServers)).toBe(true);
    });

    it('returns false for tool with no server reference', () => {
      const tool: CatalogMcpTool = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'orphan-tool',
          namespace: 'default',
        },
        spec: {
          type: 'mcp-tool',
          lifecycle: 'production',
          owner: 'unknown-team',
        },
      };

      expect(validateServerReference(tool, mockServers)).toBe(false);
    });

    it('validates tool with legacy mcp.server field', () => {
      const tool: CatalogMcpTool = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'legacy-mcp-tool',
          namespace: 'default',
        },
        spec: {
          type: 'mcp-tool',
          lifecycle: 'production',
          owner: 'legacy-team',
          mcp: {
            server: 'github-mcp',
          },
        },
      };

      expect(validateServerReference(tool, mockServers)).toBe(true);
    });

    it('prioritizes subcomponentOf over other fields', () => {
      const tool: CatalogMcpTool = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'multi-ref-tool',
          namespace: 'default',
          labels: {
            'mcp-catalog.io/server': 'nonexistent-mcp',
          },
        },
        spec: {
          type: 'mcp-tool',
          lifecycle: 'production',
          owner: 'platform-team',
          subcomponentOf: 'component:default/github-mcp',
        },
      };

      // Should use subcomponentOf (github-mcp) and ignore the label
      expect(validateServerReference(tool, mockServers)).toBe(true);
    });
  });

  describe('validateToolReferences', () => {
    const mockTools = [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'create-issue', namespace: 'default' },
        spec: { type: 'mcp-tool', lifecycle: 'production', owner: 'team' },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'list-issues', namespace: 'default' },
        spec: { type: 'mcp-tool', lifecycle: 'production', owner: 'team' },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'search-repos', namespace: 'default' },
        spec: { type: 'mcp-tool', lifecycle: 'production', owner: 'team' },
      },
    ];

    it('returns empty array when all tool references are valid', () => {
      const workload = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'my-workload', namespace: 'default' },
        spec: {
          type: 'mcp-workload',
          lifecycle: 'production',
          owner: 'team',
          consumesTools: ['create-issue', 'list-issues'],
        },
      };

      const result = validateToolReferences(workload, mockTools);
      expect(result).toHaveLength(0);
    });

    it('returns invalid references when tools do not exist', () => {
      const workload = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'my-workload', namespace: 'default' },
        spec: {
          type: 'mcp-workload',
          lifecycle: 'production',
          owner: 'team',
          consumesTools: ['create-issue', 'nonexistent-tool', 'another-missing'],
        },
      };

      const result = validateToolReferences(workload, mockTools);
      expect(result).toHaveLength(2);
      expect(result).toContain('nonexistent-tool');
      expect(result).toContain('another-missing');
    });

    it('returns empty array when workload has no consumesTools', () => {
      const workload = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'my-workload', namespace: 'default' },
        spec: {
          type: 'mcp-workload',
          lifecycle: 'production',
          owner: 'team',
        },
      };

      const result = validateToolReferences(workload, mockTools);
      expect(result).toHaveLength(0);
    });

    it('returns all references as invalid when tools array is empty', () => {
      const workload = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'my-workload', namespace: 'default' },
        spec: {
          type: 'mcp-workload',
          lifecycle: 'production',
          owner: 'team',
          consumesTools: ['create-issue', 'list-issues'],
        },
      };

      const result = validateToolReferences(workload, []);
      expect(result).toHaveLength(2);
    });
  });
});
