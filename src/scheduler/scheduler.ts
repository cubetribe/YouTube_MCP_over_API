export interface SchedulingOptions {
  startDate?: string;
  endDate?: string;
  timeSlots: string[];
  timezone: string;
  mode: 'preview' | 'apply';
  spacing?: {
    minHoursBetweenVideos?: number;
    maxVideosPerDay?: number;
  };
  overrides?: Record<string, string>;
}

export interface VideoSchedulingInput {
  videoId: string;
  title: string;
  category?: string;
}

export interface ScheduledVideo {
  videoId: string;
  title: string;
  scheduledTime: string;
  source: 'override' | 'algorithm';
  category?: string;
}

export interface SchedulingResult {
  mode: 'preview' | 'apply';
  scheduled: ScheduledVideo[];
  conflicts: Array<{ videoId: string; message: string }>;
  summary: {
    total: number;
    scheduled: number;
    skipped: number;
    timezone: string;
  };
}

export class VideoScheduler {
  private options: SchedulingOptions;

  constructor(options: SchedulingOptions) {
    if (!options.timeSlots || options.timeSlots.length === 0) {
      throw new Error('At least one time slot must be provided.');
    }
    this.options = options;
  }

  schedule(videos: VideoSchedulingInput[]): SchedulingResult {
    const scheduled: ScheduledVideo[] = [];
    const conflicts: Array<{ videoId: string; message: string }> = [];
    const overrides = this.options.overrides || {};

    for (const video of videos) {
      if (overrides[video.videoId]) {
        scheduled.push({
          videoId: video.videoId,
          title: video.title,
          category: video.category,
          scheduledTime: overrides[video.videoId],
          source: 'override',
        });
      }
    }

    const remaining = videos.filter(video => !overrides[video.videoId]);
    const start = this.options.startDate ? new Date(this.options.startDate) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = this.options.endDate ? new Date(this.options.endDate) : null;

    const minSpacing = this.options.spacing?.minHoursBetweenVideos ?? 6;
    const maxPerDay = this.options.spacing?.maxVideosPerDay ?? this.options.timeSlots.length;
    const perDayCounts = new Map<string, number>();

    let cursor = new Date(start);
    let slotIndex = 0;

    for (const video of remaining) {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 500) {
        const dayKey = cursor.toISOString().split('T')[0];
        const count = perDayCounts.get(dayKey) || 0;
        if (count >= maxPerDay) {
          cursor = this.nextDay(cursor);
          slotIndex = 0;
          attempts++;
          continue;
        }

        const slot = this.options.timeSlots[slotIndex % this.options.timeSlots.length];
        const [hour, minute] = slot.split(':').map(Number);
        const candidate = new Date(cursor);
        candidate.setHours(hour ?? 0, minute ?? 0, 0, 0);

        if (candidate < new Date()) {
          slotIndex++;
          attempts++;
          continue;
        }

        if (end && candidate > end) {
          conflicts.push({ videoId: video.videoId, message: 'No available slot within the selected range.' });
          placed = true;
          break;
        }

        if (scheduled.length > 0) {
          const last = scheduled[scheduled.length - 1];
          const diffHours = Math.abs((candidate.getTime() - new Date(last.scheduledTime).getTime()) / 3_600_000);
          if (diffHours < minSpacing && last.source !== 'override') {
            slotIndex++;
            attempts++;
            continue;
          }
        }

        scheduled.push({
          videoId: video.videoId,
          title: video.title,
          category: video.category,
          scheduledTime: candidate.toISOString(),
          source: 'algorithm',
        });

        perDayCounts.set(dayKey, count + 1);
        slotIndex++;
        placed = true;
      }

      if (!placed) {
        conflicts.push({ videoId: video.videoId, message: 'Could not place video within retry limit.' });
      }
    }

    return {
      mode: this.options.mode,
      scheduled,
      conflicts,
      summary: {
        total: videos.length,
        scheduled: scheduled.length,
        skipped: conflicts.length,
        timezone: this.options.timezone,
      },
    };
  }

  private nextDay(date: Date): Date {
    const next = new Date(date);
    next.setDate(date.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }
}
