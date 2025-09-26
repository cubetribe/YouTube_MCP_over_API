import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { MetadataSuggestion, MetadataSuggestionRecord } from '../types/index.js';

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'metadata-suggestions');

async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

function filePath(id: string): string {
  return path.join(STORAGE_DIR, `${id}.json`);
}

async function readRecord(id: string): Promise<MetadataSuggestionRecord | null> {
  try {
    const raw = await fs.readFile(filePath(id), 'utf-8');
    return JSON.parse(raw) as MetadataSuggestionRecord;
  } catch {
    return null;
  }
}

async function writeRecord(record: MetadataSuggestionRecord): Promise<void> {
  await ensureStorageDir();
  await fs.writeFile(filePath(record.id), JSON.stringify(record, null, 2), 'utf-8');
}

export class MetadataReviewStore {
  async saveSuggestion(suggestion: MetadataSuggestion): Promise<MetadataSuggestionRecord> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const record: MetadataSuggestionRecord = {
      ...suggestion,
      id,
      status: 'pending',
      updatedAt: timestamp,
    };
    await writeRecord(record);
    return record;
  }

  async getSuggestion(id: string): Promise<MetadataSuggestionRecord | null> {
    return readRecord(id);
  }

  async acknowledgeGuardrails(id: string): Promise<MetadataSuggestionRecord | null> {
    const record = await readRecord(id);
    if (!record) return null;
    const timestamp = new Date().toISOString();
    record.acknowledgedAt = timestamp;
    record.updatedAt = timestamp;
    await writeRecord(record);
    return record;
  }

  async markApplied(id: string): Promise<MetadataSuggestionRecord | null> {
    const record = await readRecord(id);
    if (!record) return null;
    const timestamp = new Date().toISOString();
    record.status = 'applied';
    record.appliedAt = timestamp;
    record.updatedAt = timestamp;
    await writeRecord(record);
    return record;
  }
}

export const metadataReviewStore = new MetadataReviewStore();
