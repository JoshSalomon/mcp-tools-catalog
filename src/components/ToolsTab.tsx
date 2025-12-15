import * as React from 'react';
import {
  EmptyState,
  EmptyStateBody,
  Title,
} from '@patternfly/react-core';
import { WrenchIcon } from '@patternfly/react-icons';

/**
 * Tools Tab - Placeholder for now
 */
const ToolsTab: React.FC = () => {
  return (
    <EmptyState>
      <WrenchIcon />
      <Title headingLevel="h2" size="lg">
        MCP Tools
      </Title>
      <EmptyStateBody>
        Tools functionality will be implemented soon. This tab will display all MCP tools registered in the cluster.
      </EmptyStateBody>
    </EmptyState>
  );
};

export default ToolsTab;
