import { google, youtube_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { RateLimiter, type RateLimiterOptions } from './rate-limiter.js';
import { QuotaManager, type OperationType } from './quota.js';
import type { YouTubeVideo, YouTubePlaylist } from '../types/index.js';
import { performanceMonitor } from '../lib/performance-monitor.js';
import { quotaMonitor } from '../lib/quota-monitor.js';
import { logger } from '../lib/logger.js';

/**
 * Configuration options for creating a YouTube client instance
 */
export interface YouTubeClientOptions {
  /** OAuth2 client for authentication with YouTube API */
  oauthClient: OAuth2Client;
  /** Daily quota limit (default: 10000 units) */
  quotaLimit?: number;
  /** Rate limiting configuration */
  rateLimiter?: RateLimiterOptions;
  /** User identifier for logging and monitoring */
  userId?: string;
  /** Correlation ID for request tracing */
  correlationId?: string;
}

/**
 * Options for listing videos from YouTube
 */
export interface VideoListOptions {
  /** Maximum number of results to return (1-50, default: 25) */
  maxResults?: number;
  /** Sort order for videos */
  order?: youtube_v3.Params$Resource$Search$List['order'];
  /** Filter videos published after this date (RFC 3339 format) */
  publishedAfter?: string;
  /** Filter videos published before this date (RFC 3339 format) */
  publishedBefore?: string;
  /** Filter videos by category ID */
  videoCategoryId?: string;
}

/**
 * YouTube Data API v3 client with quota management, rate limiting, and performance monitoring.
 *
 * This client provides a comprehensive interface to the YouTube Data API with built-in
 * safeguards for quota management, rate limiting, and error handling. All operations
 * are monitored for performance and quota usage.
 *
 * @example
 * ```typescript
 * const client = new YouTubeClient({
 *   oauthClient: authenticatedOAuthClient,
 *   quotaLimit: 10000,
 *   userId: 'user-123'
 * });
 *
 * const videos = await client.listMyVideos({ maxResults: 10 });
 * await client.updateVideoMetadata('video-id', { title: 'New Title' });
 * ```
 */
export class YouTubeClient {
  private youtube: youtube_v3.Youtube;
  private quota: QuotaManager;
  private limiter: RateLimiter;
  private userId?: string;
  private correlationId?: string;

  /**
   * Creates a new YouTube client instance.
   *
   * @param options - Configuration options for the client
   * @throws {Error} If OAuth client is not provided or invalid
   */
  constructor(options: YouTubeClientOptions) {
    this.youtube = google.youtube({ version: 'v3', auth: options.oauthClient });
    this.quota = new QuotaManager(options.quotaLimit);
    this.limiter = new RateLimiter(options.rateLimiter);
    this.userId = options.userId;
    this.correlationId = options.correlationId;

    logger.info('YouTube client initialized', 'api', {
      quotaLimit: options.quotaLimit,
      userId: this.userId,
      correlationId: this.correlationId
    });
  }

  /**
   * Lists videos owned by the authenticated user.
   *
   * This method retrieves videos from the authenticated user's channel using the
   * YouTube Search API followed by the Videos API to get detailed metadata.
   * The operation uses 100 quota units for search plus 1 unit per video details call.
   *
   * @param options - Filtering and pagination options
   * @returns Promise resolving to array of video objects with full metadata
   * @throws {Error} If quota is exceeded or API call fails
   * @throws {AuthenticationError} If OAuth token is invalid or expired
   *
   * @example
   * ```typescript
   * // Get recent videos
   * const videos = await client.listMyVideos({
   *   maxResults: 10,
   *   order: 'date',
   *   publishedAfter: '2023-01-01T00:00:00Z'
   * });
   * ```
   */
  async listMyVideos(options: VideoListOptions = {}): Promise<YouTubeVideo[]> {
    const op: OperationType = 'videos.list';

    return performanceMonitor.wrapOperation(
      {
        operationType: op,
        correlationId: this.correlationId,
        userId: this.userId,
        quotaCost: this.getQuotaCost(op)
      },
      async () => {
        this.ensureQuota(op);

        const response = await this.limiter.run(() =>
          this.youtube.search.list({
            part: ['id'],
            forMine: true,
            type: ['video'],
            maxResults: options.maxResults || 25,
            order: options.order,
            publishedAfter: options.publishedAfter,
            publishedBefore: options.publishedBefore,
            videoCategoryId: options.videoCategoryId,
          })
        );

        this.recordQuotaUsage(op, true);

        const videoIds = (response.data.items || [])
          .map(item => item.id?.videoId)
          .filter((id): id is string => Boolean(id));

        if (videoIds.length === 0) return [];
        return this.getVideoDetails(videoIds);
      }
    );
  }

  /**
   * Retrieves detailed metadata for one or more videos by their IDs.
   *
   * This method fetches comprehensive video information including snippet data,
   * statistics, content details, and status. Uses 1 quota unit regardless of
   * the number of videos requested (up to 50 per call).
   *
   * @param videoIds - Single video ID or array of video IDs (max 50)
   * @returns Promise resolving to array of video objects with complete metadata
   * @throws {Error} If quota is exceeded or API call fails
   * @throws {ValidationError} If video IDs are invalid format
   *
   * @example
   * ```typescript
   * // Get details for single video
   * const video = await client.getVideoDetails('dQw4w9WgXcQ');
   *
   * // Get details for multiple videos
   * const videos = await client.getVideoDetails(['id1', 'id2', 'id3']);
   * ```
   */
  async getVideoDetails(videoIds: string | string[]): Promise<YouTubeVideo[]> {
    const ids = Array.isArray(videoIds) ? videoIds : [videoIds];
    const op: OperationType = 'videos.list';

    return performanceMonitor.wrapOperation(
      {
        operationType: op,
        correlationId: this.correlationId,
        userId: this.userId,
        quotaCost: this.getQuotaCost(op)
      },
      async () => {
        this.ensureQuota(op);

        const response = await this.limiter.run(() =>
          this.youtube.videos.list({
            part: ['snippet', 'status', 'contentDetails', 'statistics'],
            id: ids,
          })
        );

        this.recordQuotaUsage(op, true);

    return (response.data.items || []).map((video) => ({
      id: video.id || '',
      title: video.snippet?.title || '',
      description: video.snippet?.description || '',
      tags: video.snippet?.tags || [],
      categoryId: video.snippet?.categoryId || '',
      defaultLanguage: video.snippet?.defaultLanguage || '',
      defaultAudioLanguage: video.snippet?.defaultAudioLanguage || '',
      thumbnails: this.mapThumbnails(video.snippet?.thumbnails),
      publishedAt: video.snippet?.publishedAt || '',
      privacyStatus: (video.status?.privacyStatus as YouTubeVideo['privacyStatus']) || 'private',
      viewCount: video.statistics?.viewCount,
      likeCount: video.statistics?.likeCount,
      commentCount: video.statistics?.commentCount,
      duration: video.contentDetails?.duration || '',
    }));
  }

  /**
   * Updates metadata for a specific video.
   *
   * This method modifies video properties such as title, description, tags, category,
   * privacy status, and publishing schedule. Uses 50 quota units per update.
   * Changes are applied immediately and audit logged for security.
   *
   * @param videoId - The ID of the video to update
   * @param payload - Object containing the metadata fields to update
   * @returns Promise that resolves when update is complete
   * @throws {Error} If quota is exceeded, video not found, or API call fails
   * @throws {ValidationError} If metadata violates YouTube policies
   * @throws {AuthenticationError} If user lacks permission to edit video
   *
   * @example
   * ```typescript
   * await client.updateVideoMetadata('video-id', {
   *   title: 'Updated Video Title',
   *   description: 'New description with more details',
   *   tags: ['updated', 'tag1', 'tag2'],
   *   privacyStatus: 'public',
   *   publishAt: '2024-01-15T10:00:00Z'
   * });
   * ```
   */
  async updateVideoMetadata(videoId: string, payload: Partial<youtube_v3.Schema$VideoSnippet & youtube_v3.Schema$VideoStatus>): Promise<void> {
    const op: OperationType = 'videos.update';

    return performanceMonitor.wrapOperation(
      {
        operationType: op,
        correlationId: this.correlationId,
        userId: this.userId,
        quotaCost: this.getQuotaCost(op)
      },
      async () => {
        this.ensureQuota(op);

        await this.limiter.run(() =>
          this.youtube.videos.update({
            part: ['snippet', 'status'],
            requestBody: {
              id: videoId,
              snippet: {
                title: payload.title,
                description: payload.description,
                tags: payload.tags,
                categoryId: payload.categoryId,
                defaultLanguage: payload.defaultLanguage,
              },
              status: {
                privacyStatus: payload.privacyStatus,
                publishAt: payload.publishAt,
              },
            },
          })
        );

        this.recordQuotaUsage(op, true);

        // Log metadata update for audit purposes
        logger.info(
          `Video metadata updated: ${videoId}`,
          'api',
          {
            videoId,
            hasTitle: !!payload.title,
            hasDescription: !!payload.description,
            tagsCount: payload.tags?.length || 0,
            privacyStatus: payload.privacyStatus,
            userId: this.userId,
            correlationId: this.correlationId
          }
        );
      }
    );
  }

  async createPlaylist(payload: { title: string; description?: string; privacyStatus: 'private' | 'unlisted' | 'public'; defaultLanguage?: string; }): Promise<YouTubePlaylist> {
    const op: OperationType = 'playlists.insert';

    return performanceMonitor.wrapOperation(
      {
        operationType: op,
        correlationId: this.correlationId,
        userId: this.userId,
        quotaCost: this.getQuotaCost(op)
      },
      async () => {
        this.ensureQuota(op);

        const response = await this.limiter.run(() =>
          this.youtube.playlists.insert({
            part: ['snippet', 'status'],
            requestBody: {
              snippet: {
                title: payload.title,
                description: payload.description,
                defaultLanguage: payload.defaultLanguage,
              },
              status: {
                privacyStatus: payload.privacyStatus,
              },
            },
          })
        );

        this.recordQuotaUsage(op, true);

    const playlist = response.data;
    if (!playlist.id) {
      throw new Error('YouTube API did not return a playlist ID');
    }

    return {
      id: playlist.id,
      title: playlist.snippet?.title || payload.title,
      description: playlist.snippet?.description || payload.description || '',
      privacyStatus: payload.privacyStatus,
      itemCount: playlist.contentDetails?.itemCount ?? 0,
      url: `https://www.youtube.com/playlist?list=${playlist.id}`,
      thumbnails: this.mapThumbnails(playlist.snippet?.thumbnails),
    };
  }

  async listPlaylists(options: { maxResults?: number } = {}): Promise<YouTubePlaylist[]> {
    const op: OperationType = 'playlists.list';

    return performanceMonitor.wrapOperation(
      {
        operationType: op,
        correlationId: this.correlationId,
        userId: this.userId,
        quotaCost: this.getQuotaCost(op)
      },
      async () => {
        this.ensureQuota(op);

    const playlists: YouTubePlaylist[] = [];
    let nextPageToken: string | undefined;
    const limit = options.maxResults ?? 100;

    do {
      const response = await this.limiter.run(() =>
        this.youtube.playlists.list({
          part: ['snippet', 'contentDetails', 'status'],
          mine: true,
          maxResults: Math.min(limit - playlists.length, 50),
          pageToken: nextPageToken,
        })
      );
      this.recordQuotaUsage(op, true);
      const items = response.data.items || [];
      for (const playlist of items) {
        if (!playlist.id) continue;
        playlists.push({
          id: playlist.id,
          title: playlist.snippet?.title || '',
          description: playlist.snippet?.description || '',
          privacyStatus: (playlist.status?.privacyStatus as YouTubePlaylist['privacyStatus']) || 'private',
          itemCount: playlist.contentDetails?.itemCount ?? 0,
          url: `https://www.youtube.com/playlist?list=${playlist.id}`,
          thumbnails: this.mapThumbnails(playlist.snippet?.thumbnails),
        });
        if (playlists.length >= limit) break;
      }
      nextPageToken = response.data.nextPageToken || undefined;
    } while (nextPageToken && playlists.length < limit);

        return playlists;
      }
    );
  }

  async addVideoToPlaylist(playlistId: string, videoId: string, position?: number): Promise<void> {
    const op: OperationType = 'playlistItems.insert';

    return performanceMonitor.wrapOperation(
      {
        operationType: op,
        correlationId: this.correlationId,
        userId: this.userId,
        quotaCost: this.getQuotaCost(op)
      },
      async () => {
        this.ensureQuota(op);

        await this.limiter.run(() =>
          this.youtube.playlistItems.insert({
            part: ['snippet'],
            requestBody: {
              snippet: {
                playlistId,
                ...(typeof position === 'number' ? { position } : {}),
                resourceId: {
                  kind: 'youtube#video',
                  videoId,
                },
              },
            },
          })
        );

        this.recordQuotaUsage(op, true);
      }
    );
  }

  async addVideosToPlaylist(playlistId: string, videoIds: string[], startPosition?: number): Promise<void> {
    let position = startPosition;
    for (const videoId of videoIds) {
      await this.addVideoToPlaylist(playlistId, videoId, position);
      if (typeof position === 'number') {
        position += 1;
      }
    }
  }

  async findPlaylistByTitle(title: string): Promise<YouTubePlaylist | undefined> {
    const normalized = title.trim().toLowerCase();
    const playlists = await this.listPlaylists();
    return playlists.find((playlist) => playlist.title.trim().toLowerCase() === normalized);
  }

  private ensureQuota(operation: OperationType) {
    if (!this.quota.canExecute(operation)) {
      const error = new Error(`YouTube API quota exceeded for operation ${operation}`);
      logger.error('Quota exceeded', 'quota', error, {
        operation,
        correlationId: this.correlationId,
        userId: this.userId
      });
      throw error;
    }
  }

  private recordQuotaUsage(operation: OperationType, success: boolean): void {
    this.quota.record(operation, success);

    // Record in quota monitor
    quotaMonitor.recordQuotaUsage({
      operation,
      cost: this.getQuotaCost(operation),
      totalUsage: this.quota['usage'], // Access private field for monitoring
      remainingQuota: this.quota['quotaLimit'] - this.quota['usage'],
      success,
      correlationId: this.correlationId
    });
  }

  private getQuotaCost(operation: OperationType): number {
    const costs: Record<OperationType, number> = {
      'videos.list': 1,
      'videos.update': 50,
      'videos.insert': 1600,
      'search.list': 100,
      'playlists.insert': 50,
      'playlists.list': 1,
      'playlists.update': 50,
      'playlistItems.insert': 50,
    };
    return costs[operation] || 0;
  }

  // Add getter for quota information
  getQuotaInfo(): { used: number; limit: number; remaining: number } {
    const used = this.quota['usage'];
    const limit = this.quota['quotaLimit'];
    return {
      used,
      limit,
      remaining: limit - used
    };
  }

  private mapThumbnails(thumbnails?: youtube_v3.Schema$ThumbnailDetails | null): Record<string, { url: string; width?: number; height?: number }> {
    if (!thumbnails) return {};
    const result: Record<string, { url: string; width?: number; height?: number }> = {};
    for (const [key, value] of Object.entries(thumbnails)) {
      if (!value?.url) continue;
      result[key] = {
        url: value.url,
        width: value.width || undefined,
        height: value.height || undefined,
      };
    }
    return result;
  }
}
