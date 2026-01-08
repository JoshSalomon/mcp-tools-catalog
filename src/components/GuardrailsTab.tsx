import * as React from 'react';
import { useHistory } from 'react-router-dom';
import {
  Bullseye,
  Spinner,
  EmptyState,
  EmptyStateBody,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  ToolbarGroup,
  SearchInput,
  Label,
  Button,
  Alert,
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td, ActionsColumn } from '@patternfly/react-table';
import { ShieldAltIcon, SearchIcon, PlusCircleIcon, UploadIcon } from '@patternfly/react-icons';
import { usePerformanceMonitor } from '../utils/performanceMonitor';
import { Pagination } from './shared/Pagination';
import { CatalogMcpGuardrail } from '../models/CatalogMcpGuardrail';
import {
  useGuardrails,
  previewGuardrailYaml,
  importGuardrailYaml,
  deleteGuardrail,
  updateGuardrail,
  GuardrailImportPreview,
  GuardrailImportResult,
} from '../services/catalogService';
import { useCanEditGuardrails } from '../services/authService';

interface GuardrailsTabProps {
  /** Initial search term from parent component */
  initialSearch?: string;
}

/**
 * Filter guardrails by search term.
 * Searches in name, namespace, description, and deployment fields.
 */
const filterGuardrails = (
  guardrails: CatalogMcpGuardrail[],
  searchTerm: string,
): CatalogMcpGuardrail[] => {
  if (!searchTerm) return guardrails;

  const lowerSearch = searchTerm.toLowerCase();
  return guardrails.filter((guardrail) => {
    const name = guardrail.metadata?.name?.toLowerCase() || '';
    const namespace = guardrail.metadata?.namespace?.toLowerCase() || '';
    const description = guardrail.metadata?.description?.toLowerCase() || '';
    const deployment = guardrail.spec?.deployment?.toLowerCase() || '';

    return (
      name.includes(lowerSearch) ||
      namespace.includes(lowerSearch) ||
      description.includes(lowerSearch) ||
      deployment.includes(lowerSearch)
    );
  });
};

