import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import McpToolPage from './McpToolPage';
import { useCatalogEntity, useCatalogEntities } from '../services/catalogService';
import { CatalogMcpTool } from '../models/CatalogMcpTool';
import { CatalogMcpServer } from '../models/CatalogMcpServer';
import { CatalogMcpWorkload } from '../models/CatalogMcpWorkload';

// Mock the catalogService
jest.mock('../services/catalogService', () => ({
  useCatalogEntity: jest.fn(),
  useCatalogEntities: jest.fn(),
}));

// Mock the performanceMonitor
jest.mock('../utils/performanceMonitor', () => ({
  usePerformanceMonitor: jest.fn(() => jest.fn()),
}));

const mockUseCatalogEntity = useCatalogEntity as jest.MockedFunction<typeof useCatalogEntity>;
const mockUseCatalogEntities = useCatalogEntities as jest.MockedFunction<typeof useCatalogEntities>;

const mockTool: CatalogMcpTool = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'create-issue',
    namespace: 'default',
    uid: 'tool-1',
    description: 'Create GitHub issues programmatically',
  },
  spec: {
    type: 'mcp-tool',
    lifecycle: 'production',
    owner: 'platform-team',
    subcomponentOf: 'component:default/github-mcp',
  },
};

const mockServer: CatalogMcpServer = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'github-mcp',
    namespace: 'default',
    uid: 'server-1',
    description: 'GitHub MCP Server',
  },
  spec: {
    type: 'mcp-server',
    lifecycle: 'production',
    owner: 'platform-team',
  },
};

const mockWorkload: CatalogMcpWorkload = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'cicd-pipeline',
    namespace: 'default',
    uid: 'workload-1',
  },
  spec: {
    type: 'mcp-workload',
    lifecycle: 'production',
    owner: 'ops-team',
    consumes: ['component:default/create-issue'],
  },
  relations: [
    { type: 'dependsOn', targetRef: 'component:default/create-issue' },
  ],
};

const renderWithRouter = (initialPath: string) => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Route path="/mcp-catalog/tools/:name">
        <McpToolPage />
      </Route>
    </MemoryRouter>
  );
};

