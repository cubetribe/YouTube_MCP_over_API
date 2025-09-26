import fs from 'fs/promises';
import path from 'path';
import type { YouTubeVideo } from '../types/index.js';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

export interface BackupSummary {
  date: string;
  videoCount: number;
  files: string[];
}

export class BackupService {
  async backupVideo(video: YouTubeVideo): Promise<string> {
    const dateDir = new Date().toISOString().split('T')[0];
    const dir = path.join(BACKUP_DIR, dateDir);
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${video.id}.json`);
    await fs.writeFile(file, JSON.stringify(video, null, 2), 'utf-8');
    return file;
  }

  async listBackups(): Promise<BackupSummary[]> {
    try {
      const dirs = await fs.readdir(BACKUP_DIR);
      const summaries: BackupSummary[] = [];
      for (const dir of dirs) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dir)) continue;
        const files = await fs.readdir(path.join(BACKUP_DIR, dir));
        summaries.push({ date: dir, videoCount: files.length, files });
      }
      return summaries;
    } catch {
      return [];
    }
  }

  async restoreVideo(date: string, videoId: string): Promise<YouTubeVideo> {
    const file = path.join(BACKUP_DIR, date, `${videoId}.json`);
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw) as YouTubeVideo;
  }
}

export const backupService = new BackupService();
