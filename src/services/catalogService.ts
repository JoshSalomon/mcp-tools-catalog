import { useState, useEffect } from 'react';
import { Entity } from '@backstage/catalog-model';
import { CatalogMcpTool, MCP_TOOL_DISABLED_ANNOTATION } from '../models/CatalogMcpTool';
import { CatalogMcpWorkload } from '../models/CatalogMcpWorkload';
import {
  CatalogMcpGuardrail,
  UpdateGuardrailInput,
  ToolGuardrailAssociation,
  WorkloadToolGuardrailAssociation,
  AttachGuardrailInput,
  GuardrailSource,
} from '../models/CatalogMcpGuardrail';

/**
 * Get authentication token from console.
 * Tries multiple methods:
 * 1. Console cookie (openshift-session-token) - may be HttpOnly, so might not be accessible
 * 2. Console window object (SERVER_FLAGS)
 * 3. Console API endpoint (/api/kubernetes/version or similar)
 * 4. Try to get from console's auth service
 *
 * Note: The console proxy with authorization: UserToken should automatically forward
 * the token as X-Forwarded-Access-Token header, but some APIs might not check that.
 *
 * @returns Token string or null if not found
 */
const getTokenFromConsole = (): string | null => {
  try {
    // Method 1: Try to get from cookie (may be HttpOnly and not accessible)
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      // Try multiple cookie names
      if (
        (name === 'openshift-session-token' ||
          name === 'openshift-auth-token' ||
          name === 'session-token') &&
        value
      ) {
        const token = decodeURIComponent(value);
        if (token && token.length > 0) {
          return token;
        }
      }
    }

    // Method 2: Try to get from console window object
    const windowAny = window as any;
    if (windowAny.SERVER_FLAGS?.authToken) {
      return windowAny.SERVER_FLAGS.authToken;
    }

    // Method 3: Try to get from console's auth service (if available)
    if (windowAny.OPENSHIFT_CONSOLE_AUTH_TOKEN) {
      return windowAny.OPENSHIFT_CONSOLE_AUTH_TOKEN;
    }

    // Method 4: Try to get from console's user object
    if (windowAny.SERVER_FLAGS?.userToken) {
      return windowAny.SERVER_FLAGS.userToken;
    }

    // Method 5: Try to get from console's k8s API wrapper (if available)
    // The console might expose the token through its k8s API client
    if (windowAny.window?.SERVER_FLAGS?.kubeAPIServerURL) {
      const k8s = windowAny.window?.k8s;
      if (k8s?.authToken) {
        return k8s.authToken;
      }
    }

    // Method 6: Try to get from console's auth service via API call (async, but we can't use async here)
    // This would require making an API call, which is not ideal for a synchronous function

    // Debug: Log available cookies for troubleshooting (first 200 chars to avoid logging sensitive data)
    const cookiePreview = document.cookie.substring(0, 200);
    const cookieNames = cookies.map((c) => c.trim().split('=')[0]);
    console.debug('Token extraction failed. Available cookies (preview):', cookiePreview);
    console.debug('Cookie names found:', cookieNames);
    console.debug(
      'SERVER_FLAGS keys:',
      windowAny.SERVER_FLAGS ? Object.keys(windowAny.SERVER_FLAGS) : 'not available',
    );

    // Note: If token extraction fails, the console proxy should still forward X-Forwarded-Access-Token
    // But the Backstage catalog API might not check that header, which would cause 401 errors
  } catch (e) {
    console.debug('Could not get token from console:', e);
  }
  return null;
};

/**
 * Create headers for API requests.
 *
 * Authentication is handled automatically by the OpenShift Console proxy:
 * 1. The browser sends cookies via credentials: 'include'
 * 2. The console proxy extracts the token and adds X-Forwarded-Access-Token header
 * 3. The nginx sidecar forwards this header to the backend
 * 4. The backend extracts the token from X-Forwarded-Access-Token
 *
 * CSRF Protection:
 * - The console proxy requires a CSRF token for write operations (PUT/POST/DELETE)
 * - We extract the csrf-token cookie and include it as X-CSRFToken header
 *
 * @param additionalHeaders - Additional headers to include
 * @returns Headers object with Content-Type, Accept, and X-CSRFToken (if available)
 */
const createAuthHeaders = (
  additionalHeaders: Record<string, string> = {},
): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...additionalHeaders,
  };

  // Extract CSRF token from cookie for OpenShift Console proxy
  // The console proxy requires this for write operations (PUT/POST/DELETE)
  const csrfToken = document.cookie
    .split('; ')
    .find((row) => row.startsWith('csrf-token='))
    ?.split('=')[1];

  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken; // Must match console format: capital X, CSRF, Token
  }

  return headers;
};

/**
 * MCP Entity API proxy endpoint.
 * This URL is configured to proxy requests through the OpenShift Console
 * to the Backstage backend's MCP Entity Management API.
 *
 * These endpoints already work with OpenShift credentials and don't require
 * authentication for read operations (GET). Write operations (POST/PUT/DELETE)
 * require authentication via Authorization header or X-Forwarded-Access-Token.
 */
const MCP_ENTITY_API_ENDPOINT = '/api/proxy/plugin/mcp-catalog/backstage/api/mcp-entity-api';

/**
 * Update an entity's annotation in the Backstage Catalog.
 * Persists changes via the MCP Entity API PUT endpoint.
 *
 * @param entityRef - The entity reference (e.g., 'component:default/my-tool')
 * @param annotationKey - The annotation key to update (e.g., 'mcp-catalog.io/disabled')
 * @param value - The value to set, or null to remove the annotation
 * @returns Promise resolving to the updated entity
 * @throws Error if the update fails
 */
