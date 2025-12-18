import React from 'react';
import { Card, CardContent, Typography, Chip, Box } from '@material-ui/core';
import { Entity } from '@backstage/catalog-model';

export interface McpServerCardProps {
  entity: Entity;
}

export const McpServerCard = ({ entity }: McpServerCardProps) => {
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
          <Chip label="MCP Server" size="small" />
        </Box>
      </CardContent>
    </Card>
  );
};