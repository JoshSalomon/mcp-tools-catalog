import * as React from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import {
  PageSection,
  Title,
  Tabs,
  Tab,
  TabTitleText,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  ToolbarGroup,
  SearchInput,
  Label,
  LabelGroup,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { ServerIcon, WrenchIcon, CubeIcon } from '@patternfly/react-icons';
import ServersTab from './ServersTab';
import ToolsTab from './ToolsTab';
import WorkloadsTab from './WorkloadsTab';
import { ErrorBoundary } from './shared/ErrorBoundary';

/**
 * MCP Catalog Page
 * Displays the list of MCP servers, tools, and workloads with global search and entity type filters
 */
const McpCatalogPage: React.FC = () => {
  const location = useLocation();
  const history = useHistory();
  
  // Get active tab and search from URL query parameters
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('type') || 'server';
  const urlSearch = searchParams.get('search') || '';
  
  const [globalSearch, setGlobalSearch] = React.useState(urlSearch);
  
  // Update URL when search changes
  const updateSearch = (value: string) => {
    setGlobalSearch(value);
    const params = new URLSearchParams(location.search);
    if (value) {
      params.set('search', value);
    } else {
      params.delete('search');
    }
    history.replace(`/mcp-catalog?${params.toString()}`);
  };
  
  const handleTabClick = (_event: React.MouseEvent<HTMLElement, MouseEvent>, tabIndex: string | number) => {
    const tabMap: Record<string, string> = {
      '0': 'server',
      '1': 'tool',
      '2': 'workload',
    };
    const tabName = tabMap[String(tabIndex)] || 'server';
    const params = new URLSearchParams();
    params.set('type', tabName);
    if (globalSearch) {
      params.set('search', globalSearch);
    }
    history.push(`/mcp-catalog?${params.toString()}`);
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
  
  // Quick filter to switch to a specific entity type
  const handleTypeFilter = (type: 'server' | 'tool' | 'workload') => {
    const params = new URLSearchParams();
    params.set('type', type);
    if (globalSearch) {
      params.set('search', globalSearch);
    }
    history.push(`/mcp-catalog?${params.toString()}`);
  };

  return (
    <>
      <PageSection>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <Title headingLevel="h1" size="lg">
              MCP Tools Catalog
            </Title>
            <p>
              Browse and manage Model Context Protocol (MCP) servers, tools, and workloads.
            </p>
          </FlexItem>
        </Flex>
      </PageSection>
      
      <PageSection padding={{ default: 'noPadding' }}>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <SearchInput
                placeholder="Search across all entities..."
                value={globalSearch}
                onChange={(_event, value) => updateSearch(value)}
                onClear={() => updateSearch('')}
                aria-label="Global search"
              />
            </ToolbarItem>
            <ToolbarGroup variant="filter-group" aria-label="Entity type filters">
              <ToolbarItem>
                <LabelGroup categoryName="Filter by type" aria-label="Filter entities by type">
                  <Label
                    color={activeTab === 'server' ? 'blue' : 'grey'}
                    icon={<ServerIcon />}
                    onClick={() => handleTypeFilter('server')}
                    onKeyDown={(e) => e.key === 'Enter' && handleTypeFilter('server')}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={activeTab === 'server'}
                    aria-label="Filter by servers"
                  >
                    Servers
                  </Label>
                  <Label
                    color={activeTab === 'tool' ? 'blue' : 'grey'}
                    icon={<WrenchIcon />}
                    onClick={() => handleTypeFilter('tool')}
                    onKeyDown={(e) => e.key === 'Enter' && handleTypeFilter('tool')}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={activeTab === 'tool'}
                    aria-label="Filter by tools"
                  >
                    Tools
                  </Label>
                  <Label
                    color={activeTab === 'workload' ? 'blue' : 'grey'}
                    icon={<CubeIcon />}
                    onClick={() => handleTypeFilter('workload')}
                    onKeyDown={(e) => e.key === 'Enter' && handleTypeFilter('workload')}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={activeTab === 'workload'}
                    aria-label="Filter by workloads"
                  >
                    Workloads
                  </Label>
                </LabelGroup>
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
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
              <ErrorBoundary>
                <ServersTab initialSearch={globalSearch} />
              </ErrorBoundary>
            </PageSection>
          </Tab>
          <Tab eventKey={1} title={<TabTitleText>Tools</TabTitleText>}>
            <PageSection>
              <ErrorBoundary>
                <ToolsTab initialSearch={globalSearch} />
              </ErrorBoundary>
            </PageSection>
          </Tab>
          <Tab eventKey={2} title={<TabTitleText>Workloads</TabTitleText>}>
            <PageSection>
              <ErrorBoundary>
                <WorkloadsTab initialSearch={globalSearch} />
              </ErrorBoundary>
            </PageSection>
          </Tab>
        </Tabs>
      </PageSection>
    </>
  );
};

export default McpCatalogPage;
