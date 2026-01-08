import * as React from 'react';
import { useHistory } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem } from '@patternfly/react-core';

/**
 * Breadcrumb item definition
 */
export interface BreadcrumbItemDef {
  /** Display label for the breadcrumb */
  label: string;
  /** URL path to navigate to (optional for last item) */
  path?: string;
}

/**
 * Props for the Breadcrumbs component
 */
interface BreadcrumbsProps {
  /** Array of breadcrumb items to display */
  items: BreadcrumbItemDef[];
}

/**
 * Breadcrumbs component for navigation within the MCP Catalog
 * Provides consistent breadcrumb navigation across detail pages.
 *
 * @example
 * ```tsx
 * <Breadcrumbs items={[
 *   { label: 'MCP Catalog', path: '/mcp-catalog' },
 *   { label: 'Servers', path: '/mcp-catalog?type=server' },
 *   { label: 'my-server' }
 * ]} />
 * ```
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  const history = useHistory();

  const handleClick = (path: string | undefined, e: React.MouseEvent) => {
    e.preventDefault();
    if (path) {
      history.push(path);
    }
  };

  return (
    <nav aria-label="Breadcrumb navigation">
      <Breadcrumb>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <BreadcrumbItem key={index} isActive={isLast}>
              {item.path && !isLast ? (
                <a
                  href="#"
                  onClick={(e) => handleClick(item.path, e)}
                  aria-label={`Navigate to ${item.label}`}
                >
                  {item.label}
                </a>
              ) : (
                <span aria-current={isLast ? 'page' : undefined}>{item.label}</span>
              )}
            </BreadcrumbItem>
          );
        })}
      </Breadcrumb>
    </nav>
  );
};

/**
 * Helper to create standard MCP Catalog breadcrumbs
 */
export const createMcpCatalogBreadcrumbs = (
  entityType: 'server' | 'tool' | 'workload' | 'guardrail',
  entityName: string,
): BreadcrumbItemDef[] => {
  const typeLabels: Record<string, string> = {
    server: 'Servers',
    tool: 'Tools',
    workload: 'Workloads',
    guardrail: 'Guardrails',
  };

  return [
    { label: 'MCP Catalog', path: '/mcp-catalog' },
    { label: typeLabels[entityType], path: `/mcp-catalog?type=${entityType}` },
    { label: entityName },
  ];
};
