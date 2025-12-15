import * as React from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import {
  PageSection,
  Title,
  Tabs,
  Tab,
  TabTitleText,
} from '@patternfly/react-core';
import ServersTab from './ServersTab';
import ToolsTab from './ToolsTab';
import WorkloadsTab from './WorkloadsTab';

/**
 * MCP Catalog Page
 * Displays the list of MCP servers, tools, and workloads
 */
const McpCatalogPage: React.FC = () => {
  const location = useLocation();
  const history = useHistory();
  
  // Get active tab from URL query parameter
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('type') || 'server';
  
  const handleTabClick = (_event: React.MouseEvent<HTMLElement, MouseEvent>, tabIndex: string | number) => {
    const tabMap: Record<string, string> = {
      '0': 'server',
      '1': 'tool',
      '2': 'workload',
    };
    const tabName = tabMap[String(tabIndex)] || 'server';
    history.push(`/mcp-catalog?type=${tabName}`);
  };

  const getActiveTabIndex = (): number => {
    switch (activeTab) {
      case 'server':
        return 0;
      case 'tool':
        return 1;
      case 'workload':
        return 2;
      default:
        return 0;
    }
  };

  return (
    <>
      <PageSection>
        <Title headingLevel="h1" size="lg">
          MCP Tools Catalog
        </Title>
        <p>
          Browse and manage Model Context Protocol (MCP) servers, tools, and workloads.
        </p>
      </PageSection>
      <PageSection padding={{ default: 'noPadding' }}>
        <Tabs
          activeKey={getActiveTabIndex()}
          onSelect={handleTabClick}
          aria-label="MCP Catalog Tabs"
          role="region"
        >
          <Tab eventKey={0} title={<TabTitleText>Servers</TabTitleText>}>
            <PageSection>
              <ServersTab />
            </PageSection>
          </Tab>
          <Tab eventKey={1} title={<TabTitleText>Tools</TabTitleText>}>
            <PageSection>
              <ToolsTab />
            </PageSection>
          </Tab>
          <Tab eventKey={2} title={<TabTitleText>Workloads</TabTitleText>}>
            <PageSection>
              <WorkloadsTab />
            </PageSection>
          </Tab>
        </Tabs>
      </PageSection>
    </>
  );
};

export default McpCatalogPage;
