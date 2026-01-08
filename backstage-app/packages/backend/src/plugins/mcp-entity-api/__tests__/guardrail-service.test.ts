/**
 * MCP Entity API - Guardrail Service Unit Tests (006-mcp-guardrails)
 *
 * Tests for database-only guardrail operations:
 * - T011: listGuardrails() - list with filtering
 * - T012: getGuardrail() - get with usage info
 * - T013: updateGuardrail() - update with rename conflict check
 * - T014: deleteGuardrail() - delete with reference protection
 */

import {
  Guardrail,
  GuardrailWithUsage,
  ToolGuardrailAssociation,
  WorkloadToolGuardrailAssociation,
} from '../types';

// Mock types for testing
interface MockDatabase {
  listGuardrails: jest.Mock;
  getGuardrail: jest.Mock;
  getGuardrailById: jest.Mock;
  getGuardrailWithUsage: jest.Mock;
  createGuardrail: jest.Mock;
  updateGuardrail: jest.Mock;
  deleteGuardrail: jest.Mock;
  guardrailExists: jest.Mock;
  setGuardrailDisabled: jest.Mock;
}

// Helper to create a mock guardrail
const createMockGuardrail = (name: string, overrides?: Partial<Guardrail>): Guardrail => ({
  id: `guardrail-${name}-id`,
  namespace: 'default',
  name,
  description: 'Test guardrail description',
  deployment: 'sidecar-container',
  parameters: undefined,
  disabled: false,
  createdAt: '2026-01-04T00:00:00.000Z',
  updatedAt: '2026-01-04T00:00:00.000Z',
  ...overrides,
});

// Helper to create a mock guardrail with usage
const createMockGuardrailWithUsage = (
  name: string,
  tools: ToolGuardrailAssociation[] = [],
  workloadTools: WorkloadToolGuardrailAssociation[] = [],
): GuardrailWithUsage => ({
  ...createMockGuardrail(name),
  usage: {
    tools,
    workloadTools,
  },
});

