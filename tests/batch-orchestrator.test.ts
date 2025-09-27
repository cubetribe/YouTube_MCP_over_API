import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BatchOrchestrator } from '../src/batch/batch-orchestrator.js';
import { batchManager } from '../src/batch/batch-manager.js';

beforeEach(() => {
  batchManager.clear();
});

describe('BatchOrchestrator', () => {
  it('processes queued items sequentially and records results', async () => {
    const listener = vi.fn();
    const orchestrator = new BatchOrchestrator(listener);

    const batch = orchestrator.enqueue({
      type: 'schedule_videos',
      metadata: { test: true },
      items: [
        {
          id: 'first',
          label: 'First operation',
          type: 'test_op',
          run: async () => ({ result: { ok: true } }),
        },
        {
          id: 'second',
          label: 'Second operation',
          type: 'test_op',
          run: async () => ({ result: { ok: true } }),
        },
      ],
    });

    await vi.waitFor(() => {
      const record = batchManager.get(batch.id);
      expect(record?.status).toBe('completed');
    });

    const record = batchManager.get(batch.id)!;
    expect(record.progress.completed).toBe(2);
    expect(record.operations.map((op) => op.status)).toEqual(['completed', 'completed']);
    expect(listener).toHaveBeenCalled();
  });

  it('captures failures without stopping remaining operations', async () => {
    const orchestrator = new BatchOrchestrator();

    const batch = orchestrator.enqueue({
      type: 'playlist_management',
      items: [
        {
          id: 'will-fail',
          type: 'test_op',
          run: async () => {
            throw new Error('Boom');
          },
        },
        {
          id: 'will-succeed',
          type: 'test_op',
          run: async () => ({ result: { ok: true } }),
        },
      ],
    });

    await vi.waitFor(() => {
      const record = batchManager.get(batch.id);
      expect(record?.status).toBe('failed');
    });

    const record = batchManager.get(batch.id)!;
    expect(record.progress.failed).toBe(1);
    expect(record.progress.completed).toBe(1);
    expect(record.operations[0].status).toBe('failed');
    expect(record.operations[1].status).toBe('completed');
  });
});
