import { randomUUID } from 'crypto';
import type { BatchOperation } from '../types/index.js';

export class BatchManager {
  private batches = new Map<string, BatchOperation>();

  create(batch: Omit<BatchOperation, 'id'> & { id?: string }): BatchOperation {
    const id = batch.id ?? randomUUID();
    const record: BatchOperation = {
      ...batch,
      id,
    };
    this.batches.set(id, record);
    return record;
  }

  update(batchId: string, updater: (batch: BatchOperation) => void): BatchOperation | undefined {
    const record = this.batches.get(batchId);
    if (!record) return undefined;
    updater(record);
    this.batches.set(batchId, record);
    return record;
  }

  get(batchId: string): BatchOperation | undefined {
    return this.batches.get(batchId);
  }

  clear(): void {
    this.batches.clear();
  }
}

export const batchManager = new BatchManager();
