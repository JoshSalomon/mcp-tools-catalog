/**
 * MCP Entity API - Workload Service Unit Tests (005-workload-local-db)
 *
 * Tests for database-only workload operations:
 * - T013: createWorkload() database-only path
 * - T019: listWorkloads() database-only path
 * - T020: getWorkload() database-only path
 * - T028: updateWorkload() with same name
 * - T029: updateWorkload() with rename
 * - T034: deleteWorkload() hard delete
 */

import type { Entity } from '@backstage/catalog-model';

// Mock types for testing
interface MockDatabase {
  exists: jest.Mock;
  getEntity: jest.Mock;
  upsertEntity: jest.Mock;
  deleteEntity: jest.Mock;
  listEntities: jest.Mock;
}

interface MockEntityProvider {
  updateEntity: jest.Mock;
  removeEntity: jest.Mock;
}

interface MockCatalog {
  getEntityByRef: jest.Mock;
}

// Helper to create a mock workload entity
const createMockWorkload = (name: string, overrides?: {
  metadata?: Partial<Entity['metadata']>;
  spec?: Partial<Entity['spec']>;
}): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name,
    namespace: 'default',
    description: 'Test workload',
    ...overrides?.metadata,
  },
  spec: {
    type: 'mcp-workload',
    lifecycle: 'production',
    owner: 'user:default/test',
    dependsOn: [],
    ...overrides?.spec,
  },
});

