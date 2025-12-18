import React from 'react';
import { Card, CardContent, Typography, Chip, Box } from '@material-ui/core';
import { Entity } from '@backstage/catalog-model';

export interface McpWorkloadCardProps {
  entity: Entity;
}

export const McpWorkloadCard = ({ entity }: McpWorkloadCardProps) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {entity.metadata.name}
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {entity.metadata.description || 'No description available'}
        </Typography>
        <Box mt={1}>
          <Chip label="MCP Workload" size="small" />
        </Box>
      </CardContent>
    </Card>
  );
};