const GuardrailsTab: React.FC<GuardrailsTabProps> = ({ initialSearch = '' }) => {
  const history = useHistory();
  const [searchTerm, setSearchTerm] = React.useState(initialSearch);
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(100);

  // Import state
  const [isImporting, setIsImporting] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);

  // Multi-import confirmation state
  const [importPreview, setImportPreview] = React.useState<{
    yamlContent: string;
    preview: GuardrailImportPreview;
  } | null>(null);

  // Delete state
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [guardrailToDelete, setGuardrailToDelete] = React.useState<CatalogMcpGuardrail | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Toggle enable/disable state
  const [toggleError, setToggleError] = React.useState<string | null>(null);
  const [isToggling, setIsToggling] = React.useState<string | null>(null); // stores guardrail key being toggled

  // Check if user has mcp-admin role for guardrails
  const { canEdit: canEditGuardrails, loaded: authLoaded } = useCanEditGuardrails();

  // Sync with parent search term
  React.useEffect(() => {
    setSearchTerm(initialSearch);
    setPage(1);
  }, [initialSearch]);

  const stopPerfMonitor = usePerformanceMonitor('GuardrailsTab');

  // Fetch guardrails from API
  const [allGuardrails, loaded, loadError] = useGuardrails();

  // Handle YAML file import - preview first, then confirm if multiple
  const handleImportClick = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.yaml,.yml';
    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setIsImporting(true);
        setImportError(null);
        try {
          const yamlContent = await file.text();

          // Preview first to check how many guardrails
          const preview = await previewGuardrailYaml(yamlContent);

          if (preview.count > 1) {
            // Multiple guardrails - show confirmation modal
            setImportPreview({ yamlContent, preview });
            setIsImporting(false);
          } else {
            // Single guardrail - proceed directly
            const result = await importGuardrailYaml(yamlContent);
            // Handle single guardrail result
            if ('metadata' in result) {
              history.push(
                `/mcp-catalog/guardrails/${result.metadata.name}?namespace=${
                  result.metadata.namespace || 'default'
                }`,
              );
            }
          }
        } catch (error) {
          setImportError(error instanceof Error ? error.message : 'Failed to import guardrail');
          setIsImporting(false);
        }
      }
    };
    fileInput.click();
  };

  // Handle confirmed multi-import
  const handleConfirmImport = async () => {
    if (!importPreview) return;

    setIsImporting(true);
    setImportError(null);
    try {
      const result = await importGuardrailYaml(importPreview.yamlContent);
      setImportPreview(null);

      // Handle multi-import result
      if ('imported' in result) {
        const importResult = result as GuardrailImportResult;
        if (importResult.failed > 0) {
          setImportError(
            `Imported ${importResult.imported} guardrail(s), ${
              importResult.failed
            } failed: ${importResult.errors.map((e) => e.name).join(', ')}`,
          );
        }
        // Refresh the list
        window.location.reload();
      } else {
        // Single result (shouldn't happen for multi-import, but handle it)
        history.push(
          `/mcp-catalog/guardrails/${result.metadata.name}?namespace=${
            result.metadata.namespace || 'default'
          }`,
        );
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to import guardrails');
    } finally {
      setIsImporting(false);
    }
  };

  // Handle edit guardrail - navigate to edit page
  const handleEditGuardrail = React.useCallback(
    (guardrail: CatalogMcpGuardrail) => {
      history.push(
        `/mcp-catalog/guardrails/${guardrail.metadata.name}/edit?namespace=${
          guardrail.metadata.namespace || 'default'
        }`,
      );
    },
    [history],
  );

  // Open delete confirmation modal
  const openDeleteModal = React.useCallback((guardrail: CatalogMcpGuardrail) => {
    setGuardrailToDelete(guardrail);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  }, []);

  // Handle delete guardrail (called from modal)
  const handleDeleteGuardrail = React.useCallback(async () => {
    if (!guardrailToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteGuardrail(
        guardrailToDelete.metadata.namespace || 'default',
        guardrailToDelete.metadata.name,
      );
      setIsDeleteModalOpen(false);
      setGuardrailToDelete(null);
      // Refresh the list by reloading
      window.location.reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete guardrail');
    } finally {
      setIsDeleting(false);
    }
  }, [guardrailToDelete]);

  // Close delete modal
  const closeDeleteModal = React.useCallback(() => {
    setIsDeleteModalOpen(false);
    setGuardrailToDelete(null);
    setDeleteError(null);
  }, []);

  // Handle toggle enable/disable
  const handleToggleDisabled = React.useCallback(async (guardrail: CatalogMcpGuardrail) => {
    const guardrailKey = `${guardrail.metadata.namespace || 'default'}/${guardrail.metadata.name}`;
    setIsToggling(guardrailKey);
    setToggleError(null);
    try {
      const newDisabledState = !guardrail.spec?.disabled;
      await updateGuardrail(guardrail.metadata.namespace || 'default', guardrail.metadata.name, {
        spec: { disabled: newDisabledState },
      });
      // Refresh the list
      window.location.reload();
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : 'Failed to update guardrail status');
      setIsToggling(null);
    }
  }, []);

  React.useEffect(() => {
    if (loaded) {
      stopPerfMonitor();
    }
  }, [loaded, stopPerfMonitor]);

  const filteredGuardrails = React.useMemo(() => {
    return filterGuardrails(allGuardrails || [], searchTerm);
  }, [allGuardrails, searchTerm]);

  const paginatedGuardrails = React.useMemo(() => {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return filteredGuardrails.slice(start, end);
  }, [filteredGuardrails, page, perPage]);

  const onSetPage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const onPerPageSelect = (_event: unknown, newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1);
  };

  if (!loaded) {
    return (
      <Bullseye>
        <Spinner size="xl" />
      </Bullseye>
    );
  }

  if (loadError) {
    return (
      <EmptyState icon={ShieldAltIcon}>
        <Title headingLevel="h2" size="lg">
          Error Loading Guardrails
        </Title>
        <EmptyStateBody>{loadError.message || 'Failed to load MCP guardrails.'}</EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <>
      {importError && (
        <Alert
          variant="danger"
          title="Import failed"
          isInline
          actionClose={
            <Button variant="plain" onClick={() => setImportError(null)}>
              Close
            </Button>
          }
          style={{ marginBottom: '1rem' }}
        >
          {importError}
        </Alert>
      )}

      {deleteError && (
        <Alert
          variant="danger"
          title="Delete failed"
          isInline
          actionClose={
            <Button variant="plain" onClick={() => setDeleteError(null)}>
              Close
            </Button>
          }
          style={{ marginBottom: '1rem' }}
        >
          {deleteError}
        </Alert>
      )}

      {toggleError && (
        <Alert
          variant="danger"
          title="Status update failed"
          isInline
          actionClose={
            <Button variant="plain" onClick={() => setToggleError(null)}>
              Close
            </Button>
          }
          style={{ marginBottom: '1rem' }}
        >
          {toggleError}
        </Alert>
      )}

      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <SearchInput
              placeholder="Find guardrail by name..."
              value={searchTerm}
              onChange={(_event, value) => {
                setSearchTerm(value);
                setPage(1);
              }}
              onClear={() => {
                setSearchTerm('');
                setPage(1);
              }}
              aria-label="Search MCP guardrails by name or description"
            />
          </ToolbarItem>
          {authLoaded && canEditGuardrails && (
            <ToolbarGroup>
              <ToolbarItem>
                <Button
                  variant="primary"
                  icon={<PlusCircleIcon />}
                  onClick={() => history.push('/mcp-catalog/guardrails/create')}
                >
                  Create Guardrail
                </Button>
              </ToolbarItem>
              <ToolbarItem>
                <Button
                  variant="secondary"
                  icon={<UploadIcon />}
                  onClick={handleImportClick}
                  isLoading={isImporting}
                  isDisabled={isImporting}
                >
                  Import YAML
                </Button>
              </ToolbarItem>
            </ToolbarGroup>
          )}
          <ToolbarItem variant="pagination">
            <Pagination
              itemCount={filteredGuardrails.length}
              page={page}
              perPage={perPage}
              onSetPage={onSetPage}
              onPerPageSelect={onPerPageSelect}
            />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {filteredGuardrails.length === 0 ? (
        <EmptyState icon={searchTerm ? SearchIcon : ShieldAltIcon}>
          <Title headingLevel="h2" size="lg">
            {searchTerm ? 'No results found' : 'No MCP Guardrails Found'}
          </Title>
          <EmptyStateBody>
            {searchTerm
              ? `No guardrails match "${searchTerm}"`
              : 'No MCP guardrails have been created yet.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label="MCP Guardrails Table" variant="compact">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Namespace</Th>
              <Th>Description</Th>
              <Th>Deployment</Th>
              <Th>Status</Th>
              {authLoaded && canEditGuardrails && <Th>Actions</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {paginatedGuardrails.map((guardrail, index) => {
              const isDisabled = guardrail.spec?.disabled === true;
              const rowStyle = isDisabled
                ? { opacity: 0.6, backgroundColor: '#f5f5f5' }
                : undefined;

              return (
                <Tr
                  key={`${guardrail.metadata.namespace}/${guardrail.metadata.name}-${index}`}
                  style={rowStyle}
                >
                  <Td dataLabel="Name">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        history.push(
                          `/mcp-catalog/guardrails/${guardrail.metadata.name}?namespace=${
                            guardrail.metadata.namespace || 'default'
                          }`,
                        );
                      }}
                    >
                      {guardrail.metadata.name}
                    </a>
                  </Td>
                  <Td dataLabel="Namespace">{guardrail.metadata.namespace || 'default'}</Td>
                  <Td dataLabel="Description">
                    {guardrail.metadata.description?.substring(0, 80)}
                    {guardrail.metadata.description?.length > 80 ? '...' : ''}
                  </Td>
                  <Td dataLabel="Deployment">
                    {guardrail.spec.deployment?.substring(0, 50)}
                    {guardrail.spec.deployment?.length > 50 ? '...' : ''}
                  </Td>
                  <Td dataLabel="Status">
                    <Label color={isDisabled ? 'grey' : 'green'}>
                      {isDisabled ? 'Disabled' : 'Enabled'}
                    </Label>
                  </Td>
                  {authLoaded && canEditGuardrails && (
                    <Td dataLabel="Actions">
                      <ActionsColumn
                        items={[
                          {
                            title: 'Edit',
                            onClick: () => handleEditGuardrail(guardrail),
                          },
                          {
                            title: isDisabled ? 'Enable' : 'Disable',
                            onClick: () => handleToggleDisabled(guardrail),
                            isDisabled:
                              isToggling ===
                              `${guardrail.metadata.namespace || 'default'}/${
                                guardrail.metadata.name
                              }`,
                          },
                          {
                            title: 'Delete',
                            onClick: () => openDeleteModal(guardrail),
                          },
                        ]}
                      />
                    </Td>
                  )}
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        variant={ModalVariant.medium}
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        aria-labelledby="delete-guardrail-title"
        aria-describedby="delete-guardrail-body"
      >
        <ModalHeader title="Delete Guardrail" labelId="delete-guardrail-title" />
        <ModalBody id="delete-guardrail-body">
          {deleteError && (
            <Alert variant="danger" title="Delete failed" isInline style={{ marginBottom: '1rem' }}>
              {deleteError}
            </Alert>
          )}
          <p style={{ marginBottom: '0.5rem' }}>
            Are you sure you want to delete the guardrail{' '}
            <strong>{guardrailToDelete?.metadata.name}</strong>?
          </p>
          <p style={{ color: '#6a6e73' }}>This action cannot be undone.</p>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="danger"
            onClick={handleDeleteGuardrail}
            isLoading={isDeleting}
            isDisabled={isDeleting}
          >
            Delete
          </Button>
          <Button variant="link" onClick={closeDeleteModal} isDisabled={isDeleting}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Multi-Import Confirmation Modal */}
      <Modal
        variant={ModalVariant.medium}
        isOpen={!!importPreview}
        onClose={() => setImportPreview(null)}
        aria-labelledby="import-guardrails-title"
        aria-describedby="import-guardrails-body"
      >
        <ModalHeader title="Import Multiple Guardrails" labelId="import-guardrails-title" />
        <ModalBody id="import-guardrails-body">
          <p style={{ marginBottom: '1rem' }}>
            You are about to import <strong>{importPreview?.preview.count}</strong> guardrails:
          </p>
          <ul style={{ margin: '0 0 1rem 1.5rem', padding: 0 }}>
            {importPreview?.preview.guardrails.map((g, index) => (
              <li key={`${g.namespace}-${g.name}-${index}`} style={{ marginBottom: '0.5rem' }}>
                <strong>{g.name}</strong>
                {g.namespace !== 'default' && (
                  <span style={{ color: '#6a6e73' }}> ({g.namespace})</span>
                )}
                {g.description && (
                  <span style={{ color: '#6a6e73', display: 'block', fontSize: '0.9em' }}>
                    {g.description.length > 80
                      ? `${g.description.substring(0, 80)}...`
                      : g.description}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p style={{ color: '#6a6e73' }}>Do you want to proceed with importing all guardrails?</p>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            onClick={handleConfirmImport}
            isLoading={isImporting}
            isDisabled={isImporting}
          >
            Import All
          </Button>
          <Button variant="link" onClick={() => setImportPreview(null)} isDisabled={isImporting}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default GuardrailsTab;
