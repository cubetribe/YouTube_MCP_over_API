import { google, youtube_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { RateLimiter, type RateLimiterOptions } from './rate-limiter.js';
import { QuotaManager, type OperationType } from './quota.js';
import type { YouTubeVideo, YouTubePlaylist } from '../types/index.js';

export interface YouTubeClientOptions {
  oauthClient: OAuth2Client;
  quotaLimit?: number;
  rateLimiter?: RateLimiterOptions;
}

export interface VideoListOptions {
  maxResults?: number;
  order?: youtube_v3.Params$Resource$Search$List['order'];
  publishedAfter?: string;
  publishedBefore?: string;
  videoCategoryId?: string;
}

export class YouTubeClient {
  private youtube: youtube_v3.Youtube;
  private quota: QuotaManager;
  private limiter: RateLimiter;

  constructor(options: YouTubeClientOptions) {
    this.youtube = google.youtube({ version: 'v3', auth: options.oauthClient });
    this.quota = new QuotaManager(options.quotaLimit);
    this.limiter = new RateLimiter(options.rateLimiter);
  }

  async listMyVideos(options: VideoListOptions = {}): Promise<YouTubeVideo[]> {
    const op: OperationType = 'videos.list';
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

    this.quota.record(op, true);

    const videoIds = (response.data.items || [])
      .map(item => item.id?.videoId)
      .filter((id): id is string => Boolean(id));

    if (videoIds.length === 0) return [];
    return this.getVideoDetails(videoIds);
  }

  async getVideoDetails(videoIds: string | string[]): Promise<YouTubeVideo[]> {
    const ids = Array.isArray(videoIds) ? videoIds : [videoIds];
    const op: OperationType = 'videos.list';
    this.ensureQuota(op);

    const response = await this.limiter.run(() =>
      this.youtube.videos.list({
        part: ['snippet', 'status', 'contentDetails', 'statistics'],
        id: ids,
      })
    );

    this.quota.record(op, true);

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

  async updateVideoMetadata(videoId: string, payload: Partial<youtube_v3.Schema$VideoSnippet & youtube_v3.Schema$VideoStatus>): Promise<void> {
    const op: OperationType = 'videos.update';
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

    this.quota.record(op, true);
  }

  async createPlaylist(payload: { title: string; description?: string; privacyStatus: 'private' | 'unlisted' | 'public'; defaultLanguage?: string; }): Promise<YouTubePlaylist> {
    const op: OperationType = 'playlists.insert';
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

    this.quota.record(op, true);

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
      this.quota.record(op, true);
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

  async addVideoToPlaylist(playlistId: string, videoId: string, position?: number): Promise<void> {
    const op: OperationType = 'playlistItems.insert';
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

    this.quota.record(op, true);
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
      throw new Error(`YouTube API quota exceeded for operation ${operation}`);
    }
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
