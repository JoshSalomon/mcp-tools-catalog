import React from 'react';
import { Grid, Typography } from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';

export const McpWorkloadPage = () => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <InfoCard title="MCP Workload Details">
          <Typography>
            MCP Workload detail page - Implementation coming in Phase 5 (User Story 3)
          </Typography>
        </InfoCard>
      </Grid>
    </Grid>
  );
};