import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestMCPServer, createTestYouTubeMCPServer } from './helpers/test-server.js';
import { MockYouTubeAPI, createMockOAuthClient } from './helpers/mock-youtube-api.js';
import {
  TEST_CONFIGURATION,
  TEST_VIDEOS,
  TEST_PLAYLISTS,
  TEST_OAUTH_TOKENS,
  TEST_METADATA_SUGGESTIONS,
  createTestVideo
} from './fixtures/index.js';

describe('MCP Tools Integration Tests', () => {
  let testServer: TestMCPServer;
  let mockYouTubeAPI: MockYouTubeAPI;
  let mockOAuthClient: any;

  beforeEach(async () => {
    mockYouTubeAPI = new MockYouTubeAPI();
    mockOAuthClient = createMockOAuthClient();

    // Mock all dependencies
    vi.doMock('../../config/index.js', () => ({
      getConfig: () => TEST_CONFIGURATION,
      getFeatureFlags: () => ({
        getAllFlags: () => ({}),
        getSummary: () => ({ total: 0, enabled: 0, disabled: 0 }),
        getDeprecatedFlags: () => [],
        getEnabledFlags: () => [],
        getDisabledFlags: () => []
      }),
      ConfigValidator: {
        validateAppConfig: () => ({ isValid: true, errors: [], warnings: [], suggestions: [] }),
        checkCommonIssues: () => ({ isValid: true, errors: [], warnings: [], suggestions: [] })
      },
      configManager: {
        getEnv: () => process.env,
        reload: () => TEST_CONFIGURATION
      }
    }));

    vi.doMock('../../auth/oauth-service.js', () => ({
      oauthService: {
        generateAuthorizationUrl: vi.fn().mockResolvedValue({
          url: 'https://accounts.google.com/oauth2/auth?test=true',
          state: 'test-state-123'
        }),
        completeAuthorization: vi.fn().mockResolvedValue(TEST_OAUTH_TOKENS.valid),
        getAuthorizedClient: vi.fn().mockResolvedValue(mockOAuthClient)
      }
    }));

    vi.doMock('../../youtube/client.js', () => ({
      YouTubeClient: vi.fn().mockImplementation(() => ({
        listMyVideos: vi.fn().mockResolvedValue(TEST_VIDEOS),
        getVideoDetails: vi.fn().mockResolvedValue([TEST_VIDEOS[0]]),
        updateVideoMetadata: vi.fn().mockResolvedValue(true),
        addVideoToPlaylist: vi.fn().mockResolvedValue(true)
      }))
    }));

    vi.doMock('../../metadata/metadata-service.js', () => ({
      metadataService: {
        generateSuggestion: vi.fn().mockReturnValue(TEST_METADATA_SUGGESTIONS['test-video-1'])
      }
    }));

    vi.doMock('../../metadata/metadata-review-store.js', () => ({
      metadataReviewStore: {
        saveSuggestion: vi.fn().mockResolvedValue(TEST_METADATA_SUGGESTIONS['test-video-1']),
        getSuggestion: vi.fn().mockResolvedValue(TEST_METADATA_SUGGESTIONS['test-video-1']),
        acknowledgeGuardrails: vi.fn().mockResolvedValue(true),
        markApplied: vi.fn().mockResolvedValue(true)
      }
    }));

    vi.doMock('../../playlist/playlist-service.js', () => ({
      PlaylistService: vi.fn().mockImplementation(() => ({
        createPlaylist: vi.fn().mockResolvedValue(TEST_PLAYLISTS[0]),
        findOrCreatePlaylist: vi.fn().mockResolvedValue(TEST_PLAYLISTS[0])
      }))
    }));

    vi.doMock('../../backup/backup-service.js', () => ({
      backupService: {
        backupVideo: vi.fn().mockResolvedValue('backup-path-123'),
        restoreVideo: vi.fn().mockResolvedValue(TEST_VIDEOS[0]),
        listBackups: vi.fn().mockResolvedValue([])
      }
    }));

    vi.doMock('../../batch/batch-manager.js', () => ({
      batchManager: {
        get: vi.fn().mockReturnValue(null)
      }
    }));

    vi.doMock('../../transcript/transcript-manager.js', () => ({
      TranscriptManager: vi.fn().mockImplementation(() => ({
        getTranscript: vi.fn().mockResolvedValue({
          transcript: 'Sample transcript text',
          language: 'en'
        })
      }))
    }));

    testServer = await createTestYouTubeMCPServer();
  });

  afterEach(async () => {
    await testServer.stop();
    vi.clearAllMocks();
    vi.doUnmock('../../config/index.js');
    vi.doUnmock('../../auth/oauth-service.js');
    vi.doUnmock('../../youtube/client.js');
    vi.doUnmock('../../metadata/metadata-service.js');
    vi.doUnmock('../../metadata/metadata-review-store.js');
    vi.doUnmock('../../playlist/playlist-service.js');
    vi.doUnmock('../../backup/backup-service.js');
    vi.doUnmock('../../batch/batch-manager.js');
    vi.doUnmock('../../transcript/transcript-manager.js');
  });

  describe('OAuth Tools', () => {
    it('should start OAuth flow successfully', async () => {
      const result = await testServer.callTool('start_oauth_flow', {
        scopes: ['https://www.googleapis.com/auth/youtube']
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');

      const response = JSON.parse(result.content[0].text);
      expect(response.authUrl).toContain('https://accounts.google.com');
      expect(response.state).toBeDefined();
      expect(response.message).toContain('complete_oauth_flow');
    });

    it('should complete OAuth flow successfully', async () => {
      const result = await testServer.callTool('complete_oauth_flow', {
        code: 'test-auth-code',
        state: 'test-state-123'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.tokens).toBeDefined();
    });

    it('should validate OAuth scopes', async () => {
      await expect(
        testServer.callTool('start_oauth_flow', {
          scopes: 'invalid-scopes' // Should be array
        })
      ).rejects.toThrow();
    });
  });

  describe('Video Management Tools', () => {
    it('should list videos with correct format', async () => {
      const result = await testServer.callTool('list_videos', {
        maxResults: 10
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.count).toBe(TEST_VIDEOS.length);
      expect(response.videos).toHaveLength(TEST_VIDEOS.length);
      expect(response.videos[0]).toHaveProperty('id');
      expect(response.videos[0]).toHaveProperty('title');
    });

    it('should get video transcript', async () => {
      const result = await testServer.callTool('get_video_transcript', {
        videoId: 'test-video-1',
        language: 'en'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.transcript).toBeDefined();
      expect(response.language).toBe('en');
    });

    it('should handle video not found', async () => {
      vi.doMock('../../youtube/client.js', () => ({
        YouTubeClient: vi.fn().mockImplementation(() => ({
          getVideoDetails: vi.fn().mockResolvedValue([])
        }))
      }));

      await expect(
        testServer.callTool('get_video_transcript', {
          videoId: 'non-existent-video'
        })
      ).rejects.toThrow();
    });
  });

  describe('Metadata Tools', () => {
    it('should generate metadata suggestions', async () => {
      const result = await testServer.callTool('generate_metadata_suggestions', {
        videoId: 'test-video-1',
        includeTranscript: true
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.suggestionId).toBeDefined();
      expect(response.status).toBe('pending');
      expect(response.guardrails).toBeDefined();
      expect(response.reviewChecklist).toBeDefined();
      expect(response.suggestion).toBeDefined();
    });

    it('should apply metadata with guardrail acknowledgment', async () => {
      const result = await testServer.callTool('apply_metadata', {
        videoId: 'test-video-1',
        suggestionId: 'suggestion-1',
        acknowledgedGuardrails: true,
        createBackup: true,
        title: 'Updated Video Title'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.suggestionId).toBe('suggestion-1');
      expect(response.appliedFields).toContain('title');
    });

    it('should reject metadata application without guardrail acknowledgment', async () => {
      await expect(
        testServer.callTool('apply_metadata', {
          videoId: 'test-video-1',
          suggestionId: 'suggestion-1',
          acknowledgedGuardrails: false
        })
      ).rejects.toThrow('GUARDRAILS_NOT_ACKNOWLEDGED');
    });

    it('should validate metadata update has content', async () => {
      await expect(
        testServer.callTool('apply_metadata', {
          videoId: 'test-video-1'
          // No metadata provided
        })
      ).rejects.toThrow('EMPTY_METADATA_UPDATE');
    });
  });

  describe('Scheduling Tools', () => {
    it('should create video schedule in preview mode', async () => {
      const result = await testServer.callTool('schedule_videos', {
        videoIds: ['test-video-1', 'test-video-2'],
        startDate: '2023-06-01',
        endDate: '2023-06-30',
        timeSlots: ['09:00', '15:00'],
        timezone: 'America/New_York',
        mode: 'preview'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.schedule).toBeDefined();
      expect(response.schedule.summary).toBeDefined();
      expect(response.batchId).toBeUndefined(); // No batch in preview mode
    });

    it('should apply video schedule and return batch ID', async () => {
      const result = await testServer.callTool('schedule_videos', {
        videoIds: ['test-video-1'],
        startDate: '2023-06-01',
        endDate: '2023-06-30',
        timeSlots: ['09:00'],
        timezone: 'America/New_York',
        mode: 'apply'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.schedule).toBeDefined();
      expect(response.batchId).toBeDefined();
    });
  });

  describe('Playlist Tools', () => {
    it('should create playlist successfully', async () => {
      const result = await testServer.callTool('create_playlist', {
        title: 'Test Integration Playlist',
        description: 'Created by integration test',
        privacyStatus: 'private'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.id).toBeDefined();
      expect(response.title).toBe('Test Integration Playlist');
    });

    it('should add videos to playlist with batch processing', async () => {
      const result = await testServer.callTool('add_videos_to_playlist', {
        playlistId: 'test-playlist-1',
        videoIds: ['test-video-1', 'test-video-2'],
        position: 0
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.batchId).toBeDefined();
      expect(response.videoCount).toBe(2);
    });

    it('should organize playlists by category', async () => {
      const result = await testServer.callTool('organize_playlists', {
        videoIds: ['test-video-1', 'test-video-2'],
        strategy: 'category',
        createMissingPlaylists: true,
        categoryMap: {
          '27': {
            playlistTitle: 'Educational Content',
            description: 'Educational videos',
            privacyStatus: 'public'
          }
        }
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.batchId).toBeDefined();
      expect(response.groups).toBeDefined();
    });

    it('should organize playlists manually', async () => {
      const result = await testServer.callTool('organize_playlists', {
        videoIds: ['test-video-1', 'test-video-2'],
        strategy: 'manual',
        createMissingPlaylists: true,
        groups: [{
          playlistTitle: 'Manual Group 1',
          videoIds: ['test-video-1'],
          privacyStatus: 'private'
        }]
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.groups).toHaveLength(1);
      expect(response.unassigned).toContain('test-video-2');
    });
  });

  describe('Backup and Restore Tools', () => {
    it('should backup video metadata', async () => {
      const result = await testServer.callTool('backup_video_metadata', {
        videoIds: ['test-video-1'],
        includeAllVideos: false
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.backups).toHaveLength(1);
    });

    it('should backup all videos', async () => {
      const result = await testServer.callTool('backup_video_metadata', {
        includeAllVideos: true
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.backups).toBeDefined();
    });

    it('should restore video metadata from backup', async () => {
      const result = await testServer.callTool('restore_video_metadata', {
        backupDate: '2023-03-01',
        videoId: 'test-video-1'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });
  });

  describe('Batch Monitoring Tools', () => {
    it('should get batch status for non-existent batch', async () => {
      await expect(
        testServer.callTool('get_batch_status', {
          batchId: 'non-existent-batch'
        })
      ).rejects.toThrow('BATCH_NOT_FOUND');
    });
  });

  describe('Configuration Tools', () => {
    it('should get configuration status', async () => {
      const result = await testServer.callTool('get_configuration_status', {
        section: 'all',
        includeValidation: true,
        includeEnvironment: true
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.timestamp).toBeDefined();
      expect(response.environment).toBeDefined();
      expect(response.validation).toBeDefined();
      expect(response.config).toBeDefined();
    });

    it('should get specific configuration section', async () => {
      const result = await testServer.callTool('get_configuration_status', {
        section: 'oauth',
        includeValidation: false
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.oauth).toBeDefined();
      expect(response.oauth.configured).toBe(true);
      expect(response.validation).toBeUndefined();
    });

    it('should reload configuration', async () => {
      const result = await testServer.callTool('reload_configuration', {
        validateAfterReload: true,
        notifyServices: false
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.validation).toBeDefined();
      expect(response.changes).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle tool execution errors gracefully', async () => {
      // Mock a service to throw an error
      vi.doMock('../../youtube/client.js', () => ({
        YouTubeClient: vi.fn().mockImplementation(() => ({
          listMyVideos: vi.fn().mockRejectedValue(new Error('API Error'))
        }))
      }));

      await expect(
        testServer.callTool('list_videos', {})
      ).rejects.toThrow();
    });

    it('should validate required tool parameters', async () => {
      await expect(
        testServer.callTool('get_video_transcript', {
          // Missing videoId
        })
      ).rejects.toThrow();
    });

    it('should handle authentication errors', async () => {
      vi.doMock('../../auth/oauth-service.js', () => ({
        oauthService: {
          getAuthorizedClient: vi.fn().mockRejectedValue(new Error('Authentication failed'))
        }
      }));

      await expect(
        testServer.callTool('list_videos', {})
      ).rejects.toThrow();
    });

    it('should handle invalid parameter types', async () => {
      await expect(
        testServer.callTool('list_videos', {
          maxResults: 'not-a-number'
        })
      ).rejects.toThrow();
    });
  });

  describe('Tool Response Format Validation', () => {
    it('should return properly formatted responses', async () => {
      const result = await testServer.callTool('get_configuration_status', {
        section: 'all'
      });

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type');
      expect(result.content[0]).toHaveProperty('text');
      expect(result.content[0].type).toBe('text');

      // Verify JSON content is valid
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should maintain consistent response structure across tools', async () => {
      const tools = [
        'get_configuration_status',
        'start_oauth_flow'
      ];

      for (const tool of tools) {
        const args = tool === 'start_oauth_flow'
          ? { scopes: ['https://www.googleapis.com/auth/youtube'] }
          : { section: 'all' };

        const result = await testServer.callTool(tool, args);

        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0]).toHaveProperty('text');
      }
    });
  });
});