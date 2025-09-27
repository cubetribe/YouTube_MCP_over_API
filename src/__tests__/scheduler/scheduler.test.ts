import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VideoScheduler,
  type SchedulingOptions,
  type VideoSchedulingInput,
  type ScheduledVideo,
  type SchedulingResult,
} from '../../scheduler/scheduler.js';

describe('VideoScheduler', () => {
  let scheduler: VideoScheduler;
  const baseOptions: SchedulingOptions = {
    timeSlots: ['10:00', '14:00', '18:00'],
    timezone: 'UTC',
    mode: 'preview',
  };

  const sampleVideos: VideoSchedulingInput[] = [
    { videoId: 'video1', title: 'First Video', category: 'Education' },
    { videoId: 'video2', title: 'Second Video', category: 'Technology' },
    { videoId: 'video3', title: 'Third Video' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock current date to make tests deterministic
    vi.setSystemTime(new Date('2024-01-15T09:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Constructor', () => {
    it('should create scheduler with valid options', () => {
      scheduler = new VideoScheduler(baseOptions);
      expect(scheduler).toBeInstanceOf(VideoScheduler);
    });

    it('should throw error when no time slots provided', () => {
      const invalidOptions: SchedulingOptions = {
        ...baseOptions,
        timeSlots: [],
      };

      expect(() => new VideoScheduler(invalidOptions)).toThrow(
        'At least one time slot must be provided.'
      );
    });

    it('should throw error when timeSlots is null/undefined', () => {
      const invalidOptions = {
        ...baseOptions,
        timeSlots: undefined,
      } as any;

      expect(() => new VideoScheduler(invalidOptions)).toThrow(
        'At least one time slot must be provided.'
      );
    });
  });

  describe('Basic Scheduling', () => {
    beforeEach(() => {
      scheduler = new VideoScheduler(baseOptions);
    });

    it('should schedule videos in available time slots', () => {
      const result = scheduler.schedule(sampleVideos);

      expect(result.mode).toBe('preview');
      expect(result.scheduled).toHaveLength(3);
      expect(result.conflicts).toHaveLength(0);
      expect(result.summary).toEqual({
        total: 3,
        scheduled: 3,
        skipped: 0,
        timezone: 'UTC',
      });

      // Should schedule videos starting from the next available slot
      expect(new Date(result.scheduled[0].scheduledTime).getHours()).toBe(10);
      expect(result.scheduled[0].source).toBe('algorithm');
    });

    it('should include video metadata in scheduled results', () => {
      const result = scheduler.schedule(sampleVideos);

      expect(result.scheduled[0]).toEqual({
        videoId: 'video1',
        title: 'First Video',
        category: 'Education',
        scheduledTime: expect.any(String),
        source: 'algorithm',
      });

      expect(result.scheduled[2]).toEqual({
        videoId: 'video3',
        title: 'Third Video',
        category: undefined,
        scheduledTime: expect.any(String),
        source: 'algorithm',
      });
    });

    it('should handle empty video list', () => {
      const result = scheduler.schedule([]);

      expect(result.scheduled).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
      expect(result.summary.total).toBe(0);
    });
  });

  describe('Time Slot Management', () => {
    it('should cycle through time slots across days', () => {
      const manyVideos = Array.from({ length: 6 }, (_, i) => ({
        videoId: `video${i + 1}`,
        title: `Video ${i + 1}`,
      }));

      scheduler = new VideoScheduler(baseOptions);
      const result = scheduler.schedule(manyVideos);

      const scheduledTimes = result.scheduled.map(v => new Date(v.scheduledTime));

      // First 3 videos should be scheduled on the first day
      expect(scheduledTimes[0].getHours()).toBe(10);
      expect(scheduledTimes[1].getHours()).toBe(14);
      expect(scheduledTimes[2].getHours()).toBe(18);

      // Next 3 videos should be scheduled on the next day
      expect(scheduledTimes[3].getHours()).toBe(10);
      expect(scheduledTimes[3].getDate()).toBe(scheduledTimes[0].getDate() + 1);
    });

    it('should skip past time slots on the current day', () => {
      vi.setSystemTime(new Date('2024-01-15T15:00:00Z')); // After 10:00 and 14:00

      scheduler = new VideoScheduler(baseOptions);
      const result = scheduler.schedule([sampleVideos[0]]);

      // Should schedule at 18:00 today (next available slot)
      const scheduledTime = new Date(result.scheduled[0].scheduledTime);
      expect(scheduledTime.getHours()).toBe(18);
      expect(scheduledTime.getDate()).toBe(15); // Same day
    });

    it('should move to next day when all slots are past', () => {
      vi.setSystemTime(new Date('2024-01-15T20:00:00Z')); // After all time slots

      scheduler = new VideoScheduler(baseOptions);
      const result = scheduler.schedule([sampleVideos[0]]);

      // Should schedule at 10:00 tomorrow
      const scheduledTime = new Date(result.scheduled[0].scheduledTime);
      expect(scheduledTime.getHours()).toBe(10);
      expect(scheduledTime.getDate()).toBe(16); // Next day
    });
  });

  describe('Date Range Constraints', () => {
    it('should respect start date', () => {
      const options: SchedulingOptions = {
        ...baseOptions,
        startDate: '2024-01-20', // 5 days in the future
      };

      scheduler = new VideoScheduler(options);
      const result = scheduler.schedule([sampleVideos[0]]);

      const scheduledTime = new Date(result.scheduled[0].scheduledTime);
      expect(scheduledTime.getDate()).toBeGreaterThanOrEqual(20);
    });

    it('should respect end date and create conflicts for videos that cannot fit', () => {
      const options: SchedulingOptions = {
        ...baseOptions,
        startDate: '2024-01-15',
        endDate: '2024-01-15', // Same day only
      };

      scheduler = new VideoScheduler(options);
      const result = scheduler.schedule(Array.from({ length: 5 }, (_, i) => ({
        videoId: `video${i + 1}`,
        title: `Video ${i + 1}`,
      })));

      // Should schedule 3 videos (max time slots) and create conflicts for the rest
      expect(result.scheduled.length).toBeLessThanOrEqual(3);
      expect(result.conflicts.length).toBeGreaterThan(0);

      const conflicts = result.conflicts.filter(c =>
        c.message.includes('No available slot within the selected range')
      );
      expect(conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('Spacing Configuration', () => {
    it('should respect minimum hours between videos', () => {
      const options: SchedulingOptions = {
        ...baseOptions,
        spacing: {
          minHoursBetweenVideos: 8, // Require 8 hours between videos
        },
      };

      scheduler = new VideoScheduler(options);
      const result = scheduler.schedule(sampleVideos);

      for (let i = 1; i < result.scheduled.length; i++) {
        const prev = new Date(result.scheduled[i - 1].scheduledTime);
        const curr = new Date(result.scheduled[i].scheduledTime);
        const diffHours = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60);

        expect(diffHours).toBeGreaterThanOrEqual(8);
      }
    });

    it('should respect maximum videos per day', () => {
      const options: SchedulingOptions = {
        ...baseOptions,
        spacing: {
          maxVideosPerDay: 1, // Only 1 video per day
        },
      };

      scheduler = new VideoScheduler(options);
      const result = scheduler.schedule(sampleVideos);

      // Group by day to verify the constraint
      const videosByDay = new Map<string, number>();
      for (const video of result.scheduled) {
        const day = new Date(video.scheduledTime).toISOString().split('T')[0];
        videosByDay.set(day, (videosByDay.get(day) || 0) + 1);
      }

      for (const [day, count] of videosByDay) {
        expect(count).toBeLessThanOrEqual(1);
      }
    });

    it('should use default spacing values when not provided', () => {
      scheduler = new VideoScheduler(baseOptions);
      const result = scheduler.schedule(Array.from({ length: 10 }, (_, i) => ({
        videoId: `video${i + 1}`,
        title: `Video ${i + 1}`,
      })));

      // Should apply default 6-hour minimum spacing
      for (let i = 1; i < Math.min(result.scheduled.length, 5); i++) {
        const prev = new Date(result.scheduled[i - 1].scheduledTime);
        const curr = new Date(result.scheduled[i].scheduledTime);
        const diffHours = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60);

        expect(diffHours).toBeGreaterThanOrEqual(6);
      }
    });
  });

  describe('Override Handling', () => {
    it('should apply manual overrides before algorithmic scheduling', () => {
      const options: SchedulingOptions = {
        ...baseOptions,
        overrides: {
          'video2': '2024-01-20T12:30:00Z',
        },
      };

      scheduler = new VideoScheduler(options);
      const result = scheduler.schedule(sampleVideos);

      const overriddenVideo = result.scheduled.find(v => v.videoId === 'video2');
      expect(overriddenVideo).toBeDefined();
      expect(overriddenVideo!.scheduledTime).toBe('2024-01-20T12:30:00Z');
      expect(overriddenVideo!.source).toBe('override');

      const algorithmicVideos = result.scheduled.filter(v => v.source === 'algorithm');
      expect(algorithmicVideos).toHaveLength(2);
    });

    it('should not affect spacing calculations for override videos', () => {
      const options: SchedulingOptions = {
        ...baseOptions,
        spacing: { minHoursBetweenVideos: 24 }, // 24 hours apart
        overrides: {
          'video1': '2024-01-15T10:00:00Z', // Override first video
        },
      };

      scheduler = new VideoScheduler(options);
      const result = scheduler.schedule(sampleVideos);

      // Algorithm should still place video2 and video3 respecting the spacing,
      // but not being blocked by the override
      expect(result.scheduled).toHaveLength(3);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('Conflict Detection', () => {
    it('should detect scheduling conflicts when retry limit is reached', () => {
      const options: SchedulingOptions = {
        ...baseOptions,
        endDate: '2024-01-15', // Very restrictive date range
        spacing: { minHoursBetweenVideos: 48 }, // Impossible spacing
      };

      scheduler = new VideoScheduler(options);
      const result = scheduler.schedule(sampleVideos);

      expect(result.conflicts.length).toBeGreaterThan(0);

      const retryLimitConflicts = result.conflicts.filter(c =>
        c.message.includes('Could not place video within retry limit')
      );
      expect(retryLimitConflicts.length).toBeGreaterThan(0);
    });

    it('should provide meaningful conflict messages', () => {
      const options: SchedulingOptions = {
        ...baseOptions,
        endDate: '2024-01-14', // Date in the past
      };

      scheduler = new VideoScheduler(options);
      const result = scheduler.schedule([sampleVideos[0]]);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].videoId).toBe('video1');
      expect(result.conflicts[0].message).toContain('No available slot within the selected range');
    });
  });

  describe('Mode Handling', () => {
    it('should return correct mode in result', () => {
      const previewScheduler = new VideoScheduler({ ...baseOptions, mode: 'preview' });
      const previewResult = previewScheduler.schedule([sampleVideos[0]]);
      expect(previewResult.mode).toBe('preview');

      const applyScheduler = new VideoScheduler({ ...baseOptions, mode: 'apply' });
      const applyResult = applyScheduler.schedule([sampleVideos[0]]);
      expect(applyResult.mode).toBe('apply');
    });
  });

  describe('Summary Statistics', () => {
    it('should provide accurate summary statistics', () => {
      const options: SchedulingOptions = {
        ...baseOptions,
        endDate: '2024-01-15', // Restrictive to cause some conflicts
      };

      scheduler = new VideoScheduler(options);
      const manyVideos = Array.from({ length: 10 }, (_, i) => ({
        videoId: `video${i + 1}`,
        title: `Video ${i + 1}`,
      }));

      const result = scheduler.schedule(manyVideos);

      expect(result.summary.total).toBe(10);
      expect(result.summary.scheduled).toBe(result.scheduled.length);
      expect(result.summary.skipped).toBe(result.conflicts.length);
      expect(result.summary.scheduled + result.summary.skipped).toBe(result.summary.total);
      expect(result.summary.timezone).toBe('UTC');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single time slot correctly', () => {
      const options: SchedulingOptions = {
        ...baseOptions,
        timeSlots: ['12:00'],
      };

      scheduler = new VideoScheduler(options);
      const result = scheduler.schedule(sampleVideos);

      // Should space videos across multiple days since only one slot per day
      const days = new Set(result.scheduled.map(v =>
        new Date(v.scheduledTime).toISOString().split('T')[0]
      ));
      expect(days.size).toBeGreaterThan(1);
    });

    it('should handle videos with identical metadata', () => {
      const identicalVideos = [
        { videoId: 'video1', title: 'Same Title' },
        { videoId: 'video2', title: 'Same Title' },
        { videoId: 'video3', title: 'Same Title' },
      ];

      scheduler = new VideoScheduler(baseOptions);
      const result = scheduler.schedule(identicalVideos);

      expect(result.scheduled).toHaveLength(3);
      expect(result.scheduled.map(v => v.videoId)).toEqual(['video1', 'video2', 'video3']);
    });

    it('should handle different timezone setting', () => {
      const options: SchedulingOptions = {
        ...baseOptions,
        timezone: 'America/New_York',
      };

      scheduler = new VideoScheduler(options);
      const result = scheduler.schedule([sampleVideos[0]]);

      expect(result.summary.timezone).toBe('America/New_York');
    });

    it('should handle invalid time slot format gracefully', () => {
      // The scheduler expects valid time format, but let's test edge case
      const options: SchedulingOptions = {
        ...baseOptions,
        timeSlots: ['25:00'], // Invalid hour
      };

      scheduler = new VideoScheduler(options);
      const result = scheduler.schedule([sampleVideos[0]]);

      // Should still attempt to schedule (NaN handling in Date constructor)
      expect(result.scheduled).toHaveLength(1);
    });
  });

  describe('Performance', () => {
    it('should handle large number of videos efficiently', () => {
      const largeVideoList = Array.from({ length: 100 }, (_, i) => ({
        videoId: `video${i + 1}`,
        title: `Video ${i + 1}`,
      }));

      scheduler = new VideoScheduler(baseOptions);
      const startTime = Date.now();
      const result = scheduler.schedule(largeVideoList);
      const endTime = Date.now();

      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000); // 1 second
      expect(result.scheduled.length + result.conflicts.length).toBe(100);
    });
  });
});