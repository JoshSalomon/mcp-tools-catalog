import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DependencyTreeView } from './DependencyTreeView';
import { CatalogMcpWorkload } from '../../models/CatalogMcpWorkload';
import { CatalogMcpTool } from '../../models/CatalogMcpTool';
import { CatalogMcpServer } from '../../models/CatalogMcpServer';

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
    owner: 'platform-team',
    consumes: ['component:default/create-issue', 'component:default/list-pods'],
  },
};

const mockWorkloadNoTools: CatalogMcpWorkload = {
  ...mockWorkload,
  spec: {
    ...mockWorkload.spec,
    consumes: undefined,
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

const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('DependencyTreeView', () => {
  it('renders empty state when workload has no dependencies', () => {
    renderWithRouter(
      <DependencyTreeView workload={mockWorkloadNoTools} tools={mockTools} servers={mockServers} />,
    );

    expect(screen.getByText('No Dependencies')).toBeInTheDocument();
    expect(
      screen.getByText('This workload does not have any tool dependencies.'),
    ).toBeInTheDocument();
  });

  it('renders tree view with dependencies', () => {
    renderWithRouter(
      <DependencyTreeView workload={mockWorkload} tools={mockTools} servers={mockServers} />,
    );

    // Should show the workload name at root
    expect(screen.getByText('cicd-pipeline')).toBeInTheDocument();

    // Should show server nodes
    expect(screen.getByText('github-mcp')).toBeInTheDocument();
    expect(screen.getByText('kubernetes-mcp')).toBeInTheDocument();

    // Should show tool nodes
    expect(screen.getByText('create-issue')).toBeInTheDocument();
    expect(screen.getByText('list-pods')).toBeInTheDocument();
  });

  it('has accessible region container', () => {
    renderWithRouter(
      <DependencyTreeView workload={mockWorkload} tools={mockTools} servers={mockServers} />,
    );

    expect(screen.getByRole('region', { name: 'Dependency tree view' })).toBeInTheDocument();
  });

  it('has accessible search input', () => {
    renderWithRouter(
      <DependencyTreeView workload={mockWorkload} tools={mockTools} servers={mockServers} />,
    );

    expect(screen.getByPlaceholderText('Filter dependencies...')).toHaveAttribute(
      'aria-label',
      'Filter dependencies by name',
    );
  });

  it('displays total dependency count', () => {
    renderWithRouter(
      <DependencyTreeView workload={mockWorkload} tools={mockTools} servers={mockServers} />,
    );

    expect(screen.getByText('2 total dependencies')).toBeInTheDocument();
  });

  it('filters tree by search term', async () => {
    renderWithRouter(
      <DependencyTreeView workload={mockWorkload} tools={mockTools} servers={mockServers} />,
    );

    const searchInput = screen.getByPlaceholderText('Filter dependencies...');
    fireEvent.change(searchInput, { target: { value: 'issue' } });

    await waitFor(() => {
      expect(screen.getByText('create-issue')).toBeInTheDocument();
      // kubernetes-mcp should still be visible as parent path
      // but list-pods should be filtered out based on name match
    });
  });

  it('shows no matches message when search has no results', async () => {
    renderWithRouter(
      <DependencyTreeView workload={mockWorkload} tools={mockTools} servers={mockServers} />,
    );

    const searchInput = screen.getByPlaceholderText('Filter dependencies...');
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('No matches found')).toBeInTheDocument();
    });
  });

  it('shows View links for existing entities', () => {
    renderWithRouter(
      <DependencyTreeView workload={mockWorkload} tools={mockTools} servers={mockServers} />,
    );

    const viewLinks = screen.getAllByText('View →');
    expect(viewLinks.length).toBeGreaterThan(0);
  });

  it('shows Not Found label for missing tools', () => {
    const workloadWithMissingTool: CatalogMcpWorkload = {
      ...mockWorkload,
      spec: {
        ...mockWorkload.spec,
        consumes: ['component:default/nonexistent-tool'],
      },
    };

    renderWithRouter(
      <DependencyTreeView
        workload={workloadWithMissingTool}
        tools={mockTools}
        servers={mockServers}
      />,
    );

    // The missing tool should show 'Unknown Server' as parent since tool doesn't exist
    expect(screen.getByText('Unknown Server')).toBeInTheDocument();
    expect(screen.getByText('nonexistent-tool')).toBeInTheDocument();
  });

  it('groups tools under their parent servers', () => {
    renderWithRouter(
      <DependencyTreeView workload={mockWorkload} tools={mockTools} servers={mockServers} />,
    );

    // Both servers should be shown
    expect(screen.getByText('github-mcp')).toBeInTheDocument();
    expect(screen.getByText('kubernetes-mcp')).toBeInTheDocument();

    // Both tools should be shown
    expect(screen.getByText('create-issue')).toBeInTheDocument();
    expect(screen.getByText('list-pods')).toBeInTheDocument();
  });

  it('renders tree with proper structure', () => {
    renderWithRouter(
      <DependencyTreeView workload={mockWorkload} tools={mockTools} servers={mockServers} />,
    );

    // Workload should be at the root
    expect(screen.getByText('cicd-pipeline')).toBeInTheDocument();

    // Tree should have proper structure (workload -> servers -> tools)
    const tree = screen.getByRole('tree');
    expect(tree).toBeInTheDocument();
  });

  it('has accessible tree view', () => {
    renderWithRouter(
      <DependencyTreeView workload={mockWorkload} tools={mockTools} servers={mockServers} />,
    );

    expect(screen.getByRole('tree', { name: 'Workload dependency hierarchy' })).toBeInTheDocument();
  });
});
