import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestMCPServer, createTestYouTubeMCPServer, waitFor } from './helpers/test-server.js';
import { createMockOAuthClient } from './helpers/mock-youtube-api.js';
import {
  TEST_CONFIGURATION,
  TEST_VIDEOS,
  TEST_PLAYLISTS,
  TEST_METADATA_SUGGESTIONS,
  createTestVideo,
  createTestBatch
} from './fixtures/index.js';

describe('End-to-End Workflow Integration Tests', () => {
  let testServer: TestMCPServer;
  let mockOAuthClient: any;
  let workflowState: any = {};

  beforeEach(async () => {
    mockOAuthClient = createMockOAuthClient();
    workflowState = {
      videos: [...TEST_VIDEOS],
      playlists: [...TEST_PLAYLISTS],
      suggestions: {},
      batches: [],
      backups: []
    };

    // Mock all services with workflow-aware state
    vi.doMock('../../auth/oauth-service.js', () => ({
      oauthService: {
        generateAuthorizationUrl: vi.fn().mockResolvedValue({
          url: 'https://accounts.google.com/oauth2/auth?workflow=test',
          state: 'workflow-state-123'
        }),
        completeAuthorization: vi.fn().mockResolvedValue({
          access_token: 'workflow-access-token',
          refresh_token: 'workflow-refresh-token',
          expiry_date: Date.now() + 3600000
        }),
        getAuthorizedClient: vi.fn().mockResolvedValue(mockOAuthClient)
      }
    }));

    vi.doMock('../../youtube/client.js', () => ({
      YouTubeClient: vi.fn().mockImplementation(() => ({
        listMyVideos: vi.fn().mockResolvedValue(workflowState.videos),
        getVideoDetails: vi.fn().mockImplementation(async (videoIds) => {
          const ids = Array.isArray(videoIds) ? videoIds : [videoIds];
          return workflowState.videos.filter((v: any) => ids.includes(v.id));
        }),
        updateVideoMetadata: vi.fn().mockImplementation(async (videoId, metadata) => {
          const video = workflowState.videos.find((v: any) => v.id === videoId);
          if (video) {
            Object.assign(video, metadata);
            // Simulate backup creation
            workflowState.backups.push({
              videoId,
              originalData: { ...video },
              updatedAt: new Date().toISOString()
            });
          }
          return video;
        }),
        addVideoToPlaylist: vi.fn().mockImplementation(async (playlistId, videoId) => {
          const playlist = workflowState.playlists.find((p: any) => p.id === playlistId);
          if (playlist) {
            if (!playlist.videos) playlist.videos = [];
            playlist.videos.push(videoId);
          }
          return { playlistId, videoId, position: playlist?.videos?.length || 0 };
        }),
        searchVideos: vi.fn().mockImplementation(async (query) => {
          return workflowState.videos.filter((v: any) =>
            v.title.toLowerCase().includes(query.toLowerCase()) ||
            v.description.toLowerCase().includes(query.toLowerCase())
          );
        })
      }))
    }));

    vi.doMock('../../metadata/metadata-service.js', () => ({
      metadataService: {
        generateSuggestion: vi.fn().mockImplementation((input) => {
          const suggestion = {
            id: `suggestion-${Date.now()}`,
            videoId: input.videoId,
            status: 'pending',
            generatedAt: new Date().toISOString(),
            requiresApproval: true,
            overallConfidence: 0.85,
            suggestions: {
              title: {
                current: input.title,
                suggested: `Enhanced: ${input.title}`,
                confidence: 0.9
              },
              description: {
                current: input.description,
                suggested: `Optimized: ${input.description}`,
                confidence: 0.8
              },
              tags: {
                current: input.tags || [],
                suggested: [...(input.tags || []), 'workflow', 'integration'],
                confidence: 0.75
              }
            },
            guardrails: ['Verify enhanced title accuracy', 'Check description optimization'],
            reviewChecklist: ['Title enhancement approved', 'Description optimization verified']
          };
          workflowState.suggestions[suggestion.id] = suggestion;
          return suggestion;
        })
      }
    }));

    vi.doMock('../../metadata/metadata-review-store.js', () => ({
      metadataReviewStore: {
        saveSuggestion: vi.fn().mockImplementation(async (suggestion) => {
          const stored = { ...suggestion, savedAt: new Date().toISOString() };
          workflowState.suggestions[suggestion.id] = stored;
          return stored;
        }),
        getSuggestion: vi.fn().mockImplementation(async (id) => {
          return workflowState.suggestions[id] || null;
        }),
        acknowledgeGuardrails: vi.fn().mockImplementation(async (id) => {
          const suggestion = workflowState.suggestions[id];
          if (suggestion) {
            suggestion.guardrailsAcknowledged = true;
            suggestion.acknowledgedAt = new Date().toISOString();
          }
          return !!suggestion;
        }),
        markApplied: vi.fn().mockImplementation(async (id) => {
          const suggestion = workflowState.suggestions[id];
          if (suggestion) {
            suggestion.status = 'applied';
            suggestion.appliedAt = new Date().toISOString();
          }
          return !!suggestion;
        })
      }
    }));

    vi.doMock('../../playlist/playlist-service.js', () => ({
      PlaylistService: vi.fn().mockImplementation(() => ({
        createPlaylist: vi.fn().mockImplementation(async (options) => {
          const playlist = {
            id: `playlist-${Date.now()}`,
            title: options.title,
            description: options.description,
            privacyStatus: options.privacyStatus || 'private',
            videos: [],
            createdAt: new Date().toISOString()
          };
          workflowState.playlists.push(playlist);
          return playlist;
        }),
        findOrCreatePlaylist: vi.fn().mockImplementation(async (options) => {
          let playlist = workflowState.playlists.find((p: any) => p.id === options.playlistId);
          if (!playlist && options.allowCreate) {
            playlist = {
              id: options.playlistId || `playlist-${Date.now()}`,
              title: options.title,
              description: options.description,
              privacyStatus: options.privacyStatus || 'private',
              videos: []
            };
            workflowState.playlists.push(playlist);
          }
          return playlist;
        })
      }))
    }));

    vi.doMock('../../scheduler/scheduler.js', () => ({
      VideoScheduler: vi.fn().mockImplementation((config) => ({
        schedule: vi.fn().mockImplementation((videos) => {
          const scheduled = videos.map((video: any, index: number) => {
            const scheduledTime = new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000);
            return {
              videoId: video.videoId,
              title: video.title,
              scheduledTime: scheduledTime.toISOString(),
              category: video.category,
              timeSlot: config.timeSlots?.[index % config.timeSlots.length] || '09:00'
            };
          });

          return {
            scheduled,
            summary: {
              totalVideos: videos.length,
              scheduledVideos: scheduled.length,
              conflicts: 0,
              startDate: config.startDate,
              endDate: config.endDate,
              timeSpan: `${scheduled.length} days`
            }
          };
        })
      }))
    }));

    vi.doMock('../../backup/backup-service.js', () => ({
      backupService: {
        backupVideo: vi.fn().mockImplementation(async (video) => {
          const backup = {
            id: `backup-${Date.now()}`,
            videoId: video.id,
            originalData: { ...video },
            backupPath: `/backups/${video.id}.json`,
            createdAt: new Date().toISOString()
          };
          workflowState.backups.push(backup);
          return backup.backupPath;
        }),
        restoreVideo: vi.fn().mockImplementation(async (backupDate, videoId) => {
          const backup = workflowState.backups.find((b: any) => b.videoId === videoId);
          if (!backup) throw new Error('Backup not found');
          return backup.originalData;
        }),
        listBackups: vi.fn().mockResolvedValue(workflowState.backups)
      }
    }));

    vi.doMock('../../batch/batch-orchestrator.js', () => ({
      BatchOrchestrator: vi.fn().mockImplementation(() => ({
        enqueue: vi.fn().mockImplementation((batchSpec) => {
          const batch = {
            id: `batch-${Date.now()}`,
            type: batchSpec.type,
            status: 'pending',
            createdAt: new Date().toISOString(),
            metadata: batchSpec.metadata,
            items: batchSpec.items.map((item: any, index: number) => ({
              ...item,
              status: 'pending',
              index
            })),
            progress: {
              total: batchSpec.items.length,
              completed: 0,
              failed: 0,
              percentage: 0
            }
          };
          workflowState.batches.push(batch);

          // Simulate async processing
          setTimeout(() => {
            batch.status = 'running';
            let processed = 0;

            const processNext = () => {
              if (processed < batch.items.length) {
                const item = batch.items[processed];
                item.status = 'completed';
                item.completedAt = new Date().toISOString();
                batch.progress.completed++;
                batch.progress.percentage = Math.round((batch.progress.completed / batch.progress.total) * 100);
                processed++;

                if (processed === batch.items.length) {
                  batch.status = 'completed';
                  batch.completedAt = new Date().toISOString();
                } else {
                  setTimeout(processNext, 100);
                }
              }
            };

            processNext();
          }, 50);

          return batch;
        }),
        setUpdateListener: vi.fn()
      }))
    }));

    vi.doMock('../../batch/batch-manager.js', () => ({
      batchManager: {
        get: vi.fn().mockImplementation((batchId) => {
          return workflowState.batches.find((b: any) => b.id === batchId) || null;
        })
      }
    }));

    vi.doMock('../../config/index.js', () => ({
      getConfig: () => TEST_CONFIGURATION
    }));

    testServer = await createTestYouTubeMCPServer();
  });

  afterEach(async () => {
    await testServer.stop();
    vi.clearAllMocks();
    // Clear all mocks
    vi.doUnmock('../../auth/oauth-service.js');
    vi.doUnmock('../../youtube/client.js');
    vi.doUnmock('../../metadata/metadata-service.js');
    vi.doUnmock('../../metadata/metadata-review-store.js');
    vi.doUnmock('../../playlist/playlist-service.js');
    vi.doUnmock('../../scheduler/scheduler.js');
    vi.doUnmock('../../backup/backup-service.js');
    vi.doUnmock('../../batch/batch-orchestrator.js');
    vi.doUnmock('../../batch/batch-manager.js');
    vi.doUnmock('../../config/index.js');
  });

  describe('Complete Video Publishing Workflow', () => {
    it('should complete full video publishing pipeline', async () => {
      const videoId = TEST_VIDEOS[0].id;

      // Step 1: OAuth authentication
      const authStart = await testServer.callTool('start_oauth_flow', {
        scopes: ['https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/youtube.upload']
      });

      const authResponse = JSON.parse(authStart.content[0].text);
      expect(authResponse.authUrl).toBeDefined();

      const authComplete = await testServer.callTool('complete_oauth_flow', {
        code: 'workflow-auth-code',
        state: authResponse.state
      });

      const tokenResponse = JSON.parse(authComplete.content[0].text);
      expect(tokenResponse.success).toBe(true);

      // Step 2: List and select videos
      const videoList = await testServer.callTool('list_videos', { maxResults: 10 });
      const videosResponse = JSON.parse(videoList.content[0].text);
      expect(videosResponse.videos).toHaveLength(TEST_VIDEOS.length);

      // Step 3: Generate metadata suggestions
      const suggestions = await testServer.callTool('generate_metadata_suggestions', {
        videoId,
        includeTranscript: true
      });

      const suggestionsResponse = JSON.parse(suggestions.content[0].text);
      expect(suggestionsResponse.suggestionId).toBeDefined();
      expect(suggestionsResponse.guardrails).toBeDefined();

      // Step 4: Create backup before changes
      const backup = await testServer.callTool('backup_video_metadata', {
        videoIds: [videoId],
        includeAllVideos: false
      });

      const backupResponse = JSON.parse(backup.content[0].text);
      expect(backupResponse.success).toBe(true);
      expect(workflowState.backups).toHaveLength(1);

      // Step 5: Apply metadata changes
      const applyMetadata = await testServer.callTool('apply_metadata', {
        videoId,
        suggestionId: suggestionsResponse.suggestionId,
        acknowledgedGuardrails: true,
        createBackup: true
      });

      const applyResponse = JSON.parse(applyMetadata.content[0].text);
      expect(applyResponse.success).toBe(true);

      // Step 6: Schedule video for publication
      const schedule = await testServer.callTool('schedule_videos', {
        videoIds: [videoId],
        startDate: '2023-06-01',
        endDate: '2023-06-30',
        timeSlots: ['09:00'],
        timezone: 'America/New_York',
        mode: 'apply'
      });

      const scheduleResponse = JSON.parse(schedule.content[0].text);
      expect(scheduleResponse.batchId).toBeDefined();

      // Step 7: Monitor batch progress
      await waitFor(300);
      const batchStatus = await testServer.callTool('get_batch_status', {
        batchId: scheduleResponse.batchId
      });

      const batchResponse = JSON.parse(batchStatus.content[0].text);
      expect(batchResponse.progress).toBeDefined();

      // Verify workflow state
      expect(workflowState.suggestions).toBeDefined();
      expect(workflowState.backups.length).toBeGreaterThan(0);
      expect(workflowState.batches.length).toBeGreaterThan(0);
    });

    it('should handle workflow errors gracefully', async () => {
      const videoId = 'non-existent-video';

      // Try to generate suggestions for non-existent video
      await expect(
        testServer.callTool('generate_metadata_suggestions', {
          videoId,
          includeTranscript: false
        })
      ).rejects.toThrow();

      // Workflow should be able to recover from individual step failures
      const validVideoId = TEST_VIDEOS[0].id;
      const suggestions = await testServer.callTool('generate_metadata_suggestions', {
        videoId: validVideoId,
        includeTranscript: false
      });

      expect(suggestions.content).toBeDefined();
    });

    it('should support workflow rollback via backups', async () => {
      const videoId = TEST_VIDEOS[0].id;
      const originalVideo = workflowState.videos.find((v: any) => v.id === videoId);
      const originalTitle = originalVideo.title;

      // Create backup
      await testServer.callTool('backup_video_metadata', {
        videoIds: [videoId],
        includeAllVideos: false
      });

      // Apply changes
      await testServer.callTool('apply_metadata', {
        videoId,
        title: 'Modified Title',
        createBackup: false
      });

      // Verify changes were applied
      const modifiedVideo = workflowState.videos.find((v: any) => v.id === videoId);
      expect(modifiedVideo.title).toBe('Modified Title');

      // Restore from backup
      const restore = await testServer.callTool('restore_video_metadata', {
        backupDate: '2023-03-01',
        videoId
      });

      const restoreResponse = JSON.parse(restore.content[0].text);
      expect(restoreResponse.success).toBe(true);
    });
  });

  describe('Metadata Generation and Application Flow', () => {
    it('should complete metadata optimization workflow', async () => {
      const videoId = TEST_VIDEOS[0].id;

      // Generate suggestions with transcript
      const suggestions = await testServer.callTool('generate_metadata_suggestions', {
        videoId,
        includeTranscript: true
      });

      const suggestionsResponse = JSON.parse(suggestions.content[0].text);
      const suggestionId = suggestionsResponse.suggestionId;

      // Verify suggestion was stored
      const suggestion = workflowState.suggestions[suggestionId];
      expect(suggestion).toBeDefined();
      expect(suggestion.suggestions.title.suggested).toContain('Enhanced:');

      // Apply suggestions with guardrail acknowledgment
      const apply = await testServer.callTool('apply_metadata', {
        videoId,
        suggestionId,
        acknowledgedGuardrails: true,
        createBackup: true
      });

      const applyResponse = JSON.parse(apply.content[0].text);
      expect(applyResponse.success).toBe(true);

      // Verify suggestion was marked as applied
      const appliedSuggestion = workflowState.suggestions[suggestionId];
      expect(appliedSuggestion.status).toBe('applied');
      expect(appliedSuggestion.appliedAt).toBeDefined();

      // Verify video metadata was updated
      const updatedVideo = workflowState.videos.find((v: any) => v.id === videoId);
      expect(updatedVideo.title).toContain('Enhanced:');
    });

    it('should handle metadata review and approval process', async () => {
      const videoId = TEST_VIDEOS[1].id;

      // Generate metadata suggestions
      const suggestions = await testServer.callTool('generate_metadata_suggestions', {
        videoId,
        includeTranscript: false
      });

      const suggestionsResponse = JSON.parse(suggestions.content[0].text);
      const suggestionId = suggestionsResponse.suggestionId;

      // Verify guardrails are present
      expect(suggestionsResponse.guardrails).toBeDefined();
      expect(suggestionsResponse.reviewChecklist).toBeDefined();
      expect(suggestionsResponse.summary.requiresApproval).toBe(true);

      // Try to apply without acknowledging guardrails
      await expect(
        testServer.callTool('apply_metadata', {
          videoId,
          suggestionId,
          acknowledgedGuardrails: false
        })
      ).rejects.toThrow('GUARDRAILS_NOT_ACKNOWLEDGED');

      // Apply with proper acknowledgment
      const apply = await testServer.callTool('apply_metadata', {
        videoId,
        suggestionId,
        acknowledgedGuardrails: true
      });

      const applyResponse = JSON.parse(apply.content[0].text);
      expect(applyResponse.success).toBe(true);
    });

    it('should support iterative metadata refinement', async () => {
      const videoId = TEST_VIDEOS[2].id;

      // First iteration
      const suggestions1 = await testServer.callTool('generate_metadata_suggestions', {
        videoId,
        includeTranscript: false
      });

      const response1 = JSON.parse(suggestions1.content[0].text);
      const suggestionId1 = response1.suggestionId;

      // Apply first set of suggestions
      await testServer.callTool('apply_metadata', {
        videoId,
        suggestionId: suggestionId1,
        acknowledgedGuardrails: true
      });

      // Generate new suggestions based on updated metadata
      const suggestions2 = await testServer.callTool('generate_metadata_suggestions', {
        videoId,
        includeTranscript: true
      });

      const response2 = JSON.parse(suggestions2.content[0].text);
      const suggestionId2 = response2.suggestionId;

      // Verify we have different suggestions
      expect(suggestionId1).not.toBe(suggestionId2);

      // Both suggestions should be tracked
      expect(workflowState.suggestions[suggestionId1]).toBeDefined();
      expect(workflowState.suggestions[suggestionId2]).toBeDefined();
    });
  });

  describe('Playlist Creation and Organization Flow', () => {
    it('should organize videos into playlists systematically', async () => {
      const videoIds = TEST_VIDEOS.map(v => v.id);

      // Step 1: Create themed playlists
      const educationPlaylist = await testServer.callTool('create_playlist', {
        title: 'Educational Content',
        description: 'Curated educational videos',
        privacyStatus: 'public'
      });

      const educationResponse = JSON.parse(educationPlaylist.content[0].text);
      expect(educationResponse.id).toBeDefined();

      // Step 2: Organize videos by category
      const organize = await testServer.callTool('organize_playlists', {
        videoIds,
        strategy: 'category',
        createMissingPlaylists: true,
        categoryMap: {
          '27': {
            playlistId: educationResponse.id,
            playlistTitle: 'Educational Content'
          }
        }
      });

      const organizeResponse = JSON.parse(organize.content[0].text);
      expect(organizeResponse.success).toBe(true);
      expect(organizeResponse.batchId).toBeDefined();

      // Step 3: Monitor organization progress
      await waitFor(200);
      const batchStatus = await testServer.callTool('get_batch_status', {
        batchId: organizeResponse.batchId
      });

      const batchResponse = JSON.parse(batchStatus.content[0].text);
      expect(batchResponse.progress).toBeDefined();

      // Verify playlist was populated
      const playlist = workflowState.playlists.find((p: any) => p.id === educationResponse.id);
      expect(playlist).toBeDefined();
    });

    it('should handle manual playlist curation workflow', async () => {
      const videoIds = TEST_VIDEOS.slice(0, 4).map(v => v.id);

      // Create manual organization with specific groupings
      const organize = await testServer.callTool('organize_playlists', {
        videoIds,
        strategy: 'manual',
        createMissingPlaylists: true,
        groups: [
          {
            playlistTitle: 'Beginner Series',
            videoIds: videoIds.slice(0, 2),
            description: 'Perfect for beginners',
            privacyStatus: 'public'
          },
          {
            playlistTitle: 'Advanced Topics',
            videoIds: videoIds.slice(2),
            description: 'Advanced content',
            privacyStatus: 'unlisted'
          }
        ]
      });

      const organizeResponse = JSON.parse(organize.content[0].text);
      expect(organizeResponse.success).toBe(true);
      expect(organizeResponse.groups).toHaveLength(2);

      // Verify playlists were created with correct videos
      const beginnerPlaylist = workflowState.playlists.find((p: any) => p.title === 'Beginner Series');
      const advancedPlaylist = workflowState.playlists.find((p: any) => p.title === 'Advanced Topics');

      expect(beginnerPlaylist).toBeDefined();
      expect(advancedPlaylist).toBeDefined();
    });

    it('should support playlist content migration', async () => {
      // Create source playlist with videos
      const sourcePlaylist = await testServer.callTool('create_playlist', {
        title: 'Source Playlist',
        description: 'Original playlist',
        privacyStatus: 'private'
      });

      const sourceResponse = JSON.parse(sourcePlaylist.content[0].text);

      // Add videos to source playlist
      await testServer.callTool('add_videos_to_playlist', {
        playlistId: sourceResponse.id,
        videoIds: [TEST_VIDEOS[0].id, TEST_VIDEOS[1].id]
      });

      // Create destination playlist
      const destPlaylist = await testServer.callTool('create_playlist', {
        title: 'Destination Playlist',
        description: 'Migrated content',
        privacyStatus: 'public'
      });

      const destResponse = JSON.parse(destPlaylist.content[0].text);

      // Migrate content (by adding same videos to new playlist)
      await testServer.callTool('add_videos_to_playlist', {
        playlistId: destResponse.id,
        videoIds: [TEST_VIDEOS[0].id, TEST_VIDEOS[1].id]
      });

      // Verify both playlists exist
      expect(workflowState.playlists).toHaveLength(TEST_PLAYLISTS.length + 2);
    });
  });

  describe('Backup and Restore Cycle', () => {
    it('should complete comprehensive backup and restore workflow', async () => {
      // Step 1: Create comprehensive backup
      const backup = await testServer.callTool('backup_video_metadata', {
        includeAllVideos: true
      });

      const backupResponse = JSON.parse(backup.content[0].text);
      expect(backupResponse.success).toBe(true);
      expect(backupResponse.backups).toHaveLength(TEST_VIDEOS.length);

      // Step 2: Make changes to videos
      const videoId = TEST_VIDEOS[0].id;
      await testServer.callTool('apply_metadata', {
        videoId,
        title: 'Modified for Testing',
        description: 'Changed during workflow test',
        createBackup: false
      });

      // Verify changes were applied
      const modifiedVideo = workflowState.videos.find((v: any) => v.id === videoId);
      expect(modifiedVideo.title).toBe('Modified for Testing');

      // Step 3: List available backups
      const backupList = await testServer.readResource('backups://list');
      const backups = JSON.parse(backupList.contents[0].text);
      expect(Array.isArray(backups)).toBe(true);
      expect(backups.length).toBeGreaterThan(0);

      // Step 4: Restore from backup
      const restore = await testServer.callTool('restore_video_metadata', {
        backupDate: '2023-03-01',
        videoId
      });

      const restoreResponse = JSON.parse(restore.content[0].text);
      expect(restoreResponse.success).toBe(true);
    });

    it('should handle selective backup and restore', async () => {
      const criticalVideoIds = [TEST_VIDEOS[0].id, TEST_VIDEOS[1].id];

      // Backup only critical videos
      const backup = await testServer.callTool('backup_video_metadata', {
        videoIds: criticalVideoIds,
        includeAllVideos: false
      });

      const backupResponse = JSON.parse(backup.content[0].text);
      expect(backupResponse.backups).toHaveLength(2);

      // Make changes to one of the backed-up videos
      await testServer.callTool('apply_metadata', {
        videoId: criticalVideoIds[0],
        title: 'Critically Modified',
        createBackup: false
      });

      // Restore just that video
      const restore = await testServer.callTool('restore_video_metadata', {
        backupDate: '2023-03-01',
        videoId: criticalVideoIds[0]
      });

      const restoreResponse = JSON.parse(restore.content[0].text);
      expect(restoreResponse.success).toBe(true);
    });
  });

  describe('Multi-Tool Orchestration Scenarios', () => {
    it('should orchestrate complex multi-step operations', async () => {
      const videoIds = TEST_VIDEOS.slice(0, 3).map(v => v.id);

      // Workflow: Optimize metadata → Create playlist → Schedule → Backup
      const operations = [];

      // Step 1: Generate metadata for all videos
      for (const videoId of videoIds) {
        const suggestions = await testServer.callTool('generate_metadata_suggestions', {
          videoId,
          includeTranscript: false
        });
        operations.push({ type: 'suggestions', videoId, response: suggestions });
      }

      // Step 2: Apply metadata changes
      for (const op of operations) {
        const response = JSON.parse(op.response.content[0].text);
        const apply = await testServer.callTool('apply_metadata', {
          videoId: op.videoId,
          suggestionId: response.suggestionId,
          acknowledgedGuardrails: true,
          createBackup: true
        });
        op.applyResponse = apply;
      }

      // Step 3: Create playlist and add optimized videos
      const playlist = await testServer.callTool('create_playlist', {
        title: 'Optimized Content Series',
        description: 'Videos with AI-optimized metadata',
        privacyStatus: 'public'
      });

      const playlistResponse = JSON.parse(playlist.content[0].text);

      const addToPlaylist = await testServer.callTool('add_videos_to_playlist', {
        playlistId: playlistResponse.id,
        videoIds
      });

      const addResponse = JSON.parse(addToPlaylist.content[0].text);
      expect(addResponse.success).toBe(true);

      // Step 4: Schedule the series for publication
      const schedule = await testServer.callTool('schedule_videos', {
        videoIds,
        startDate: '2023-06-01',
        endDate: '2023-06-30',
        timeSlots: ['09:00', '15:00'],
        timezone: 'America/New_York',
        mode: 'apply'
      });

      const scheduleResponse = JSON.parse(schedule.content[0].text);
      expect(scheduleResponse.batchId).toBeDefined();

      // Verify entire workflow state
      expect(Object.keys(workflowState.suggestions)).toHaveLength(3);
      expect(workflowState.backups.length).toBeGreaterThan(0);
      expect(workflowState.batches.length).toBeGreaterThan(0);
    });

    it('should handle concurrent workflow execution', async () => {
      const workflow1VideoIds = [TEST_VIDEOS[0].id];
      const workflow2VideoIds = [TEST_VIDEOS[1].id, TEST_VIDEOS[2].id];

      // Execute two workflows concurrently
      const [workflow1, workflow2] = await Promise.all([
        // Workflow 1: Single video optimization
        (async () => {
          const suggestions = await testServer.callTool('generate_metadata_suggestions', {
            videoId: workflow1VideoIds[0],
            includeTranscript: true
          });

          const suggestionsResponse = JSON.parse(suggestions.content[0].text);

          return testServer.callTool('apply_metadata', {
            videoId: workflow1VideoIds[0],
            suggestionId: suggestionsResponse.suggestionId,
            acknowledgedGuardrails: true
          });
        })(),

        // Workflow 2: Playlist organization
        testServer.callTool('organize_playlists', {
          videoIds: workflow2VideoIds,
          strategy: 'manual',
          createMissingPlaylists: true,
          groups: [{
            playlistTitle: 'Concurrent Test Playlist',
            videoIds: workflow2VideoIds,
            privacyStatus: 'private'
          }]
        })
      ]);

      // Both workflows should complete successfully
      const workflow1Response = JSON.parse(workflow1.content[0].text);
      const workflow2Response = JSON.parse(workflow2.content[0].text);

      expect(workflow1Response.success).toBe(true);
      expect(workflow2Response.success).toBe(true);
    });

    it('should maintain workflow state consistency', async () => {
      const videoId = TEST_VIDEOS[0].id;
      const initialVideoState = { ...workflowState.videos.find((v: any) => v.id === videoId) };

      // Perform multiple operations on the same video
      const operations = [
        // Generate suggestions
        testServer.callTool('generate_metadata_suggestions', {
          videoId,
          includeTranscript: false
        }),
        // Create backup
        testServer.callTool('backup_video_metadata', {
          videoIds: [videoId],
          includeAllVideos: false
        })
      ];

      const [suggestionsOp, backupOp] = await Promise.all(operations);

      // Apply metadata changes
      const suggestionsResponse = JSON.parse(suggestionsOp.content[0].text);
      await testServer.callTool('apply_metadata', {
        videoId,
        suggestionId: suggestionsResponse.suggestionId,
        acknowledgedGuardrails: true
      });

      // Verify state consistency
      const finalVideoState = workflowState.videos.find((v: any) => v.id === videoId);
      expect(finalVideoState.id).toBe(initialVideoState.id);
      expect(finalVideoState.title).not.toBe(initialVideoState.title); // Should be updated

      // Verify all operations were tracked
      expect(Object.keys(workflowState.suggestions).length).toBeGreaterThan(0);
      expect(workflowState.backups.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery and Workflow Resilience', () => {
    it('should recover from partial workflow failures', async () => {
      const videoIds = TEST_VIDEOS.map(v => v.id);

      // Start a complex workflow
      const organize = await testServer.callTool('organize_playlists', {
        videoIds,
        strategy: 'category',
        createMissingPlaylists: true
      });

      const organizeResponse = JSON.parse(organize.content[0].text);
      const batchId = organizeResponse.batchId;

      // Wait for partial completion
      await waitFor(150);

      // Check batch status
      const status = await testServer.callTool('get_batch_status', { batchId });
      const statusResponse = JSON.parse(status.content[0].text);

      expect(statusResponse.progress).toBeDefined();
      expect(statusResponse.progress.total).toBe(videoIds.length);

      // Workflow should continue even with some failures
      await waitFor(400);

      const finalStatus = await testServer.callTool('get_batch_status', { batchId });
      const finalResponse = JSON.parse(finalStatus.content[0].text);

      expect(finalResponse.status).toMatch(/completed|completed_with_errors|running/);
    });

    it('should handle resource conflicts gracefully', async () => {
      const videoId = TEST_VIDEOS[0].id;

      // Try to perform multiple conflicting operations
      const operations = [
        testServer.callTool('apply_metadata', {
          videoId,
          title: 'First Update',
          createBackup: false
        }),
        testServer.callTool('apply_metadata', {
          videoId,
          title: 'Second Update',
          createBackup: false
        })
      ];

      // One should succeed, the other might conflict or both might complete
      const results = await Promise.allSettled(operations);

      // At least one should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);
    });
  });
});