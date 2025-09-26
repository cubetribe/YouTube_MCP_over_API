export type OperationType =
  | 'videos.list'
  | 'videos.update'
  | 'videos.insert'
  | 'search.list'
  | 'playlists.insert'
  | 'playlists.list'
  | 'playlists.update'
  | 'playlistItems.insert';

const DEFAULT_COSTS: Record<OperationType, number> = {
  'videos.list': 1,
  'videos.update': 50,
  'videos.insert': 1600,
  'search.list': 100,
  'playlists.insert': 50,
  'playlists.list': 1,
  'playlists.update': 50,
  'playlistItems.insert': 50,
};

export class QuotaManager {
  private quotaLimit: number;
  private usage = 0;
  private lastReset: Date;

  constructor(limit = 10_000) {
    this.quotaLimit = limit;
    this.lastReset = this.midnightPacific();
  }

  canExecute(operation: OperationType): boolean {
    this.maybeReset();
    return this.usage + DEFAULT_COSTS[operation] <= this.quotaLimit;
  }

  record(operation: OperationType, success: boolean): void {
    if (!success) return;
    this.maybeReset();
    this.usage += DEFAULT_COSTS[operation];
  }

  private maybeReset() {
    const now = this.midnightPacific();
    if (now > this.lastReset) {
      this.lastReset = now;
      this.usage = 0;
    }
  }

  private midnightPacific(): Date {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
    const pacific = new Date(utc - 8 * 60 * 60 * 1000);
    pacific.setUTCHours(8, 0, 0, 0); // midnight PT = 08:00 UTC
    return pacific;
  }
}
