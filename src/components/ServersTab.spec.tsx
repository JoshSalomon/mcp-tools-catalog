import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ServersTab from './ServersTab';
import { useCatalogEntities } from '../services/catalogService';
import { CatalogMcpServer } from '../models/CatalogMcpServer';

// Mock the catalogService
jest.mock('../services/catalogService', () => ({
  useCatalogEntities: jest.fn(),
}));

// Mock the performanceMonitor
jest.mock('../utils/performanceMonitor', () => ({
  usePerformanceMonitor: jest.fn(() => jest.fn()),
}));

const mockUseCatalogEntities = useCatalogEntities as jest.MockedFunction<typeof useCatalogEntities>;

const mockServers: CatalogMcpServer[] = [
  {
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
    relations: [
      { type: 'hasPart', targetRef: 'component:default/github-create-issue' },
      { type: 'hasPart', targetRef: 'component:default/github-list-issues' },
    ],
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'kubernetes-mcp',
      namespace: 'default',
      uid: 'server-2',
      description: 'Kubernetes MCP Server',
    },
    spec: {
      type: 'mcp-server',
      lifecycle: 'experimental',
      owner: 'ops-team',
    },
    relations: [],
  },
];

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
};

describe('ServersTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading spinner when data is loading', () => {
    mockUseCatalogEntities.mockReturnValue([[], false, null]);

    renderWithRouter(<ServersTab />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders error state when there is an error', () => {
    const error = new Error('Failed to fetch servers');
    mockUseCatalogEntities.mockReturnValue([[], true, error]);

    renderWithRouter(<ServersTab />);

    expect(screen.getByText('Error Loading Servers')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch servers')).toBeInTheDocument();
  });

  it('renders empty state when no servers are found', () => {
    mockUseCatalogEntities.mockReturnValue([[], true, null]);

    renderWithRouter(<ServersTab />);

    expect(screen.getByText('No MCP Servers Found')).toBeInTheDocument();
  });

  it('renders server list when data is loaded', () => {
    mockUseCatalogEntities.mockReturnValue([mockServers, true, null]);

    renderWithRouter(<ServersTab />);

    expect(screen.getByText('github-mcp')).toBeInTheDocument();
    expect(screen.getByText('kubernetes-mcp')).toBeInTheDocument();
  });

  it('displays correct tool count from relations', () => {
    mockUseCatalogEntities.mockReturnValue([mockServers, true, null]);

    renderWithRouter(<ServersTab />);

    // github-mcp has 2 hasPart relations
    const rows = screen.getAllByRole('row');
    // First row is header, second is github-mcp
    expect(rows[1]).toHaveTextContent('2');
    // kubernetes-mcp has 0 tools
    expect(rows[2]).toHaveTextContent('0');
  });

  it('filters servers by search term', async () => {
    mockUseCatalogEntities.mockReturnValue([mockServers, true, null]);

    renderWithRouter(<ServersTab />);

    const searchInput = screen.getByPlaceholderText('Find server by name...');
    fireEvent.change(searchInput, { target: { value: 'github' } });

    await waitFor(() => {
      expect(screen.getByText('github-mcp')).toBeInTheDocument();
      expect(screen.queryByText('kubernetes-mcp')).not.toBeInTheDocument();
    });
  });

  it('shows no results message when search has no matches', async () => {
    mockUseCatalogEntities.mockReturnValue([mockServers, true, null]);

    renderWithRouter(<ServersTab />);

    const searchInput = screen.getByPlaceholderText('Find server by name...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('No results found')).toBeInTheDocument();
      expect(screen.getByText('No servers match "nonexistent"')).toBeInTheDocument();
    });
  });

  it('clears search when clear button is clicked', async () => {
    mockUseCatalogEntities.mockReturnValue([mockServers, true, null]);

    renderWithRouter(<ServersTab />);

    const searchInput = screen.getByPlaceholderText('Find server by name...');
    fireEvent.change(searchInput, { target: { value: 'github' } });

    await waitFor(() => {
      expect(screen.queryByText('kubernetes-mcp')).not.toBeInTheDocument();
    });

    // Find and click the clear button
    const clearButton = screen.getByLabelText('Reset');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText('kubernetes-mcp')).toBeInTheDocument();
    });
  });

  it('accepts initialSearch prop', () => {
    mockUseCatalogEntities.mockReturnValue([mockServers, true, null]);

    renderWithRouter(<ServersTab initialSearch="github" />);

    expect(screen.getByText('github-mcp')).toBeInTheDocument();
    expect(screen.queryByText('kubernetes-mcp')).not.toBeInTheDocument();
  });

  it('has accessible search input', () => {
    mockUseCatalogEntities.mockReturnValue([mockServers, true, null]);

    renderWithRouter(<ServersTab />);

    const searchInput = screen.getByPlaceholderText('Find server by name...');
    expect(searchInput).toHaveAttribute('aria-label', 'Search MCP servers by name or description');
  });

  it('renders table with correct headers', () => {
    mockUseCatalogEntities.mockReturnValue([mockServers, true, null]);

    renderWithRouter(<ServersTab />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Namespace')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Lifecycle')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
  });

  it('displays server metadata correctly', () => {
    mockUseCatalogEntities.mockReturnValue([mockServers, true, null]);

    renderWithRouter(<ServersTab />);

    // Check first server's data
    expect(screen.getByText('github-mcp')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByText('platform-team')).toBeInTheDocument();

    // Check second server's data
    expect(screen.getByText('kubernetes-mcp')).toBeInTheDocument();
    expect(screen.getByText('experimental')).toBeInTheDocument();
    expect(screen.getByText('ops-team')).toBeInTheDocument();
  });
});
