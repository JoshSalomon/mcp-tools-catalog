/**
 * WorkloadForm component for creating and editing workloads.
 * Provides metadata input fields and server/tool tree selection.
 */

import * as React from 'react';
import {
  Form,
  FormGroup,
  TextInput,
  TextArea,
  FormSelect,
  FormSelectOption,
  Button,
  Alert,
  Card,
  CardBody,
  Title,
  TreeView,
  TreeViewDataItem,
  Checkbox,
  Label,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { CheckCircleIcon, TimesCircleIcon, ServerIcon, WrenchIcon } from '@patternfly/react-icons';
import { CatalogMcpServer } from '../models/CatalogMcpServer';
import { CatalogMcpTool, isToolDisabled } from '../models/CatalogMcpTool';
import { CatalogMcpWorkload } from '../models/CatalogMcpWorkload';
import { useWorkloadForm, WorkloadFormData } from '../hooks/useWorkloadForm';
import { filterToolsByServer } from '../services/searchService';

interface WorkloadFormProps {
  /** Initial workload data (for edit mode) */
  initialWorkload?: CatalogMcpWorkload;
  /** All available servers */
  servers: CatalogMcpServer[];
  /** All available tools */
  tools: CatalogMcpTool[];
  /** Callback when save is clicked */
  onSave: (formData: WorkloadFormData) => Promise<void>;
  /** Callback when cancel is clicked */
  onCancel: () => void;
  /** Whether this is edit mode */
  isEditMode?: boolean;
}

/**
 * Component for creating or editing workloads.
 * Includes metadata fields and server/tool tree selection.
 */
export const WorkloadForm: React.FC<WorkloadFormProps> = ({
  initialWorkload,
  servers,
  tools,
  onSave,
  onCancel,
  isEditMode = false,
}) => {
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<Error | null>(null);
  const [expandedServers, setExpandedServers] = React.useState<Set<string>>(new Set());

  // Initialize form data from workload (for edit mode)
  const initialFormData: Partial<WorkloadFormData> = React.useMemo(() => {
    if (!initialWorkload) {
      return {};
    }

    // Extract tool references from workload
    const toolRefs = new Set<string>();
    if (initialWorkload.spec.dependsOn) {
      initialWorkload.spec.dependsOn.forEach((ref: string) => toolRefs.add(ref));
    }
    if ((initialWorkload.spec as any).consumes) {
      const consumes = (initialWorkload.spec as any).consumes as string[];
      consumes.forEach((ref: string) => {
        toolRefs.add(ref);
      });
    }

    return {
      name: initialWorkload.metadata.name,
      namespace: initialWorkload.metadata.namespace || 'default',
      description: initialWorkload.metadata.description || '',
      lifecycle: initialWorkload.spec.lifecycle || '',
      owner: initialWorkload.spec.owner || '',
      selectedTools: toolRefs,
    };
  }, [initialWorkload]);

  const formState = useWorkloadForm(initialFormData, isEditMode);

  // Build server/tool tree data
  const treeData = React.useMemo((): TreeViewDataItem[] => {
    const serverNodes: TreeViewDataItem[] = servers.map((server) => {
      const serverTools = filterToolsByServer(tools, server.metadata.name);
      const toolNodes: TreeViewDataItem[] = serverTools.map((tool) => {
        const toolRef = `component:${tool.metadata.namespace || 'default'}/${tool.metadata.name}`;
        const isSelected = formState.formData.selectedTools.has(toolRef);
        const isDisabled = isToolDisabled(tool);

        return {
          name: (
            <Flex
              alignItems={{ default: 'alignItemsCenter' }}
              spaceItems={{ default: 'spaceItemsSm' }}
            >
              <FlexItem>
                <Checkbox
                  id={`tool-${tool.metadata.name}`}
                  isChecked={isSelected}
                  isDisabled={isDisabled}
                  onChange={() => {
                    if (!isDisabled) {
                      formState.toggleTool(toolRef);
                    }
                  }}
                  label={tool.metadata.name}
                  aria-label={`Select tool ${tool.metadata.name}`}
                />
              </FlexItem>
              {isDisabled && (
                <FlexItem>
                  <Label color="orange" isCompact>
                    Disabled
                  </Label>
                </FlexItem>
              )}
            </Flex>
          ),
          id: `tool-${tool.metadata.name}`,
          icon: <WrenchIcon />,
        };
      });

      return {
        name: server.metadata.name,
        id: `server-${server.metadata.name}`,
        icon: <ServerIcon />,
        children: toolNodes.length > 0 ? toolNodes : undefined,
        defaultExpanded: expandedServers.has(server.metadata.name),
      };
    });

    return serverNodes;
  }, [servers, tools, formState.formData.selectedTools, expandedServers, formState]);

  // Handle expand/collapse
  const handleToggle = React.useCallback((_event: React.MouseEvent, item: TreeViewDataItem) => {
    if (item.id && item.id.startsWith('server-')) {
      const serverName = item.id.replace('server-', '');
      setExpandedServers((prev) => {
        const updated = new Set(prev);
        if (updated.has(serverName)) {
          updated.delete(serverName);
        } else {
          updated.add(serverName);
        }
        return updated;
      });
    }
  }, []);

  // Handle save
  const handleSave = React.useCallback(async () => {
    if (!formState.validate()) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(formState.formData);
      // Navigation will be handled by parent component
    } catch (err) {
      setSaveError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsSaving(false);
    }
  }, [formState, onSave]);

  // Handle cancel
  const handleCancel = React.useCallback(() => {
    formState.reset();
    onCancel();
  }, [formState, onCancel]);

  return (
    <Form>
      {/* Error display */}
      {saveError && (
        <Alert
          variant="danger"
          title="Failed to save workload"
          isInline
          actionClose={
            <Button variant="plain" onClick={() => setSaveError(null)}>
              ×
            </Button>
          }
          style={{ marginBottom: '1rem' }}
        >
          {saveError.message}
        </Alert>
      )}

      {/* Metadata fields */}
      <Card style={{ marginBottom: '1rem' }}>
        <CardBody>
          <Title headingLevel="h3" size="md" style={{ marginBottom: '1rem' }}>
            Workload Metadata
          </Title>

          <FormGroup label="Name" isRequired fieldId="workload-name">
            <TextInput
              id="workload-name"
              value={formState.formData.name}
              onChange={(_event, value) => formState.updateField('name', value)}
              isRequired
              validated={formState.errors.name ? 'error' : 'default'}
              aria-label="Workload name"
            />
            {isEditMode && !formState.errors.name && (
              <div style={{ color: '#6a6e73', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Changing the name will rename the workload
              </div>
            )}
            {formState.errors.name && (
              <div style={{ color: '#c9190b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {formState.errors.name}
              </div>
            )}
          </FormGroup>

          <FormGroup label="Namespace" isRequired fieldId="workload-namespace">
            <TextInput
              id="workload-namespace"
              value={formState.formData.namespace}
              onChange={(_event, value) => formState.updateField('namespace', value)}
              isRequired
              validated={formState.errors.namespace ? 'error' : 'default'}
              aria-label="Workload namespace"
            />
            {formState.errors.namespace && (
              <div style={{ color: '#c9190b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {formState.errors.namespace}
              </div>
            )}
          </FormGroup>

          <FormGroup label="Description" fieldId="workload-description">
            <TextArea
              id="workload-description"
              value={formState.formData.description || ''}
              onChange={(_event, value) => formState.updateField('description', value)}
              aria-label="Workload description"
            />
          </FormGroup>

          <FormGroup label="Lifecycle" fieldId="workload-lifecycle">
            <FormSelect
              id="workload-lifecycle"
              value={formState.formData.lifecycle || ''}
              onChange={(_event, value) => formState.updateField('lifecycle', value)}
              aria-label="Workload lifecycle"
            >
              <FormSelectOption value="" label="Select lifecycle..." />
              <FormSelectOption value="experimental" label="Experimental" />
              <FormSelectOption value="production" label="Production" />
              <FormSelectOption value="deprecated" label="Deprecated" />
            </FormSelect>
          </FormGroup>

          <FormGroup label="Owner" fieldId="workload-owner">
            <TextInput
              id="workload-owner"
              value={formState.formData.owner || ''}
              onChange={(_event, value) => formState.updateField('owner', value)}
              placeholder="user:default/admin"
              aria-label="Workload owner"
            />
          </FormGroup>
        </CardBody>
      </Card>

      {/* Server/Tool tree */}
      <Card style={{ marginBottom: '1rem' }}>
        <CardBody>
          <Title headingLevel="h3" size="md" style={{ marginBottom: '1rem' }}>
            Select Tools
          </Title>

          {servers.length === 0 ? (
            <EmptyState variant="xs">
              <Title headingLevel="h4" size="md">
                No servers available
              </Title>
              <EmptyStateBody>
                No MCP servers are available in the catalog. Create a server first.
              </EmptyStateBody>
            </EmptyState>
          ) : (
            <TreeView
              data={treeData}
              hasGuides
              hasSelectableNodes={false}
              onSelect={handleToggle}
              aria-label="Server and tool selection tree"
            />
          )}

          {formState.formData.selectedTools.size > 0 && (
            <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6a6e73' }}>
              {formState.formData.selectedTools.size} tool
              {formState.formData.selectedTools.size !== 1 ? 's' : ''} selected
            </div>
          )}
        </CardBody>
      </Card>

      {/* Save/Cancel buttons */}
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsMd' }}>
        <FlexItem>
          <Button
            variant="primary"
            onClick={handleSave}
            isDisabled={!formState.isValid() || isSaving}
            icon={isSaving ? undefined : <CheckCircleIcon />}
            isLoading={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </FlexItem>
        <FlexItem>
          <Button
            variant="secondary"
            onClick={handleCancel}
            isDisabled={isSaving}
            icon={<TimesCircleIcon />}
          >
            Cancel
          </Button>
        </FlexItem>
        {formState.hasChanges && (
          <FlexItem>
            <span style={{ fontSize: '0.875rem', color: '#6a6e73' }}>Unsaved changes</span>
          </FlexItem>
        )}
      </Flex>
    </Form>
  );
};

export default WorkloadForm;
