import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import McpWorkloadPage from './McpWorkloadPage';
import { useCatalogEntity, useCatalogEntities } from '../services/catalogService';
import { CatalogMcpWorkload } from '../models/CatalogMcpWorkload';
import { CatalogMcpTool } from '../models/CatalogMcpTool';
import { CatalogMcpServer } from '../models/CatalogMcpServer';

// Mock the catalogService
jest.mock('../services/catalogService', () => ({
  useCatalogEntity: jest.fn(),
  useCatalogEntities: jest.fn(),
  useGuardrails: jest.fn(() => [[], true, null]),
  useWorkloadToolGuardrails: jest.fn(() => [[], true, null]),
  addGuardrailToWorkloadTool: jest.fn(),
  removeGuardrailFromWorkloadTool: jest.fn(),
}));

// Mock the authService
jest.mock('../services/authService', () => ({
  useCanEditCatalog: jest.fn(() => ({ canEdit: false, loaded: true })),
}));

// Mock the performanceMonitor
jest.mock('../utils/performanceMonitor', () => ({
  usePerformanceMonitor: jest.fn(() => jest.fn()),
}));

const mockUseCatalogEntity = useCatalogEntity as jest.MockedFunction<typeof useCatalogEntity>;
const mockUseCatalogEntities = useCatalogEntities as jest.MockedFunction<typeof useCatalogEntities>;

const mockWorkload: CatalogMcpWorkload = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'cicd-pipeline',
    namespace: 'default',
    uid: 'workload-1',
    description: 'CI/CD Pipeline for automated deployments',
  },
  spec: {
    type: 'mcp-workload',
    lifecycle: 'production',
    owner: 'platform-team',
    consumes: ['component:default/create-issue', 'component:default/list-pods'],
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
      name: 'list-pods',
      namespace: 'default',
      uid: 'tool-2',
    },
    spec: {
      type: 'mcp-tool',
      lifecycle: 'production',
      owner: 'ops-team',
      subcomponentOf: 'component:default/kubernetes-mcp',
    },
  },
];

const mockServers: CatalogMcpServer[] = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'github-mcp',
      namespace: 'default',
      uid: 'server-1',
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
      uid: 'server-2',
    },
    spec: {
      type: 'mcp-server',
      lifecycle: 'production',
      owner: 'ops-team',
    },
  },
];

// Helper to setup mocks
const setupMocks = (
  workload: CatalogMcpWorkload | null = mockWorkload,
  workloadLoaded = true,
  workloadError: Error | null = null,
  tools: CatalogMcpTool[] = mockTools,
  toolsLoaded = true,
  servers: CatalogMcpServer[] = mockServers,
  serversLoaded = true,
) => {
  mockUseCatalogEntity.mockReturnValue([workload, workloadLoaded, workloadError]);
  mockUseCatalogEntities.mockImplementation((_kind, type) => {
    if (type === 'mcp-tool') {
      return [tools, toolsLoaded, null];
    }
    if (type === 'mcp-server') {
      return [servers, serversLoaded, null];
    }
    return [[], true, null];
  });
};

const renderWithRouter = (initialPath: string) => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Route path="/mcp-catalog/workloads/:name">
        <McpWorkloadPage />
      </Route>
    </MemoryRouter>,
  );
};

