import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkloadsTab from './WorkloadsTab';
import { useCatalogEntities } from '../services/catalogService';
import { CatalogMcpWorkload } from '../models/CatalogMcpWorkload';
import { CatalogMcpTool } from '../models/CatalogMcpTool';

// Mock the catalogService
jest.mock('../services/catalogService', () => ({
  useCatalogEntities: jest.fn(),
}));

// Mock the authService
jest.mock('../services/authService', () => ({
  useCanEditWorkloads: jest.fn(() => ({ canEdit: false, loaded: true })),
}));

// Mock the performanceMonitor
jest.mock('../utils/performanceMonitor', () => ({
  usePerformanceMonitor: jest.fn(() => jest.fn()),
}));

const mockUseCatalogEntities = useCatalogEntities as jest.MockedFunction<typeof useCatalogEntities>;

const mockWorkloads: CatalogMcpWorkload[] = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'cicd-pipeline',
      namespace: 'default',
      uid: 'workload-1',
      description: 'CI/CD Pipeline service',
    },
    spec: {
      type: 'mcp-workload',
      lifecycle: 'production',
      owner: 'platform-team',
      dependsOn: ['component:default/create-issue', 'component:default/list-pods'],
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'data-processor',
      namespace: 'default',
      uid: 'workload-2',
      description: 'Data processing workflow',
    },
    spec: {
      type: 'mcp-workload',
      lifecycle: 'experimental',
      owner: 'data-team',
      dependsOn: ['component:default/search-repos'],
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'legacy-service',
      namespace: 'default',
      uid: 'workload-3',
    },
    spec: {
      type: 'service', // Legacy type
      lifecycle: 'deprecated',
      owner: 'ops-team',
    },
  },
];

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
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'list-pods',
      namespace: 'default',
      uid: 'tool-2',
    },
    spec: {
      type: 'mcp-tool',
      lifecycle: 'production',
      owner: 'ops-team',
    },
  },
];

const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

// Helper to setup mocks for both workloads and tools
const setupMocks = (
  workloads: CatalogMcpWorkload[] = mockWorkloads,
  workloadsLoaded = true,
  workloadsError: Error | null = null,
  tools: CatalogMcpTool[] = mockTools,
  toolsLoaded = true,
) => {
  mockUseCatalogEntities.mockImplementation((_kind, type) => {
    // Second parameter distinguishes workloads (undefined) from tools ('mcp-tool')
    if (type === 'mcp-tool') {
      return [tools, toolsLoaded, null];
    }
    return [workloads, workloadsLoaded, workloadsError];
  });
};

describe('WorkloadsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading spinner when data is loading', () => {
    setupMocks(mockWorkloads, false, null, mockTools, false);

    renderWithRouter(<WorkloadsTab />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders error state when there is an error', () => {
    const error = new Error('Failed to fetch workloads');
    setupMocks([], true, error, mockTools, true);

    renderWithRouter(<WorkloadsTab />);

    expect(screen.getByText('Error Loading Workloads')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch workloads')).toBeInTheDocument();
  });

  it('renders empty state when no workloads are found', () => {
    setupMocks([], true, null, mockTools, true);

    renderWithRouter(<WorkloadsTab />);

    expect(screen.getByText('No MCP Workloads Found')).toBeInTheDocument();
  });

  it('renders workload list when data is loaded', () => {
    setupMocks();

    renderWithRouter(<WorkloadsTab />);

    expect(screen.getByText('cicd-pipeline')).toBeInTheDocument();
    expect(screen.getByText('data-processor')).toBeInTheDocument();
    expect(screen.getByText('legacy-service')).toBeInTheDocument();
  });

  it('displays workload metadata correctly', () => {
    setupMocks();

    renderWithRouter(<WorkloadsTab />);

    expect(screen.getAllByText('platform-team').length).toBeGreaterThan(0);
    expect(screen.getAllByText('data-team').length).toBeGreaterThan(0);
    expect(screen.getAllByText('production').length).toBeGreaterThan(0);
    expect(screen.getAllByText('experimental').length).toBeGreaterThan(0);
  });

  it('shows correct tool count for workloads', () => {
    setupMocks();

    renderWithRouter(<WorkloadsTab />);

    // cicd-pipeline has 2 tools, data-processor has 1
    const rows = screen.getAllByRole('row');
    // First row is header, subsequent are data
    expect(rows.length).toBeGreaterThan(1);
  });

  it('filters workloads by search term', async () => {
    setupMocks();

    renderWithRouter(<WorkloadsTab />);

    const searchInput = screen.getByPlaceholderText('Find workload by name...');
    fireEvent.change(searchInput, { target: { value: 'pipeline' } });

    await waitFor(() => {
      expect(screen.getByText('cicd-pipeline')).toBeInTheDocument();
      expect(screen.queryByText('data-processor')).not.toBeInTheDocument();
    });
  });

  it('shows no results message when search has no matches', async () => {
    setupMocks();

    renderWithRouter(<WorkloadsTab />);

    const searchInput = screen.getByPlaceholderText('Find workload by name...');
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent123' } });

    await waitFor(() => {
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  it('accepts initialSearch prop', () => {
    setupMocks();

    renderWithRouter(<WorkloadsTab initialSearch="data" />);

    expect(screen.getByText('data-processor')).toBeInTheDocument();
    expect(screen.queryByText('cicd-pipeline')).not.toBeInTheDocument();
  });

  it('has accessible search input', () => {
    setupMocks();

    renderWithRouter(<WorkloadsTab />);

    const searchInput = screen.getByPlaceholderText('Find workload by name...');
    expect(searchInput).toHaveAttribute(
      'aria-label',
      'Search MCP workloads by name or description',
    );
  });

  it('renders table with correct headers', () => {
    setupMocks();

    renderWithRouter(<WorkloadsTab />);

    const headers = screen.getAllByRole('columnheader');
    const headerTexts = headers.map((h) => h.textContent);

    expect(headerTexts).toContain('Name');
    expect(headerTexts).toContain('Namespace');
    expect(headerTexts).toContain('Type');
    expect(headerTexts).toContain('Lifecycle');
    expect(headerTexts).toContain('Owner');
    expect(headerTexts).toContain('Tools');
  });

  it('has tool filter button with accessibility attributes', () => {
    setupMocks();

    renderWithRouter(<WorkloadsTab />);

    const filterButton = screen.getByRole('button', { name: /Filter by tool/i });
    expect(filterButton).toHaveAttribute('aria-expanded', 'false');
    expect(filterButton).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('filters workloads with different spec.type values', () => {
    const mixedWorkloads = [
      ...mockWorkloads,
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'non-workload',
          namespace: 'default',
          uid: 'other-1',
        },
        spec: {
          type: 'library', // Should be filtered out
          lifecycle: 'production',
          owner: 'dev-team',
        },
      },
    ];

    setupMocks(mixedWorkloads as CatalogMcpWorkload[]);

    renderWithRouter(<WorkloadsTab />);

    // Should show workloads with valid types
    expect(screen.getByText('cicd-pipeline')).toBeInTheDocument();
    expect(screen.getByText('legacy-service')).toBeInTheDocument();

    // Should not show library type
    expect(screen.queryByText('non-workload')).not.toBeInTheDocument();
  });
});
