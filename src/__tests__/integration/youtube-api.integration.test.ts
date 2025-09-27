import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestMCPServer, createTestYouTubeMCPServer, waitFor } from './helpers/test-server.js';
import { MockYouTubeAPI, createMockOAuthClient } from './helpers/mock-youtube-api.js';
import {
  TEST_CONFIGURATION,
  TEST_VIDEOS,
  TEST_PLAYLISTS,
  TEST_CHANNEL,
  TEST_TRANSCRIPTS,
  createTestVideo
} from './fixtures/index.js';

describe('YouTube API Integration Tests', () => {
  let testServer: TestMCPServer;
  let mockYouTubeAPI: MockYouTubeAPI;
  let mockOAuthClient: any;
  let quotaUsage = 0;

  beforeEach(async () => {
    mockYouTubeAPI = new MockYouTubeAPI();
    mockOAuthClient = createMockOAuthClient();
    quotaUsage = 0;

    // Mock YouTube Client with realistic API behavior
    vi.doMock('../../youtube/client.js', () => ({
      YouTubeClient: vi.fn().mockImplementation((config) => ({
        listMyVideos: vi.fn().mockImplementation(async (options = {}) => {
          quotaUsage += 100; // search.list cost
          await waitFor(50); // Simulate API delay

          const maxResults = options.maxResults || 25;
          const videos = TEST_VIDEOS.slice(0, maxResults);

          if (options.status === 'public') {
            return videos.filter(v => v.privacyStatus === 'public');
          }
          return videos;
        }),

        getVideoDetails: vi.fn().mockImplementation(async (videoIds) => {
          quotaUsage += 1; // videos.list cost
          await waitFor(30);

          const ids = Array.isArray(videoIds) ? videoIds : [videoIds];
          return TEST_VIDEOS.filter(v => ids.includes(v.id));
        }),

        updateVideoMetadata: vi.fn().mockImplementation(async (videoId, metadata) => {
          quotaUsage += 50; // videos.update cost
          await waitFor(100);

          if (quotaUsage > 10000) {
            throw new Error('Quota exceeded');
          }

          const video = TEST_VIDEOS.find(v => v.id === videoId);
          if (!video) {
            throw new Error('Video not found');
          }

          return {
            ...video,
            ...metadata,
            id: videoId
          };
        }),

        addVideoToPlaylist: vi.fn().mockImplementation(async (playlistId, videoId, position) => {
          quotaUsage += 50; // playlistItems.insert cost
          await waitFor(75);

          if (quotaUsage > 10000) {
            throw new Error('Quota exceeded');
          }

          return {
            playlistId,
            videoId,
            position: position || 0
          };
        }),

        searchVideos: vi.fn().mockImplementation(async (query, options = {}) => {
          quotaUsage += 100; // search.list cost
          await waitFor(200);

          return TEST_VIDEOS.filter(v =>
            v.title.toLowerCase().includes(query.toLowerCase()) ||
            v.description.toLowerCase().includes(query.toLowerCase())
          );
        }),

        getQuotaUsage: vi.fn().mockImplementation(() => quotaUsage),

        resetQuota: vi.fn().mockImplementation(() => {
          quotaUsage = 0;
        })
      }))
    }));

    // Mock Playlist Service
    vi.doMock('../../playlist/playlist-service.js', () => ({
      PlaylistService: vi.fn().mockImplementation(() => ({
        createPlaylist: vi.fn().mockImplementation(async (options) => {
          quotaUsage += 50; // playlists.insert cost
          await waitFor(100);

          return {
            id: `playlist-${Date.now()}`,
            title: options.title,
            description: options.description,
            privacyStatus: options.privacyStatus || 'private',
            url: `https://www.youtube.com/playlist?list=playlist-${Date.now()}`
          };
        }),

        findOrCreatePlaylist: vi.fn().mockImplementation(async (options) => {
          quotaUsage += options.playlistId ? 1 : 51; // list + optional insert
          await waitFor(options.playlistId ? 50 : 150);

          if (options.playlistId) {
            const existing = TEST_PLAYLISTS.find(p => p.id === options.playlistId);
            if (existing) return existing;
          }

          if (options.allowCreate) {
            return {
              id: `playlist-${Date.now()}`,
              title: options.title,
              description: options.description,
              privacyStatus: options.privacyStatus || 'private'
            };
          }

          throw new Error('Playlist not found and creation not allowed');
        }),

        listPlaylists: vi.fn().mockImplementation(async () => {
          quotaUsage += 1; // playlists.list cost
          await waitFor(50);
          return TEST_PLAYLISTS;
        })
      }))
    }));

    // Mock Transcript Manager
    vi.doMock('../../transcript/transcript-manager.js', () => ({
      TranscriptManager: vi.fn().mockImplementation(() => ({
        getTranscript: vi.fn().mockImplementation(async (videoId, language = 'en') => {
          quotaUsage += 200; // captions.download cost
          await waitFor(300);

          const transcript = TEST_TRANSCRIPTS[videoId as keyof typeof TEST_TRANSCRIPTS];
          if (!transcript) {
            throw new Error('No transcript available');
          }

          return {
            videoId,
            transcript: transcript.transcript,
            language: transcript.language,
            isAutoGenerated: false
          };
        }),

        listCaptions: vi.fn().mockImplementation(async (videoId) => {
          quotaUsage += 50; // captions.list cost
          await waitFor(50);

          return [{
            id: `caption-${videoId}`,
            language: 'en',
            name: 'English',
            trackKind: 'standard'
          }];
        })
      }))
    }));

    // Mock OAuth service
    vi.doMock('../../auth/oauth-service.js', () => ({
      oauthService: {
        getAuthorizedClient: vi.fn().mockResolvedValue(mockOAuthClient)
      }
    }));

    // Mock configuration
    vi.doMock('../../config/index.js', () => ({
      getConfig: () => TEST_CONFIGURATION
    }));

    testServer = await createTestYouTubeMCPServer();
  });

  afterEach(async () => {
    await testServer.stop();
    vi.clearAllMocks();
    vi.doUnmock('../../youtube/client.js');
    vi.doUnmock('../../playlist/playlist-service.js');
    vi.doUnmock('../../transcript/transcript-manager.js');
    vi.doUnmock('../../auth/oauth-service.js');
    vi.doUnmock('../../config/index.js');
  });

  describe('Video Listing and Filtering', () => {
    it('should list videos with default parameters', async () => {
      const result = await testServer.callTool('list_videos', {});

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response.count).toBe(TEST_VIDEOS.length);
      expect(response.videos).toHaveLength(TEST_VIDEOS.length);
      expect(response.videos[0]).toHaveProperty('id');
      expect(response.videos[0]).toHaveProperty('title');
      expect(response.videos[0]).toHaveProperty('privacyStatus');
    });

    it('should filter videos by status', async () => {
      const result = await testServer.callTool('list_videos', {
        status: 'public'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      const publicVideos = TEST_VIDEOS.filter(v => v.privacyStatus === 'public');
      expect(response.videos).toHaveLength(publicVideos.length);
      response.videos.forEach((video: any) => {
        expect(video.privacyStatus).toBe('public');
      });
    });

    it('should limit results with maxResults parameter', async () => {
      const maxResults = 2;
      const result = await testServer.callTool('list_videos', { maxResults });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response.videos).toHaveLength(maxResults);
      expect(response.count).toBe(maxResults);
    });

    it('should get video details for specific videos', async () => {
      const videoId = TEST_VIDEOS[0].id;
      const result = await testServer.callTool('get_video_transcript', { videoId });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response.videoId).toBe(videoId);
      expect(response.transcript).toBeDefined();
      expect(response.language).toBe('en');
    });
  });

  describe('Metadata Updates with Mocked API', () => {
    it('should update video metadata successfully', async () => {
      const videoId = TEST_VIDEOS[0].id;
      const newTitle = 'Updated Video Title';
      const newDescription = 'Updated video description';

      const result = await testServer.callTool('apply_metadata', {
        videoId,
        title: newTitle,
        description: newDescription,
        createBackup: false
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.appliedFields).toContain('title');
      expect(response.appliedFields).toContain('description');
    });

    it('should update video privacy status', async () => {
      const videoId = TEST_VIDEOS[0].id;

      const result = await testServer.callTool('apply_metadata', {
        videoId,
        privacyStatus: 'public',
        createBackup: false
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.appliedFields).toContain('privacyStatus');
    });

    it('should update video tags', async () => {
      const videoId = TEST_VIDEOS[0].id;
      const newTags = ['integration', 'test', 'youtube', 'api'];

      const result = await testServer.callTool('apply_metadata', {
        videoId,
        tags: newTags,
        createBackup: false
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.appliedFields).toContain('tags');
    });

    it('should handle video not found errors', async () => {
      await expect(
        testServer.callTool('apply_metadata', {
          videoId: 'non-existent-video',
          title: 'New Title',
          createBackup: false
        })
      ).rejects.toThrow();
    });
  });

  describe('Playlist Operations', () => {
    it('should create new playlist', async () => {
      const result = await testServer.callTool('create_playlist', {
        title: 'Integration Test Playlist',
        description: 'Created during integration testing',
        privacyStatus: 'private'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response.id).toBeDefined();
      expect(response.title).toBe('Integration Test Playlist');
      expect(response.privacyStatus).toBe('private');
    });

    it('should add videos to playlist', async () => {
      const playlistId = TEST_PLAYLISTS[0].id;
      const videoIds = [TEST_VIDEOS[0].id, TEST_VIDEOS[1].id];

      const result = await testServer.callTool('add_videos_to_playlist', {
        playlistId,
        videoIds,
        position: 0
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.batchId).toBeDefined();
      expect(response.videoCount).toBe(videoIds.length);
    });

    it('should handle playlist not found errors', async () => {
      await expect(
        testServer.callTool('add_videos_to_playlist', {
          playlistId: 'non-existent-playlist',
          videoIds: [TEST_VIDEOS[0].id]
        })
      ).rejects.toThrow();
    });
  });

  describe('Transcript Retrieval', () => {
    it('should retrieve video transcript', async () => {
      const videoId = TEST_VIDEOS[0].id;

      const result = await testServer.callTool('get_video_transcript', {
        videoId,
        language: 'en'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response.videoId).toBe(videoId);
      expect(response.transcript).toBeDefined();
      expect(response.language).toBe('en');
      expect(Array.isArray(response.transcript)).toBe(true);
    });

    it('should handle transcript not available', async () => {
      await expect(
        testServer.callTool('get_video_transcript', {
          videoId: 'video-without-transcript'
        })
      ).rejects.toThrow('No transcript available');
    });

    it('should retrieve transcript for multiple languages', async () => {
      const videoId = TEST_VIDEOS[0].id;

      // Test default language (English)
      const enResult = await testServer.callTool('get_video_transcript', {
        videoId
      });

      expect(enResult.content).toBeDefined();
      const enResponse = JSON.parse(enResult.content[0].text);
      expect(enResponse.language).toBe('en');

      // Test specific language
      const langResult = await testServer.callTool('get_video_transcript', {
        videoId,
        language: 'en'
      });

      expect(langResult.content).toBeDefined();
      const langResponse = JSON.parse(langResult.content[0].text);
      expect(langResponse.language).toBe('en');
    });
  });

  describe('Quota Management Across Operations', () => {
    it('should track quota usage across multiple operations', async () => {
      // Perform several operations that consume quota
      await testServer.callTool('list_videos', { maxResults: 10 }); // 100 units
      await testServer.callTool('get_video_transcript', { videoId: TEST_VIDEOS[0].id }); // 200 units
      await testServer.callTool('create_playlist', {
        title: 'Test Playlist',
        privacyStatus: 'private'
      }); // 50 units

      // Total should be 350 units
      expect(quotaUsage).toBe(350);
    });

    it('should handle quota exceeded errors', async () => {
      // Set quota to a high value to trigger exceeded error
      quotaUsage = 9950; // Close to 10,000 limit

      // This operation should exceed the quota
      await expect(
        testServer.callTool('get_video_transcript', {
          videoId: TEST_VIDEOS[0].id
        })
      ).rejects.toThrow('Quota exceeded');
    });

    it('should manage quota for batch operations', async () => {
      const videoIds = TEST_VIDEOS.map(v => v.id);

      // This will create multiple API calls in a batch
      const result = await testServer.callTool('add_videos_to_playlist', {
        playlistId: TEST_PLAYLISTS[0].id,
        videoIds
      });

      expect(result.content).toBeDefined();
      expect(quotaUsage).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting and Error Handling', () => {
    it('should handle rate limiting gracefully', async () => {
      // Mock rate limit error
      vi.doMock('../../youtube/client.js', () => ({
        YouTubeClient: vi.fn().mockImplementation(() => ({
          listMyVideos: vi.fn().mockRejectedValue(new Error('Rate limit exceeded'))
        }))
      }));

      await expect(
        testServer.callTool('list_videos', {})
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle API authentication errors', async () => {
      // Mock authentication error
      vi.doMock('../../auth/oauth-service.js', () => ({
        oauthService: {
          getAuthorizedClient: vi.fn().mockRejectedValue(new Error('Invalid credentials'))
        }
      }));

      await expect(
        testServer.callTool('list_videos', {})
      ).rejects.toThrow('Invalid credentials');
    });

    it('should handle YouTube API service errors', async () => {
      // Mock service error
      vi.doMock('../../youtube/client.js', () => ({
        YouTubeClient: vi.fn().mockImplementation(() => ({
          listMyVideos: vi.fn().mockRejectedValue(new Error('YouTube service unavailable'))
        }))
      }));

      await expect(
        testServer.callTool('list_videos', {})
      ).rejects.toThrow('YouTube service unavailable');
    });

    it('should handle network timeouts', async () => {
      // Mock timeout error
      vi.doMock('../../youtube/client.js', () => ({
        YouTubeClient: vi.fn().mockImplementation(() => ({
          listMyVideos: vi.fn().mockImplementation(async () => {
            await waitFor(10000); // Simulate long delay
            throw new Error('Request timeout');
          })
        }))
      }));

      await expect(
        testServer.callTool('list_videos', {})
      ).rejects.toThrow();
    });
  });

  describe('API Response Validation', () => {
    it('should validate video response structure', async () => {
      const result = await testServer.callTool('list_videos', {});

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response.videos).toBeDefined();
      expect(Array.isArray(response.videos)).toBe(true);

      response.videos.forEach((video: any) => {
        expect(video).toHaveProperty('id');
        expect(video).toHaveProperty('title');
        expect(video).toHaveProperty('description');
        expect(video).toHaveProperty('privacyStatus');
        expect(video).toHaveProperty('publishedAt');
      });
    });

    it('should validate playlist response structure', async () => {
      const result = await testServer.callTool('create_playlist', {
        title: 'Test Playlist',
        privacyStatus: 'private'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('title');
      expect(response).toHaveProperty('privacyStatus');
      expect(typeof response.id).toBe('string');
      expect(typeof response.title).toBe('string');
    });

    it('should validate transcript response structure', async () => {
      const result = await testServer.callTool('get_video_transcript', {
        videoId: TEST_VIDEOS[0].id
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response).toHaveProperty('videoId');
      expect(response).toHaveProperty('transcript');
      expect(response).toHaveProperty('language');
      expect(Array.isArray(response.transcript)).toBe(true);

      if (response.transcript.length > 0) {
        const segment = response.transcript[0];
        expect(segment).toHaveProperty('text');
        expect(typeof segment.text).toBe('string');
      }
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent API calls', async () => {
      const operations = [
        testServer.callTool('list_videos', { maxResults: 5 }),
        testServer.callTool('get_video_transcript', { videoId: TEST_VIDEOS[0].id }),
        testServer.callTool('create_playlist', { title: 'Concurrent Test', privacyStatus: 'private' })
      ];

      const results = await Promise.allSettled(operations);

      // All operations should complete
      expect(results).toHaveLength(3);

      // At least some should succeed (depending on mocking)
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();

      // Perform multiple sequential operations
      for (let i = 0; i < 5; i++) {
        await testServer.callTool('list_videos', { maxResults: 1 });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust based on requirements)
      expect(duration).toBeLessThan(3000); // 3 seconds for 5 operations
    });

    it('should handle large response data', async () => {
      // Mock large video list
      const largeVideoList = Array.from({ length: 50 }, (_, i) =>
        createTestVideo({ id: `large-test-${i}`, title: `Large Test Video ${i}` })
      );

      vi.doMock('../../youtube/client.js', () => ({
        YouTubeClient: vi.fn().mockImplementation(() => ({
          listMyVideos: vi.fn().mockResolvedValue(largeVideoList)
        }))
      }));

      const result = await testServer.callTool('list_videos', { maxResults: 50 });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.videos).toHaveLength(50);
    });
  });
});