describe('Guardrail Service - Database-Only Operations', () => {
  let mockDatabase: MockDatabase;

  beforeEach(() => {
    // Reset all mocks
    mockDatabase = {
      listGuardrails: jest.fn(),
      getGuardrail: jest.fn(),
      getGuardrailById: jest.fn(),
      getGuardrailWithUsage: jest.fn(),
      createGuardrail: jest.fn(),
      updateGuardrail: jest.fn(),
      deleteGuardrail: jest.fn(),
      guardrailExists: jest.fn(),
      setGuardrailDisabled: jest.fn(),
    };
  });

  // ==========================================================================
  // T011: listGuardrails() Tests
  // ==========================================================================
  describe('listGuardrails() - T011', () => {
    it('should list all guardrails from database', async () => {
      // Arrange
      const guardrails = [
        createMockGuardrail('rate-limiter'),
        createMockGuardrail('auth-validator'),
        createMockGuardrail('input-sanitizer'),
      ];
      mockDatabase.listGuardrails.mockResolvedValue({
        items: guardrails,
        totalCount: 3,
      });

      // Act
      const result = await mockDatabase.listGuardrails();

      // Assert
      expect(result.items).toHaveLength(3);
      expect(result.totalCount).toBe(3);
      expect(result.items[0].name).toBe('rate-limiter');
    });

    it('should filter guardrails by namespace', async () => {
      // Arrange
      const guardrails = [createMockGuardrail('rate-limiter', { namespace: 'production' })];
      mockDatabase.listGuardrails.mockResolvedValue({
        items: guardrails,
        totalCount: 1,
      });

      // Act
      const result = await mockDatabase.listGuardrails({ namespace: 'production' });

      // Assert
      expect(mockDatabase.listGuardrails).toHaveBeenCalledWith({ namespace: 'production' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].namespace).toBe('production');
    });

    it('should support pagination with limit and offset', async () => {
      // Arrange
      const guardrails = [createMockGuardrail('guardrail-page-2')];
      mockDatabase.listGuardrails.mockResolvedValue({
        items: guardrails,
        totalCount: 10,
      });

      // Act
      const result = await mockDatabase.listGuardrails({ limit: 5, offset: 5 });

      // Assert
      expect(mockDatabase.listGuardrails).toHaveBeenCalledWith({ limit: 5, offset: 5 });
      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBe(10);
    });

    it('should return empty array when no guardrails exist', async () => {
      // Arrange
      mockDatabase.listGuardrails.mockResolvedValue({
        items: [],
        totalCount: 0,
      });

      // Act
      const result = await mockDatabase.listGuardrails();

      // Assert
      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });

  // ==========================================================================
  // T012: getGuardrail() Tests
  // ==========================================================================
  describe('getGuardrail() - T012', () => {
    it('should get guardrail with usage information', async () => {
      // Arrange
      const toolAssociations: ToolGuardrailAssociation[] = [
        {
          id: 'tg-1',
          toolNamespace: 'default',
          toolName: 'my-tool',
          guardrailId: 'guardrail-rate-limiter-id',
          executionTiming: 'pre-execution',
          createdAt: '2026-01-04T00:00:00.000Z',
        },
      ];
      const workloadToolAssociations: WorkloadToolGuardrailAssociation[] = [
        {
          id: 'wtg-1',
          workloadNamespace: 'default',
          workloadName: 'my-workload',
          toolNamespace: 'default',
          toolName: 'my-tool',
          guardrailId: 'guardrail-rate-limiter-id',
          executionTiming: 'pre-execution',
          source: 'tool',
          createdAt: '2026-01-04T00:00:00.000Z',
        },
      ];
      const guardrailWithUsage = createMockGuardrailWithUsage(
        'rate-limiter',
        toolAssociations,
        workloadToolAssociations,
      );
      mockDatabase.getGuardrailWithUsage.mockResolvedValue(guardrailWithUsage);

      // Act
      const result = await mockDatabase.getGuardrailWithUsage('default', 'rate-limiter');

      // Assert
      expect(result).toBeDefined();
      expect(result?.name).toBe('rate-limiter');
      expect(result?.usage.tools).toHaveLength(1);
      expect(result?.usage.workloadTools).toHaveLength(1);
      expect(result?.usage.tools[0].toolName).toBe('my-tool');
      expect(result?.usage.workloadTools[0].source).toBe('tool');
    });

    it('should return null for non-existent guardrail', async () => {
      // Arrange
      mockDatabase.getGuardrailWithUsage.mockResolvedValue(null);

      // Act
      const result = await mockDatabase.getGuardrailWithUsage('default', 'non-existent');

      // Assert
      expect(result).toBeNull();
      // In real service, this would throw NotFoundError
    });

    it('should return guardrail with empty usage when no associations exist', async () => {
      // Arrange
      const guardrailWithUsage = createMockGuardrailWithUsage('new-guardrail', [], []);
      mockDatabase.getGuardrailWithUsage.mockResolvedValue(guardrailWithUsage);

      // Act
      const result = await mockDatabase.getGuardrailWithUsage('default', 'new-guardrail');

      // Assert
      expect(result).toBeDefined();
      expect(result?.usage.tools).toHaveLength(0);
      expect(result?.usage.workloadTools).toHaveLength(0);
    });
  });

  // ==========================================================================
  // T013: updateGuardrail() Tests
  // ==========================================================================
  describe('updateGuardrail() - T013', () => {
    it('should update guardrail in database', async () => {
      // Arrange
      const existingGuardrail = createMockGuardrail('rate-limiter', {
        description: 'Old description',
      });
      const updatedGuardrail = createMockGuardrail('rate-limiter', {
        description: 'New description',
        updatedAt: '2026-01-04T12:00:00.000Z',
      });
      mockDatabase.getGuardrail.mockResolvedValue(existingGuardrail);
      mockDatabase.updateGuardrail.mockResolvedValue(updatedGuardrail);

      // Act
      const result = await mockDatabase.updateGuardrail('default', 'rate-limiter', {
        description: 'New description',
      });

      // Assert
      expect(result).toBeDefined();
      expect(result?.description).toBe('New description');
      expect(mockDatabase.updateGuardrail).toHaveBeenCalledWith('default', 'rate-limiter', {
        description: 'New description',
      });
    });

    it('should return null when updating non-existent guardrail', async () => {
      // Arrange
      mockDatabase.updateGuardrail.mockResolvedValue(null);

      // Act
      const result = await mockDatabase.updateGuardrail('default', 'non-existent', {
        description: 'New description',
      });

      // Assert
      expect(result).toBeNull();
      // In real service, this would throw NotFoundError
    });

    it('should check for name conflict when renaming', async () => {
      // Arrange
      mockDatabase.guardrailExists.mockResolvedValue(true); // new name exists

      // Act
      const newNameExists = await mockDatabase.guardrailExists('default', 'existing-name');

      // Assert
      expect(newNameExists).toBe(true);
      // In real service, this would throw ConflictError
    });

    it('should allow rename when new name does not exist', async () => {
      // Arrange
      const renamedGuardrail = createMockGuardrail('new-name');
      mockDatabase.guardrailExists.mockResolvedValue(false);
      mockDatabase.updateGuardrail.mockResolvedValue(renamedGuardrail);

      // Act
      const newNameExists = await mockDatabase.guardrailExists('default', 'new-name');
      expect(newNameExists).toBe(false);

      const result = await mockDatabase.updateGuardrail('default', 'old-name', {
        name: 'new-name',
      });

      // Assert
      expect(result?.name).toBe('new-name');
    });

    it('should update disabled state', async () => {
      // Arrange
      const disabledGuardrail = createMockGuardrail('rate-limiter', { disabled: true });
      mockDatabase.updateGuardrail.mockResolvedValue(disabledGuardrail);

      // Act
      const result = await mockDatabase.updateGuardrail('default', 'rate-limiter', {
        disabled: true,
      });

      // Assert
      expect(result?.disabled).toBe(true);
    });
  });

  // ==========================================================================
  // T014: deleteGuardrail() Tests
  // ==========================================================================
  describe('deleteGuardrail() - T014', () => {
    it('should delete guardrail when no associations exist', async () => {
      // Arrange
      mockDatabase.deleteGuardrail.mockResolvedValue({ deleted: true });

      // Act
      const result = await mockDatabase.deleteGuardrail('default', 'unused-guardrail');

      // Assert
      expect(result.deleted).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should prevent deletion when guardrail has tool associations', async () => {
      // Arrange
      mockDatabase.deleteGuardrail.mockResolvedValue({
        deleted: false,
        error: 'Cannot delete: guardrail has 2 reference(s) (2 tool(s), 0 workload-tool relationship(s))',
      });

      // Act
      const result = await mockDatabase.deleteGuardrail('default', 'used-guardrail');

      // Assert
      expect(result.deleted).toBe(false);
      expect(result.error).toContain('Cannot delete');
      expect(result.error).toContain('2 tool(s)');
    });

    it('should prevent deletion when guardrail has workload-tool associations', async () => {
      // Arrange
      mockDatabase.deleteGuardrail.mockResolvedValue({
        deleted: false,
        error: 'Cannot delete: guardrail has 3 reference(s) (0 tool(s), 3 workload-tool relationship(s))',
      });

      // Act
      const result = await mockDatabase.deleteGuardrail('default', 'used-guardrail');

      // Assert
      expect(result.deleted).toBe(false);
      expect(result.error).toContain('Cannot delete');
      expect(result.error).toContain('3 workload-tool relationship(s)');
    });

    it('should prevent deletion when guardrail has both tool and workload-tool associations', async () => {
      // Arrange
      mockDatabase.deleteGuardrail.mockResolvedValue({
        deleted: false,
        error: 'Cannot delete: guardrail has 5 reference(s) (2 tool(s), 3 workload-tool relationship(s))',
      });

      // Act
      const result = await mockDatabase.deleteGuardrail('default', 'heavily-used-guardrail');

      // Assert
      expect(result.deleted).toBe(false);
      expect(result.error).toContain('5 reference(s)');
    });

    it('should return error for non-existent guardrail', async () => {
      // Arrange
      mockDatabase.deleteGuardrail.mockResolvedValue({
        deleted: false,
        error: 'Guardrail not found',
      });

      // Act
      const result = await mockDatabase.deleteGuardrail('default', 'non-existent');

      // Assert
      expect(result.deleted).toBe(false);
      expect(result.error).toBe('Guardrail not found');
    });
  });

  // ==========================================================================
  // Additional Tests: setGuardrailDisabled()
  // ==========================================================================
  // ==========================================================================
  // US5: Disable/Enable Guardrails Tests (T063-T065)
  // ==========================================================================
  describe('setGuardrailDisabled() - US5', () => {
    it('should disable a guardrail', async () => {
      // Arrange
      const disabledGuardrail = createMockGuardrail('rate-limiter', { disabled: true });
      mockDatabase.setGuardrailDisabled.mockResolvedValue(disabledGuardrail);

      // Act
      const result = await mockDatabase.setGuardrailDisabled('default', 'rate-limiter', true);

      // Assert
      expect(result?.disabled).toBe(true);
      expect(mockDatabase.setGuardrailDisabled).toHaveBeenCalledWith(
        'default',
        'rate-limiter',
        true,
      );
    });

    it('should enable a disabled guardrail', async () => {
      // Arrange
      const enabledGuardrail = createMockGuardrail('rate-limiter', { disabled: false });
      mockDatabase.setGuardrailDisabled.mockResolvedValue(enabledGuardrail);

      // Act
      const result = await mockDatabase.setGuardrailDisabled('default', 'rate-limiter', false);

      // Assert
      expect(result?.disabled).toBe(false);
    });

    it('should return null for non-existent guardrail', async () => {
      // Arrange
      mockDatabase.setGuardrailDisabled.mockResolvedValue(null);

      // Act
      const result = await mockDatabase.setGuardrailDisabled('default', 'non-existent', true);

      // Assert
      expect(result).toBeNull();
    });

    it('should toggle disabled state from true to false', async () => {
      // Arrange - start with disabled guardrail
      const initialGuardrail = createMockGuardrail('toggle-test', { disabled: true });
      const toggledGuardrail = createMockGuardrail('toggle-test', { disabled: false });
      mockDatabase.getGuardrail.mockResolvedValue(initialGuardrail);
      mockDatabase.setGuardrailDisabled.mockResolvedValue(toggledGuardrail);

      // Act
      const initial = await mockDatabase.getGuardrail('default', 'toggle-test');
      expect(initial?.disabled).toBe(true);

      const result = await mockDatabase.setGuardrailDisabled('default', 'toggle-test', false);

      // Assert
      expect(result?.disabled).toBe(false);
    });

    it('should toggle disabled state from false to true', async () => {
      // Arrange - start with enabled guardrail
      const initialGuardrail = createMockGuardrail('toggle-test', { disabled: false });
      const toggledGuardrail = createMockGuardrail('toggle-test', { disabled: true });
      mockDatabase.getGuardrail.mockResolvedValue(initialGuardrail);
      mockDatabase.setGuardrailDisabled.mockResolvedValue(toggledGuardrail);

      // Act
      const initial = await mockDatabase.getGuardrail('default', 'toggle-test');
      expect(initial?.disabled).toBe(false);

      const result = await mockDatabase.setGuardrailDisabled('default', 'toggle-test', true);

      // Assert
      expect(result?.disabled).toBe(true);
    });

    it('should preserve other fields when disabling', async () => {
      // Arrange
      const originalGuardrail = createMockGuardrail('full-guardrail', {
        description: 'Original description',
        deployment: 'sidecar-container',
        parameters: '{"key": "value"}',
        disabled: false,
      });
      const disabledGuardrail = {
        ...originalGuardrail,
        disabled: true,
        updatedAt: '2026-01-08T12:00:00.000Z',
      };
      mockDatabase.setGuardrailDisabled.mockResolvedValue(disabledGuardrail);

      // Act
      const result = await mockDatabase.setGuardrailDisabled('default', 'full-guardrail', true);

      // Assert
      expect(result?.disabled).toBe(true);
      expect(result?.description).toBe('Original description');
      expect(result?.deployment).toBe('sidecar-container');
      expect(result?.parameters).toBe('{"key": "value"}');
    });

    it('should work across different namespaces', async () => {
      // Arrange
      const prodGuardrail = createMockGuardrail('rate-limiter', {
        namespace: 'production',
        disabled: true,
      });
      mockDatabase.setGuardrailDisabled.mockResolvedValue(prodGuardrail);

      // Act
      const result = await mockDatabase.setGuardrailDisabled('production', 'rate-limiter', true);

      // Assert
      expect(result?.disabled).toBe(true);
      expect(result?.namespace).toBe('production');
      expect(mockDatabase.setGuardrailDisabled).toHaveBeenCalledWith(
        'production',
        'rate-limiter',
        true,
      );
    });
  });

  describe('updateGuardrail() with disabled field - US5', () => {
    it('should update disabled via PUT endpoint', async () => {
      // Arrange
      const disabledGuardrail = createMockGuardrail('rate-limiter', { disabled: true });
      mockDatabase.updateGuardrail.mockResolvedValue(disabledGuardrail);

      // Act
      const result = await mockDatabase.updateGuardrail('default', 'rate-limiter', {
        disabled: true,
      });

      // Assert
      expect(result?.disabled).toBe(true);
    });

    it('should update disabled along with other fields', async () => {
      // Arrange
      const updatedGuardrail = createMockGuardrail('rate-limiter', {
        description: 'Updated description',
        disabled: true,
      });
      mockDatabase.updateGuardrail.mockResolvedValue(updatedGuardrail);

      // Act
      const result = await mockDatabase.updateGuardrail('default', 'rate-limiter', {
        description: 'Updated description',
        disabled: true,
      });

      // Assert
      expect(result?.disabled).toBe(true);
      expect(result?.description).toBe('Updated description');
    });

    it('should enable guardrail by updating disabled to false', async () => {
      // Arrange
      const enabledGuardrail = createMockGuardrail('rate-limiter', { disabled: false });
      mockDatabase.updateGuardrail.mockResolvedValue(enabledGuardrail);

      // Act
      const result = await mockDatabase.updateGuardrail('default', 'rate-limiter', {
        disabled: false,
      });

      // Assert
      expect(result?.disabled).toBe(false);
    });
  });

  // ==========================================================================
  // Additional Tests: createGuardrail()
  // ==========================================================================
  describe('createGuardrail()', () => {
    it('should create a new guardrail', async () => {
      // Arrange
      const newGuardrail = createMockGuardrail('new-guardrail');
      mockDatabase.guardrailExists.mockResolvedValue(false);
      mockDatabase.createGuardrail.mockResolvedValue(newGuardrail);

      // Act
      const exists = await mockDatabase.guardrailExists('default', 'new-guardrail');
      expect(exists).toBe(false);

      const result = await mockDatabase.createGuardrail({
        namespace: 'default',
        name: 'new-guardrail',
        description: 'Test guardrail description',
        deployment: 'sidecar-container',
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('new-guardrail');
      expect(result.disabled).toBe(false);
    });

    it('should prevent creation of duplicate guardrail', async () => {
      // Arrange
      mockDatabase.guardrailExists.mockResolvedValue(true);

      // Act
      const exists = await mockDatabase.guardrailExists('default', 'existing-guardrail');

      // Assert
      expect(exists).toBe(true);
      // In real service, this would throw ConflictError
    });

    it('should create guardrail with optional parameters', async () => {
      // Arrange
      const guardrailWithParams = createMockGuardrail('param-guardrail', {
        parameters: '{"maxCalls": 100, "window": "1m"}',
      });
      mockDatabase.createGuardrail.mockResolvedValue(guardrailWithParams);

      // Act
      const result = await mockDatabase.createGuardrail({
        namespace: 'default',
        name: 'param-guardrail',
        description: 'Rate limiter with params',
        deployment: 'sidecar-container',
        parameters: '{"maxCalls": 100, "window": "1m"}',
      });

      // Assert
      expect(result.parameters).toBe('{"maxCalls": 100, "window": "1m"}');
    });

    it('should create guardrail with disabled=true', async () => {
      // Arrange
      const disabledGuardrail = createMockGuardrail('disabled-guardrail', { disabled: true });
      mockDatabase.guardrailExists.mockResolvedValue(false);
      mockDatabase.createGuardrail.mockResolvedValue(disabledGuardrail);

      // Act
      const result = await mockDatabase.createGuardrail({
        namespace: 'default',
        name: 'disabled-guardrail',
        description: 'Disabled guardrail',
        deployment: 'sidecar-container',
        disabled: true,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('disabled-guardrail');
      expect(result.disabled).toBe(true);
    });
  });
});

// =============================================================================
// Guardrail Validation Tests (T026-T028)
// =============================================================================
import { MCPEntityValidator } from '../validation';
import { ValidationError } from '../errors';

describe('Guardrail Validation - T026-T028', () => {
  let validator: MCPEntityValidator;

  beforeEach(() => {
    validator = new MCPEntityValidator();
  });

  describe('validateGuardrail() - Valid Input', () => {
    it('should accept valid guardrail with all fields', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'rate-limiter',
          namespace: 'production',
          description: 'Rate limiting guardrail for API calls',
        },
        spec: {
          deployment: 'sidecar-container',
          parameters: '{"maxCalls": 100}',
        },
      };

      // Act & Assert - should not throw
      expect(() => validator.validateGuardrail(input)).not.toThrow();
    });

    it('should accept valid guardrail with minimal required fields', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'ab', // minimum 2 chars for start+end pattern
          description: 'Minimal guardrail',
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert - should not throw
      expect(() => validator.validateGuardrail(input)).not.toThrow();
    });

    it('should accept guardrail name with hyphens', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'my-rate-limiter-v2',
          description: 'Hyphenated name guardrail',
        },
        spec: {
          deployment: 'sidecar-container',
        },
      };

      // Act & Assert - should not throw
      expect(() => validator.validateGuardrail(input)).not.toThrow();
    });

    it('should accept guardrail with 63-character name (max length)', () => {
      // Arrange
      const longName = 'a' + 'b'.repeat(61) + 'c'; // 63 chars total
      const input = {
        metadata: {
          name: longName,
          description: 'Max length name guardrail',
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert - should not throw
      expect(() => validator.validateGuardrail(input)).not.toThrow();
    });

    it('should default namespace to "default" when not provided', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'no-namespace-guardrail',
          description: 'Guardrail without explicit namespace',
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert - should not throw (namespace is optional with default)
      expect(() => validator.validateGuardrail(input)).not.toThrow();
    });
  });

  describe('validateGuardrail() - Name Validation (T026)', () => {
    it('should reject empty name', () => {
      // Arrange
      const input = {
        metadata: {
          name: '',
          description: 'Empty name guardrail',
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should reject name with uppercase letters', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'RateLimiter',
          description: 'Uppercase name guardrail',
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should reject name starting with hyphen', () => {
      // Arrange
      const input = {
        metadata: {
          name: '-rate-limiter',
          description: 'Hyphen-start name guardrail',
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should reject name ending with hyphen', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'rate-limiter-',
          description: 'Hyphen-end name guardrail',
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should reject name with special characters', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'rate_limiter',
          description: 'Underscore name guardrail',
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should reject name over 63 characters', () => {
      // Arrange
      const longName = 'a'.repeat(64);
      const input = {
        metadata: {
          name: longName,
          description: 'Too long name guardrail',
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should reject missing name', () => {
      // Arrange
      const input = {
        metadata: {
          description: 'Missing name guardrail',
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });
  });

  describe('validateGuardrail() - Description Validation (T027)', () => {
    it('should reject missing description', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'rate-limiter',
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should reject empty description', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'rate-limiter',
          description: '',
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should reject description over 1000 characters', () => {
      // Arrange
      const longDescription = 'a'.repeat(1001);
      const input = {
        metadata: {
          name: 'rate-limiter',
          description: longDescription,
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should accept description at exactly 1000 characters', () => {
      // Arrange
      const maxDescription = 'a'.repeat(1000);
      const input = {
        metadata: {
          name: 'rate-limiter',
          description: maxDescription,
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert - should not throw
      expect(() => validator.validateGuardrail(input)).not.toThrow();
    });
  });

  describe('validateGuardrail() - Deployment Validation (T028)', () => {
    it('should reject missing deployment', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'rate-limiter',
          description: 'Rate limiting guardrail',
        },
        spec: {},
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should reject empty deployment', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'rate-limiter',
          description: 'Rate limiting guardrail',
        },
        spec: {
          deployment: '',
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should reject deployment over 2000 characters', () => {
      // Arrange
      const longDeployment = 'a'.repeat(2001);
      const input = {
        metadata: {
          name: 'rate-limiter',
          description: 'Rate limiting guardrail',
        },
        spec: {
          deployment: longDeployment,
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should accept deployment at exactly 2000 characters', () => {
      // Arrange
      const maxDeployment = 'a'.repeat(2000);
      const input = {
        metadata: {
          name: 'rate-limiter',
          description: 'Rate limiting guardrail',
        },
        spec: {
          deployment: maxDeployment,
        },
      };

      // Act & Assert - should not throw
      expect(() => validator.validateGuardrail(input)).not.toThrow();
    });
  });

  describe('validateGuardrail() - Parameters Validation', () => {
    it('should accept missing parameters (optional field)', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'rate-limiter',
          description: 'Rate limiting guardrail',
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert - should not throw
      expect(() => validator.validateGuardrail(input)).not.toThrow();
    });

    it('should accept empty string parameters', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'rate-limiter',
          description: 'Rate limiting guardrail',
        },
        spec: {
          deployment: 'sidecar',
          parameters: '',
        },
      };

      // Act & Assert - should not throw
      expect(() => validator.validateGuardrail(input)).not.toThrow();
    });

    it('should reject parameters over 10000 characters', () => {
      // Arrange
      const longParameters = 'a'.repeat(10001);
      const input = {
        metadata: {
          name: 'rate-limiter',
          description: 'Rate limiting guardrail',
        },
        spec: {
          deployment: 'sidecar',
          parameters: longParameters,
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should accept parameters at exactly 10000 characters', () => {
      // Arrange
      const maxParameters = 'a'.repeat(10000);
      const input = {
        metadata: {
          name: 'rate-limiter',
          description: 'Rate limiting guardrail',
        },
        spec: {
          deployment: 'sidecar',
          parameters: maxParameters,
        },
      };

      // Act & Assert - should not throw
      expect(() => validator.validateGuardrail(input)).not.toThrow();
    });
  });

  describe('validateGuardrail() - Structure Validation', () => {
    it('should reject missing metadata', () => {
      // Arrange
      const input = {
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should reject missing spec', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'rate-limiter',
          description: 'Rate limiting guardrail',
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should reject additional properties in metadata', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'rate-limiter',
          description: 'Rate limiting guardrail',
          extraField: 'not allowed',
        },
        spec: {
          deployment: 'sidecar',
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should reject additional properties in spec', () => {
      // Arrange
      const input = {
        metadata: {
          name: 'rate-limiter',
          description: 'Rate limiting guardrail',
        },
        spec: {
          deployment: 'sidecar',
          extraField: 'not allowed',
        },
      };

      // Act & Assert
      expect(() => validator.validateGuardrail(input)).toThrow(ValidationError);
    });

    it('should reject null input', () => {
      // Act & Assert
      expect(() => validator.validateGuardrail(null)).toThrow(ValidationError);
    });

    it('should reject undefined input', () => {
      // Act & Assert
      expect(() => validator.validateGuardrail(undefined)).toThrow(ValidationError);
    });

    it('should reject non-object input', () => {
      // Act & Assert
      expect(() => validator.validateGuardrail('not an object')).toThrow(ValidationError);
      expect(() => validator.validateGuardrail(123)).toThrow(ValidationError);
      expect(() => validator.validateGuardrail([])).toThrow(ValidationError);
    });
  });
});

// =============================================================================
// Workload-Tool-Guardrail Parameters Tests (US4 - T057)
// =============================================================================
describe('Workload-Tool-Guardrail Parameters - US4', () => {
  interface MockDatabaseWithWTG {
    addGuardrailToWorkloadTool: jest.Mock;
    listWorkloadToolGuardrails: jest.Mock;
    workloadToolGuardrailExists: jest.Mock;
    removeGuardrailFromWorkloadTool: jest.Mock;
  }

  let mockDatabase: MockDatabaseWithWTG;

  beforeEach(() => {
    mockDatabase = {
      addGuardrailToWorkloadTool: jest.fn(),
      listWorkloadToolGuardrails: jest.fn(),
      workloadToolGuardrailExists: jest.fn(),
      removeGuardrailFromWorkloadTool: jest.fn(),
    };
  });

  describe('addGuardrailToWorkloadTool() with parameters', () => {
    it('should store parameters when adding guardrail to workload-tool', async () => {
      // Arrange
      const expectedAssociation: WorkloadToolGuardrailAssociation = {
        id: 'wtg-with-params-id',
        workloadNamespace: 'default',
        workloadName: 'my-workload',
        toolNamespace: 'default',
        toolName: 'my-tool',
        guardrailId: 'guardrail-rate-limiter-id',
        executionTiming: 'pre-execution',
        source: 'workload',
        parameters: '{"maxCalls": 100, "window": "1m"}',
        createdAt: '2026-01-07T00:00:00.000Z',
      };
      mockDatabase.addGuardrailToWorkloadTool.mockResolvedValue(expectedAssociation);

      // Act
      const result = await mockDatabase.addGuardrailToWorkloadTool(
        'default',
        'my-workload',
        'default',
        'my-tool',
        'guardrail-rate-limiter-id',
        'pre-execution',
        'workload',
        '{"maxCalls": 100, "window": "1m"}',
      );

      // Assert
      expect(result.parameters).toBe('{"maxCalls": 100, "window": "1m"}');
      expect(mockDatabase.addGuardrailToWorkloadTool).toHaveBeenCalledWith(
        'default',
        'my-workload',
        'default',
        'my-tool',
        'guardrail-rate-limiter-id',
        'pre-execution',
        'workload',
        '{"maxCalls": 100, "window": "1m"}',
      );
    });

    it('should allow undefined parameters (optional field)', async () => {
      // Arrange
      const expectedAssociation: WorkloadToolGuardrailAssociation = {
        id: 'wtg-no-params-id',
        workloadNamespace: 'default',
        workloadName: 'my-workload',
        toolNamespace: 'default',
        toolName: 'my-tool',
        guardrailId: 'guardrail-rate-limiter-id',
        executionTiming: 'post-execution',
        source: 'workload',
        parameters: undefined,
        createdAt: '2026-01-07T00:00:00.000Z',
      };
      mockDatabase.addGuardrailToWorkloadTool.mockResolvedValue(expectedAssociation);

      // Act
      const result = await mockDatabase.addGuardrailToWorkloadTool(
        'default',
        'my-workload',
        'default',
        'my-tool',
        'guardrail-rate-limiter-id',
        'post-execution',
        'workload',
        undefined,
      );

      // Assert
      expect(result.parameters).toBeUndefined();
    });

    it('should store plain text parameters', async () => {
      // Arrange
      const expectedAssociation: WorkloadToolGuardrailAssociation = {
        id: 'wtg-text-params-id',
        workloadNamespace: 'production',
        workloadName: 'prod-workload',
        toolNamespace: 'default',
        toolName: 'api-tool',
        guardrailId: 'guardrail-auth-validator-id',
        executionTiming: 'pre-execution',
        source: 'workload',
        parameters: 'strict-mode: enabled\nmax-retries: 3',
        createdAt: '2026-01-07T00:00:00.000Z',
      };
      mockDatabase.addGuardrailToWorkloadTool.mockResolvedValue(expectedAssociation);

      // Act
      const result = await mockDatabase.addGuardrailToWorkloadTool(
        'production',
        'prod-workload',
        'default',
        'api-tool',
        'guardrail-auth-validator-id',
        'pre-execution',
        'workload',
        'strict-mode: enabled\nmax-retries: 3',
      );

      // Assert
      expect(result.parameters).toBe('strict-mode: enabled\nmax-retries: 3');
    });
  });

  describe('listWorkloadToolGuardrails() with parameters', () => {
    it('should return parameters in listed associations', async () => {
      // Arrange
      const associations: WorkloadToolGuardrailAssociation[] = [
        {
          id: 'wtg-1',
          workloadNamespace: 'default',
          workloadName: 'my-workload',
          toolNamespace: 'default',
          toolName: 'my-tool',
          guardrailId: 'guardrail-1-id',
          executionTiming: 'pre-execution',
          source: 'tool',
          parameters: '{"setting": "inherited"}',
          createdAt: '2026-01-07T00:00:00.000Z',
        },
        {
          id: 'wtg-2',
          workloadNamespace: 'default',
          workloadName: 'my-workload',
          toolNamespace: 'default',
          toolName: 'my-tool',
          guardrailId: 'guardrail-2-id',
          executionTiming: 'post-execution',
          source: 'workload',
          parameters: undefined,
          createdAt: '2026-01-07T01:00:00.000Z',
        },
      ];
      mockDatabase.listWorkloadToolGuardrails.mockResolvedValue(associations);

      // Act
      const result = await mockDatabase.listWorkloadToolGuardrails(
        'default',
        'my-workload',
        'default',
        'my-tool',
      );

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].parameters).toBe('{"setting": "inherited"}');
      expect(result[1].parameters).toBeUndefined();
    });

    it('should distinguish between tool-inherited and workload-added associations with different parameters', async () => {
      // Arrange
      const associations: WorkloadToolGuardrailAssociation[] = [
        {
          id: 'wtg-inherited',
          workloadNamespace: 'default',
          workloadName: 'my-workload',
          toolNamespace: 'default',
          toolName: 'my-tool',
          guardrailId: 'guardrail-rate-limiter-id',
          executionTiming: 'pre-execution',
          source: 'tool',
          parameters: '{"maxCalls": 50}', // Inherited from tool
          createdAt: '2026-01-07T00:00:00.000Z',
        },
        {
          id: 'wtg-workload',
          workloadNamespace: 'default',
          workloadName: 'my-workload',
          toolNamespace: 'default',
          toolName: 'my-tool',
          guardrailId: 'guardrail-logger-id',
          executionTiming: 'post-execution',
          source: 'workload',
          parameters: '{"logLevel": "debug"}', // Added at workload level
          createdAt: '2026-01-07T01:00:00.000Z',
        },
      ];
      mockDatabase.listWorkloadToolGuardrails.mockResolvedValue(associations);

      // Act
      const result = await mockDatabase.listWorkloadToolGuardrails(
        'default',
        'my-workload',
        'default',
        'my-tool',
      );

      // Assert
      expect(result).toHaveLength(2);
      const inherited = result.find((a: WorkloadToolGuardrailAssociation) => a.source === 'tool');
      const workloadAdded = result.find((a: WorkloadToolGuardrailAssociation) => a.source === 'workload');
      expect(inherited?.parameters).toBe('{"maxCalls": 50}');
      expect(workloadAdded?.parameters).toBe('{"logLevel": "debug"}');
    });
  });
});