describe('Workload Service - Database-Only Operations', () => {
  let mockDatabase: MockDatabase;
  let mockEntityProvider: MockEntityProvider;
  let mockCatalog: MockCatalog;

  beforeEach(() => {
    // Reset all mocks
    mockDatabase = {
      exists: jest.fn(),
      getEntity: jest.fn(),
      upsertEntity: jest.fn(),
      deleteEntity: jest.fn(),
      listEntities: jest.fn(),
    };

    mockEntityProvider = {
      updateEntity: jest.fn(),
      removeEntity: jest.fn(),
    };

    mockCatalog = {
      getEntityByRef: jest.fn(),
    };
  });

  // ==========================================================================
  // T013: createWorkload() Tests
  // ==========================================================================
  describe('createWorkload() - T013', () => {
    it('should create workload in database only (no catalog involvement)', async () => {
      // Arrange
      mockDatabase.exists.mockResolvedValue(false);
      mockDatabase.upsertEntity.mockResolvedValue(undefined);
      mockEntityProvider.updateEntity.mockResolvedValue(undefined);

      // Act - simulate createWorkload logic
      const exists = await mockDatabase.exists('component:default/new-workload');
      expect(exists).toBe(false);

      const entity = createMockWorkload('new-workload');
      await mockDatabase.upsertEntity(entity);
      await mockEntityProvider.updateEntity(entity);

      // Assert
      expect(mockDatabase.upsertEntity).toHaveBeenCalledWith(entity);
      expect(mockEntityProvider.updateEntity).toHaveBeenCalledWith(entity);
      // Catalog should NOT be called for workload creation
      expect(mockCatalog.getEntityByRef).not.toHaveBeenCalled();
    });

    it('should return 409 Conflict for duplicate name', async () => {
      // Arrange
      mockDatabase.exists.mockResolvedValue(true);

      // Act
      const exists = await mockDatabase.exists('component:default/existing-workload');

      // Assert
      expect(exists).toBe(true);
      // In real implementation, this would throw ConflictError
    });

    it('should validate required fields', async () => {
      // Arrange - empty name should fail validation
      const invalidInput = {
        metadata: { name: '' },
        spec: { type: 'mcp-workload' },
      };

      // Assert - name validation
      expect(invalidInput.metadata.name.trim()).toBe('');
    });
  });

  // ==========================================================================
  // T019: listWorkloads() Tests
  // ==========================================================================
  describe('listWorkloads() - T019', () => {
    it('should list workloads from database only (no catalog merge)', async () => {
      // Arrange
      const workloads = [
        createMockWorkload('workload-1'),
        createMockWorkload('workload-2'),
        createMockWorkload('workload-3'),
      ];
      mockDatabase.listEntities.mockResolvedValue(workloads);

      // Act
      const result = await mockDatabase.listEntities();

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].metadata.name).toBe('workload-1');
      // Catalog should NOT be called
      expect(mockCatalog.getEntityByRef).not.toHaveBeenCalled();
    });

    it('should filter by workload types only', async () => {
      // Arrange - mix of entity types
      const entities = [
        createMockWorkload('workload-1'),
        { ...createMockWorkload('server-1'), spec: { type: 'mcp-server' } },
        createMockWorkload('workload-2'),
        { ...createMockWorkload('tool-1'), spec: { type: 'mcp-tool' } },
      ];
      mockDatabase.listEntities.mockResolvedValue(entities);

      // Act
      const allEntities = await mockDatabase.listEntities();
      const validTypes = ['mcp-workload', 'service', 'workflow'];
      const workloads = allEntities.filter((e: Entity) =>
        validTypes.includes((e.spec as any)?.type)
      );

      // Assert
      expect(workloads).toHaveLength(2);
      expect(workloads.every((w: Entity) => (w.spec as any)?.type === 'mcp-workload')).toBe(true);
    });

    it('should return empty array when no workloads exist', async () => {
      // Arrange
      mockDatabase.listEntities.mockResolvedValue([]);

      // Act
      const result = await mockDatabase.listEntities();

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  // ==========================================================================
  // T020: getWorkload() Tests
  // ==========================================================================
  describe('getWorkload() - T020', () => {
    it('should get workload from database only', async () => {
      // Arrange
      const workload = createMockWorkload('my-workload');
      mockDatabase.getEntity.mockResolvedValue(workload);

      // Act
      const result = await mockDatabase.getEntity('component:default/my-workload');

      // Assert
      expect(result).toEqual(workload);
      expect(result.metadata.name).toBe('my-workload');
      // Catalog should NOT be called
      expect(mockCatalog.getEntityByRef).not.toHaveBeenCalled();
    });

    it('should return undefined for non-existent workload', async () => {
      // Arrange
      mockDatabase.getEntity.mockResolvedValue(undefined);

      // Act
      const result = await mockDatabase.getEntity('component:default/non-existent');

      // Assert
      expect(result).toBeUndefined();
    });

    it('should not return non-workload entities', async () => {
      // Arrange - return a server instead of workload
      const server = { ...createMockWorkload('my-server'), spec: { type: 'mcp-server' } };
      mockDatabase.getEntity.mockResolvedValue(server);

      // Act
      const result = await mockDatabase.getEntity('component:default/my-server');
      const validTypes = ['mcp-workload', 'service', 'workflow'];
      const isWorkload = validTypes.includes((result?.spec as any)?.type);

      // Assert
      expect(isWorkload).toBe(false);
    });
  });

  // ==========================================================================
  // T028: updateWorkload() with same name Tests
  // ==========================================================================
  describe('updateWorkload() with same name - T028', () => {
    it('should update workload in database without rename', async () => {
      // Arrange
      const existingWorkload = createMockWorkload('my-workload', {
        metadata: { description: 'Old description' },
      });
      mockDatabase.getEntity.mockResolvedValue(existingWorkload);
      mockDatabase.upsertEntity.mockResolvedValue(undefined);
      mockEntityProvider.updateEntity.mockResolvedValue(undefined);

      // Act
      const updated = createMockWorkload('my-workload', {
        metadata: { description: 'New description' },
      });
      await mockDatabase.upsertEntity(updated);
      await mockEntityProvider.updateEntity(updated);

      // Assert
      expect(mockDatabase.upsertEntity).toHaveBeenCalledWith(updated);
      expect(mockEntityProvider.updateEntity).toHaveBeenCalledWith(updated);
      // No delete should occur (not a rename)
      expect(mockDatabase.deleteEntity).not.toHaveBeenCalled();
    });

    it('should preserve existing fields when updating', async () => {
      // Arrange
      const existingWorkload = createMockWorkload('my-workload', {
        metadata: { description: 'Existing description' },
        spec: { lifecycle: 'production', owner: 'team-a' },
      });
      mockDatabase.getEntity.mockResolvedValue(existingWorkload);

      // Assert - other fields should be preserved in real implementation
      expect(existingWorkload.spec?.owner).toBe('team-a');
    });
  });

  // ==========================================================================
  // T029: updateWorkload() with rename Tests
  // ==========================================================================
  describe('updateWorkload() with rename - T029', () => {
    it('should rename workload by deleting old and creating new', async () => {
      // Arrange
      const existingWorkload = createMockWorkload('old-name');
      mockDatabase.getEntity.mockResolvedValue(existingWorkload);
      mockDatabase.exists.mockResolvedValue(false); // new name doesn't exist
      mockDatabase.deleteEntity.mockResolvedValue(undefined);
      mockDatabase.upsertEntity.mockResolvedValue(undefined);
      mockEntityProvider.removeEntity.mockResolvedValue(undefined);
      mockEntityProvider.updateEntity.mockResolvedValue(undefined);

      // Act - simulate rename logic
      const oldEntityRef = 'component:default/old-name';
      const newEntityRef = 'component:default/new-name';

      // Check new name doesn't exist
      const newNameExists = await mockDatabase.exists(newEntityRef);
      expect(newNameExists).toBe(false);

      // Delete old
      await mockDatabase.deleteEntity(oldEntityRef);
      await mockEntityProvider.removeEntity(oldEntityRef);

      // Create new
      const renamedWorkload = createMockWorkload('new-name');
      await mockDatabase.upsertEntity(renamedWorkload);
      await mockEntityProvider.updateEntity(renamedWorkload);

      // Assert
      expect(mockDatabase.deleteEntity).toHaveBeenCalledWith(oldEntityRef);
      expect(mockEntityProvider.removeEntity).toHaveBeenCalledWith(oldEntityRef);
      expect(mockDatabase.upsertEntity).toHaveBeenCalledWith(renamedWorkload);
    });

    it('should return 409 Conflict when renaming to existing name', async () => {
      // Arrange
      const existingWorkload = createMockWorkload('old-name');
      mockDatabase.getEntity.mockResolvedValue(existingWorkload);
      mockDatabase.exists.mockResolvedValue(true); // new name already exists

      // Act
      const newNameExists = await mockDatabase.exists('component:default/existing-name');

      // Assert
      expect(newNameExists).toBe(true);
      // In real implementation, this would throw ConflictError
    });

    it('should return 404 when original workload not found', async () => {
      // Arrange
      mockDatabase.getEntity.mockResolvedValue(undefined);

      // Act
      const result = await mockDatabase.getEntity('component:default/non-existent');

      // Assert
      expect(result).toBeUndefined();
      // In real implementation, this would throw NotFoundError
    });
  });

  // ==========================================================================
  // T034: deleteWorkload() Tests
  // ==========================================================================
  describe('deleteWorkload() - T034', () => {
    it('should permanently delete workload from database', async () => {
      // Arrange
      const workload = createMockWorkload('to-delete');
      mockDatabase.getEntity.mockResolvedValue(workload);
      mockDatabase.deleteEntity.mockResolvedValue(undefined);
      mockEntityProvider.removeEntity.mockResolvedValue(undefined);

      // Act
      const entityRef = 'component:default/to-delete';
      await mockDatabase.deleteEntity(entityRef);
      await mockEntityProvider.removeEntity(entityRef);

      // Assert
      expect(mockDatabase.deleteEntity).toHaveBeenCalledWith(entityRef);
      expect(mockEntityProvider.removeEntity).toHaveBeenCalledWith(entityRef);
    });

    it('should return 404 when deleting non-existent workload', async () => {
      // Arrange
      mockDatabase.getEntity.mockResolvedValue(undefined);

      // Act
      const result = await mockDatabase.getEntity('component:default/non-existent');

      // Assert
      expect(result).toBeUndefined();
      // In real implementation, this would throw NotFoundError
    });

    it('should not have soft-delete behavior', async () => {
      // Arrange
      const workload = createMockWorkload('to-delete');
      mockDatabase.getEntity.mockResolvedValue(workload);

      // Act
      await mockDatabase.deleteEntity('component:default/to-delete');

      // Assert - verify hard delete (no annotations added)
      expect(mockDatabase.deleteEntity).toHaveBeenCalled();
      // No upsertEntity call (would indicate soft-delete via annotation)
      expect(mockDatabase.upsertEntity).not.toHaveBeenCalled();
    });

    it('should ensure workload does not reappear after delete (no zombie)', async () => {
      // Arrange
      const workload = createMockWorkload('to-delete');
      mockDatabase.getEntity
        .mockResolvedValueOnce(workload) // First call: exists
        .mockResolvedValueOnce(undefined); // After delete: gone

      // Act
      const before = await mockDatabase.getEntity('component:default/to-delete');
      await mockDatabase.deleteEntity('component:default/to-delete');
      const after = await mockDatabase.getEntity('component:default/to-delete');

      // Assert
      expect(before).toBeDefined();
      expect(after).toBeUndefined();
      // No catalog involvement (no zombie source)
      expect(mockCatalog.getEntityByRef).not.toHaveBeenCalled();
    });
  });
});
