import * as React from 'react';
import { Pagination as PfPagination, PaginationVariant } from '@patternfly/react-core';

interface PaginationProps {
  itemCount: number;
  page: number;
  perPage: number;
  onSetPage: (_event: React.MouseEvent | React.KeyboardEvent | MouseEvent, newPage: number) => void;
  onPerPageSelect: (
    _event: React.MouseEvent | React.KeyboardEvent | MouseEvent,
    newPerPage: number,
  ) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  itemCount,
  page,
  perPage,
  onSetPage,
  onPerPageSelect,
}) => {
  return (
    <PfPagination
      itemCount={itemCount}
      page={page}
      perPage={perPage}
      onSetPage={onSetPage}
      onPerPageSelect={onPerPageSelect}
      variant={PaginationVariant.top}
      isCompact
    />
  );
};
