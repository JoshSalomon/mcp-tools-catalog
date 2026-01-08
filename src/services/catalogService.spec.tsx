import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useCatalogEntities, useCatalogEntity } from './catalogService';
import { Entity } from '@backstage/catalog-model';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Silence expected console.error and console.warn calls during error handling tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

interface MockEntity extends Entity {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    uid?: string;
  };
  spec: {
    type: string;
    lifecycle: string;
    owner: string;
  };
}

const mockEntities: MockEntity[] = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'github-mcp',
      namespace: 'default',
      uid: 'entity-1',
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
      uid: 'entity-2',
    },
    spec: {
      type: 'mcp-server',
      lifecycle: 'production',
      owner: 'ops-team',
    },
  },
];

// Test component that uses useCatalogEntities hook
interface EntitiesTestComponentProps {
  kind: string;
  type?: string;
  namespace?: string;
}

const EntitiesTestComponent: React.FC<EntitiesTestComponentProps> = ({ kind, type, namespace }) => {
  const [entities, loaded, error] = useCatalogEntities<MockEntity>(kind, type, namespace);

  return (
    <div>
      <span data-testid="loaded">{loaded ? 'true' : 'false'}</span>
      <span data-testid="error">{error?.message || 'none'}</span>
      <span data-testid="count">{entities.length}</span>
      {entities.map((e, i) => (
        <span key={i} data-testid={`entity-${i}`}>
          {e.metadata.name}
        </span>
      ))}
    </div>
  );
};

// Test component that uses useCatalogEntity hook
interface EntityTestComponentProps {
  kind: string;
  name: string;
  namespace?: string;
}

const EntityTestComponent: React.FC<EntityTestComponentProps> = ({ kind, name, namespace }) => {
  const [entity, loaded, error] = useCatalogEntity<MockEntity>(kind, name, namespace);

  return (
    <div>
      <span data-testid="loaded">{loaded ? 'true' : 'false'}</span>
      <span data-testid="error">{error?.message || 'none'}</span>
      <span data-testid="name">{entity?.metadata.name || 'null'}</span>
    </div>
  );
};

describe('catalogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.location.origin for URL construction
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:9000' },
      writable: true,
    });
  });

  describe('useCatalogEntities', () => {
    it('fetches entities successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEntities,
      });

      render(<EntitiesTestComponent kind="Component" type="mcp-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('loaded').textContent).toBe('true');
      });

      expect(screen.getByTestId('count').textContent).toBe('2');
      expect(screen.getByTestId('entity-0').textContent).toBe('github-mcp');
      expect(screen.getByTestId('entity-1').textContent).toBe('kubernetes-mcp');
    });

    it('handles API error gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      render(<EntitiesTestComponent kind="Component" type="mcp-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('loaded').textContent).toBe('true');
      });

      expect(screen.getByTestId('error').textContent).toContain('Failed to fetch entities');
    });

    it('handles 404 by returning empty array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      render(<EntitiesTestComponent kind="Component" type="mcp-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('loaded').textContent).toBe('true');
      });

      expect(screen.getByTestId('count').textContent).toBe('0');
      expect(screen.getByTestId('error').textContent).toBe('none');
    });

    it('constructs correct URL with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      render(<EntitiesTestComponent kind="Component" type="mcp-server" namespace="production" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const calledUrl = mockFetch.mock.calls[0][0];
      // MCP Entity API uses dedicated endpoints per type with namespace query param
      expect(calledUrl).toContain(
        '/api/proxy/plugin/mcp-catalog/backstage/api/mcp-entity-api/servers',
      );
      expect(calledUrl).toContain('namespace=production');
    });

    it('handles response with items property', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: mockEntities }),
      });

      render(<EntitiesTestComponent kind="Component" type="mcp-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('loaded').textContent).toBe('true');
      });

      expect(screen.getByTestId('count').textContent).toBe('2');
    });

    it('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<EntitiesTestComponent kind="Component" type="mcp-server" />);

      await waitFor(() => {
        expect(screen.getByTestId('loaded').textContent).toBe('true');
      });

      expect(screen.getByTestId('error').textContent).toBe('Network error');
    });
  });

  describe('useCatalogEntity', () => {
    it('fetches single entity successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEntities[0],
      });

      render(<EntityTestComponent kind="Component" name="github-mcp" namespace="default" />);

      await waitFor(() => {
        expect(screen.getByTestId('loaded').textContent).toBe('true');
      });

      expect(screen.getByTestId('name').textContent).toBe('github-mcp');
    });

    it('handles entity not found (404)', async () => {
      // MCP Entity API tries multiple endpoints - mock all returning 404
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      render(<EntityTestComponent kind="Component" name="nonexistent" namespace="default" />);

      await waitFor(() => {
        expect(screen.getByTestId('loaded').textContent).toBe('true');
      });

      expect(screen.getByTestId('name').textContent).toBe('null');
      expect(screen.getByTestId('error').textContent).toBe('none');
    });

    it('handles API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      render(<EntityTestComponent kind="Component" name="github-mcp" namespace="default" />);

      await waitFor(() => {
        expect(screen.getByTestId('loaded').textContent).toBe('true');
      });

      expect(screen.getByTestId('error').textContent).toContain('Failed to fetch entity');
    });

    it('skips fetching for placeholder names', async () => {
      render(<EntityTestComponent kind="Component" name="__placeholder__" namespace="default" />);

      await waitFor(() => {
        expect(screen.getByTestId('loaded').textContent).toBe('true');
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(screen.getByTestId('name').textContent).toBe('null');
    });

    it('skips fetching for empty names', async () => {
      render(<EntityTestComponent kind="Component" name="" namespace="default" />);

      await waitFor(() => {
        expect(screen.getByTestId('loaded').textContent).toBe('true');
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(screen.getByTestId('name').textContent).toBe('null');
    });

    it('constructs correct URL for entity lookup', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEntities[0],
      });

      render(<EntityTestComponent kind="Component" name="github-mcp" namespace="production" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const calledUrl = mockFetch.mock.calls[0][0];
      // MCP Entity API uses dedicated endpoints: /servers/:namespace/:name, /tools/:namespace/:name, etc.
      expect(calledUrl).toContain('/api/proxy/plugin/mcp-catalog/backstage/api/mcp-entity-api/');
      expect(calledUrl).toContain('/production/github-mcp');
    });
  });
});
