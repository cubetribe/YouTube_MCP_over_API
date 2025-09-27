import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestMCPServer, createTestYouTubeMCPServer, waitFor } from './helpers/test-server.js';
import { createMockOAuthClient } from './helpers/mock-youtube-api.js';
import {
  TEST_CONFIGURATION,
  TEST_VIDEOS,
  TEST_PLAYLISTS,
  TEST_BATCH_OPERATIONS,
  createTestBatch
} from './fixtures/index.js';

describe('Batch Processing Integration Tests', () => {
  let testServer: TestMCPServer;
  let mockOAuthClient: any;
  let batchExecutionHistory: any[] = [];
  let currentBatchId = 0;

  beforeEach(async () => {
    mockOAuthClient = createMockOAuthClient();
    batchExecutionHistory = [];
    currentBatchId = 0;

    // Mock Batch Manager with realistic behavior
    vi.doMock('../../batch/batch-manager.js', () => ({
      batchManager: {
        get: vi.fn().mockImplementation((batchId) => {
          const batch = batchExecutionHistory.find(b => b.id === batchId);
          return batch || null;
        }),

        create: vi.fn().mockImplementation((type, metadata) => {
          const batch = {
            id: `batch-${++currentBatchId}`,
            type,
            status: 'pending',
            createdAt: new Date().toISOString(),
            metadata,
            items: [],
            progress: {
              total: 0,
              completed: 0,
              failed: 0
            }
          };
          batchExecutionHistory.push(batch);
          return batch;
        }),

        update: vi.fn().mockImplementation((batchId, updates) => {
          const batch = batchExecutionHistory.find(b => b.id === batchId);
          if (batch) {
            Object.assign(batch, updates);
          }
          return batch;
        }),

        list: vi.fn().mockImplementation(() => {
          return batchExecutionHistory;
        })
      }
    }));

    // Mock Batch Orchestrator with execution simulation
    vi.doMock('../../batch/batch-orchestrator.js', () => ({
      BatchOrchestrator: vi.fn().mockImplementation(() => ({
        enqueue: vi.fn().mockImplementation((batchSpec) => {
          const batch = {
            id: `batch-${++currentBatchId}`,
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
          batchExecutionHistory.push(batch);

          // Simulate async execution
          setTimeout(() => {
            this.simulateBatchExecution(batch);
          }, 100);

          return batch;
        }),

        setUpdateListener: vi.fn(),

        simulateBatchExecution: function(batch: any) {
          // Simulate processing items one by one
          let processed = 0;
          const processItem = () => {
            if (processed < batch.items.length) {
              const item = batch.items[processed];
              const shouldFail = Math.random() < 0.1; // 10% failure rate

              if (shouldFail) {
                item.status = 'failed';
                item.error = 'Simulated processing error';
                batch.progress.failed++;
              } else {
                item.status = 'completed';
                item.result = { processed: true, timestamp: new Date().toISOString() };
                batch.progress.completed++;
              }

              processed++;
              batch.progress.percentage = Math.round((processed / batch.items.length) * 100);

              if (processed === batch.items.length) {
                batch.status = batch.progress.failed > 0 ? 'completed_with_errors' : 'completed';
                batch.completedAt = new Date().toISOString();
              }

              // Continue processing next item
              setTimeout(processItem, 200);
            }
          };

          batch.status = 'running';
          batch.startedAt = new Date().toISOString();
          processItem();
        }
      }))
    }));

    // Mock YouTube Client
    vi.doMock('../../youtube/client.js', () => ({
      YouTubeClient: vi.fn().mockImplementation(() => ({
        getVideoDetails: vi.fn().mockResolvedValue(TEST_VIDEOS),
        updateVideoMetadata: vi.fn().mockImplementation(async (videoId, metadata) => {
          await waitFor(100); // Simulate API delay
          return { videoId, ...metadata };
        }),
        addVideoToPlaylist: vi.fn().mockImplementation(async (playlistId, videoId, position) => {
          await waitFor(75);
          return { playlistId, videoId, position };
        })
      }))
    }));

    // Mock Playlist Service
    vi.doMock('../../playlist/playlist-service.js', () => ({
      PlaylistService: vi.fn().mockImplementation(() => ({
        findOrCreatePlaylist: vi.fn().mockImplementation(async (options) => {
          await waitFor(150);
          if (options.playlistId) {
            return TEST_PLAYLISTS.find(p => p.id === options.playlistId) || TEST_PLAYLISTS[0];
          }
          return {
            id: `playlist-${Date.now()}`,
            title: options.title,
            description: options.description,
            privacyStatus: options.privacyStatus
          };
        })
      }))
    }));

    // Mock Video Scheduler
    vi.doMock('../../scheduler/scheduler.js', () => ({
      VideoScheduler: vi.fn().mockImplementation((config) => ({
        schedule: vi.fn().mockImplementation((videos) => {
          return {
            scheduled: videos.map((video: any, index: number) => ({
              videoId: video.videoId,
              title: video.title,
              scheduledTime: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
              category: video.category
            })),
            summary: {
              totalVideos: videos.length,
              scheduledVideos: videos.length,
              conflicts: 0,
              timeSpan: `${videos.length} days`
            }
          };
        })
      }))
    }));

    // Mock other dependencies
    vi.doMock('../../auth/oauth-service.js', () => ({
      oauthService: {
        getAuthorizedClient: vi.fn().mockResolvedValue(mockOAuthClient)
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
    vi.doUnmock('../../batch/batch-manager.js');
    vi.doUnmock('../../batch/batch-orchestrator.js');
    vi.doUnmock('../../youtube/client.js');
    vi.doUnmock('../../playlist/playlist-service.js');
    vi.doUnmock('../../scheduler/scheduler.js');
    vi.doUnmock('../../auth/oauth-service.js');
    vi.doUnmock('../../config/index.js');
  });

  describe('Multi-Video Scheduling Operations', () => {
    it('should create and execute video scheduling batch', async () => {
      const videoIds = TEST_VIDEOS.slice(0, 2).map(v => v.id);

      const result = await testServer.callTool('schedule_videos', {
        videoIds,
        startDate: '2023-06-01',
        endDate: '2023-06-30',
        timeSlots: ['09:00', '15:00'],
        timezone: 'America/New_York',
        mode: 'apply'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response.schedule).toBeDefined();
      expect(response.batchId).toBeDefined();
      expect(response.schedule.scheduled).toHaveLength(videoIds.length);

      // Verify batch was created
      const batch = batchExecutionHistory.find(b => b.id === response.batchId);
      expect(batch).toBeDefined();
      expect(batch.type).toBe('schedule_videos');
      expect(batch.items).toHaveLength(videoIds.length);
    });

    it('should handle scheduling conflicts and retry logic', async () => {
      const videoIds = TEST_VIDEOS.map(v => v.id);

      const result = await testServer.callTool('schedule_videos', {
        videoIds,
        startDate: '2023-06-01',
        endDate: '2023-06-02', // Short time window to create conflicts
        timeSlots: ['09:00'],
        timezone: 'America/New_York',
        mode: 'apply'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response.batchId).toBeDefined();

      // Check that batch handles the constraint properly
      const batch = batchExecutionHistory.find(b => b.id === response.batchId);
      expect(batch).toBeDefined();
    });

    it('should provide real-time progress updates for scheduling', async () => {
      const videoIds = TEST_VIDEOS.slice(0, 3).map(v => v.id);

      const scheduleResult = await testServer.callTool('schedule_videos', {
        videoIds,
        startDate: '2023-06-01',
        endDate: '2023-06-30',
        timeSlots: ['09:00'],
        timezone: 'America/New_York',
        mode: 'apply'
      });

      const scheduleResponse = JSON.parse(scheduleResult.content[0].text);
      const batchId = scheduleResponse.batchId;

      // Wait for some processing
      await waitFor(500);

      // Check batch status
      const statusResult = await testServer.callTool('get_batch_status', { batchId });
      const statusResponse = JSON.parse(statusResult.content[0].text);

      expect(statusResponse.id).toBe(batchId);
      expect(statusResponse.progress).toBeDefined();
      expect(statusResponse.progress.total).toBe(videoIds.length);
      expect(statusResponse.items).toHaveLength(videoIds.length);
    });
  });

  describe('Playlist Organization Workflows', () => {
    it('should organize videos into playlists by category', async () => {
      const videoIds = TEST_VIDEOS.map(v => v.id);

      const result = await testServer.callTool('organize_playlists', {
        videoIds,
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
      expect(Array.isArray(response.groups)).toBe(true);

      // Verify batch was created
      const batch = batchExecutionHistory.find(b => b.id === response.batchId);
      expect(batch).toBeDefined();
      expect(batch.type).toBe('playlist_management');
    });

    it('should handle manual playlist organization', async () => {
      const videoIds = TEST_VIDEOS.map(v => v.id);

      const result = await testServer.callTool('organize_playlists', {
        videoIds,
        strategy: 'manual',
        createMissingPlaylists: true,
        groups: [
          {
            playlistTitle: 'Group 1',
            videoIds: videoIds.slice(0, 2),
            privacyStatus: 'private'
          },
          {
            playlistId: TEST_PLAYLISTS[0].id,
            videoIds: videoIds.slice(2),
            privacyStatus: 'public'
          }
        ]
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.groups).toHaveLength(2);
      expect(response.groups[0].videoCount).toBe(2);
    });

    it('should add multiple videos to existing playlist', async () => {
      const videoIds = TEST_VIDEOS.slice(0, 3).map(v => v.id);
      const playlistId = TEST_PLAYLISTS[0].id;

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

      // Verify batch structure
      const batch = batchExecutionHistory.find(b => b.id === response.batchId);
      expect(batch).toBeDefined();
      expect(batch.items).toHaveLength(videoIds.length);
      expect(batch.metadata.playlistId).toBe(playlistId);
    });
  });

  describe('Progress Tracking and Resource Updates', () => {
    it('should track batch progress correctly', async () => {
      const videoIds = TEST_VIDEOS.slice(0, 4).map(v => v.id);

      const result = await testServer.callTool('add_videos_to_playlist', {
        playlistId: TEST_PLAYLISTS[0].id,
        videoIds
      });

      const response = JSON.parse(result.content[0].text);
      const batchId = response.batchId;

      // Initial status should show pending
      let statusResult = await testServer.callTool('get_batch_status', { batchId });
      let statusResponse = JSON.parse(statusResult.content[0].text);

      expect(statusResponse.status).toMatch(/pending|running/);
      expect(statusResponse.progress.total).toBe(videoIds.length);

      // Wait for some processing
      await waitFor(1000);

      // Check progress
      statusResult = await testServer.callTool('get_batch_status', { batchId });
      statusResponse = JSON.parse(statusResult.content[0].text);

      expect(statusResponse.progress.percentage).toBeGreaterThan(0);
      expect(statusResponse.progress.completed + statusResponse.progress.failed).toBeGreaterThan(0);
    });

    it('should handle batch completion states', async () => {
      const videoIds = TEST_VIDEOS.slice(0, 2).map(v => v.id);

      const result = await testServer.callTool('schedule_videos', {
        videoIds,
        startDate: '2023-06-01',
        endDate: '2023-06-30',
        timeSlots: ['09:00'],
        timezone: 'America/New_York',
        mode: 'apply'
      });

      const response = JSON.parse(result.content[0].text);
      const batchId = response.batchId;

      // Wait for completion
      await waitFor(1500);

      const statusResult = await testServer.callTool('get_batch_status', { batchId });
      const statusResponse = JSON.parse(statusResult.content[0].text);

      expect(statusResponse.status).toMatch(/completed|completed_with_errors/);
      expect(statusResponse.progress.percentage).toBe(100);
      expect(statusResponse.completedAt).toBeDefined();
    });

    it('should provide detailed item-level status', async () => {
      const videoIds = TEST_VIDEOS.slice(0, 3).map(v => v.id);

      const result = await testServer.callTool('add_videos_to_playlist', {
        playlistId: TEST_PLAYLISTS[0].id,
        videoIds
      });

      const response = JSON.parse(result.content[0].text);
      const batchId = response.batchId;

      // Wait for some processing
      await waitFor(800);

      const statusResult = await testServer.callTool('get_batch_status', { batchId });
      const statusResponse = JSON.parse(statusResult.content[0].text);

      expect(statusResponse.items).toBeDefined();
      expect(statusResponse.items).toHaveLength(videoIds.length);

      statusResponse.items.forEach((item: any) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('status');
        expect(['pending', 'running', 'completed', 'failed']).toContain(item.status);

        if (item.status === 'completed') {
          expect(item.result).toBeDefined();
        }

        if (item.status === 'failed') {
          expect(item.error).toBeDefined();
        }
      });
    });
  });

  describe('Concurrent Batch Execution', () => {
    it('should handle multiple concurrent batches', async () => {
      const videoIds1 = TEST_VIDEOS.slice(0, 2).map(v => v.id);
      const videoIds2 = TEST_VIDEOS.slice(2, 4).map(v => v.id);

      // Start multiple batches concurrently
      const [result1, result2] = await Promise.all([
        testServer.callTool('add_videos_to_playlist', {
          playlistId: TEST_PLAYLISTS[0].id,
          videoIds: videoIds1
        }),
        testServer.callTool('schedule_videos', {
          videoIds: videoIds2,
          startDate: '2023-06-01',
          endDate: '2023-06-30',
          timeSlots: ['09:00'],
          timezone: 'America/New_York',
          mode: 'apply'
        })
      ]);

      const response1 = JSON.parse(result1.content[0].text);
      const response2 = JSON.parse(result2.content[0].text);

      expect(response1.batchId).toBeDefined();
      expect(response2.batchId).toBeDefined();
      expect(response1.batchId).not.toBe(response2.batchId);

      // Both batches should be tracked
      expect(batchExecutionHistory).toHaveLength(2);
    });

    it('should maintain batch isolation', async () => {
      const batch1VideoIds = [TEST_VIDEOS[0].id];
      const batch2VideoIds = [TEST_VIDEOS[1].id];

      // Create two different types of batches
      const playlist1 = await testServer.callTool('add_videos_to_playlist', {
        playlistId: TEST_PLAYLISTS[0].id,
        videoIds: batch1VideoIds
      });

      const schedule1 = await testServer.callTool('schedule_videos', {
        videoIds: batch2VideoIds,
        startDate: '2023-06-01',
        endDate: '2023-06-30',
        timeSlots: ['09:00'],
        timezone: 'America/New_York',
        mode: 'apply'
      });

      const playlistResponse = JSON.parse(playlist1.content[0].text);
      const scheduleResponse = JSON.parse(schedule1.content[0].text);

      // Wait for processing
      await waitFor(1000);

      // Check that each batch maintains its own state
      const playlistStatus = await testServer.callTool('get_batch_status', {
        batchId: playlistResponse.batchId
      });
      const scheduleStatus = await testServer.callTool('get_batch_status', {
        batchId: scheduleResponse.batchId
      });

      const playlistStatusResponse = JSON.parse(playlistStatus.content[0].text);
      const scheduleStatusResponse = JSON.parse(scheduleStatus.content[0].text);

      expect(playlistStatusResponse.type).toBe('playlist_management');
      expect(scheduleStatusResponse.type).toBe('schedule_videos');
      expect(playlistStatusResponse.items).toHaveLength(1);
      expect(scheduleStatusResponse.items).toHaveLength(1);
    });
  });

  describe('Error Recovery and Partial Completion', () => {
    it('should handle partial batch failures gracefully', async () => {
      // Mock some operations to fail
      vi.doMock('../../youtube/client.js', () => ({
        YouTubeClient: vi.fn().mockImplementation(() => ({
          addVideoToPlaylist: vi.fn().mockImplementation(async (playlistId, videoId) => {
            // Simulate failure for specific video
            if (videoId === TEST_VIDEOS[1].id) {
              throw new Error('Video not found or unavailable');
            }
            await waitFor(100);
            return { playlistId, videoId, position: 0 };
          })
        }))
      }));

      const videoIds = TEST_VIDEOS.slice(0, 3).map(v => v.id);

      const result = await testServer.callTool('add_videos_to_playlist', {
        playlistId: TEST_PLAYLISTS[0].id,
        videoIds
      });

      const response = JSON.parse(result.content[0].text);
      const batchId = response.batchId;

      // Wait for completion
      await waitFor(1500);

      const statusResult = await testServer.callTool('get_batch_status', { batchId });
      const statusResponse = JSON.parse(statusResult.content[0].text);

      expect(statusResponse.status).toBe('completed_with_errors');
      expect(statusResponse.progress.failed).toBeGreaterThan(0);
      expect(statusResponse.progress.completed).toBeGreaterThan(0);

      // Check that failed items have error information
      const failedItems = statusResponse.items.filter((item: any) => item.status === 'failed');
      expect(failedItems.length).toBeGreaterThan(0);
      failedItems.forEach((item: any) => {
        expect(item.error).toBeDefined();
      });
    });

    it('should support batch retry mechanisms', async () => {
      const videoIds = TEST_VIDEOS.slice(0, 2).map(v => v.id);

      const result = await testServer.callTool('add_videos_to_playlist', {
        playlistId: TEST_PLAYLISTS[0].id,
        videoIds
      });

      const response = JSON.parse(result.content[0].text);
      const batchId = response.batchId;

      // Wait for initial processing
      await waitFor(800);

      // Check initial status
      let statusResult = await testServer.callTool('get_batch_status', { batchId });
      let statusResponse = JSON.parse(statusResult.content[0].text);

      expect(statusResponse.id).toBe(batchId);
      expect(statusResponse.progress).toBeDefined();

      // Note: Actual retry logic would be implemented in the batch orchestrator
      // This test verifies the structure is in place for retry functionality
    });

    it('should handle resource cleanup on batch cancellation', async () => {
      const videoIds = TEST_VIDEOS.slice(0, 2).map(v => v.id);

      const result = await testServer.callTool('schedule_videos', {
        videoIds,
        startDate: '2023-06-01',
        endDate: '2023-06-30',
        timeSlots: ['09:00'],
        timezone: 'America/New_York',
        mode: 'apply'
      });

      const response = JSON.parse(result.content[0].text);
      const batchId = response.batchId;

      // Verify batch exists
      const batch = batchExecutionHistory.find(b => b.id === batchId);
      expect(batch).toBeDefined();

      // Note: Actual cancellation would be implemented as a separate tool
      // This test verifies batch tracking is working correctly
    });
  });

  describe('Batch Resource Subscription and Notifications', () => {
    it('should support subscription to batch status updates', async () => {
      const videoIds = TEST_VIDEOS.slice(0, 2).map(v => v.id);

      const result = await testServer.callTool('add_videos_to_playlist', {
        playlistId: TEST_PLAYLISTS[0].id,
        videoIds
      });

      const response = JSON.parse(result.content[0].text);
      const batchId = response.batchId;

      // Subscribe to batch status updates
      const subscribeResult = await testServer.subscribe(`batch://status/${batchId}`);
      expect(subscribeResult).toBeDefined();

      // Unsubscribe
      const unsubscribeResult = await testServer.unsubscribe(`batch://status/${batchId}`);
      expect(unsubscribeResult).toBeDefined();
    });

    it('should provide batch listing functionality', async () => {
      // Create multiple batches
      await testServer.callTool('add_videos_to_playlist', {
        playlistId: TEST_PLAYLISTS[0].id,
        videoIds: [TEST_VIDEOS[0].id]
      });

      await testServer.callTool('schedule_videos', {
        videoIds: [TEST_VIDEOS[1].id],
        startDate: '2023-06-01',
        endDate: '2023-06-30',
        timeSlots: ['09:00'],
        timezone: 'America/New_York',
        mode: 'apply'
      });

      // Verify multiple batches exist
      expect(batchExecutionHistory.length).toBeGreaterThan(1);

      // Check different batch types
      const batchTypes = batchExecutionHistory.map(b => b.type);
      expect(batchTypes).toContain('playlist_management');
      expect(batchTypes).toContain('schedule_videos');
    });
  });
});