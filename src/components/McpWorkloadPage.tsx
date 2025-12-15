import * as React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  PageSection,
  Title,
  EmptyState,
  EmptyStateBody,
} from '@patternfly/react-core';
import { CubeIcon } from '@patternfly/react-icons';

/**
 * MCP Workload Detail Page for OpenShift Console
 */
const McpWorkloadPage: React.FC = () => {
  const params = useParams<{ name: string }>();
  const location = useLocation();
  
  // OpenShift Console dynamic plugins may not populate useParams correctly
  // Extract name from pathname as fallback: /mcp-catalog/workloads/:name
  const extractNameFromPath = (pathname: string): string => {
    const match = pathname.match(/\/mcp-catalog\/workloads\/([^/?]+)/);
    return match ? match[1] : '';
  };
  
  const name = params.name || extractNameFromPath(location.pathname);

  return (
    <PageSection>
      <EmptyState icon={CubeIcon}>
        <Title headingLevel="h1" size="lg">
          MCP Workload: {name || 'Unknown'}
        </Title>
        <EmptyStateBody>
          This page will display detailed information about the MCP workload including:
          <ul>
            <li>Deployment status and pod information</li>
            <li>MCP server connections and dependencies</li>
            <li>Resource usage and metrics</li>
            <li>Logs and troubleshooting information</li>
          </ul>
        </EmptyStateBody>
      </EmptyState>
    </PageSection>
  );
};

export default McpWorkloadPage;