describe('McpToolPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading spinner when data is loading', () => {
    mockUseCatalogEntity.mockReturnValue([null, false, null]);
    mockUseCatalogEntities.mockReturnValue([[], false, null]);

    renderWithRouter('/mcp-catalog/tools/create-issue');

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders tool not found when tool does not exist', () => {
    mockUseCatalogEntity.mockReturnValue([null, true, null]);
    mockUseCatalogEntities.mockReturnValue([[], true, null]);

    renderWithRouter('/mcp-catalog/tools/nonexistent');

    expect(screen.getByText('Tool Not Found')).toBeInTheDocument();
  });

  it('renders error message when there is an error', () => {
    const error = new Error('Failed to fetch tool');
    mockUseCatalogEntity.mockReturnValue([null, true, error]);
    mockUseCatalogEntities.mockReturnValue([[], true, null]);

    renderWithRouter('/mcp-catalog/tools/create-issue');

    expect(screen.getByText('Tool Not Found')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch tool')).toBeInTheDocument();
  });

  it('renders tool details when loaded', () => {
    mockUseCatalogEntity.mockReturnValue([mockTool, true, null]);
    mockUseCatalogEntities
      .mockReturnValueOnce([[mockServer], true, null]) // servers
      .mockReturnValueOnce([[], true, null]); // workloads

    renderWithRouter('/mcp-catalog/tools/create-issue');

    expect(screen.getByText(/MCP Tool:/)).toBeInTheDocument();
    expect(screen.getByText('Tool Details')).toBeInTheDocument();
  });

  it('displays tool metadata correctly', () => {
    mockUseCatalogEntity.mockReturnValue([mockTool, true, null]);
    mockUseCatalogEntities
      .mockReturnValueOnce([[mockServer], true, null])
      .mockReturnValueOnce([[], true, null]);

    renderWithRouter('/mcp-catalog/tools/create-issue');

    expect(screen.getAllByText('create-issue').length).toBeGreaterThan(0);
    expect(screen.getAllByText('production').length).toBeGreaterThan(0);
    expect(screen.getAllByText('platform-team').length).toBeGreaterThan(0);
    expect(screen.getByText('Create GitHub issues programmatically')).toBeInTheDocument();
  });

  it('displays hierarchical name with server prefix', () => {
    mockUseCatalogEntity.mockReturnValue([mockTool, true, null]);
    mockUseCatalogEntities
      .mockReturnValueOnce([[mockServer], true, null])
      .mockReturnValueOnce([[], true, null]);

    renderWithRouter('/mcp-catalog/tools/create-issue');

    // Hierarchical name should be server/tool format
    expect(screen.getByText('github-mcp/create-issue')).toBeInTheDocument();
  });

  it('displays parent server section', () => {
    mockUseCatalogEntity.mockReturnValue([mockTool, true, null]);
    mockUseCatalogEntities
      .mockReturnValueOnce([[mockServer], true, null])
      .mockReturnValueOnce([[], true, null]);

    renderWithRouter('/mcp-catalog/tools/create-issue');

    expect(screen.getByText('Parent Server')).toBeInTheDocument();
    expect(screen.getAllByText('github-mcp').length).toBeGreaterThan(0);
  });

  it('shows warning when server reference is invalid', () => {
    const toolWithMissingServer: CatalogMcpTool = {
      ...mockTool,
      spec: {
        ...mockTool.spec,
        subcomponentOf: 'component:default/nonexistent-server',
      },
    };

    mockUseCatalogEntity.mockReturnValue([toolWithMissingServer, true, null]);
    mockUseCatalogEntities
      .mockReturnValueOnce([[mockServer], true, null]) // server not matching
      .mockReturnValueOnce([[], true, null]);

    renderWithRouter('/mcp-catalog/tools/create-issue');

    expect(screen.getByText('Server Reference Invalid')).toBeInTheDocument();
  });

  it('displays workloads using this tool', () => {
    mockUseCatalogEntity.mockReturnValue([mockTool, true, null]);
    mockUseCatalogEntities
      .mockReturnValueOnce([[mockServer], true, null])
      .mockReturnValueOnce([[mockWorkload], true, null]);

    renderWithRouter('/mcp-catalog/tools/create-issue');

    expect(screen.getByText('Used By Workloads (1)')).toBeInTheDocument();
    expect(screen.getByText('cicd-pipeline')).toBeInTheDocument();
  });

  it('displays empty state when no workloads use the tool', () => {
    mockUseCatalogEntity.mockReturnValue([mockTool, true, null]);
    mockUseCatalogEntities
      .mockReturnValueOnce([[mockServer], true, null])
      .mockReturnValueOnce([[], true, null]);

    renderWithRouter('/mcp-catalog/tools/create-issue');

    expect(screen.getByText('Used By Workloads (0)')).toBeInTheDocument();
    expect(screen.getByText('Not used by any workloads')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation', () => {
    mockUseCatalogEntity.mockReturnValue([mockTool, true, null]);
    mockUseCatalogEntities
      .mockReturnValueOnce([[mockServer], true, null])
      .mockReturnValueOnce([[], true, null]);

    renderWithRouter('/mcp-catalog/tools/create-issue');

    expect(screen.getByText('MCP Catalog')).toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
  });

  it('handles tool with no server reference', () => {
    const toolNoServer: CatalogMcpTool = {
      ...mockTool,
      spec: {
        type: 'mcp-tool',
        lifecycle: 'production',
        owner: 'platform-team',
        // No subcomponentOf
      },
    };

    mockUseCatalogEntity.mockReturnValue([toolNoServer, true, null]);
    mockUseCatalogEntities
      .mockReturnValueOnce([[mockServer], true, null])
      .mockReturnValueOnce([[], true, null]);

    renderWithRouter('/mcp-catalog/tools/create-issue');

    expect(screen.getByText('No Server Reference')).toBeInTheDocument();
  });

  it('displays input schema when available', () => {
    const toolWithSchema: CatalogMcpTool = {
      ...mockTool,
      spec: {
        ...mockTool.spec,
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
          },
        },
      },
    };

    mockUseCatalogEntity.mockReturnValue([toolWithSchema, true, null]);
    mockUseCatalogEntities
      .mockReturnValueOnce([[mockServer], true, null])
      .mockReturnValueOnce([[], true, null]);

    renderWithRouter('/mcp-catalog/tools/create-issue');

    expect(screen.getByText('Input Schema')).toBeInTheDocument();
  });
});
