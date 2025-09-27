import { beforeEach, describe, expect, it, vi } from 'vitest';
import { google, youtube_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { YouTubeClient, type YouTubeClientOptions, type VideoListOptions } from '../../youtube/client.js';
import { RateLimiter } from '../../youtube/rate-limiter.js';
import { QuotaManager } from '../../youtube/quota.js';
import { performanceMonitor } from '../../lib/performance-monitor.js';
import { quotaMonitor } from '../../lib/quota-monitor.js';
import { logger } from '../../lib/logger.js';

// Mock dependencies
vi.mock('googleapis');
vi.mock('../../youtube/rate-limiter.js');
vi.mock('../../youtube/quota.js');
vi.mock('../../lib/performance-monitor.js');
vi.mock('../../lib/quota-monitor.js');
vi.mock('../../lib/logger.js');

describe('YouTubeClient', () => {
  let client: YouTubeClient;
  const mockOAuthClient = {} as OAuth2Client;
  const mockYouTubeAPI = {
    search: {
      list: vi.fn(),
    },
    videos: {
      list: vi.fn(),
      update: vi.fn(),
    },
    playlists: {
      list: vi.fn(),
      insert: vi.fn(),
    },
    playlistItems: {
      insert: vi.fn(),
    },
  };

  const mockRateLimiter = {
    run: vi.fn((fn) => fn()),
  };

  const mockQuotaManager = {
    canExecute: vi.fn(() => true),
    record: vi.fn(),
    usage: 0,
    quotaLimit: 10000,
  };

  const defaultOptions: YouTubeClientOptions = {
    oauthClient: mockOAuthClient,
    quotaLimit: 10000,
    userId: 'test-user',
    correlationId: 'test-correlation-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    vi.mocked(google.youtube).mockReturnValue(mockYouTubeAPI as any);
    vi.mocked(RateLimiter).mockImplementation(() => mockRateLimiter as any);
    vi.mocked(QuotaManager).mockImplementation(() => mockQuotaManager as any);
    vi.mocked(performanceMonitor.wrapOperation).mockImplementation(async (_, fn) => fn());
    vi.mocked(logger.info).mockImplementation(() => {});
    vi.mocked(logger.error).mockImplementation(() => {});
    vi.mocked(quotaMonitor.recordQuotaUsage).mockImplementation(() => {});

    client = new YouTubeClient(defaultOptions);
  });

  describe('Constructor', () => {
    it('should initialize YouTube client with correct configuration', () => {
      expect(google.youtube).toHaveBeenCalledWith({
        version: 'v3',
        auth: mockOAuthClient,
      });
      expect(QuotaManager).toHaveBeenCalledWith(defaultOptions.quotaLimit);
      expect(RateLimiter).toHaveBeenCalledWith(undefined);
      expect(logger.info).toHaveBeenCalledWith(
        'YouTube client initialized',
        'api',
        expect.objectContaining({
          quotaLimit: defaultOptions.quotaLimit,
          userId: defaultOptions.userId,
          correlationId: defaultOptions.correlationId,
        })
      );
    });

    it('should handle optional parameters', () => {
      const minimalOptions: YouTubeClientOptions = {
        oauthClient: mockOAuthClient,
      };

      new YouTubeClient(minimalOptions);

      expect(QuotaManager).toHaveBeenCalledWith(undefined);
    });
  });

  describe('listMyVideos', () => {
    const mockSearchResponse = {
      data: {
        items: [
          { id: { videoId: 'video1' } },
          { id: { videoId: 'video2' } },
        ],
      },
    };

    const mockVideosResponse = {
      data: {
        items: [
          {
            id: 'video1',
            snippet: {
              title: 'Test Video 1',
              description: 'Description 1',
              tags: ['tag1', 'tag2'],
              categoryId: '22',
              publishedAt: '2023-01-01T00:00:00Z',
            },
            status: {
              privacyStatus: 'public',
            },
            statistics: {
              viewCount: '1000',
              likeCount: '50',
              commentCount: '10',
            },
            contentDetails: {
              duration: 'PT5M30S',
            },
          },
        ],
      },
    };

    beforeEach(() => {
      mockYouTubeAPI.search.list.mockResolvedValue(mockSearchResponse);
      mockYouTubeAPI.videos.list.mockResolvedValue(mockVideosResponse);
    });

    it('should list user videos with default options', async () => {
      const videos = await client.listMyVideos();

      expect(mockYouTubeAPI.search.list).toHaveBeenCalledWith({
        part: ['id'],
        forMine: true,
        type: ['video'],
        maxResults: 25,
        order: undefined,
        publishedAfter: undefined,
        publishedBefore: undefined,
        videoCategoryId: undefined,
      });

      expect(mockYouTubeAPI.videos.list).toHaveBeenCalledWith({
        part: ['snippet', 'status', 'contentDetails', 'statistics'],
        id: ['video1', 'video2'],
      });

      expect(videos).toHaveLength(1);
      expect(videos[0]).toEqual({
        id: 'video1',
        title: 'Test Video 1',
        description: 'Description 1',
        tags: ['tag1', 'tag2'],
        categoryId: '22',
        defaultLanguage: '',
        defaultAudioLanguage: '',
        thumbnails: {},
        publishedAt: '2023-01-01T00:00:00Z',
        privacyStatus: 'public',
        viewCount: '1000',
        likeCount: '50',
        commentCount: '10',
        duration: 'PT5M30S',
      });
    });

    it('should apply video list options', async () => {
      const options: VideoListOptions = {
        maxResults: 50,
        order: 'date',
        publishedAfter: '2023-01-01T00:00:00Z',
        publishedBefore: '2023-12-31T23:59:59Z',
        videoCategoryId: '22',
      };

      await client.listMyVideos(options);

      expect(mockYouTubeAPI.search.list).toHaveBeenCalledWith({
        part: ['id'],
        forMine: true,
        type: ['video'],
        maxResults: 50,
        order: 'date',
        publishedAfter: '2023-01-01T00:00:00Z',
        publishedBefore: '2023-12-31T23:59:59Z',
        videoCategoryId: '22',
      });
    });

    it('should return empty array when no videos found', async () => {
      mockYouTubeAPI.search.list.mockResolvedValue({ data: { items: [] } });

      const videos = await client.listMyVideos();

      expect(videos).toEqual([]);
      expect(mockYouTubeAPI.videos.list).not.toHaveBeenCalled();
    });

    it('should check quota before execution', async () => {
      mockQuotaManager.canExecute.mockReturnValue(false);

      await expect(client.listMyVideos()).rejects.toThrow(
        'YouTube API quota exceeded for operation videos.list'
      );

      expect(mockQuotaManager.canExecute).toHaveBeenCalledWith('videos.list');
    });

    it('should record quota usage on success', async () => {
      await client.listMyVideos();

      expect(mockQuotaManager.record).toHaveBeenCalledWith('videos.list', true);
      expect(quotaMonitor.recordQuotaUsage).toHaveBeenCalledWith({
        operation: 'videos.list',
        cost: 1,
        totalUsage: 0,
        remainingQuota: 10000,
        success: true,
        correlationId: 'test-correlation-id',
      });
    });
  });

  describe('getVideoDetails', () => {
    const mockVideosResponse = {
      data: {
        items: [
          {
            id: 'video1',
            snippet: {
              title: 'Test Video',
              description: 'Test Description',
              tags: ['test'],
              thumbnails: {
                default: { url: 'http://example.com/thumb.jpg', width: 120, height: 90 },
              },
            },
            status: { privacyStatus: 'public' },
            statistics: { viewCount: '100' },
            contentDetails: { duration: 'PT2M30S' },
          },
        ],
      },
    };

    beforeEach(() => {
      mockYouTubeAPI.videos.list.mockResolvedValue(mockVideosResponse);
    });

    it('should get details for single video ID', async () => {
      const videos = await client.getVideoDetails('video1');

      expect(mockYouTubeAPI.videos.list).toHaveBeenCalledWith({
        part: ['snippet', 'status', 'contentDetails', 'statistics'],
        id: ['video1'],
      });

      expect(videos).toHaveLength(1);
      expect(videos[0].id).toBe('video1');
    });

    it('should get details for multiple video IDs', async () => {
      await client.getVideoDetails(['video1', 'video2']);

      expect(mockYouTubeAPI.videos.list).toHaveBeenCalledWith({
        part: ['snippet', 'status', 'contentDetails', 'statistics'],
        id: ['video1', 'video2'],
      });
    });

    it('should map thumbnails correctly', async () => {
      const videos = await client.getVideoDetails('video1');

      expect(videos[0].thumbnails).toEqual({
        default: {
          url: 'http://example.com/thumb.jpg',
          width: 120,
          height: 90,
        },
      });
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalResponse = {
        data: {
          items: [
            {
              id: 'video1',
              snippet: {},
              status: {},
              statistics: {},
              contentDetails: {},
            },
          ],
        },
      };
      mockYouTubeAPI.videos.list.mockResolvedValue(minimalResponse);

      const videos = await client.getVideoDetails('video1');

      expect(videos[0]).toEqual({
        id: 'video1',
        title: '',
        description: '',
        tags: [],
        categoryId: '',
        defaultLanguage: '',
        defaultAudioLanguage: '',
        thumbnails: {},
        publishedAt: '',
        privacyStatus: 'private',
        viewCount: undefined,
        likeCount: undefined,
        commentCount: undefined,
        duration: '',
      });
    });
  });

  describe('updateVideoMetadata', () => {
    const videoId = 'test-video-id';
    const payload = {
      title: 'Updated Title',
      description: 'Updated Description',
      tags: ['updated', 'tags'],
      categoryId: '22',
      privacyStatus: 'public' as const,
      publishAt: '2024-01-01T12:00:00Z',
    };

    beforeEach(() => {
      mockYouTubeAPI.videos.update.mockResolvedValue({ data: {} });
    });

    it('should update video metadata', async () => {
      await client.updateVideoMetadata(videoId, payload);

      expect(mockYouTubeAPI.videos.update).toHaveBeenCalledWith({
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
      });
    });

    it('should log metadata update for audit purposes', async () => {
      await client.updateVideoMetadata(videoId, payload);

      expect(logger.info).toHaveBeenCalledWith(
        `Video metadata updated: ${videoId}`,
        'api',
        expect.objectContaining({
          videoId,
          hasTitle: true,
          hasDescription: true,
          tagsCount: 2,
          privacyStatus: 'public',
          userId: 'test-user',
          correlationId: 'test-correlation-id',
        })
      );
    });

    it('should check quota before execution', async () => {
      mockQuotaManager.canExecute.mockReturnValue(false);

      await expect(client.updateVideoMetadata(videoId, payload)).rejects.toThrow(
        'YouTube API quota exceeded for operation videos.update'
      );
    });
  });

  describe('createPlaylist', () => {
    const playlistPayload = {
      title: 'Test Playlist',
      description: 'Test Description',
      privacyStatus: 'public' as const,
      defaultLanguage: 'en',
    };

    const mockPlaylistResponse = {
      data: {
        id: 'playlist123',
        snippet: {
          title: 'Test Playlist',
          description: 'Test Description',
          thumbnails: {},
        },
        contentDetails: {
          itemCount: 0,
        },
      },
    };

    beforeEach(() => {
      mockYouTubeAPI.playlists.insert.mockResolvedValue(mockPlaylistResponse);
    });

    it('should create playlist successfully', async () => {
      const playlist = await client.createPlaylist(playlistPayload);

      expect(mockYouTubeAPI.playlists.insert).toHaveBeenCalledWith({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: playlistPayload.title,
            description: playlistPayload.description,
            defaultLanguage: playlistPayload.defaultLanguage,
          },
          status: {
            privacyStatus: playlistPayload.privacyStatus,
          },
        },
      });

      expect(playlist).toEqual({
        id: 'playlist123',
        title: 'Test Playlist',
        description: 'Test Description',
        privacyStatus: 'public',
        itemCount: 0,
        url: 'https://www.youtube.com/playlist?list=playlist123',
        thumbnails: {},
      });
    });

    it('should throw error if no playlist ID returned', async () => {
      mockYouTubeAPI.playlists.insert.mockResolvedValue({ data: {} });

      await expect(client.createPlaylist(playlistPayload)).rejects.toThrow(
        'YouTube API did not return a playlist ID'
      );
    });
  });

  describe('listPlaylists', () => {
    const mockPlaylistsResponse = {
      data: {
        items: [
          {
            id: 'playlist1',
            snippet: {
              title: 'Playlist 1',
              description: 'Description 1',
            },
            status: {
              privacyStatus: 'public',
            },
            contentDetails: {
              itemCount: 5,
            },
          },
          {
            id: 'playlist2',
            snippet: {
              title: 'Playlist 2',
              description: 'Description 2',
            },
            status: {
              privacyStatus: 'private',
            },
            contentDetails: {
              itemCount: 3,
            },
          },
        ],
        nextPageToken: undefined,
      },
    };

    beforeEach(() => {
      mockYouTubeAPI.playlists.list.mockResolvedValue(mockPlaylistsResponse);
    });

    it('should list user playlists', async () => {
      const playlists = await client.listPlaylists();

      expect(mockYouTubeAPI.playlists.list).toHaveBeenCalledWith({
        part: ['snippet', 'contentDetails', 'status'],
        mine: true,
        maxResults: 50,
        pageToken: undefined,
      });

      expect(playlists).toHaveLength(2);
      expect(playlists[0]).toEqual({
        id: 'playlist1',
        title: 'Playlist 1',
        description: 'Description 1',
        privacyStatus: 'public',
        itemCount: 5,
        url: 'https://www.youtube.com/playlist?list=playlist1',
        thumbnails: {},
      });
    });

    it('should respect maxResults option', async () => {
      await client.listPlaylists({ maxResults: 25 });

      expect(mockYouTubeAPI.playlists.list).toHaveBeenCalledWith(
        expect.objectContaining({
          maxResults: 25,
        })
      );
    });

    it('should handle pagination', async () => {
      const firstPageResponse = {
        data: {
          items: [mockPlaylistsResponse.data.items[0]],
          nextPageToken: 'next-page-token',
        },
      };
      const secondPageResponse = {
        data: {
          items: [mockPlaylistsResponse.data.items[1]],
          nextPageToken: undefined,
        },
      };

      mockYouTubeAPI.playlists.list
        .mockResolvedValueOnce(firstPageResponse)
        .mockResolvedValueOnce(secondPageResponse);

      const playlists = await client.listPlaylists({ maxResults: 100 });

      expect(mockYouTubeAPI.playlists.list).toHaveBeenCalledTimes(2);
      expect(mockYouTubeAPI.playlists.list).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          pageToken: 'next-page-token',
        })
      );
      expect(playlists).toHaveLength(2);
    });
  });

  describe('addVideoToPlaylist', () => {
    const playlistId = 'playlist123';
    const videoId = 'video123';

    beforeEach(() => {
      mockYouTubeAPI.playlistItems.insert.mockResolvedValue({ data: {} });
    });

    it('should add video to playlist', async () => {
      await client.addVideoToPlaylist(playlistId, videoId);

      expect(mockYouTubeAPI.playlistItems.insert).toHaveBeenCalledWith({
        part: ['snippet'],
        requestBody: {
          snippet: {
            playlistId,
            resourceId: {
              kind: 'youtube#video',
              videoId,
            },
          },
        },
      });
    });

    it('should add video to playlist at specific position', async () => {
      const position = 2;
      await client.addVideoToPlaylist(playlistId, videoId, position);

      expect(mockYouTubeAPI.playlistItems.insert).toHaveBeenCalledWith({
        part: ['snippet'],
        requestBody: {
          snippet: {
            playlistId,
            position,
            resourceId: {
              kind: 'youtube#video',
              videoId,
            },
          },
        },
      });
    });
  });

  describe('addVideosToPlaylist', () => {
    const playlistId = 'playlist123';
    const videoIds = ['video1', 'video2', 'video3'];

    beforeEach(() => {
      mockYouTubeAPI.playlistItems.insert.mockResolvedValue({ data: {} });
    });

    it('should add multiple videos to playlist', async () => {
      await client.addVideosToPlaylist(playlistId, videoIds);

      expect(mockYouTubeAPI.playlistItems.insert).toHaveBeenCalledTimes(3);
      expect(mockYouTubeAPI.playlistItems.insert).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          requestBody: expect.objectContaining({
            snippet: expect.objectContaining({
              resourceId: { kind: 'youtube#video', videoId: 'video1' },
            }),
          }),
        })
      );
    });

    it('should add videos at specific positions when startPosition provided', async () => {
      const startPosition = 5;
      await client.addVideosToPlaylist(playlistId, videoIds, startPosition);

      expect(mockYouTubeAPI.playlistItems.insert).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          requestBody: expect.objectContaining({
            snippet: expect.objectContaining({
              position: 5,
            }),
          }),
        })
      );
      expect(mockYouTubeAPI.playlistItems.insert).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          requestBody: expect.objectContaining({
            snippet: expect.objectContaining({
              position: 6,
            }),
          }),
        })
      );
    });
  });

  describe('findPlaylistByTitle', () => {
    const mockPlaylists = [
      {
        id: 'playlist1',
        title: 'My Playlist',
        description: '',
        privacyStatus: 'public' as const,
        itemCount: 0,
        url: 'https://www.youtube.com/playlist?list=playlist1',
        thumbnails: {},
      },
      {
        id: 'playlist2',
        title: 'Another Playlist',
        description: '',
        privacyStatus: 'private' as const,
        itemCount: 0,
        url: 'https://www.youtube.com/playlist?list=playlist2',
        thumbnails: {},
      },
    ];

    beforeEach(() => {
      vi.spyOn(client, 'listPlaylists').mockResolvedValue(mockPlaylists);
    });

    it('should find playlist by exact title match', async () => {
      const playlist = await client.findPlaylistByTitle('My Playlist');

      expect(playlist).toEqual(mockPlaylists[0]);
    });

    it('should find playlist with case-insensitive search', async () => {
      const playlist = await client.findPlaylistByTitle('my playlist');

      expect(playlist).toEqual(mockPlaylists[0]);
    });

    it('should find playlist ignoring whitespace', async () => {
      const playlist = await client.findPlaylistByTitle('  My Playlist  ');

      expect(playlist).toEqual(mockPlaylists[0]);
    });

    it('should return undefined for non-existent playlist', async () => {
      const playlist = await client.findPlaylistByTitle('Non-existent Playlist');

      expect(playlist).toBeUndefined();
    });
  });

  describe('getQuotaInfo', () => {
    it('should return quota information', () => {
      mockQuotaManager.usage = 500;
      mockQuotaManager.quotaLimit = 10000;

      const quotaInfo = client.getQuotaInfo();

      expect(quotaInfo).toEqual({
        used: 500,
        limit: 10000,
        remaining: 9500,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const apiError = new Error('API Error');
      mockYouTubeAPI.videos.list.mockRejectedValue(apiError);

      await expect(client.getVideoDetails('video1')).rejects.toThrow('API Error');
    });

    it('should log quota exceeded errors', async () => {
      mockQuotaManager.canExecute.mockReturnValue(false);

      await expect(client.listMyVideos()).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'Quota exceeded',
        'quota',
        expect.any(Error),
        expect.objectContaining({
          operation: 'videos.list',
          correlationId: 'test-correlation-id',
          userId: 'test-user',
        })
      );
    });
  });

  describe('Performance Monitoring', () => {
    it('should wrap operations in performance monitoring', async () => {
      mockYouTubeAPI.videos.list.mockResolvedValue({ data: { items: [] } });

      await client.getVideoDetails('video1');

      expect(performanceMonitor.wrapOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: 'videos.list',
          correlationId: 'test-correlation-id',
          userId: 'test-user',
          quotaCost: 1,
        }),
        expect.any(Function)
      );
    });
  });
});