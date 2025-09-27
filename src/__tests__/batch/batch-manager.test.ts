import { describe, it, expect, beforeEach } from 'vitest';
import { BatchManager } from '../../batch/batch-manager.js';
import type { BatchOperation } from '../../types/index.js';

describe('BatchManager', () => {
  let batchManager: BatchManager;

  beforeEach(() => {
    batchManager = new BatchManager();
  });

  describe('create', () => {
    it('should create a new batch with generated ID', () => {
      const batchData = {
        type: 'schedule_videos' as const,
        status: 'pending' as const,
        progress: {
          total: 5,
          completed: 0,
          failed: 0,
        },
        operations: [],
        startedAt: new Date().toISOString(),
      };

      const batch = batchManager.create(batchData);

      expect(batch.id).toBeDefined();
      expect(typeof batch.id).toBe('string');
      expect(batch.type).toBe('schedule_videos');
      expect(batch.status).toBe('pending');
      expect(batch.progress).toEqual(batchData.progress);
      expect(batch.operations).toEqual([]);
    });

    it('should create a batch with provided ID', () => {
      const customId = 'custom-batch-id';
      const batchData = {
        id: customId,
        type: 'playlist_management' as const,
        status: 'completed' as const,
        progress: {
          total: 3,
          completed: 3,
          failed: 0,
        },
        operations: [],
        startedAt: new Date().toISOString(),
      };

      const batch = batchManager.create(batchData);

      expect(batch.id).toBe(customId);
      expect(batch.type).toBe('playlist_management');
      expect(batch.status).toBe('completed');
    });

    it('should store the created batch in memory', () => {
      const batchData = {
        type: 'metadata_update' as const,
        status: 'in_progress' as const,
        progress: {
          total: 2,
          completed: 1,
          failed: 0,
        },
        operations: [],
        startedAt: new Date().toISOString(),
      };

      const batch = batchManager.create(batchData);
      const retrieved = batchManager.get(batch.id);

      expect(retrieved).toEqual(batch);
    });

    it('should create batches with different types', () => {
      const batchTypes = ['schedule_videos', 'playlist_management', 'metadata_update'] as const;

      const batches = batchTypes.map(type => {
        return batchManager.create({
          type,
          status: 'pending',
          progress: { total: 1, completed: 0, failed: 0 },
          operations: [],
          startedAt: new Date().toISOString(),
        });
      });

      batches.forEach((batch, index) => {
        expect(batch.type).toBe(batchTypes[index]);
        expect(batchManager.get(batch.id)).toEqual(batch);
      });
    });

    it('should handle complex operation data', () => {
      const operations = [
        {
          id: 'op-1',
          type: 'schedule_video' as const,
          videoId: 'video-123',
          status: 'pending' as const,
          label: 'Schedule Test Video',
          description: 'Test video scheduling',
        },
        {
          id: 'op-2',
          type: 'schedule_video' as const,
          videoId: 'video-456',
          status: 'completed' as const,
          label: 'Schedule Another Video',
          result: { scheduledTime: '2024-01-01T12:00:00Z' },
        },
      ];

      const batchData = {
        type: 'schedule_videos' as const,
        status: 'in_progress' as const,
        progress: {
          total: 2,
          completed: 1,
          failed: 0,
        },
        operations,
        startedAt: new Date().toISOString(),
        metadata: { source: 'api', priority: 'high' },
      };

      const batch = batchManager.create(batchData);

      expect(batch.operations).toHaveLength(2);
      expect(batch.operations[0]).toEqual(operations[0]);
      expect(batch.operations[1]).toEqual(operations[1]);
      expect(batch.metadata).toEqual({ source: 'api', priority: 'high' });
    });
  });

  describe('get', () => {
    it('should retrieve existing batch by ID', () => {
      const batchData = {
        type: 'schedule_videos' as const,
        status: 'pending' as const,
        progress: { total: 1, completed: 0, failed: 0 },
        operations: [],
        startedAt: new Date().toISOString(),
      };

      const batch = batchManager.create(batchData);
      const retrieved = batchManager.get(batch.id);

      expect(retrieved).toEqual(batch);
      expect(retrieved?.id).toBe(batch.id);
    });

    it('should return undefined for non-existent batch', () => {
      const nonExistentId = 'non-existent-batch-id';
      const retrieved = batchManager.get(nonExistentId);

      expect(retrieved).toBeUndefined();
    });

    it('should maintain batch integrity after multiple retrievals', () => {
      const batchData = {
        type: 'metadata_update' as const,
        status: 'completed' as const,
        progress: { total: 5, completed: 5, failed: 0 },
        operations: [],
        startedAt: new Date().toISOString(),
      };

      const batch = batchManager.create(batchData);

      // Retrieve multiple times
      const retrieved1 = batchManager.get(batch.id);
      const retrieved2 = batchManager.get(batch.id);
      const retrieved3 = batchManager.get(batch.id);

      expect(retrieved1).toEqual(batch);
      expect(retrieved2).toEqual(batch);
      expect(retrieved3).toEqual(batch);
      expect(retrieved1).toEqual(retrieved2);
      expect(retrieved2).toEqual(retrieved3);
    });
  });

  describe('update', () => {
    it('should update existing batch', () => {
      const batchData = {
        type: 'schedule_videos' as const,
        status: 'pending' as const,
        progress: { total: 3, completed: 0, failed: 0 },
        operations: [],
        startedAt: new Date().toISOString(),
      };

      const batch = batchManager.create(batchData);

      const updated = batchManager.update(batch.id, (b) => {
        b.status = 'in_progress';
        b.progress.completed = 1;
      });

      expect(updated).toBeDefined();
      expect(updated?.status).toBe('in_progress');
      expect(updated?.progress.completed).toBe(1);
      expect(updated?.progress.total).toBe(3);
    });

    it('should persist updates to storage', () => {
      const batchData = {
        type: 'playlist_management' as const,
        status: 'pending' as const,
        progress: { total: 2, completed: 0, failed: 0 },
        operations: [],
        startedAt: new Date().toISOString(),
      };

      const batch = batchManager.create(batchData);

      batchManager.update(batch.id, (b) => {
        b.status = 'completed';
        b.progress.completed = 2;
        b.completedAt = new Date().toISOString();
      });

      const retrieved = batchManager.get(batch.id);
      expect(retrieved?.status).toBe('completed');
      expect(retrieved?.progress.completed).toBe(2);
      expect(retrieved?.completedAt).toBeDefined();
    });

    it('should return undefined for non-existent batch', () => {
      const result = batchManager.update('non-existent-id', (b) => {
        b.status = 'failed';
      });

      expect(result).toBeUndefined();
    });

    it('should handle complex updates with operations', () => {
      const operations = [
        {
          id: 'op-1',
          type: 'schedule_video' as const,
          videoId: 'video-1',
          status: 'pending' as const,
          label: 'Video 1',
        },
        {
          id: 'op-2',
          type: 'schedule_video' as const,
          videoId: 'video-2',
          status: 'pending' as const,
          label: 'Video 2',
        },
      ];

      const batchData = {
        type: 'schedule_videos' as const,
        status: 'pending' as const,
        progress: { total: 2, completed: 0, failed: 0 },
        operations,
        startedAt: new Date().toISOString(),
      };

      const batch = batchManager.create(batchData);

      const updated = batchManager.update(batch.id, (b) => {
        b.status = 'in_progress';
        b.operations[0].status = 'completed';
        b.operations[0].result = { scheduledTime: '2024-01-01T10:00:00Z' };
        b.operations[1].status = 'in_progress';
        b.progress.completed = 1;
      });

      expect(updated?.status).toBe('in_progress');
      expect(updated?.operations[0].status).toBe('completed');
      expect(updated?.operations[0].result).toEqual({ scheduledTime: '2024-01-01T10:00:00Z' });
      expect(updated?.operations[1].status).toBe('in_progress');
      expect(updated?.progress.completed).toBe(1);
    });

    it('should handle multiple consecutive updates', () => {
      const batchData = {
        type: 'metadata_update' as const,
        status: 'pending' as const,
        progress: { total: 3, completed: 0, failed: 0 },
        operations: [],
        startedAt: new Date().toISOString(),
      };

      const batch = batchManager.create(batchData);

      // First update
      batchManager.update(batch.id, (b) => {
        b.status = 'in_progress';
        b.progress.completed = 1;
      });

      // Second update
      batchManager.update(batch.id, (b) => {
        b.progress.completed = 2;
      });

      // Third update
      const final = batchManager.update(batch.id, (b) => {
        b.status = 'completed';
        b.progress.completed = 3;
        b.completedAt = new Date().toISOString();
      });

      expect(final?.status).toBe('completed');
      expect(final?.progress.completed).toBe(3);
      expect(final?.completedAt).toBeDefined();

      // Verify persistence
      const retrieved = batchManager.get(batch.id);
      expect(retrieved).toEqual(final);
    });

    it('should handle updates with error information', () => {
      const batchData = {
        type: 'schedule_videos' as const,
        status: 'in_progress' as const,
        progress: { total: 1, completed: 0, failed: 0 },
        operations: [{
          id: 'op-1',
          type: 'schedule_video' as const,
          videoId: 'video-1',
          status: 'in_progress' as const,
          label: 'Failing Video',
        }],
        startedAt: new Date().toISOString(),
      };

      const batch = batchManager.create(batchData);

      const updated = batchManager.update(batch.id, (b) => {
        b.status = 'failed';
        b.progress.failed = 1;
        b.error = 'API quota exceeded';
        b.operations[0].status = 'failed';
        b.operations[0].error = 'API quota exceeded';
        b.completedAt = new Date().toISOString();
      });

      expect(updated?.status).toBe('failed');
      expect(updated?.progress.failed).toBe(1);
      expect(updated?.error).toBe('API quota exceeded');
      expect(updated?.operations[0].status).toBe('failed');
      expect(updated?.operations[0].error).toBe('API quota exceeded');
    });
  });

  describe('clear', () => {
    it('should remove all batches from storage', () => {
      // Create multiple batches
      const batch1 = batchManager.create({
        type: 'schedule_videos',
        status: 'pending',
        progress: { total: 1, completed: 0, failed: 0 },
        operations: [],
        startedAt: new Date().toISOString(),
      });

      const batch2 = batchManager.create({
        type: 'playlist_management',
        status: 'completed',
        progress: { total: 2, completed: 2, failed: 0 },
        operations: [],
        startedAt: new Date().toISOString(),
      });

      // Verify they exist
      expect(batchManager.get(batch1.id)).toBeDefined();
      expect(batchManager.get(batch2.id)).toBeDefined();

      // Clear all
      batchManager.clear();

      // Verify they're gone
      expect(batchManager.get(batch1.id)).toBeUndefined();
      expect(batchManager.get(batch2.id)).toBeUndefined();
    });

    it('should allow new batches after clearing', () => {
      // Create and clear
      batchManager.create({
        type: 'schedule_videos',
        status: 'pending',
        progress: { total: 1, completed: 0, failed: 0 },
        operations: [],
        startedAt: new Date().toISOString(),
      });

      batchManager.clear();

      // Create new batch after clearing
      const newBatch = batchManager.create({
        type: 'metadata_update',
        status: 'pending',
        progress: { total: 1, completed: 0, failed: 0 },
        operations: [],
        startedAt: new Date().toISOString(),
      });

      expect(batchManager.get(newBatch.id)).toEqual(newBatch);
    });

    it('should be safe to call on empty storage', () => {
      expect(() => batchManager.clear()).not.toThrow();

      // Should still work normally after clearing empty storage
      const batch = batchManager.create({
        type: 'schedule_videos',
        status: 'pending',
        progress: { total: 1, completed: 0, failed: 0 },
        operations: [],
        startedAt: new Date().toISOString(),
      });

      expect(batchManager.get(batch.id)).toEqual(batch);
    });
  });

  describe('concurrency and edge cases', () => {
    it('should handle rapid batch creation', () => {
      const batches: BatchOperation[] = [];

      // Create many batches rapidly
      for (let i = 0; i < 100; i++) {
        const batch = batchManager.create({
          type: 'schedule_videos',
          status: 'pending',
          progress: { total: 1, completed: 0, failed: 0 },
          operations: [],
          startedAt: new Date().toISOString(),
          metadata: { index: i },
        });
        batches.push(batch);
      }

      // Verify all batches are unique and retrievable
      const uniqueIds = new Set(batches.map(b => b.id));
      expect(uniqueIds.size).toBe(100);

      batches.forEach((batch, index) => {
        const retrieved = batchManager.get(batch.id);
        expect(retrieved).toEqual(batch);
        expect(retrieved?.metadata?.index).toBe(index);
      });
    });

    it('should handle simultaneous updates to different batches', () => {
      const batch1 = batchManager.create({
        type: 'schedule_videos',
        status: 'pending',
        progress: { total: 1, completed: 0, failed: 0 },
        operations: [],
        startedAt: new Date().toISOString(),
      });

      const batch2 = batchManager.create({
        type: 'playlist_management',
        status: 'pending',
        progress: { total: 1, completed: 0, failed: 0 },
        operations: [],
        startedAt: new Date().toISOString(),
      });

      // Update both batches
      batchManager.update(batch1.id, (b) => {
        b.status = 'completed';
        b.progress.completed = 1;
      });

      batchManager.update(batch2.id, (b) => {
        b.status = 'failed';
        b.progress.failed = 1;
      });

      // Verify updates are isolated
      const retrieved1 = batchManager.get(batch1.id);
      const retrieved2 = batchManager.get(batch2.id);

      expect(retrieved1?.status).toBe('completed');
      expect(retrieved1?.progress.completed).toBe(1);

      expect(retrieved2?.status).toBe('failed');
      expect(retrieved2?.progress.failed).toBe(1);
    });

    it('should maintain referential integrity for operations', () => {
      const operations = [
        {
          id: 'op-1',
          type: 'schedule_video' as const,
          videoId: 'video-1',
          status: 'pending' as const,
          label: 'Test Video',
        },
      ];

      const batch = batchManager.create({
        type: 'schedule_videos',
        status: 'pending',
        progress: { total: 1, completed: 0, failed: 0 },
        operations,
        startedAt: new Date().toISOString(),
      });

      // Update operation
      batchManager.update(batch.id, (b) => {
        b.operations[0].status = 'completed';
        b.operations[0].result = { success: true };
      });

      const retrieved = batchManager.get(batch.id);
      expect(retrieved?.operations[0].status).toBe('completed');
      expect(retrieved?.operations[0].result).toEqual({ success: true });
      expect(retrieved?.operations[0].id).toBe('op-1');
    });
  });
});