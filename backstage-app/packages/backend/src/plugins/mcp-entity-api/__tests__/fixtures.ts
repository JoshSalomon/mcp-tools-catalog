/**
 * Test Fixtures for MCP Entity API
 *
 * Sample entities for unit and integration tests.
 */

import type {
  MCPServerInput,
  MCPToolInput,
  MCPWorkloadInput,
  MCPServerEntity,
  MCPToolEntity,
  MCPWorkloadEntity,
} from '../types';

// =============================================================================
// Server Fixtures
// =============================================================================

export const validServerInput: MCPServerInput = {
  metadata: {
    name: 'test-server',
    namespace: 'default',
    title: 'Test MCP Server',
    description: 'A test server for unit tests',
    tags: ['test', 'mcp'],
  },
  spec: {
    lifecycle: 'experimental',
    owner: 'user:default/testuser',
    mcp: {
      connectionType: 'stdio',
      command: 'node server.js',
      version: '1.0.0',
      capabilities: ['tools', 'resources'],
    },
  },
};

export const validServerEntity: MCPServerEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'test-server',
    namespace: 'default',
    uid: 'server-uid-123',
    title: 'Test MCP Server',
    description: 'A test server for unit tests',
    tags: ['test', 'mcp'],
  },
  spec: {
    type: 'mcp-server',
    lifecycle: 'experimental',
    owner: 'user:default/testuser',
    mcp: {
      connectionType: 'stdio',
      command: 'node server.js',
      version: '1.0.0',
      capabilities: ['tools', 'resources'],
    },
  },
};

export const invalidServerInput = {
  metadata: {
    name: 'Invalid Name With Spaces', // Invalid: contains spaces
  },
  spec: {
    lifecycle: 'experimental',
    owner: 'user:default/testuser',
    mcp: {
      connectionType: 'stdio',
      version: '1.0', // Invalid: not semver
    },
  },
};

// =============================================================================
// Tool Fixtures
// =============================================================================

export const validToolInput: MCPToolInput = {
  metadata: {
    name: 'test-tool',
    namespace: 'default',
    title: 'Test MCP Tool',
    description: 'A test tool for unit tests',
  },
  spec: {
    lifecycle: 'production',
    owner: 'user:default/testuser',
    subcomponentOf: 'component:default/test-server',
    mcp: {
      category: 'testing',
      parameters: ['param1', 'param2'],
    },
  },
};

export const validToolEntity: MCPToolEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'test-tool',
    namespace: 'default',
    uid: 'tool-uid-456',
    title: 'Test MCP Tool',
    description: 'A test tool for unit tests',
  },
  spec: {
    type: 'mcp-tool',
    lifecycle: 'production',
    owner: 'user:default/testuser',
    subcomponentOf: 'component:default/test-server',
    mcp: {
      category: 'testing',
      parameters: ['param1', 'param2'],
    },
  },
};

export const invalidToolInput = {
  metadata: {
    name: 'test-tool',
  },
  spec: {
    lifecycle: 'production',
    owner: 'user:default/testuser',
    // Missing required subcomponentOf
  },
};

// =============================================================================
// Workload Fixtures
// =============================================================================

export const validWorkloadInput: MCPWorkloadInput = {
  metadata: {
    name: 'test-workload',
    namespace: 'default',
    title: 'Test MCP Workload',
    description: 'A test workload for unit tests',
  },
  spec: {
    lifecycle: 'production',
    owner: 'user:default/testuser',
    dependsOn: ['component:default/test-tool'],
    mcp: {
      purpose: 'Testing',
      schedule: 'on-demand',
    },
  },
};

export const validWorkloadEntity: MCPWorkloadEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'test-workload',
    namespace: 'default',
    uid: 'workload-uid-789',
    title: 'Test MCP Workload',
    description: 'A test workload for unit tests',
  },
  spec: {
    type: 'mcp-workload',
    lifecycle: 'production',
    owner: 'user:default/testuser',
    dependsOn: ['component:default/test-tool'],
    mcp: {
      purpose: 'Testing',
      schedule: 'on-demand',
    },
  },
};

export const workloadWithMissingTool: MCPWorkloadInput = {
  metadata: {
    name: 'orphan-workload',
    namespace: 'default',
  },
  spec: {
    lifecycle: 'production',
    owner: 'user:default/testuser',
    dependsOn: ['component:default/nonexistent-tool'],
  },
};

// =============================================================================
// Entity References
// =============================================================================

export const entityRefs = {
  server: 'component:default/test-server',
  tool: 'component:default/test-tool',
  workload: 'component:default/test-workload',
  nonexistent: 'component:default/does-not-exist',
};

// =============================================================================
// List Response Fixtures
// =============================================================================

export const emptyListResponse = {
  items: [],
  totalCount: 0,
};

export const serverListResponse = {
  items: [validServerEntity],
  totalCount: 1,
};

export const toolListResponse = {
  items: [validToolEntity],
  totalCount: 1,
};

export const workloadListResponse = {
  items: [validWorkloadEntity],
  totalCount: 1,
};
