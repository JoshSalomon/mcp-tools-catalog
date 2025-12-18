import React from 'react';
import { Grid, Typography } from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';

export const McpToolPage = () => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <InfoCard title="MCP Tool Details">
          <Typography>
            MCP Tool detail page - Implementation coming in Phase 4 (User Story 2)
          </Typography>
        </InfoCard>
      </Grid>
    </Grid>
  );
};