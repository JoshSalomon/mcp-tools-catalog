/**
 * Authorization service for MCP Catalog operations.
 * Provides role-based access control for entity modifications.
 */

import { useState, useEffect } from 'react';

/**
 * MCP Entity API proxy endpoint for permission checks.
 */
const MCP_ENTITY_API_ENDPOINT = '/api/proxy/plugin/mcp-catalog/backstage/api/mcp-entity-api';

/**
 * Authorization state for catalog edit operations.
 */
export interface CatalogAuthorizationState {
  /** Whether the user can edit catalog entities */
  canEdit: boolean;
  /** Whether the authorization check has completed */
  loaded: boolean;
  /** Current user name (if available) */
  userName?: string;
}

/**
 * Check permission for a specific entity type by calling the backend API.
 *
 * @param entityType - The MCP entity type to check (mcp-server, mcp-tool, mcp-workload, mcp-guardrail)
 * @returns Promise resolving to whether user can edit this entity type
 */
const checkEditPermission = async (entityType: string): Promise<boolean> => {
  try {
    const response = await fetch(`${MCP_ENTITY_API_ENDPOINT}/auth/can-edit/${entityType}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      // If endpoint fails, fail open for UX but backend will still enforce
      return true;
    }
    const data = await response.json();
    return data.canEdit === true;
  } catch {
    // If request fails, fail open for UX but backend will still enforce
    return true;
  }
};

/**
 * Hook to check if the current user can edit catalog entities (servers/tools).
 * Requires mcp-admin role for server/tool CRUD operations.
 */
export const useCanEditCatalog = (): CatalogAuthorizationState => {
  const [state, setState] = useState<CatalogAuthorizationState>({
    canEdit: false,
    loaded: false,
  });

  useEffect(() => {
    checkEditPermission('mcp-server').then((canEdit) => {
      setState({ canEdit, loaded: true });
    });
  }, []);

  return state;
};

/**
 * Hook to check if the current user can edit workloads.
 * Requires mcp-user role for workload CRUD operations.
 */
export const useCanEditWorkloads = (): CatalogAuthorizationState => {
  const [state, setState] = useState<CatalogAuthorizationState>({
    canEdit: false,
    loaded: false,
  });

  useEffect(() => {
    checkEditPermission('mcp-workload').then((canEdit) => {
      setState({ canEdit, loaded: true });
    });
  }, []);

  return state;
};

/**
 * Hook to check if the current user can edit guardrails.
 * Requires mcp-admin role for guardrail CRUD operations.
 */
export const useCanEditGuardrails = (): CatalogAuthorizationState => {
  const [state, setState] = useState<CatalogAuthorizationState>({
    canEdit: false,
    loaded: false,
  });

  useEffect(() => {
    checkEditPermission('mcp-guardrail').then((canEdit) => {
      setState({ canEdit, loaded: true });
    });
  }, []);

  return state;
};
