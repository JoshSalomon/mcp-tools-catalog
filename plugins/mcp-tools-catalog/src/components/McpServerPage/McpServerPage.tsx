import React from 'react';
import { Grid, Typography } from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';

export const McpServerPage = () => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <InfoCard title="MCP Server Details">
          <Typography>
            MCP Server detail page - Implementation coming in Phase 3 (User Story 1)
          </Typography>
        </InfoCard>
      </Grid>
    </Grid>
  );
};