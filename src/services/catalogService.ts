import { useState, useEffect } from 'react';
import { Entity } from '@backstage/catalog-model';

// This URL should be configured via environment or Console configuration
// Adding /api/catalog here to match RHDH standard API path
const CATALOG_PROXY_ENDPOINT = '/api/proxy/plugin/mcp-catalog/backstage/api/catalog';

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
        // Construct URL with filters
        const url = new URL(`${CATALOG_PROXY_ENDPOINT}/entities`, window.location.origin);
        url.searchParams.append('filter', `kind=${kind}`);
        if (type) {
          url.searchParams.append('filter', `spec.type=${type}`);
        }
        if (namespace) {
          url.searchParams.append('filter', `metadata.namespace=${namespace}`);
        }

        const response = await fetch(url.toString(), {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
           if (response.status === 404) {
             console.warn(`Backstage Catalog proxy not found at ${CATALOG_PROXY_ENDPOINT}`);
             if (mounted) {
               setData([]);
               setLoaded(true);
             }
             return;
           }
           throw new Error(`Failed to fetch catalog entities: ${response.statusText}`);
        }
        
        const json = await response.json();
        const entities = Array.isArray(json) ? json : (json.items || []);
        
        if (mounted) {
          setData(entities as T[]);
          setLoaded(true);
        }
      } catch (err) {
        if (mounted) {
          console.error('Error fetching catalog data:', err);
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

export const useCatalogEntity = <T extends Entity>(
  kind: string,
  name: string,
  namespace: string = 'default'
): [T | null, boolean, Error | null] => {
  const [data, setData] = useState<T | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      try {
        const url = new URL(`${CATALOG_PROXY_ENDPOINT}/entities/by-name/${kind}/${namespace}/${name}`, window.location.origin);
        
        const response = await fetch(url.toString(), {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
           if (response.status === 404) {
             // Entity not found
             if (mounted) {
               setData(null);
               setLoaded(true);
             }
             return;
           }
           throw new Error(`Failed to fetch catalog entity: ${response.statusText}`);
        }
        
        const entity = await response.json();
        
        if (mounted) {
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
  }, [kind, name, namespace]);

  return [data, loaded, error];
};
