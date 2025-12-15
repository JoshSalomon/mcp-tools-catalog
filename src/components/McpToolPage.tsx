import * as React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  PageSection,
  Title,
  EmptyState,
  EmptyStateBody,
} from '@patternfly/react-core';
import { WrenchIcon } from '@patternfly/react-icons';

/**
 * MCP Tool Detail Page for OpenShift Console
 */
const McpToolPage: React.FC = () => {
  const params = useParams<{ name: string }>();
  const location = useLocation();
  
  // OpenShift Console dynamic plugins may not populate useParams correctly
  // Extract name from pathname as fallback: /mcp-catalog/tools/:name
  const extractNameFromPath = (pathname: string): string => {
    const match = pathname.match(/\/mcp-catalog\/tools\/([^/?]+)/);
    return match ? match[1] : '';
  };
  
  const name = params.name || extractNameFromPath(location.pathname);

  return (
    <PageSection>
      <EmptyState icon={WrenchIcon}>
        <Title headingLevel="h1" size="lg">
          MCP Tool: {name || 'Unknown'}
        </Title>
        <EmptyStateBody>
          This page will display detailed information about the MCP tool including:
          <ul>
            <li>Tool description and usage instructions</li>
            <li>Input schema and parameters</li>
            <li>Providing MCP server</li>
            <li>Integration examples and documentation</li>
          </ul>
        </EmptyStateBody>
      </EmptyState>
    </PageSection>
  );
};

export default McpToolPage;
