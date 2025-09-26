import { batchManager } from './batch-manager.js';
import type { BatchOperation, BatchOperationItem } from '../types/index.js';

export interface BatchExecutionResult {
  result?: any;
  context?: Record<string, unknown>;
}

export interface BatchExecutionItem {
  id: string;
  label?: string;
  type?: string;
  videoId?: string;
  playlistId?: string;
  description?: string;
  run: () => Promise<BatchExecutionResult | void>;
}

export interface BatchExecutionPlan {
  type: BatchOperation['type'];
  items: BatchExecutionItem[];
  metadata?: Record<string, unknown>;
}

interface BatchQueueItem {
  batchId: string;
  plan: BatchExecutionPlan;
}

export type BatchUpdateListener = (batch: BatchOperation) => void;

export class BatchOrchestrator {
  private queue: BatchQueueItem[] = [];
  private processing = false;

  constructor(private onUpdate?: BatchUpdateListener) {}

  setUpdateListener(listener?: BatchUpdateListener): void {
    this.onUpdate = listener;
  }

  enqueue(plan: BatchExecutionPlan): BatchOperation {
    const timestamp = new Date().toISOString();
    const operations: BatchOperationItem[] = plan.items.map(item => ({
      id: item.id,
      type: item.type ?? plan.type,
      videoId: item.videoId,
      playlistId: item.playlistId,
      status: 'pending',
      label: item.label,
      description: item.description,
      context: undefined,
    }));

    const batch = batchManager.create({
      type: plan.type,
      status: plan.items.length === 0 ? 'completed' : 'pending',
      progress: {
        total: plan.items.length,
        completed: 0,
        failed: 0,
      },
      operations,
      startedAt: timestamp,
      metadata: plan.metadata,
    });

    if (plan.items.length === 0) {
      batchManager.update(batch.id, (record) => {
        record.completedAt = new Date().toISOString();
      });
      this.emitUpdate(batch.id);
      return batch;
    }

    this.queue.push({ batchId: batch.id, plan });
    void this.processQueue();
    this.emitUpdate(batch.id);
    return batch;
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;
      await this.runBatch(item.batchId, item.plan);
    }

    this.processing = false;
  }

  private async runBatch(batchId: string, plan: BatchExecutionPlan): Promise<void> {
    batchManager.update(batchId, (record) => {
      record.status = 'in_progress';
      record.startedAt = record.startedAt ?? new Date().toISOString();
    });
    this.emitUpdate(batchId);

    for (let index = 0; index < plan.items.length; index += 1) {
      const item = plan.items[index];
      batchManager.update(batchId, (record) => {
        record.progress.current = item.id;
        const operation = record.operations[index];
        if (operation) {
          operation.status = 'in_progress';
          operation.startedAt = new Date().toISOString();
        }
      });
      this.emitUpdate(batchId);

      try {
        const executionResult = await item.run();
        batchManager.update(batchId, (record) => {
          record.progress.completed += 1;
          record.progress.current = undefined;
          const operation = record.operations[index];
          if (operation) {
            operation.status = 'completed';
            operation.completedAt = new Date().toISOString();
            if (executionResult && 'result' in executionResult && executionResult.result !== undefined) {
              operation.result = executionResult.result;
            }
            if (executionResult && executionResult.context) {
              operation.context = {
                ...(operation.context ?? {}),
                ...executionResult.context,
              };
            }
          }
        });
      } catch (error) {
        batchManager.update(batchId, (record) => {
          record.progress.failed += 1;
          record.progress.current = undefined;
          record.error = error instanceof Error ? error.message : String(error);
          const operation = record.operations[index];
          if (operation) {
            operation.status = 'failed';
            operation.completedAt = new Date().toISOString();
            operation.error = error instanceof Error ? error.message : String(error);
          }
        });
      }

      this.emitUpdate(batchId);
    }

    batchManager.update(batchId, (record) => {
      if (record.progress.failed > 0) {
        record.status = 'failed';
      } else {
        record.status = 'completed';
      }
      record.completedAt = new Date().toISOString();
    });
    this.emitUpdate(batchId);
  }

  private emitUpdate(batchId: string): void {
    if (!this.onUpdate) return;
    const batch = batchManager.get(batchId);
    if (batch) {
      this.onUpdate(batch);
    }
  }
}
