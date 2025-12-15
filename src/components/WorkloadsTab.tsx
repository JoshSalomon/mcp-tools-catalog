import * as React from 'react';
import {
  EmptyState,
  EmptyStateBody,
  Title,
} from '@patternfly/react-core';
import { ServerIcon } from '@patternfly/react-icons';

/**
 * Workloads Tab - Placeholder for now
 */
const WorkloadsTab: React.FC = () => {
  return (
    <EmptyState>
      <ServerIcon />
      <Title headingLevel="h2" size="lg">
        MCP Workloads
      </Title>
      <EmptyStateBody>
        Workloads functionality will be implemented soon. This tab will display all MCP workloads registered in the cluster.
      </EmptyStateBody>
    </EmptyState>
  );
};

export default WorkloadsTab;
