/**
 * Hook for managing workload form state with validation.
 * Used for both creating and editing workloads.
 */

import { useState, useCallback, useEffect } from 'react';

/**
 * Form data for workload create/edit.
 */
export interface WorkloadFormData {
  /** Workload name (required) */
  name: string;
  /** Workload namespace (required) */
  namespace: string;
  /** Workload description (optional) */
  description?: string;
  /** Lifecycle stage (optional) */
  lifecycle?: string;
  /** Owner entity reference (optional) */
  owner?: string;
  /** Set of selected tool entity references (optional, can be empty) */
  selectedTools: Set<string>;
}

/**
 * Validation errors for workload form fields.
 */
export type WorkloadFormErrors = Record<string, string>;

/**
 * State and actions for workload form management.
 */
export interface WorkloadFormState {
  /** Current form data */
  formData: WorkloadFormData;
  /** Validation errors */
  errors: WorkloadFormErrors;
  /** Whether form has been modified */
  hasChanges: boolean;
  /** Original form data (for change detection) */
  originalData: WorkloadFormData | null;
  /** Update a form field */
  updateField: (field: keyof WorkloadFormData, value: any) => void;
  /** Toggle tool selection */
  toggleTool: (toolRef: string) => void;
  /** Validate the form */
  validate: () => boolean;
  /** Reset form to original data */
  reset: () => void;
  /** Check if form is valid */
  isValid: () => boolean;
}

/**
 * Hook to manage workload form state with validation.
 * 
 * @param initialData - Initial form data (for edit mode) or default values (for create mode)
 * @param isEditMode - Whether this is edit mode (affects change detection)
 * @returns State and actions for form management
 */
export const useWorkloadForm = (
  initialData?: Partial<WorkloadFormData>,
  isEditMode: boolean = false
): WorkloadFormState => {
  const defaultData: WorkloadFormData = {
    name: '',
    namespace: 'default',
    description: '',
    lifecycle: '',
    owner: '',
    selectedTools: new Set<string>(),
    ...initialData,
  };

  const [formData, setFormData] = useState<WorkloadFormData>(defaultData);
  const [originalData, setOriginalData] = useState<WorkloadFormData | null>(
    isEditMode ? { ...defaultData } : null
  );
  const [errors, setErrors] = useState<WorkloadFormErrors>({});

  // Update original data when initialData changes (e.g., when loading workload for edit)
  useEffect(() => {
    if (initialData && isEditMode) {
      const newData: WorkloadFormData = {
        name: initialData.name || '',
        namespace: initialData.namespace || 'default',
        description: initialData.description || '',
        lifecycle: initialData.lifecycle || '',
        owner: initialData.owner || '',
        selectedTools: initialData.selectedTools || new Set<string>(),
      };
      setFormData(newData);
      setOriginalData({ ...newData });
    }
  }, [initialData, isEditMode]);

  const updateField = useCallback((field: keyof WorkloadFormData, value: any) => {
    setFormData(prev => {
      const updated = { ...prev };
      if (field === 'selectedTools') {
        updated.selectedTools = value instanceof Set ? value : new Set(value);
      } else {
        (updated as any)[field] = value;
      }
      return updated;
    });
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  }, [errors]);

  const toggleTool = useCallback((toolRef: string) => {
    setFormData(prev => {
      const updated = { ...prev };
      const newSet = new Set(updated.selectedTools);
      if (newSet.has(toolRef)) {
        newSet.delete(toolRef);
      } else {
        newSet.add(toolRef);
      }
      updated.selectedTools = newSet;
      return updated;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: WorkloadFormErrors = {};

    // Required fields
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Name is required';
    }

    if (!formData.namespace || formData.namespace.trim() === '') {
      newErrors.namespace = 'Namespace is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const reset = useCallback(() => {
    if (originalData) {
      setFormData({ ...originalData });
    } else {
      setFormData(defaultData);
    }
    setErrors({});
  }, [originalData]);

  const isValid = useCallback((): boolean => {
    return formData.name.trim() !== '' && formData.namespace.trim() !== '';
  }, [formData]);

  // Detect changes (for edit mode)
  const hasChanges = useCallback((): boolean => {
    if (!isEditMode || !originalData) {
      return formData.name !== '' || formData.namespace !== '';
    }

    return (
      formData.name !== originalData.name ||
      formData.namespace !== originalData.namespace ||
      formData.description !== originalData.description ||
      formData.lifecycle !== originalData.lifecycle ||
      formData.owner !== originalData.owner ||
      JSON.stringify(Array.from(formData.selectedTools).sort()) !==
        JSON.stringify(Array.from(originalData.selectedTools).sort())
    );
  }, [formData, originalData, isEditMode]);

  return {
    formData,
    errors,
    hasChanges: hasChanges(),
    originalData,
    updateField,
    toggleTool,
    validate,
    reset,
    isValid,
  };
};