describe('McpWorkloadPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading spinner when data is loading', () => {
    setupMocks(null, false, null, [], false, [], false);

    renderWithRouter('/mcp-catalog/workloads/cicd-pipeline');

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders workload not found when workload does not exist', () => {
    setupMocks(null, true, null);

    renderWithRouter('/mcp-catalog/workloads/nonexistent');

    expect(screen.getByText('Workload Not Found')).toBeInTheDocument();
  });

  it('renders error message when there is an error', () => {
    const error = new Error('Failed to fetch workload');
    setupMocks(null, true, error);

    renderWithRouter('/mcp-catalog/workloads/cicd-pipeline');

    expect(screen.getByText('Workload Not Found')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch workload')).toBeInTheDocument();
  });

  it('renders workload details when loaded', () => {
    setupMocks();

    renderWithRouter('/mcp-catalog/workloads/cicd-pipeline');

    expect(screen.getByText('MCP Workload: cicd-pipeline')).toBeInTheDocument();
    expect(screen.getByText('Workload Details')).toBeInTheDocument();
  });

  it('displays workload metadata correctly', () => {
    setupMocks();

    renderWithRouter('/mcp-catalog/workloads/cicd-pipeline');

    expect(screen.getAllByText('cicd-pipeline').length).toBeGreaterThan(0);
    expect(screen.getAllByText('production').length).toBeGreaterThan(0);
    expect(screen.getAllByText('platform-team').length).toBeGreaterThan(0);
    expect(screen.getByText('CI/CD Pipeline for automated deployments')).toBeInTheDocument();
  });

  it('displays referenced tools section', () => {
    setupMocks();

    renderWithRouter('/mcp-catalog/workloads/cicd-pipeline');

    expect(screen.getByText(/Referenced Tools.*2.*- Grouped by Server/)).toBeInTheDocument();
  });

  it('groups tools by server', () => {
    setupMocks();

    renderWithRouter('/mcp-catalog/workloads/cicd-pipeline');

    // Should show server groups
    expect(screen.getByText(/github-mcp.*1 tool/)).toBeInTheDocument();
    expect(screen.getByText(/kubernetes-mcp.*1 tool/)).toBeInTheDocument();
  });

  it('displays Expand All and Collapse All buttons when multiple servers', () => {
    setupMocks();

    renderWithRouter('/mcp-catalog/workloads/cicd-pipeline');

    expect(screen.getByRole('button', { name: 'Expand All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse All' })).toBeInTheDocument();
  });

  it('collapses all sections when Collapse All is clicked', async () => {
    setupMocks();

    renderWithRouter('/mcp-catalog/workloads/cicd-pipeline');

    const collapseBtn = screen.getByRole('button', { name: 'Collapse All' });
    fireEvent.click(collapseBtn);

    // After collapse, the tools table should not be visible
    // The expandable sections should be collapsed
  });

  it('shows empty state when workload has no tools', () => {
    const workloadNoTools: CatalogMcpWorkload = {
      ...mockWorkload,
      spec: {
        ...mockWorkload.spec,
        consumes: undefined,
      },
    };

    setupMocks(workloadNoTools);

    renderWithRouter('/mcp-catalog/workloads/cicd-pipeline');

    expect(screen.getByText('No tools referenced')).toBeInTheDocument();
  });

  it('shows warning when tool references are invalid', () => {
    const workloadWithInvalidRef: CatalogMcpWorkload = {
      ...mockWorkload,
      spec: {
        ...mockWorkload.spec,
        consumes: ['component:default/nonexistent-tool'],
        // validateToolReferences checks consumesTools field
        consumesTools: ['nonexistent-tool'],
      } as any,
    };

    setupMocks(workloadWithInvalidRef);

    renderWithRouter('/mcp-catalog/workloads/cicd-pipeline');

    expect(screen.getByText('Invalid Tool References')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation', () => {
    setupMocks();

    renderWithRouter('/mcp-catalog/workloads/cicd-pipeline');

    expect(screen.getByText('MCP Catalog')).toBeInTheDocument();
    expect(screen.getByText('Workloads')).toBeInTheDocument();
  });

  it('shows Server Details button for existing servers', () => {
    setupMocks();

    renderWithRouter('/mcp-catalog/workloads/cicd-pipeline');

    // The UI now shows "Details" buttons for each server group
    const detailsButtons = screen.getAllByRole('button', { name: 'Details' });
    expect(detailsButtons.length).toBeGreaterThan(0);
  });
});
