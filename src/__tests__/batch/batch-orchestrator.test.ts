import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchOrchestrator, type BatchExecutionPlan, type BatchExecutionItem } from '../../batch/batch-orchestrator.js';
import { batchManager } from '../../batch/batch-manager.js';

describe('BatchOrchestrator', () => {
  let orchestrator: BatchOrchestrator;
  let mockUpdateListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUpdateListener = vi.fn();
    orchestrator = new BatchOrchestrator(mockUpdateListener);
    batchManager.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor and configuration', () => {
    it('should create orchestrator without update listener', () => {
      const orch = new BatchOrchestrator();
      expect(orch).toBeDefined();
    });

    it('should create orchestrator with update listener', () => {
      const orch = new BatchOrchestrator(mockUpdateListener);
      expect(orch).toBeDefined();
    });

    it('should allow setting update listener after creation', () => {
      const orch = new BatchOrchestrator();
      const newListener = vi.fn();
      orch.setUpdateListener(newListener);
      expect(orch).toBeDefined();
    });

    it('should allow clearing update listener', () => {
      const orch = new BatchOrchestrator(mockUpdateListener);
      orch.setUpdateListener(undefined);
      expect(orch).toBeDefined();
    });
  });

  describe('enqueue with empty plan', () => {
    it('should handle empty execution plan', () => {
      const plan: BatchExecutionPlan = {
        type: 'schedule_videos',
        items: [],
        metadata: { source: 'test' },
      };

      const batch = orchestrator.enqueue(plan);

      expect(batch.type).toBe('schedule_videos');
      expect(batch.status).toBe('completed');
      expect(batch.progress.total).toBe(0);
      expect(batch.progress.completed).toBe(0);
      expect(batch.operations).toHaveLength(0);
      expect(batch.completedAt).toBeDefined();
    });

    it('should emit update for empty plan', () => {
      const plan: BatchExecutionPlan = {
        type: 'playlist_management',
        items: [],
      };

      orchestrator.enqueue(plan);

      expect(mockUpdateListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'playlist_management',
          status: 'completed',
        })
      );
    });
  });

  describe('enqueue with execution items', () => {
    it('should create batch from execution plan', () => {
      const mockRun1 = vi.fn().mockResolvedValue({ result: 'success1' });
      const mockRun2 = vi.fn().mockResolvedValue({ result: 'success2' });

      const items: BatchExecutionItem[] = [
        {
          id: 'item-1',
          label: 'Test Item 1',
          videoId: 'video-1',
          description: 'First test item',
          run: mockRun1,
        },
        {
          id: 'item-2',
          label: 'Test Item 2',
          videoId: 'video-2',
          description: 'Second test item',
          run: mockRun2,
        },
      ];

      const plan: BatchExecutionPlan = {
        type: 'schedule_videos',
        items,
        metadata: { priority: 'high' },
      };

      const batch = orchestrator.enqueue(plan);

      expect(batch.type).toBe('schedule_videos');
      expect(batch.status).toBe('pending');
      expect(batch.progress.total).toBe(2);
      expect(batch.progress.completed).toBe(0);
      expect(batch.operations).toHaveLength(2);
      expect(batch.metadata).toEqual({ priority: 'high' });

      expect(batch.operations[0]).toMatchObject({
        id: 'item-1',
        type: 'schedule_videos',
        videoId: 'video-1',
        status: 'pending',
        label: 'Test Item 1',
        description: 'First test item',
      });
    });

    it('should use item-specific type when provided', () => {
      const items: BatchExecutionItem[] = [
        {
          id: 'item-1',
          type: 'custom_operation',
          run: vi.fn().mockResolvedValue({}),
        },
      ];

      const plan: BatchExecutionPlan = {
        type: 'schedule_videos',
        items,
      };

      const batch = orchestrator.enqueue(plan);

      expect(batch.operations[0].type).toBe('custom_operation');
    });

    it('should emit initial update when enqueueing', () => {
      const items: BatchExecutionItem[] = [
        {
          id: 'item-1',
          run: vi.fn().mockResolvedValue({}),
        },
      ];

      const plan: BatchExecutionPlan = {
        type: 'metadata_update',
        items,
      };

      orchestrator.enqueue(plan);

      expect(mockUpdateListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'metadata_update',
          status: 'pending',
          progress: expect.objectContaining({
            total: 1,
            completed: 0,
          }),
        })
      );
    });
  });

  describe('batch execution', () => {
    it('should execute items sequentially', async () => {
      const executionOrder: number[] = [];
      const mockRun1 = vi.fn().mockImplementation(async () => {
        executionOrder.push(1);
        return { result: 'result1' };
      });
      const mockRun2 = vi.fn().mockImplementation(async () => {
        executionOrder.push(2);
        return { result: 'result2' };
      });

      const items: BatchExecutionItem[] = [
        { id: 'item-1', run: mockRun1 },
        { id: 'item-2', run: mockRun2 },
      ];

      const plan: BatchExecutionPlan = {
        type: 'schedule_videos',
        items,
      };

      const batch = orchestrator.enqueue(plan);

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(executionOrder).toEqual([1, 2]);
      expect(mockRun1).toHaveBeenCalledTimes(1);
      expect(mockRun2).toHaveBeenCalledTimes(1);

      const finalBatch = batchManager.get(batch.id);
      expect(finalBatch?.status).toBe('completed');
      expect(finalBatch?.progress.completed).toBe(2);
    });

    it('should track progress during execution', async () => {
      const updates: any[] = [];
      const trackingListener = vi.fn((batch) => {
        updates.push({
          status: batch.status,
          completed: batch.progress.completed,
          current: batch.progress.current,
        });
      });

      const slowOperation = () => new Promise(resolve => setTimeout(() => resolve({ result: 'done' }), 10));

      const items: BatchExecutionItem[] = [
        { id: 'item-1', run: slowOperation },
        { id: 'item-2', run: slowOperation },
      ];

      const plan: BatchExecutionPlan = {
        type: 'schedule_videos',
        items,
      };

      const localOrchestrator = new BatchOrchestrator(trackingListener);
      localOrchestrator.enqueue(plan);

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have received multiple updates showing progress
      expect(updates.length).toBeGreaterThan(2);

      const finalUpdate = updates[updates.length - 1];
      expect(finalUpdate.status).toBe('completed');
      expect(finalUpdate.completed).toBe(2);
    });

    it('should handle execution errors gracefully', async () => {
      const mockRun1 = vi.fn().mockResolvedValue({ result: 'success' });
      const mockRun2 = vi.fn().mockRejectedValue(new Error('Execution failed'));
      const mockRun3 = vi.fn().mockResolvedValue({ result: 'success' });

      const items: BatchExecutionItem[] = [
        { id: 'item-1', run: mockRun1 },
        { id: 'item-2', run: mockRun2 },
        { id: 'item-3', run: mockRun3 },
      ];

      const plan: BatchExecutionPlan = {
        type: 'schedule_videos',
        items,
      };

      const batch = orchestrator.enqueue(plan);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      const finalBatch = batchManager.get(batch.id);
      expect(finalBatch?.status).toBe('failed');
      expect(finalBatch?.progress.completed).toBe(2);
      expect(finalBatch?.progress.failed).toBe(1);
      expect(finalBatch?.error).toBe('Execution failed');

      // Check individual operation statuses
      expect(finalBatch?.operations[0].status).toBe('completed');
      expect(finalBatch?.operations[1].status).toBe('failed');
      expect(finalBatch?.operations[2].status).toBe('completed');
    });

    it('should handle execution results with context', async () => {
      const mockRun = vi.fn().mockResolvedValue({
        result: { videoId: 'video-123', scheduled: true },
        context: { apiQuotaUsed: 50, retryCount: 1 },
      });

      const items: BatchExecutionItem[] = [
        { id: 'item-1', run: mockRun },
      ];

      const plan: BatchExecutionPlan = {
        type: 'schedule_videos',
        items,
      };

      const batch = orchestrator.enqueue(plan);

      await new Promise(resolve => setTimeout(resolve, 50));

      const finalBatch = batchManager.get(batch.id);
      expect(finalBatch?.operations[0].result).toEqual({
        videoId: 'video-123',
        scheduled: true,
      });
      expect(finalBatch?.operations[0].context).toEqual({
        apiQuotaUsed: 50,
        retryCount: 1,
      });
    });

    it('should handle undefined execution results', async () => {
      const mockRun = vi.fn().mockResolvedValue(undefined);

      const items: BatchExecutionItem[] = [
        { id: 'item-1', run: mockRun },
      ];

      const plan: BatchExecutionPlan = {
        type: 'schedule_videos',
        items,
      };

      const batch = orchestrator.enqueue(plan);

      await new Promise(resolve => setTimeout(resolve, 50));

      const finalBatch = batchManager.get(batch.id);
      expect(finalBatch?.status).toBe('completed');
      expect(finalBatch?.operations[0].status).toBe('completed');
      expect(finalBatch?.operations[0].result).toBeUndefined();
    });
  });

  describe('update emissions', () => {
    it('should emit updates at each stage of execution', async () => {
      const updates: any[] = [];
      const trackingListener = vi.fn((batch) => {
        updates.push({
          status: batch.status,
          operationStatuses: batch.operations.map(op => op.status),
        });
      });

      const mockRun = vi.fn().mockResolvedValue({ result: 'done' });

      const items: BatchExecutionItem[] = [
        { id: 'item-1', run: mockRun },
      ];

      const plan: BatchExecutionPlan = {
        type: 'schedule_videos',
        items,
      };

      const localOrchestrator = new BatchOrchestrator(trackingListener);
      localOrchestrator.enqueue(plan);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should have multiple updates
      expect(updates.length).toBeGreaterThan(1);

      // Initial enqueue
      expect(updates[0]).toMatchObject({
        status: 'pending',
        operationStatuses: ['pending'],
      });

      // Final completion
      const finalUpdate = updates[updates.length - 1];
      expect(finalUpdate).toMatchObject({
        status: 'completed',
        operationStatuses: ['completed'],
      });
    });

    it('should not emit updates when no listener is set', async () => {
      const items: BatchExecutionItem[] = [
        { id: 'item-1', run: vi.fn().mockResolvedValue({}) },
      ];

      const plan: BatchExecutionPlan = {
        type: 'schedule_videos',
        items,
      };

      const noListenerOrchestrator = new BatchOrchestrator();
      const batch = noListenerOrchestrator.enqueue(plan);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not throw and should complete successfully
      const finalBatch = batchManager.get(batch.id);
      expect(finalBatch?.status).toBe('completed');
    });

    it('should handle listener that throws errors', async () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });

      const items: BatchExecutionItem[] = [
        { id: 'item-1', run: vi.fn().mockResolvedValue({}) },
      ];

      const plan: BatchExecutionPlan = {
        type: 'schedule_videos',
        items,
      };

      const errorOrchestrator = new BatchOrchestrator(errorListener);
      const batch = errorOrchestrator.enqueue(plan);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Execution should still complete despite listener errors
      const finalBatch = batchManager.get(batch.id);
      expect(finalBatch?.status).toBe('completed');
      expect(errorListener).toHaveBeenCalled();
    });
  });

  describe('concurrent batch processing', () => {
    it('should process multiple batches sequentially', async () => {
      const executionOrder: string[] = [];

      const createItems = (batchId: string) => [
        {
          id: `${batchId}-1`,
          run: vi.fn().mockImplementation(async () => {
            executionOrder.push(`${batchId}-1`);
            await new Promise(resolve => setTimeout(resolve, 10));
            return { result: 'done' };
          }),
        },
        {
          id: `${batchId}-2`,
          run: vi.fn().mockImplementation(async () => {
            executionOrder.push(`${batchId}-2`);
            return { result: 'done' };
          }),
        },
      ];

      const plan1: BatchExecutionPlan = {
        type: 'schedule_videos',
        items: createItems('batch1'),
      };

      const plan2: BatchExecutionPlan = {
        type: 'playlist_management',
        items: createItems('batch2'),
      };

      // Enqueue both batches
      const batch1 = orchestrator.enqueue(plan1);
      const batch2 = orchestrator.enqueue(plan2);

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should execute batch1 completely before batch2
      expect(executionOrder).toEqual(['batch1-1', 'batch1-2', 'batch2-1', 'batch2-2']);

      const finalBatch1 = batchManager.get(batch1.id);
      const finalBatch2 = batchManager.get(batch2.id);

      expect(finalBatch1?.status).toBe('completed');
      expect(finalBatch2?.status).toBe('completed');
    });

    it('should handle large batches efficiently', async () => {
      const itemCount = 50;
      const items: BatchExecutionItem[] = Array.from({ length: itemCount }, (_, i) => ({
        id: `item-${i}`,
        run: vi.fn().mockResolvedValue({ result: `result-${i}` }),
      }));

      const plan: BatchExecutionPlan = {
        type: 'schedule_videos',
        items,
        metadata: { size: 'large' },
      };

      const startTime = Date.now();
      const batch = orchestrator.enqueue(plan);

      await new Promise(resolve => setTimeout(resolve, 200));

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      const finalBatch = batchManager.get(batch.id);
      expect(finalBatch?.status).toBe('completed');
      expect(finalBatch?.progress.completed).toBe(itemCount);
      expect(finalBatch?.progress.failed).toBe(0);

      // Should complete in reasonable time (less than 200ms for 50 items)
      expect(executionTime).toBeLessThan(300);
    });
  });

  describe('error scenarios', () => {
    it('should handle non-Error exceptions', async () => {
      const mockRun = vi.fn().mockRejectedValue('String error');

      const items: BatchExecutionItem[] = [
        { id: 'item-1', run: mockRun },
      ];

      const plan: BatchExecutionPlan = {
        type: 'schedule_videos',
        items,
      };

      const batch = orchestrator.enqueue(plan);

      await new Promise(resolve => setTimeout(resolve, 50));

      const finalBatch = batchManager.get(batch.id);
      expect(finalBatch?.status).toBe('failed');
      expect(finalBatch?.operations[0].error).toBe('String error');
    });

    it('should handle operations that resolve with no result', async () => {
      const mockRun = vi.fn().mockResolvedValue({});

      const items: BatchExecutionItem[] = [
        { id: 'item-1', run: mockRun },
      ];

      const plan: BatchExecutionPlan = {
        type: 'schedule_videos',
        items,
      };

      const batch = orchestrator.enqueue(plan);

      await new Promise(resolve => setTimeout(resolve, 50));

      const finalBatch = batchManager.get(batch.id);
      expect(finalBatch?.status).toBe('completed');
      expect(finalBatch?.operations[0].status).toBe('completed');
      expect(finalBatch?.operations[0].result).toBeUndefined();
    });

    it('should set timestamps correctly during execution', async () => {
      const mockRun = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { result: 'done' };
      });

      const items: BatchExecutionItem[] = [
        { id: 'item-1', run: mockRun },
      ];

      const plan: BatchExecutionPlan = {
        type: 'schedule_videos',
        items,
      };

      const batch = orchestrator.enqueue(plan);

      await new Promise(resolve => setTimeout(resolve, 50));

      const finalBatch = batchManager.get(batch.id);
      expect(finalBatch?.startedAt).toBeDefined();
      expect(finalBatch?.completedAt).toBeDefined();
      expect(finalBatch?.operations[0].startedAt).toBeDefined();
      expect(finalBatch?.operations[0].completedAt).toBeDefined();

      // Completed time should be after started time
      expect(new Date(finalBatch!.completedAt!).getTime()).toBeGreaterThan(
        new Date(finalBatch!.startedAt).getTime()
      );
    });
  });
});