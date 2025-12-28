import { useState, useEffect } from 'react';
import { Entity } from '@backstage/catalog-model';
import { CatalogMcpTool, MCP_TOOL_DISABLED_ANNOTATION } from '../models/CatalogMcpTool';
import { CatalogMcpWorkload } from '../models/CatalogMcpWorkload';

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
      if ((name === 'openshift-session-token' || name === 'openshift-auth-token' || name === 'session-token') && value) {
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
    const cookieNames = cookies.map(c => c.trim().split('=')[0]);
    console.debug('Token extraction failed. Available cookies (preview):', cookiePreview);
    console.debug('Cookie names found:', cookieNames);
    console.debug('SERVER_FLAGS keys:', windowAny.SERVER_FLAGS ? Object.keys(windowAny.SERVER_FLAGS) : 'not available');
    
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
const createAuthHeaders = (additionalHeaders: Record<string, string> = {}): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...additionalHeaders,
  };
  
  // Extract CSRF token from cookie for OpenShift Console proxy
  // The console proxy requires this for write operations (PUT/POST/DELETE)
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf-token='))
    ?.split('=')[1];
  
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;  // Must match console format: capital X, CSRF, Token
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
  value: string | null
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
    'Accept': 'application/json',
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
  namespace?: string
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
          'Accept': 'application/json',
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
        const entities = Array.isArray(json) ? json : (json.items || []);
        
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
  namespace: string = 'default',
  refreshTrigger?: string | number,
  entityType?: 'server' | 'tool' | 'workload'
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
          'Accept': 'application/json',
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
              throw new Error(`Failed to fetch entity: ${response.statusText} (${response.status})`);
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
  toolStateChanges: Map<string, boolean>
): Promise<CatalogMcpTool[]> => {
  const updates: Promise<CatalogMcpTool>[] = [];
  
  for (const [entityRef, isDisabled] of toolStateChanges) {
    updates.push(
      updateEntityAnnotation<CatalogMcpTool>(
        entityRef,
        MCP_TOOL_DISABLED_ANNOTATION,
        isDisabled ? 'true' : null
      )
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
export const createWorkload = async (
  workload: {
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
  }
): Promise<CatalogMcpWorkload> => {
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
  name: string
): Promise<CatalogMcpWorkload | null> => {
  const url = new URL(`${MCP_ENTITY_API_ENDPOINT}/workloads/${namespace}/${name}`, window.location.origin);
  
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
  }
): Promise<CatalogMcpWorkload> => {
  const url = new URL(`${MCP_ENTITY_API_ENDPOINT}/workloads/${namespace}/${name}`, window.location.origin);
  
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
export const deleteWorkload = async (
  namespace: string,
  name: string
): Promise<void> => {
  const url = new URL(`${MCP_ENTITY_API_ENDPOINT}/workloads/${namespace}/${name}`, window.location.origin);
  
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