export const updateEntityAnnotation = async <T extends Entity>(
  entityRef: string,
  annotationKey: string,
  value: string | null,
): Promise<T> => {
  // Parse entity reference: kind:namespace/name
  const match = entityRef.match(/^([^:]+):([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid entity reference: ${entityRef}`);
  }
  const [, , namespace, name] = match;

  // First, fetch the current entity from MCP Entity API to get its full state
  // Determine the endpoint based on entity kind/type
  // For tools and servers, we need to check the spec.type from the entityRef

  // Try to determine entity type from the entity reference or fetch from all endpoints
  let entity = null;
  let entityEndpoint: string | null = null;

  const endpoints = [
    { url: `${MCP_ENTITY_API_ENDPOINT}/servers/${namespace}/${name}`, type: 'server' },
    { url: `${MCP_ENTITY_API_ENDPOINT}/tools/${namespace}/${name}`, type: 'tool' },
    { url: `${MCP_ENTITY_API_ENDPOINT}/workloads/${namespace}/${name}`, type: 'workload' },
  ];

  const getHeaders: Record<string, string> = {
    Accept: 'application/json',
  };

  // Try fetching from each endpoint until we find the entity
  for (const endpoint of endpoints) {
    const getUrl = new URL(endpoint.url, window.location.origin);
    const getResponse = await fetch(getUrl.toString(), {
      headers: getHeaders,
      credentials: 'include',
    });

    if (getResponse.ok) {
      entity = await getResponse.json();
      entityEndpoint = endpoint.url;
      break;
    } else if (getResponse.status !== 404) {
      // Non-404 error, throw
      throw new Error(`Failed to fetch entity: ${getResponse.statusText}`);
    }
    // If 404, try next endpoint
  }

  if (!entity || !entityEndpoint) {
    throw new Error(`Entity not found: ${entityRef}`);
  }

  // Update annotations
  const annotations = { ...(entity.metadata.annotations || {}) };
  if (value !== null) {
    annotations[annotationKey] = value;
  } else {
    delete annotations[annotationKey];
  }

  entity.metadata.annotations = annotations;

  // Persist changes via MCP Entity API
  // We already know the correct endpoint from the fetch above
  const updateEndpoint = entityEndpoint;

  // Send PUT request to persist the changes
  // Build the payload matching the API's expected format (MCPServerInput/MCPToolInput/MCPWorkloadInput)
  // Backend expects ONLY metadata and spec, with specific allowed fields
  const putUrl = new URL(updateEndpoint, window.location.origin);

  // Build metadata object with ONLY the fields defined in MCPEntityMetadata
  // Exclude Backstage-added fields like uid, etag, generation, resourceVersion
  const metadata: Record<string, unknown> = {
    name: entity.metadata.name,
  };

  // Add optional metadata fields if present
  if (entity.metadata.namespace || namespace) {
    metadata.namespace = entity.metadata.namespace || namespace;
  }
  if (entity.metadata.title) {
    metadata.title = entity.metadata.title;
  }
  if (entity.metadata.description) {
    metadata.description = entity.metadata.description;
  }
  if (entity.metadata.labels && Object.keys(entity.metadata.labels).length > 0) {
    metadata.labels = entity.metadata.labels;
  }
  if (Object.keys(annotations).length > 0) {
    metadata.annotations = annotations;
  }
  if (entity.metadata.tags && entity.metadata.tags.length > 0) {
    metadata.tags = entity.metadata.tags;
  }

  // Build the payload in the format expected by backend (MCPServerInput/MCPToolInput/MCPWorkloadInput)
  const updatePayload = {
    metadata,
    spec: entity.spec,
  };

  // Get authentication headers for MCP Entity API (write operations require auth)
  const putHeaders = createAuthHeaders();

  const putResponse = await fetch(putUrl.toString(), {
    method: 'PUT',
    headers: putHeaders,
    body: JSON.stringify(updatePayload),
    credentials: 'include', // Include cookies for authentication
  });

  if (!putResponse.ok) {
    const errorData = await putResponse.json().catch(() => ({ message: putResponse.statusText }));
    const errorMessage = errorData.message || `Failed to update entity: ${putResponse.statusText}`;

    // Enhanced error logging for debugging auth issues
    if (putResponse.status === 401) {
      const token = getTokenFromConsole();
      console.error('Authentication failed (401):', {
        url: putUrl.toString(),
        hasToken: !!token,
        tokenLength: token?.length || 0,
        status: putResponse.status,
        error: errorMessage,
        cookies: document.cookie ? 'present' : 'missing',
      });
    }

    throw new Error(errorMessage);
  }

  const updatedEntity = await putResponse.json();
  return updatedEntity as T;
};

/**
 * React hook for fetching multiple entities from the Backstage Catalog.
 *
 * @template T - Entity type extending Backstage Entity
 * @param kind - The entity kind to filter by (e.g., 'Component')
 * @param type - Optional spec.type to filter by (e.g., 'mcp-server', 'mcp-tool')
 * @param namespace - Optional namespace to filter by
 * @returns Tuple of [entities array, loaded boolean, error or null]
 *
 * @example
 * ```tsx
 * const [servers, loaded, error] = useCatalogEntities<CatalogMcpServer>(
 *   'Component',
 *   'mcp-server'
 * );
 * ```
 */
export const useCatalogEntities = <T extends Entity>(
  kind: string,
  type?: string,
  namespace?: string,
): [T[], boolean, Error | null] => {
  const [data, setData] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        // Determine MCP Entity API endpoint based on type
        // The MCP Entity API provides dedicated endpoints for each entity type
        let endpoint: string;
        if (type === 'mcp-server') {
          endpoint = `${MCP_ENTITY_API_ENDPOINT}/servers`;
        } else if (type === 'mcp-tool') {
          endpoint = `${MCP_ENTITY_API_ENDPOINT}/tools`;
        } else {
          // Default to workloads for other types or unspecified
          endpoint = `${MCP_ENTITY_API_ENDPOINT}/workloads`;
        }

        // Construct URL with namespace filter if provided
        const url = new URL(endpoint, window.location.origin);
        if (namespace) {
          url.searchParams.append('namespace', namespace);
        }

        // MCP Entity API read endpoints don't require authentication
        // but we include credentials for consistency
        const headers: Record<string, string> = {
          Accept: 'application/json',
        };

        const response = await fetch(url.toString(), {
          headers,
          credentials: 'include', // Include cookies for console proxy
        });

        if (!response.ok) {
          if (response.status === 404) {
            console.warn(`MCP Entity API endpoint not found: ${endpoint}`);
            if (mounted) {
              setData([]);
              setLoaded(true);
            }
            return;
          }
          throw new Error(`Failed to fetch entities: ${response.statusText} (${response.status})`);
        }

        const json = await response.json();
        // MCP Entity API returns { items: [...] } format
        const entities = Array.isArray(json) ? json : json.items || [];

        if (mounted) {
          setData(entities as T[]);
          setLoaded(true);
        }
      } catch (err) {
        if (mounted) {
          console.error('Error fetching MCP entities:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoaded(true);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [kind, type, namespace]);

  return [data, loaded, error];
};

/**
 * React hook for fetching a single entity from the Backstage Catalog by name.
 *
 * @template T - Entity type extending Backstage Entity
 * @param kind - The entity kind (e.g., 'Component')
 * @param name - The entity name
 * @param namespace - The entity namespace (defaults to 'default')
 * @param refreshTrigger - Optional value to trigger refetch (e.g., location.key for navigation-based refresh)
 * @returns Tuple of [entity or null, loaded boolean, error or null]
 *
 * @example
 * ```tsx
 * const location = useLocation();
 * const [server, loaded, error] = useCatalogEntity<CatalogMcpServer>(
 *   'Component',
 *   'my-server',
 *   'default',
 *   location.key  // Refetch on navigation
 * );
 * ```
 */
export const useCatalogEntity = <T extends Entity>(
  kind: string,
  name: string,
  namespace = 'default',
  refreshTrigger?: string | number,
  entityType?: 'server' | 'tool' | 'workload',
): [T | null, boolean, Error | null] => {
  const [data, setData] = useState<T | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    // Skip fetching for placeholder or invalid names
    if (!name || name === '__placeholder__' || name.startsWith('__')) {
      if (mounted) {
        setData(null);
        setLoaded(true);
      }
      return;
    }

    // Reset ALL state on refetch (including data to prevent stale data display)
    setData(null);
    setLoaded(false);
    setError(null);

    const fetchData = async () => {
      try {
        const headers: Record<string, string> = {
          Accept: 'application/json',
        };

        let entity = null;

        // If entityType is provided, fetch directly from the correct endpoint
        if (entityType) {
          let endpoint: string;
          if (entityType === 'server') {
            endpoint = `${MCP_ENTITY_API_ENDPOINT}/servers/${namespace}/${name}`;
          } else if (entityType === 'tool') {
            endpoint = `${MCP_ENTITY_API_ENDPOINT}/tools/${namespace}/${name}`;
          } else if (entityType === 'workload') {
            endpoint = `${MCP_ENTITY_API_ENDPOINT}/workloads/${namespace}/${name}`;
          } else {
            throw new Error(`Unknown entity type: ${entityType}`);
          }

          const url = new URL(endpoint, window.location.origin);
          const response = await fetch(url.toString(), {
            headers,
            credentials: 'include',
          });

          if (response.ok) {
            entity = await response.json();
          } else if (response.status === 404) {
            // Entity not found, return null
            if (mounted) {
              setData(null);
              setLoaded(true);
            }
            return;
          } else {
            // Non-404 error, throw
            throw new Error(`Failed to fetch entity: ${response.statusText} (${response.status})`);
          }
        } else {
          // Fallback: try all endpoints (for backward compatibility)
          // This handles cases where caller doesn't know the entity type
          const endpoints = [
            `${MCP_ENTITY_API_ENDPOINT}/servers/${namespace}/${name}`,
            `${MCP_ENTITY_API_ENDPOINT}/tools/${namespace}/${name}`,
            `${MCP_ENTITY_API_ENDPOINT}/workloads/${namespace}/${name}`,
          ];

          for (const endpoint of endpoints) {
            const url = new URL(endpoint, window.location.origin);
            const response = await fetch(url.toString(), {
              headers,
              credentials: 'include',
            });

            if (response.ok) {
              entity = await response.json();
              break;
            } else if (response.status !== 404) {
              // Non-404 error, throw
              throw new Error(
                `Failed to fetch entity: ${response.statusText} (${response.status})`,
              );
            }
            // If 404, try next endpoint
          }

          if (!entity) {
            // Entity not found in any endpoint
            if (mounted) {
              setData(null);
              setLoaded(true);
            }
            return;
          }
        }

        if (mounted && entity) {
          setData(entity as T);
          setLoaded(true);
        }
      } catch (err) {
        if (mounted) {
          console.error('Error fetching catalog entity:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoaded(true);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [kind, name, namespace, refreshTrigger, entityType]);

  return [data, loaded, error];
};

/**
 * Batch update tool disabled states.
 * Updates multiple tools' disabled annotations in a single batch operation.
 *
 * @param toolStateChanges - Map of tool entity references to their new disabled state
 * @returns Promise resolving to array of updated tool entities
 * @throws Error if any update fails
 *
 * @example
 * ```typescript
 * const changes = new Map<string, boolean>();
 * changes.set('component:default/tool1', true);  // Disable
 * changes.set('component:default/tool2', false); // Enable
 * const updatedTools = await batchUpdateToolStates(changes);
 * ```
 */
export const batchUpdateToolStates = async (
  toolStateChanges: Map<string, boolean>,
): Promise<CatalogMcpTool[]> => {
  const updates: Promise<CatalogMcpTool>[] = [];

  for (const [entityRef, isDisabled] of toolStateChanges) {
    updates.push(
      updateEntityAnnotation<CatalogMcpTool>(
        entityRef,
        MCP_TOOL_DISABLED_ANNOTATION,
        isDisabled ? 'true' : null,
      ),
    );
  }

  return Promise.all(updates);
};

/**
 * Create a new workload entity.
 *
 * @param workload - Workload input data
 * @returns Promise resolving to the created workload entity
 * @throws Error if creation fails
 *
 * @example
 * ```typescript
 * const workload = await createWorkload({
 *   metadata: {
 *     name: 'my-workload',
 *     namespace: 'default',
 *     description: 'Sample workload'
 *   },
 *   spec: {
 *     type: 'mcp-workload',
 *     lifecycle: 'experimental',
 *     owner: 'user:default/admin',
 *     dependsOn: ['component:default/tool1']
 *   }
 * });
 * ```
 */
export const createWorkload = async (workload: {
  metadata: {
    name: string;
    namespace: string;
    description?: string;
  };
  spec: {
    type?: string;
    lifecycle?: string;
    owner?: string;
    dependsOn?: string[];
    [key: string]: any;
  };
}): Promise<CatalogMcpWorkload> => {
  const url = new URL(`${MCP_ENTITY_API_ENDPOINT}/workloads`, window.location.origin);

  const headers = createAuthHeaders();
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(workload),
    credentials: 'include', // Include cookies for authentication
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to create workload: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Get a workload entity by name and namespace.
 *
 * @param namespace - Workload namespace
 * @param name - Workload name
 * @returns Promise resolving to the workload entity, or null if not found
 * @throws Error if fetch fails (other than 404)
 *
 * @example
 * ```typescript
 * const workload = await getWorkload('default', 'my-workload');
 * ```
 */
export const getWorkload = async (
  namespace: string,
  name: string,
): Promise<CatalogMcpWorkload | null> => {
  const url = new URL(
    `${MCP_ENTITY_API_ENDPOINT}/workloads/${namespace}/${name}`,
    window.location.origin,
  );

  const headers = createAuthHeaders();
  const response = await fetch(url.toString(), {
    headers,
    credentials: 'include', // Include cookies for authentication
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to get workload: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Update an existing workload entity.
 *
 * @param namespace - Workload namespace
 * @param name - Workload name
 * @param workload - Updated workload data
 * @returns Promise resolving to the updated workload entity
 * @throws Error if update fails
 *
 * @example
 * ```typescript
 * const updated = await updateWorkload('default', 'my-workload', {
 *   metadata: { description: 'Updated description' },
 *   spec: { dependsOn: ['component:default/tool2'] }
 * });
 * ```
 */
export const updateWorkload = async (
  namespace: string,
  name: string,
  workload: {
    metadata?: {
      description?: string;
      [key: string]: any;
    };
    spec?: {
      type?: string;
      lifecycle?: string;
      owner?: string;
      dependsOn?: string[];
      [key: string]: any;
    };
  },
): Promise<CatalogMcpWorkload> => {
  const url = new URL(
    `${MCP_ENTITY_API_ENDPOINT}/workloads/${namespace}/${name}`,
    window.location.origin,
  );

  const headers = createAuthHeaders();
  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers,
    body: JSON.stringify(workload),
    credentials: 'include', // Include cookies for authentication
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to update workload: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Delete a workload entity.
 *
 * @param namespace - Workload namespace
 * @param name - Workload name
 * @returns Promise resolving when deletion is complete
 * @throws Error if deletion fails
 *
 * @example
 * ```typescript
 * await deleteWorkload('default', 'my-workload');
 * ```
 */
export const deleteWorkload = async (namespace: string, name: string): Promise<void> => {
  const url = new URL(
    `${MCP_ENTITY_API_ENDPOINT}/workloads/${namespace}/${name}`,
    window.location.origin,
  );

  const headers = createAuthHeaders();
  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers,
    credentials: 'include', // Include cookies for authentication
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to delete workload: ${response.statusText}`);
  }
};

// =============================================================================
// Guardrail Service Functions (006-mcp-guardrails)
// =============================================================================

/**
 * Transform flat API guardrail response to nested CatalogMcpGuardrail structure.
 * API returns: { id, namespace, name, description, deployment, parameters, disabled, ... }
 * Frontend expects: { metadata: { name, namespace, description }, spec: { type, deployment, ... } }
 */
const transformGuardrailResponse = (apiResponse: {
  id?: string;
  namespace: string;
  name: string;
  description: string;
  deployment: string;
  parameters?: string;
  disabled?: boolean;
  usage?: {
    tools: Array<{
      toolNamespace: string;
      toolName: string;
      guardrailId: string;
      executionTiming: string;
      parameters?: string;
    }>;
    workloadTools: Array<{
      workloadNamespace: string;
      workloadName: string;
      toolNamespace: string;
      toolName: string;
      guardrailId: string;
      executionTiming: string;
      source: string;
    }>;
  };
}): CatalogMcpGuardrail => ({
  metadata: {
    name: apiResponse.name,
    namespace: apiResponse.namespace || 'default',
    description: apiResponse.description,
  },
  spec: {
    type: 'mcp-guardrail',
    deployment: apiResponse.deployment,
    parameters: apiResponse.parameters,
    disabled: apiResponse.disabled,
  },
  usage: apiResponse.usage
    ? {
        tools: apiResponse.usage.tools.map((t) => ({
          toolNamespace: t.toolNamespace,
          toolName: t.toolName,
          guardrail: {} as CatalogMcpGuardrail, // Will be populated by caller if needed
          executionTiming: t.executionTiming as 'pre-execution' | 'post-execution',
          parameters: t.parameters,
        })),
        workloadTools: apiResponse.usage.workloadTools.map((wt) => ({
          workloadNamespace: wt.workloadNamespace,
          workloadName: wt.workloadName,
          toolNamespace: wt.toolNamespace,
          toolName: wt.toolName,
          guardrail: {} as CatalogMcpGuardrail,
          executionTiming: wt.executionTiming as 'pre-execution' | 'post-execution',
          source: wt.source as 'tool' | 'workload',
        })),
      }
    : undefined,
});

/**
 * React hook for fetching all guardrails.
 *
 * @param namespace - Optional namespace filter
 * @returns Tuple of [guardrails array, loaded boolean, error or null]
 *
 * @example
 * ```tsx
 * const [guardrails, loaded, error] = useGuardrails();
 * const [nsGuardrails, loaded, error] = useGuardrails('production');
 * ```
 */
export const useGuardrails = (
  namespace?: string,
): [CatalogMcpGuardrail[], boolean, Error | null] => {
  const [data, setData] = useState<CatalogMcpGuardrail[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const url = new URL(`${MCP_ENTITY_API_ENDPOINT}/guardrails`, window.location.origin);
        if (namespace) {
          url.searchParams.append('namespace', namespace);
        }

        const headers: Record<string, string> = {
          Accept: 'application/json',
        };

        const response = await fetch(url.toString(), {
          headers,
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 404) {
            console.warn('Guardrails API endpoint not found');
            if (mounted) {
              setData([]);
              setLoaded(true);
            }
            return;
          }
          throw new Error(
            `Failed to fetch guardrails: ${response.statusText} (${response.status})`,
          );
        }

        const json = await response.json();
        const rawGuardrails = Array.isArray(json) ? json : json.items || [];
        // Transform flat API responses to nested CatalogMcpGuardrail structure
        const guardrails = rawGuardrails.map(transformGuardrailResponse);

        if (mounted) {
          setData(guardrails);
          setLoaded(true);
        }
      } catch (err) {
        if (mounted) {
          console.error('Error fetching guardrails:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoaded(true);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [namespace]);

  return [data, loaded, error];
};

/**
 * React hook for fetching a single guardrail by namespace and name.
 *
 * @param namespace - Guardrail namespace
 * @param name - Guardrail name
 * @param refreshTrigger - Optional value to trigger refetch
 * @returns Tuple of [guardrail or null, loaded boolean, error or null]
 *
 * @example
 * ```tsx
 * const [guardrail, loaded, error] = useGuardrail('default', 'rate-limiter');
 * ```
 */
export const useGuardrail = (
  namespace: string,
  name: string,
  refreshTrigger?: string | number,
): [CatalogMcpGuardrail | null, boolean, Error | null] => {
  const [data, setData] = useState<CatalogMcpGuardrail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    // Skip fetching for placeholder or invalid names
    if (!name || name === '__placeholder__' || name.startsWith('__')) {
      if (mounted) {
        setData(null);
        setLoaded(true);
      }
      return;
    }

    // Reset state on refetch
    setData(null);
    setLoaded(false);
    setError(null);

    const fetchData = async () => {
      try {
        const url = new URL(
          `${MCP_ENTITY_API_ENDPOINT}/guardrails/${namespace}/${name}`,
          window.location.origin,
        );

        const headers: Record<string, string> = {
          Accept: 'application/json',
        };

        const response = await fetch(url.toString(), {
          headers,
          credentials: 'include',
        });

        if (response.status === 404) {
          if (mounted) {
            setData(null);
            setLoaded(true);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch guardrail: ${response.statusText} (${response.status})`);
        }

        const rawGuardrail = await response.json();
        // Transform flat API response to nested CatalogMcpGuardrail structure
        const guardrail = transformGuardrailResponse(rawGuardrail);

        if (mounted) {
          setData(guardrail);
          setLoaded(true);
        }
      } catch (err) {
        if (mounted) {
          console.error('Error fetching guardrail:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoaded(true);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [namespace, name, refreshTrigger]);

  return [data, loaded, error];
};

/**
 * Update an existing guardrail.
 *
 * @param namespace - Guardrail namespace
 * @param name - Guardrail name
 * @param input - Updated guardrail data
 * @returns Promise resolving to the updated guardrail
 * @throws Error if update fails
 *
 * @example
 * ```typescript
 * const updated = await updateGuardrail('default', 'rate-limiter', {
 *   metadata: { description: 'Updated description' },
 *   spec: { deployment: 'new-deployment-config' }
 * });
 * ```
 */
export const updateGuardrail = async (
  namespace: string,
  name: string,
  input: UpdateGuardrailInput,
): Promise<CatalogMcpGuardrail> => {
  const url = new URL(
    `${MCP_ENTITY_API_ENDPOINT}/guardrails/${namespace}/${name}`,
    window.location.origin,
  );

  const headers = createAuthHeaders();
  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers,
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to update guardrail: ${response.statusText}`);
  }

  const rawGuardrail = await response.json();
  return transformGuardrailResponse(rawGuardrail);
};

/**
 * Delete a guardrail.
 * Note: Deletion will fail if the guardrail has any tool or workload-tool associations.
 *
 * @param namespace - Guardrail namespace
 * @param name - Guardrail name
 * @returns Promise resolving when deletion is complete
 * @throws Error if deletion fails (including if guardrail has associations)
 *
 * @example
 * ```typescript
 * await deleteGuardrail('default', 'rate-limiter');
 * ```
 */
export const deleteGuardrail = async (namespace: string, name: string): Promise<void> => {
  const url = new URL(
    `${MCP_ENTITY_API_ENDPOINT}/guardrails/${namespace}/${name}`,
    window.location.origin,
  );

  const headers = createAuthHeaders();
  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to delete guardrail: ${response.statusText}`);
  }
};

/**
 * Create a new guardrail entity.
 *
 * @param guardrail - Guardrail creation data
 * @returns Promise resolving to the created guardrail
 * @throws Error if creation fails
 *
 * @example
 * ```typescript
 * const guardrail = await createGuardrail({
 *   metadata: {
 *     name: 'rate-limiter',
 *     namespace: 'default',
 *     description: 'Limits API request rate'
 *   },
 *   spec: {
 *     deployment: 'sidecar-container',
 *     parameters: '{"maxCalls": 100}'
 *   }
 * });
 * ```
 */
export const createGuardrail = async (guardrail: {
  metadata: {
    name: string;
    namespace?: string;
    description: string;
  };
  spec: {
    deployment: string;
    parameters?: string;
    disabled?: boolean;
  };
}): Promise<CatalogMcpGuardrail> => {
  const url = new URL(`${MCP_ENTITY_API_ENDPOINT}/guardrails`, window.location.origin);

  const headers = createAuthHeaders();
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(guardrail),
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to create guardrail: ${response.statusText}`);
  }

  const rawGuardrail = await response.json();
  return transformGuardrailResponse(rawGuardrail);
};

/**
 * Import a guardrail from YAML content.
 *
 * @param yamlContent - YAML string containing guardrail definition
 * @returns Promise resolving to the created guardrail
 * @throws Error if import fails (invalid YAML, validation error, etc.)
 *
 * @example
 * ```typescript
 * const yamlContent = `
 * metadata:
 *   name: rate-limiter
 *   description: Limits API request rate
 * spec:
 *   deployment: sidecar-container
 * `;
 * const guardrail = await importGuardrailYaml(yamlContent);
 * ```
 */
/**
 * Preview response for multi-document YAML import.
 */
export interface GuardrailImportPreview {
  preview: boolean;
  count: number;
  guardrails: Array<{
    name: string;
    namespace: string;
    description: string;
  }>;
}

/**
 * Result of multi-document YAML import.
 */
export interface GuardrailImportResult {
  imported: number;
  failed: number;
  guardrails: CatalogMcpGuardrail[];
  errors: Array<{ name: string; error: string }>;
}

/**
 * Preview guardrails from YAML content without creating them.
 * Used to show confirmation dialog for multi-document imports.
 *
 * @param yamlContent - YAML string (may contain multiple documents)
 * @returns Promise resolving to preview with list of guardrails
 * @throws Error if YAML is invalid
 */
export const previewGuardrailYaml = async (
  yamlContent: string,
): Promise<GuardrailImportPreview> => {
  const url = new URL(`${MCP_ENTITY_API_ENDPOINT}/guardrails/import`, window.location.origin);
  url.searchParams.set('preview', 'true');

  const headers = createAuthHeaders();
  headers['Content-Type'] = 'text/yaml';

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: yamlContent,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(
      errorData.message || `Failed to preview guardrail import: ${response.statusText}`,
    );
  }

  return response.json();
};

/**
 * Import guardrail(s) from YAML content.
 * Supports multi-document YAML (multiple guardrails separated by ---).
 *
 * @param yamlContent - YAML string (may contain multiple documents)
 * @returns Promise resolving to single guardrail or import result
 * @throws Error if import fails
 */
export const importGuardrailYaml = async (
  yamlContent: string,
): Promise<CatalogMcpGuardrail | GuardrailImportResult> => {
  const url = new URL(`${MCP_ENTITY_API_ENDPOINT}/guardrails/import`, window.location.origin);

  const headers = createAuthHeaders();
  // Override Content-Type for YAML
  headers['Content-Type'] = 'text/yaml';

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: yamlContent,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to import guardrail: ${response.statusText}`);
  }

  const result = await response.json();

  // Check if it's a multi-import result or single guardrail
  if ('imported' in result && 'failed' in result) {
    // Multi-import result - transform each guardrail
    return {
      imported: result.imported,
      failed: result.failed,
      guardrails: result.guardrails.map(transformGuardrailResponse),
      errors: result.errors,
    };
  }

  // Single guardrail result
  return transformGuardrailResponse(result);
};

// =============================================================================
// Tool-Guardrail Association Functions (006-mcp-guardrails US3)
// =============================================================================

/**
 * Transform API tool-guardrail association response to ToolGuardrailAssociation.
 * API returns flat structure, we transform to nested format with guardrail object.
 */
const transformToolGuardrailAssociation = (apiResponse: {
  id: string;
  toolNamespace: string;
  toolName: string;
  guardrailId: string;
  guardrail?: {
    id?: string;
    namespace: string;
    name: string;
    description: string;
    deployment: string;
    parameters?: string;
    disabled?: boolean;
  };
  executionTiming: string;
  parameters?: string;
  createdAt: string;
}): ToolGuardrailAssociation => ({
  toolNamespace: apiResponse.toolNamespace,
  toolName: apiResponse.toolName,
  guardrail: apiResponse.guardrail
    ? transformGuardrailResponse(apiResponse.guardrail)
    : {
        metadata: { name: '', namespace: 'default', description: '' },
        spec: { type: 'mcp-guardrail', deployment: '' },
      },
  executionTiming: apiResponse.executionTiming as 'pre-execution' | 'post-execution',
  parameters: apiResponse.parameters,
});

/**
 * React hook for fetching guardrails attached to a tool.
 *
 * @param namespace - Tool namespace
 * @param name - Tool name
 * @param refreshTrigger - Optional value to trigger refetch
 * @returns Tuple of [associations array, loaded boolean, error or null]
 *
 * @example
 * ```tsx
 * const [guardrails, loaded, error] = useToolGuardrails('default', 'my-tool');
 * ```
 */
export const useToolGuardrails = (
  namespace: string,
  name: string,
  refreshTrigger?: string | number,
): [ToolGuardrailAssociation[], boolean, Error | null] => {
  const [data, setData] = useState<ToolGuardrailAssociation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    // Skip fetching for placeholder or invalid names
    if (!name || name === '__placeholder__' || name.startsWith('__')) {
      if (mounted) {
        setData([]);
        setLoaded(true);
      }
      return;
    }

    // Reset state on refetch
    setData([]);
    setLoaded(false);
    setError(null);

    const fetchData = async () => {
      try {
        const url = new URL(
          `${MCP_ENTITY_API_ENDPOINT}/tools/${namespace}/${name}/guardrails`,
          window.location.origin,
        );

        const headers: Record<string, string> = {
          Accept: 'application/json',
        };

        const response = await fetch(url.toString(), {
          headers,
          credentials: 'include',
        });

        if (response.status === 404) {
          // Tool not found - return empty array
          if (mounted) {
            setData([]);
            setLoaded(true);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(
            `Failed to fetch tool guardrails: ${response.statusText} (${response.status})`,
          );
        }

        const json = await response.json();
        const rawAssociations = Array.isArray(json) ? json : json.items || [];
        const associations = rawAssociations.map(transformToolGuardrailAssociation);

        if (mounted) {
          setData(associations);
          setLoaded(true);
        }
      } catch (err) {
        if (mounted) {
          console.error('Error fetching tool guardrails:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoaded(true);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [namespace, name, refreshTrigger]);

  return [data, loaded, error];
};

/**
 * Attach a guardrail to a tool.
 *
 * @param toolNamespace - Tool namespace
 * @param toolName - Tool name
 * @param input - Guardrail attachment data
 * @returns Promise resolving to the created association
 * @throws Error if attachment fails (including 409 for duplicate)
 *
 * @example
 * ```typescript
 * const association = await attachGuardrailToTool('default', 'my-tool', {
 *   guardrailNamespace: 'default',
 *   guardrailName: 'rate-limiter',
 *   executionTiming: 'pre-execution'
 * });
 * ```
 */
export const attachGuardrailToTool = async (
  toolNamespace: string,
  toolName: string,
  input: AttachGuardrailInput,
): Promise<ToolGuardrailAssociation> => {
  const url = new URL(
    `${MCP_ENTITY_API_ENDPOINT}/tools/${toolNamespace}/${toolName}/guardrails`,
    window.location.origin,
  );

  const headers = createAuthHeaders();
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to attach guardrail: ${response.statusText}`);
  }

  const rawAssociation = await response.json();
  return transformToolGuardrailAssociation(rawAssociation);
};

/**
 * Detach a guardrail from a tool.
 *
 * @param toolNamespace - Tool namespace
 * @param toolName - Tool name
 * @param guardrailNamespace - Guardrail namespace
 * @param guardrailName - Guardrail name
 * @returns Promise resolving when detachment is complete
 * @throws Error if detachment fails (including 404 if not attached)
 *
 * @example
 * ```typescript
 * await detachGuardrailFromTool('default', 'my-tool', 'default', 'rate-limiter');
 * ```
 */
export const detachGuardrailFromTool = async (
  toolNamespace: string,
  toolName: string,
  guardrailNamespace: string,
  guardrailName: string,
): Promise<void> => {
  const url = new URL(
    `${MCP_ENTITY_API_ENDPOINT}/tools/${toolNamespace}/${toolName}/guardrails/${guardrailNamespace}/${guardrailName}`,
    window.location.origin,
  );

  const headers = createAuthHeaders();
  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to detach guardrail: ${response.statusText}`);
  }
};

// =============================================================================
// Workload-Tool-Guardrail Association Functions (006-mcp-guardrails US4)
// =============================================================================

/**
 * Transform API workload-tool-guardrail association response to WorkloadToolGuardrailAssociation.
 * API returns flat structure, we transform to nested format with guardrail object.
 */
const transformWorkloadToolGuardrailAssociation = (apiResponse: {
  id: string;
  workloadNamespace: string;
  workloadName: string;
  toolNamespace: string;
  toolName: string;
  guardrailId: string;
  guardrail?: {
    id?: string;
    namespace: string;
    name: string;
    description: string;
    deployment: string;
    parameters?: string;
    disabled?: boolean;
  };
  executionTiming: string;
  source: string;
  parameters?: string;
  createdAt: string;
}): WorkloadToolGuardrailAssociation => ({
  workloadNamespace: apiResponse.workloadNamespace,
  workloadName: apiResponse.workloadName,
  toolNamespace: apiResponse.toolNamespace,
  toolName: apiResponse.toolName,
  guardrail: apiResponse.guardrail
    ? transformGuardrailResponse(apiResponse.guardrail)
    : {
        metadata: { name: '', namespace: 'default', description: '' },
        spec: { type: 'mcp-guardrail', deployment: '' },
      },
  executionTiming: apiResponse.executionTiming as 'pre-execution' | 'post-execution',
  source: apiResponse.source as GuardrailSource,
  parameters: apiResponse.parameters,
});

/**
 * React hook for fetching guardrails attached to a workload-tool relationship.
 *
 * @param workloadNamespace - Workload namespace
 * @param workloadName - Workload name
 * @param toolNamespace - Tool namespace
 * @param toolName - Tool name
 * @param refreshTrigger - Optional value to trigger refetch
 * @returns Tuple of [associations array, loaded boolean, error or null]
 *
 * @example
 * ```tsx
 * const [guardrails, loaded, error] = useWorkloadToolGuardrails(
 *   'default', 'my-workload', 'default', 'my-tool'
 * );
 * ```
 */
export const useWorkloadToolGuardrails = (
  workloadNamespace: string,
  workloadName: string,
  toolNamespace: string,
  toolName: string,
  refreshTrigger?: string | number,
): [WorkloadToolGuardrailAssociation[], boolean, Error | null] => {
  const [data, setData] = useState<WorkloadToolGuardrailAssociation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    // Skip fetching for placeholder or invalid names
    if (
      !workloadName ||
      workloadName === '__placeholder__' ||
      workloadName.startsWith('__') ||
      !toolName ||
      toolName === '__placeholder__' ||
      toolName.startsWith('__')
    ) {
      if (mounted) {
        setData([]);
        setLoaded(true);
      }
      return;
    }

    // Reset state on refetch
    setData([]);
    setLoaded(false);
    setError(null);

    const fetchData = async () => {
      try {
        const url = new URL(
          `${MCP_ENTITY_API_ENDPOINT}/workloads/${workloadNamespace}/${workloadName}/tools/${toolNamespace}/${toolName}/guardrails`,
          window.location.origin,
        );

        const headers: Record<string, string> = {
          Accept: 'application/json',
        };

        const response = await fetch(url.toString(), {
          headers,
          credentials: 'include',
        });

        if (response.status === 404) {
          // Workload or tool not found - return empty array
          if (mounted) {
            setData([]);
            setLoaded(true);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(
            `Failed to fetch workload-tool guardrails: ${response.statusText} (${response.status})`,
          );
        }

        const json = await response.json();
        const rawAssociations = Array.isArray(json) ? json : json.items || [];
        const associations = rawAssociations.map(transformWorkloadToolGuardrailAssociation);

        if (mounted) {
          setData(associations);
          setLoaded(true);
        }
      } catch (err) {
        if (mounted) {
          console.error('Error fetching workload-tool guardrails:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoaded(true);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [workloadNamespace, workloadName, toolNamespace, toolName, refreshTrigger]);

  return [data, loaded, error];
};

/**
 * Add a guardrail to a workload-tool relationship.
 *
 * @param workloadNamespace - Workload namespace
 * @param workloadName - Workload name
 * @param toolNamespace - Tool namespace
 * @param toolName - Tool name
 * @param input - Guardrail attachment data
 * @returns Promise resolving to the created association
 * @throws Error if attachment fails (including 409 for duplicate)
 *
 * @example
 * ```typescript
 * const association = await addGuardrailToWorkloadTool(
 *   'default', 'my-workload', 'default', 'my-tool',
 *   {
 *     guardrailNamespace: 'default',
 *     guardrailName: 'rate-limiter',
 *     executionTiming: 'pre-execution'
 *   }
 * );
 * ```
 */
export const addGuardrailToWorkloadTool = async (
  workloadNamespace: string,
  workloadName: string,
  toolNamespace: string,
  toolName: string,
  input: AttachGuardrailInput,
): Promise<WorkloadToolGuardrailAssociation> => {
  const url = new URL(
    `${MCP_ENTITY_API_ENDPOINT}/workloads/${workloadNamespace}/${workloadName}/tools/${toolNamespace}/${toolName}/guardrails`,
    window.location.origin,
  );

  const headers = createAuthHeaders();
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(
      errorData.message || `Failed to add guardrail to workload-tool: ${response.statusText}`,
    );
  }

  const rawAssociation = await response.json();
  return transformWorkloadToolGuardrailAssociation(rawAssociation);
};

/**
 * Remove a guardrail from a workload-tool relationship.
 *
 * @param workloadNamespace - Workload namespace
 * @param workloadName - Workload name
 * @param toolNamespace - Tool namespace
 * @param toolName - Tool name
 * @param guardrailNamespace - Guardrail namespace
 * @param guardrailName - Guardrail name
 * @returns Promise resolving when removal is complete
 * @throws Error if removal fails (including 404 if not attached)
 *
 * @example
 * ```typescript
 * await removeGuardrailFromWorkloadTool(
 *   'default', 'my-workload', 'default', 'my-tool',
 *   'default', 'rate-limiter'
 * );
 * ```
 */
export const removeGuardrailFromWorkloadTool = async (
  workloadNamespace: string,
  workloadName: string,
  toolNamespace: string,
  toolName: string,
  guardrailNamespace: string,
  guardrailName: string,
): Promise<void> => {
  const url = new URL(
    `${MCP_ENTITY_API_ENDPOINT}/workloads/${workloadNamespace}/${workloadName}/tools/${toolNamespace}/${toolName}/guardrails/${guardrailNamespace}/${guardrailName}`,
    window.location.origin,
  );

  const headers = createAuthHeaders();
  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(
      errorData.message || `Failed to remove guardrail from workload-tool: ${response.statusText}`,
    );
  }
};

/**
 * Update a guardrail association in a workload-tool relationship.
 *
 * @param workloadNamespace - Namespace of the workload
 * @param workloadName - Name of the workload
 * @param toolNamespace - Namespace of the tool
 * @param toolName - Name of the tool
 * @param guardrailNamespace - Namespace of the guardrail to update
 * @param guardrailName - Name of the guardrail to update
 * @param updates - Fields to update (executionTiming and/or parameters)
 * @returns Promise resolving to the updated association
 * @throws Error if update fails (including 404 if not attached)
 *
 * @example
 * ```typescript
 * const updated = await updateWorkloadToolGuardrail(
 *   'default', 'my-workload', 'default', 'my-tool',
 *   'default', 'rate-limiter',
 *   { executionTiming: 'post-execution', parameters: '{"maxCalls": 100}' }
 * );
 * ```
 */
export const updateWorkloadToolGuardrail = async (
  workloadNamespace: string,
  workloadName: string,
  toolNamespace: string,
  toolName: string,
  guardrailNamespace: string,
  guardrailName: string,
  updates: { executionTiming?: 'pre-execution' | 'post-execution'; parameters?: string | null },
): Promise<WorkloadToolGuardrailAssociation> => {
  const url = new URL(
    `${MCP_ENTITY_API_ENDPOINT}/workloads/${workloadNamespace}/${workloadName}/tools/${toolNamespace}/${toolName}/guardrails/${guardrailNamespace}/${guardrailName}`,
    window.location.origin,
  );

  const headers = createAuthHeaders();
  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(
      errorData.message || `Failed to update workload-tool guardrail: ${response.statusText}`,
    );
  }

  return response.json();
};
