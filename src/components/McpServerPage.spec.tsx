import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import McpServerPage from './McpServerPage';
import { useCatalogEntity, useCatalogEntities } from '../services/catalogService';
import { CatalogMcpServer } from '../models/CatalogMcpServer';
import { CatalogMcpTool } from '../models/CatalogMcpTool';

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

const mockServer: CatalogMcpServer = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'github-mcp',
    namespace: 'default',
    uid: 'server-1',
    description: 'GitHub MCP Server for API operations',
  },
  spec: {
    type: 'mcp-server',
    lifecycle: 'production',
    owner: 'platform-team',
    transport: {
      type: 'stdio',
      url: 'docker run -i ghcr.io/github/mcp-server',
    },
  },
};

const mockTools: CatalogMcpTool[] = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'create-issue',
      namespace: 'default',
      uid: 'tool-1',
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
      uid: 'tool-2',
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
      name: 'other-tool',
      namespace: 'default',
      uid: 'tool-3',
    },
    spec: {
      type: 'mcp-tool',
      lifecycle: 'production',
      owner: 'ops-team',
      subcomponentOf: 'component:default/other-mcp',
    },
  },
];

const renderWithRouter = (initialPath: string) => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Route path="/mcp-catalog/servers/:name">
        <McpServerPage />
      </Route>
    </MemoryRouter>
  );
};

describe('McpServerPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading spinner when data is loading', () => {
    mockUseCatalogEntity.mockReturnValue([null, false, null]);
    mockUseCatalogEntities.mockReturnValue([[], false, null]);

    renderWithRouter('/mcp-catalog/servers/github-mcp');

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders server not found when server does not exist', () => {
    mockUseCatalogEntity.mockReturnValue([null, true, null]);
    mockUseCatalogEntities.mockReturnValue([[], true, null]);

    renderWithRouter('/mcp-catalog/servers/nonexistent');

    expect(screen.getByText('Server Not Found')).toBeInTheDocument();
  });

  it('renders error message when there is an error', () => {
    const error = new Error('Failed to fetch server');
    mockUseCatalogEntity.mockReturnValue([null, true, error]);
    mockUseCatalogEntities.mockReturnValue([[], true, null]);

    renderWithRouter('/mcp-catalog/servers/github-mcp');

    expect(screen.getByText('Server Not Found')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch server')).toBeInTheDocument();
  });

  it('renders server details when loaded', () => {
    mockUseCatalogEntity.mockReturnValue([mockServer, true, null]);
    mockUseCatalogEntities.mockReturnValue([mockTools, true, null]);

    renderWithRouter('/mcp-catalog/servers/github-mcp');

    expect(screen.getByText('MCP Server: github-mcp')).toBeInTheDocument();
    expect(screen.getByText('Server Details')).toBeInTheDocument();
  });

  it('displays server metadata correctly', () => {
    mockUseCatalogEntity.mockReturnValue([mockServer, true, null]);
    mockUseCatalogEntities.mockReturnValue([mockTools, true, null]);

    renderWithRouter('/mcp-catalog/servers/github-mcp');

    // Server name appears multiple times (title, breadcrumb, details)
    expect(screen.getAllByText('github-mcp').length).toBeGreaterThan(0);
    // Check other metadata - may also appear multiple times
    expect(screen.getAllByText('production').length).toBeGreaterThan(0);
    expect(screen.getAllByText('platform-team').length).toBeGreaterThan(0);
    expect(screen.getAllByText('mcp-server').length).toBeGreaterThan(0);
  });

  it('displays transport information', () => {
    mockUseCatalogEntity.mockReturnValue([mockServer, true, null]);
    mockUseCatalogEntities.mockReturnValue([mockTools, true, null]);

    renderWithRouter('/mcp-catalog/servers/github-mcp');

    expect(screen.getByText(/stdio/)).toBeInTheDocument();
  });

  it('displays provided tools filtered by server', () => {
    mockUseCatalogEntity.mockReturnValue([mockServer, true, null]);
    mockUseCatalogEntities.mockReturnValue([mockTools, true, null]);

    renderWithRouter('/mcp-catalog/servers/github-mcp');

    // Should show the title with count
    expect(screen.getByText('Provided Tools (2)')).toBeInTheDocument();

    // Should show tools belonging to this server
    expect(screen.getByText('create-issue')).toBeInTheDocument();
    expect(screen.getByText('list-issues')).toBeInTheDocument();

    // Should NOT show tools from other servers
    expect(screen.queryByText('other-tool')).not.toBeInTheDocument();
  });

  it('displays empty state when server has no tools', () => {
    mockUseCatalogEntity.mockReturnValue([mockServer, true, null]);
    mockUseCatalogEntities.mockReturnValue([[], true, null]);

    renderWithRouter('/mcp-catalog/servers/github-mcp');

    expect(screen.getByText('No tools available')).toBeInTheDocument();
    expect(screen.getByText('This server does not currently provide any tools.')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation', () => {
    mockUseCatalogEntity.mockReturnValue([mockServer, true, null]);
    mockUseCatalogEntities.mockReturnValue([mockTools, true, null]);

    renderWithRouter('/mcp-catalog/servers/github-mcp');

    expect(screen.getByText('MCP Catalog')).toBeInTheDocument();
    expect(screen.getByText('Servers')).toBeInTheDocument();
  });

  it('renders tools table with correct columns', () => {
    mockUseCatalogEntity.mockReturnValue([mockServer, true, null]);
    mockUseCatalogEntities.mockReturnValue([mockTools, true, null]);

    renderWithRouter('/mcp-catalog/servers/github-mcp');

    // Check the table column headers exist
    const headers = screen.getAllByRole('columnheader');
    const headerTexts = headers.map(h => h.textContent);
    
    expect(headerTexts).toContain('Name');
    expect(headerTexts).toContain('Type');
    expect(headerTexts).toContain('Lifecycle');
    expect(headerTexts).toContain('Owner');
  });

  it('handles server with no transport info', () => {
    const serverNoTransport: CatalogMcpServer = {
      ...mockServer,
      spec: {
        ...mockServer.spec,
        transport: undefined,
      },
    };

    mockUseCatalogEntity.mockReturnValue([serverNoTransport, true, null]);
    mockUseCatalogEntities.mockReturnValue([[], true, null]);

    renderWithRouter('/mcp-catalog/servers/github-mcp');

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
