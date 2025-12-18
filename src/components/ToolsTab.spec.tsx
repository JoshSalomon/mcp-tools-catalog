import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ToolsTab from './ToolsTab';
import { useCatalogEntities } from '../services/catalogService';
import { CatalogMcpTool } from '../models/CatalogMcpTool';

// Mock the catalogService
jest.mock('../services/catalogService', () => ({
  useCatalogEntities: jest.fn(),
}));

// Mock the performanceMonitor
jest.mock('../utils/performanceMonitor', () => ({
  usePerformanceMonitor: jest.fn(() => jest.fn()),
}));

const mockUseCatalogEntities = useCatalogEntities as jest.MockedFunction<typeof useCatalogEntities>;

const mockTools: CatalogMcpTool[] = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'create-issue',
      namespace: 'default',
      uid: 'tool-1',
      description: 'Create GitHub issues',
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
      uid: 'tool-2',
      description: 'List Kubernetes pods',
    },
    spec: {
      type: 'mcp-tool',
      lifecycle: 'experimental',
      owner: 'ops-team',
      subcomponentOf: 'component:default/kubernetes-mcp',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'search-repos',
      namespace: 'default',
      uid: 'tool-3',
      description: 'Search GitHub repositories',
    },
    spec: {
      type: 'mcp-tool',
      lifecycle: 'production',
      owner: 'platform-team',
      subcomponentOf: 'component:default/github-mcp',
    },
  },
];

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
};

describe('ToolsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading spinner when data is loading', () => {
    mockUseCatalogEntities.mockReturnValue([[], false, null]);

    renderWithRouter(<ToolsTab />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders error state when there is an error', () => {
    const error = new Error('Failed to fetch tools');
    mockUseCatalogEntities.mockReturnValue([[], true, error]);

    renderWithRouter(<ToolsTab />);

    expect(screen.getByText('Error Loading Tools')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch tools')).toBeInTheDocument();
  });

  it('renders empty state when no tools are found', () => {
    mockUseCatalogEntities.mockReturnValue([[], true, null]);

    renderWithRouter(<ToolsTab />);

    expect(screen.getByText('No MCP Tools Found')).toBeInTheDocument();
  });

  it('renders tool list when data is loaded', () => {
    mockUseCatalogEntities.mockReturnValue([mockTools, true, null]);

    renderWithRouter(<ToolsTab />);

    expect(screen.getByText('create-issue')).toBeInTheDocument();
    expect(screen.getByText('list-pods')).toBeInTheDocument();
    expect(screen.getByText('search-repos')).toBeInTheDocument();
  });

  it('displays tool metadata correctly', () => {
    mockUseCatalogEntities.mockReturnValue([mockTools, true, null]);

    renderWithRouter(<ToolsTab />);

    // Multiple tools may have the same owner/lifecycle, so use getAllByText
    expect(screen.getAllByText('platform-team').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ops-team').length).toBeGreaterThan(0);
    expect(screen.getAllByText('production').length).toBeGreaterThan(0);
    expect(screen.getAllByText('experimental').length).toBeGreaterThan(0);
  });

  it('filters tools by search term', async () => {
    mockUseCatalogEntities.mockReturnValue([mockTools, true, null]);

    renderWithRouter(<ToolsTab />);

    const searchInput = screen.getByPlaceholderText('Find tool by name...');
    fireEvent.change(searchInput, { target: { value: 'issue' } });

    await waitFor(() => {
      expect(screen.getByText('create-issue')).toBeInTheDocument();
      expect(screen.queryByText('list-pods')).not.toBeInTheDocument();
    });
  });

  it('shows no results message when search has no matches', async () => {
    mockUseCatalogEntities.mockReturnValue([mockTools, true, null]);

    renderWithRouter(<ToolsTab />);

    const searchInput = screen.getByPlaceholderText('Find tool by name...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  it('accepts initialSearch prop', () => {
    mockUseCatalogEntities.mockReturnValue([mockTools, true, null]);

    renderWithRouter(<ToolsTab initialSearch="pods" />);

    expect(screen.getByText('list-pods')).toBeInTheDocument();
    expect(screen.queryByText('create-issue')).not.toBeInTheDocument();
  });

  it('has accessible search input', () => {
    mockUseCatalogEntities.mockReturnValue([mockTools, true, null]);

    renderWithRouter(<ToolsTab />);

    const searchInput = screen.getByPlaceholderText('Find tool by name...');
    expect(searchInput).toHaveAttribute('aria-label', 'Search MCP tools by name or description');
  });

  it('renders table with correct headers', () => {
    mockUseCatalogEntities.mockReturnValue([mockTools, true, null]);

    renderWithRouter(<ToolsTab />);

    // Check the table exists with column headers
    const headers = screen.getAllByRole('columnheader');
    const headerTexts = headers.map(h => h.textContent);
    
    expect(headerTexts).toContain('Name');
    expect(headerTexts).toContain('Namespace');
    expect(headerTexts).toContain('Type');
    expect(headerTexts).toContain('Lifecycle');
    expect(headerTexts).toContain('Owner');
    expect(headerTexts).toContain('Server');
  });

  it('displays server name from subcomponentOf', () => {
    mockUseCatalogEntities.mockReturnValue([mockTools, true, null]);

    renderWithRouter(<ToolsTab />);

    // Multiple tools may reference the same server, so use getAllByText
    expect(screen.getAllByText('github-mcp').length).toBeGreaterThan(0);
    expect(screen.getAllByText('kubernetes-mcp').length).toBeGreaterThan(0);
  });

  it('has server filter button with accessibility attributes', () => {
    mockUseCatalogEntities.mockReturnValue([mockTools, true, null]);

    renderWithRouter(<ToolsTab />);

    const filterButton = screen.getByRole('button', { name: /Filter by server/i });
    expect(filterButton).toHaveAttribute('aria-expanded', 'false');
    expect(filterButton).toHaveAttribute('aria-haspopup', 'listbox');
  });
});
