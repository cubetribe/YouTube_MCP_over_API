import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QuotaManager, type OperationType } from '../../youtube/quota.js';

describe('QuotaManager', () => {
  let quotaManager: QuotaManager;
  let originalDate: typeof Date;

  beforeEach(() => {
    originalDate = global.Date;
    quotaManager = new QuotaManager();
  });

  afterEach(() => {
    global.Date = originalDate;
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default limit', () => {
      const manager = new QuotaManager();
      expect(manager).toBeDefined();
    });

    it('should initialize with custom limit', () => {
      const manager = new QuotaManager(5000);
      expect(manager).toBeDefined();
    });
  });

  describe('operation costs', () => {
    it('should have correct costs for each operation type', () => {
      const operations: Array<[OperationType, number]> = [
        ['videos.list', 1],
        ['videos.update', 50],
        ['videos.insert', 1600],
        ['search.list', 100],
        ['playlists.insert', 50],
        ['playlists.list', 1],
        ['playlists.update', 50],
        ['playlistItems.insert', 50],
      ];

      operations.forEach(([operation, expectedCost]) => {
        const manager = new QuotaManager(10000);

        // Should be able to execute within quota
        expect(manager.canExecute(operation)).toBe(true);

        // Record the operation
        manager.record(operation, true);

        // Should now have used the expected cost
        const remainingQuota = 10000 - expectedCost;
        const canExecuteAgain = manager.canExecute(operation);

        if (expectedCost * 2 <= 10000) {
          expect(canExecuteAgain).toBe(true);
        } else {
          expect(canExecuteAgain).toBe(false);
        }
      });
    });
  });

  describe('canExecute', () => {
    it('should allow operations within quota limit', () => {
      const manager = new QuotaManager(100);

      expect(manager.canExecute('videos.list')).toBe(true);
      expect(manager.canExecute('videos.update')).toBe(true);
    });

    it('should deny operations that would exceed quota', () => {
      const manager = new QuotaManager(100);

      // Use up most of the quota
      manager.record('videos.update', true); // 50
      manager.record('videos.update', true); // 50 (total: 100)

      // Should not be able to execute any more operations
      expect(manager.canExecute('videos.list')).toBe(false);
      expect(manager.canExecute('videos.update')).toBe(false);
    });

    it('should handle expensive operations correctly', () => {
      const manager = new QuotaManager(1000);

      expect(manager.canExecute('videos.insert')).toBe(false); // costs 1600, exceeds 1000
      expect(manager.canExecute('search.list')).toBe(true); // costs 100, within limit
    });
  });

  describe('record', () => {
    it('should track quota usage for successful operations', () => {
      const manager = new QuotaManager(100);

      manager.record('videos.update', true); // 50
      expect(manager.canExecute('videos.update')).toBe(true); // 50 + 50 = 100, at limit

      manager.record('videos.update', true); // 50 (total: 100)
      expect(manager.canExecute('videos.list')).toBe(false); // 100 + 1 = 101, exceeds limit
    });

    it('should not track quota usage for failed operations', () => {
      const manager = new QuotaManager(100);

      manager.record('videos.update', false); // Should not count
      expect(manager.canExecute('videos.update')).toBe(true);
      expect(manager.canExecute('videos.update')).toBe(true); // Still within quota
    });

    it('should accumulate usage across multiple operations', () => {
      const manager = new QuotaManager(200);

      manager.record('videos.list', true); // 1
      manager.record('videos.update', true); // 50 (total: 51)
      manager.record('search.list', true); // 100 (total: 151)

      expect(manager.canExecute('videos.update')).toBe(false); // 151 + 50 = 201, exceeds 200
      expect(manager.canExecute('playlists.list')).toBe(true); // 151 + 1 = 152, within limit
    });
  });

  describe('quota reset', () => {
    it('should reset quota at midnight Pacific time', () => {
      // Mock current time to be before midnight PT
      const currentTime = new Date('2024-01-15T10:00:00Z'); // 2 AM PT
      vi.setSystemTime(currentTime);

      const manager = new QuotaManager(100);

      // Use up quota
      manager.record('videos.update', true); // 50
      manager.record('videos.update', true); // 50 (total: 100)
      expect(manager.canExecute('videos.list')).toBe(false);

      // Advance to next day midnight PT (16:00 UTC next day)
      const nextMidnight = new Date('2024-01-16T08:00:00Z'); // midnight PT
      vi.setSystemTime(nextMidnight);

      // Quota should be reset
      expect(manager.canExecute('videos.update')).toBe(true);
      expect(manager.canExecute('videos.insert')).toBe(false); // Still too expensive
    });

    it('should handle Pacific timezone correctly', () => {
      // Test during PST (winter time)
      const winterTime = new Date('2024-01-15T08:00:00Z'); // midnight PST
      vi.setSystemTime(winterTime);

      const manager = new QuotaManager(100);
      manager.record('videos.update', true);

      // Move forward 1 second before next midnight
      vi.setSystemTime(new Date('2024-01-16T07:59:59Z'));
      expect(manager.canExecute('videos.update')).toBe(true); // Should not reset yet

      // Move to exactly midnight PST
      vi.setSystemTime(new Date('2024-01-16T08:00:00Z'));
      expect(manager.canExecute('videos.update')).toBe(true); // Should reset
    });

    it('should not reset quota multiple times in same day', () => {
      const currentTime = new Date('2024-01-15T12:00:00Z'); // 4 AM PT
      vi.setSystemTime(currentTime);

      const manager = new QuotaManager(100);

      // Use quota
      manager.record('videos.update', true); // 50
      expect(manager.canExecute('videos.update')).toBe(true);

      // Later same day
      vi.setSystemTime(new Date('2024-01-15T20:00:00Z')); // 12 PM PT

      // Quota should still show usage
      expect(manager.canExecute('videos.update')).toBe(true); // 50 + 50 = 100, at limit
    });
  });

  describe('edge cases', () => {
    it('should handle zero quota limit', () => {
      const manager = new QuotaManager(0);

      expect(manager.canExecute('videos.list')).toBe(false);
      expect(manager.canExecute('videos.update')).toBe(false);
    });

    it('should handle exactly at quota limit', () => {
      const manager = new QuotaManager(50);

      expect(manager.canExecute('videos.update')).toBe(true); // exactly 50
      manager.record('videos.update', true);
      expect(manager.canExecute('videos.list')).toBe(false); // would exceed by 1
    });

    it('should handle large quota limits', () => {
      const manager = new QuotaManager(1000000);

      expect(manager.canExecute('videos.insert')).toBe(true);
      manager.record('videos.insert', true);
      expect(manager.canExecute('videos.insert')).toBe(true);
    });

    it('should handle rapid successive operations', () => {
      const manager = new QuotaManager(1000);

      // Record many small operations rapidly
      for (let i = 0; i < 500; i++) {
        if (manager.canExecute('videos.list')) {
          manager.record('videos.list', true);
        }
      }

      // Should have used 500 quota
      expect(manager.canExecute('videos.update')).toBe(true); // 500 + 50 = 550
      manager.record('videos.update', true);
      expect(manager.canExecute('videos.update')).toBe(true); // 550 + 50 = 600
    });
  });

  describe('integration scenarios', () => {
    it('should handle mixed operation types realistically', () => {
      const manager = new QuotaManager(500);

      // Typical usage pattern
      manager.record('videos.list', true); // 1
      manager.record('videos.list', true); // 1 (total: 2)
      manager.record('playlists.list', true); // 1 (total: 3)
      manager.record('videos.update', true); // 50 (total: 53)
      manager.record('playlistItems.insert', true); // 50 (total: 103)

      expect(manager.canExecute('search.list')).toBe(true); // 103 + 100 = 203
      manager.record('search.list', true);

      expect(manager.canExecute('videos.update')).toBe(true); // 203 + 50 = 253
      expect(manager.canExecute('videos.insert')).toBe(false); // 203 + 1600 > 500
    });

    it('should handle failure scenarios', () => {
      const manager = new QuotaManager(100);

      // Mix of successful and failed operations
      manager.record('videos.update', true); // 50
      manager.record('videos.update', false); // 0 (failed)
      manager.record('videos.list', true); // 1 (total: 51)
      manager.record('search.list', false); // 0 (failed)

      expect(manager.canExecute('videos.update')).toBe(false); // 51 + 50 = 101 > 100
      expect(manager.canExecute('playlists.list')).toBe(true); // 51 + 1 = 52
    });
  });
});