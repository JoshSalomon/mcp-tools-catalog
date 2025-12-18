import React from 'react';
import { Grid, Typography } from '@material-ui/core';
import { InfoCard, Page, Header, Content } from '@backstage/core-components';

export const McpCatalogPage = () => {
  return (
    <Page themeId="tool">
      <Header title="MCP Tools Catalog" subtitle="Model Context Protocol Infrastructure" />
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <InfoCard title="Welcome to MCP Tools Catalog">
              <Typography>
                This is the main MCP catalog page. Full implementation coming in the next phases:
              </Typography>
              <ul>
                <li>Phase 3: Browse MCP Servers (User Story 1)</li>
                <li>Phase 4: Explore MCP Tools (User Story 2)</li>
                <li>Phase 5: Manage MCP Workloads (User Story 3)</li>
              </ul>
            </InfoCard>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};