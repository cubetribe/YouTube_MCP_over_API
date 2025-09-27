import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaylistService } from '../../playlist/playlist-service.js';
import type { YouTubeClient } from '../../youtube/client.js';
import type { YouTubePlaylist } from '../../types/index.js';

// Mock YouTube client
const createMockYouTubeClient = (): jest.Mocked<YouTubeClient> => ({
  createPlaylist: vi.fn(),
  addVideosToPlaylist: vi.fn(),
  listPlaylists: vi.fn(),
  findPlaylistByTitle: vi.fn(),
  // Add other required methods as no-ops
  listVideos: vi.fn(),
  updateVideo: vi.fn(),
  getVideoTranscript: vi.fn(),
} as any);

describe('PlaylistService', () => {
  let playlistService: PlaylistService;
  let mockClient: jest.Mocked<YouTubeClient>;

  const mockPlaylist: YouTubePlaylist = {
    id: 'test-playlist-id',
    title: 'Test Playlist',
    description: 'Test playlist description',
    privacyStatus: 'private',
    videoCount: 0,
    channelId: 'test-channel-id',
    channelTitle: 'Test Channel',
    publishedAt: '2024-01-01T00:00:00Z',
    thumbnails: {
      default: { url: 'https://example.com/thumb.jpg' },
    },
  };

  beforeEach(() => {
    mockClient = createMockYouTubeClient();
    playlistService = new PlaylistService(mockClient);
  });

  describe('createPlaylist', () => {
    it('should create a playlist with required parameters', async () => {
      const payload = {
        title: 'New Playlist',
        description: 'New playlist description',
        privacyStatus: 'public' as const,
        defaultLanguage: 'en',
      };

      mockClient.createPlaylist.mockResolvedValue(mockPlaylist);

      const result = await playlistService.createPlaylist(payload);

      expect(mockClient.createPlaylist).toHaveBeenCalledWith(payload);
      expect(result).toEqual(mockPlaylist);
    });

    it('should create a playlist with minimal parameters', async () => {
      const payload = {
        title: 'Minimal Playlist',
        privacyStatus: 'private' as const,
      };

      mockClient.createPlaylist.mockResolvedValue(mockPlaylist);

      const result = await playlistService.createPlaylist(payload);

      expect(mockClient.createPlaylist).toHaveBeenCalledWith(payload);
      expect(result).toEqual(mockPlaylist);
    });

    it('should handle client errors when creating playlist', async () => {
      const payload = {
        title: 'Error Playlist',
        privacyStatus: 'public' as const,
      };

      const error = new Error('API quota exceeded');
      mockClient.createPlaylist.mockRejectedValue(error);

      await expect(playlistService.createPlaylist(payload)).rejects.toThrow('API quota exceeded');
      expect(mockClient.createPlaylist).toHaveBeenCalledWith(payload);
    });

    it('should pass through all privacy status options', async () => {
      const privacyStatuses = ['private', 'unlisted', 'public'] as const;

      for (const privacyStatus of privacyStatuses) {
        const payload = {
          title: `${privacyStatus} Playlist`,
          privacyStatus,
        };

        mockClient.createPlaylist.mockResolvedValue({
          ...mockPlaylist,
          privacyStatus,
        });

        const result = await playlistService.createPlaylist(payload);

        expect(mockClient.createPlaylist).toHaveBeenCalledWith(payload);
        expect(result.privacyStatus).toBe(privacyStatus);
      }
    });
  });

  describe('addVideos', () => {
    it('should add videos to playlist with default position', async () => {
      const playlistId = 'test-playlist-id';
      const videoIds = ['video-1', 'video-2', 'video-3'];

      mockClient.addVideosToPlaylist.mockResolvedValue(undefined);

      await playlistService.addVideos(playlistId, videoIds);

      expect(mockClient.addVideosToPlaylist).toHaveBeenCalledWith(playlistId, videoIds, 0);
    });

    it('should add videos to playlist with custom start position', async () => {
      const playlistId = 'test-playlist-id';
      const videoIds = ['video-1', 'video-2'];
      const startPosition = 5;

      mockClient.addVideosToPlaylist.mockResolvedValue(undefined);

      await playlistService.addVideos(playlistId, videoIds, startPosition);

      expect(mockClient.addVideosToPlaylist).toHaveBeenCalledWith(playlistId, videoIds, startPosition);
    });

    it('should handle empty video list', async () => {
      const playlistId = 'test-playlist-id';
      const videoIds: string[] = [];

      mockClient.addVideosToPlaylist.mockResolvedValue(undefined);

      await playlistService.addVideos(playlistId, videoIds);

      expect(mockClient.addVideosToPlaylist).toHaveBeenCalledWith(playlistId, videoIds, 0);
    });

    it('should handle client errors when adding videos', async () => {
      const playlistId = 'test-playlist-id';
      const videoIds = ['video-1'];

      const error = new Error('Video not found');
      mockClient.addVideosToPlaylist.mockRejectedValue(error);

      await expect(playlistService.addVideos(playlistId, videoIds)).rejects.toThrow('Video not found');
      expect(mockClient.addVideosToPlaylist).toHaveBeenCalledWith(playlistId, videoIds, 0);
    });

    it('should handle single video addition', async () => {
      const playlistId = 'test-playlist-id';
      const videoIds = ['single-video'];

      mockClient.addVideosToPlaylist.mockResolvedValue(undefined);

      await playlistService.addVideos(playlistId, videoIds);

      expect(mockClient.addVideosToPlaylist).toHaveBeenCalledWith(playlistId, videoIds, 0);
    });
  });

  describe('listPlaylists', () => {
    it('should return list of playlists', async () => {
      const mockPlaylists = [
        mockPlaylist,
        {
          ...mockPlaylist,
          id: 'playlist-2',
          title: 'Second Playlist',
        },
      ];

      mockClient.listPlaylists.mockResolvedValue(mockPlaylists);

      const result = await playlistService.listPlaylists();

      expect(mockClient.listPlaylists).toHaveBeenCalledWith();
      expect(result).toEqual(mockPlaylists);
      expect(result).toHaveLength(2);
    });

    it('should return empty list when no playlists exist', async () => {
      mockClient.listPlaylists.mockResolvedValue([]);

      const result = await playlistService.listPlaylists();

      expect(mockClient.listPlaylists).toHaveBeenCalledWith();
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle client errors when listing playlists', async () => {
      const error = new Error('Network error');
      mockClient.listPlaylists.mockRejectedValue(error);

      await expect(playlistService.listPlaylists()).rejects.toThrow('Network error');
      expect(mockClient.listPlaylists).toHaveBeenCalledWith();
    });
  });

  describe('findOrCreatePlaylist', () => {
    describe('with playlistId', () => {
      it('should return existing playlist when found by ID', async () => {
        const payload = {
          playlistId: 'existing-playlist-id',
        };

        const existingPlaylist = {
          ...mockPlaylist,
          id: 'existing-playlist-id',
        };

        mockClient.listPlaylists.mockResolvedValue([existingPlaylist]);

        const result = await playlistService.findOrCreatePlaylist(payload);

        expect(mockClient.listPlaylists).toHaveBeenCalledWith();
        expect(result).toEqual(existingPlaylist);
        expect(mockClient.findPlaylistByTitle).not.toHaveBeenCalled();
        expect(mockClient.createPlaylist).not.toHaveBeenCalled();
      });

      it('should throw error when playlist ID not found', async () => {
        const payload = {
          playlistId: 'non-existent-playlist-id',
        };

        mockClient.listPlaylists.mockResolvedValue([mockPlaylist]);

        await expect(playlistService.findOrCreatePlaylist(payload)).rejects.toThrow(
          'Playlist non-existent-playlist-id not found'
        );

        expect(mockClient.listPlaylists).toHaveBeenCalledWith();
        expect(mockClient.findPlaylistByTitle).not.toHaveBeenCalled();
        expect(mockClient.createPlaylist).not.toHaveBeenCalled();
      });

      it('should handle empty playlist list when searching by ID', async () => {
        const payload = {
          playlistId: 'any-playlist-id',
        };

        mockClient.listPlaylists.mockResolvedValue([]);

        await expect(playlistService.findOrCreatePlaylist(payload)).rejects.toThrow(
          'Playlist any-playlist-id not found'
        );
      });
    });

    describe('with title', () => {
      it('should return existing playlist when found by title', async () => {
        const payload = {
          title: 'Existing Playlist',
        };

        const existingPlaylist = {
          ...mockPlaylist,
          title: 'Existing Playlist',
        };

        mockClient.findPlaylistByTitle.mockResolvedValue(existingPlaylist);

        const result = await playlistService.findOrCreatePlaylist(payload);

        expect(mockClient.findPlaylistByTitle).toHaveBeenCalledWith('Existing Playlist');
        expect(result).toEqual(existingPlaylist);
        expect(mockClient.createPlaylist).not.toHaveBeenCalled();
      });

      it('should create new playlist when not found by title', async () => {
        const payload = {
          title: 'New Playlist',
          description: 'New description',
          privacyStatus: 'public' as const,
          defaultLanguage: 'en',
        };

        const newPlaylist = {
          ...mockPlaylist,
          title: 'New Playlist',
        };

        mockClient.findPlaylistByTitle.mockResolvedValue(null);
        mockClient.createPlaylist.mockResolvedValue(newPlaylist);

        const result = await playlistService.findOrCreatePlaylist(payload);

        expect(mockClient.findPlaylistByTitle).toHaveBeenCalledWith('New Playlist');
        expect(mockClient.createPlaylist).toHaveBeenCalledWith({
          title: 'New Playlist',
          description: 'New description',
          privacyStatus: 'public',
          defaultLanguage: 'en',
        });
        expect(result).toEqual(newPlaylist);
      });

      it('should use default privacy status when creating new playlist', async () => {
        const payload = {
          title: 'Default Privacy Playlist',
        };

        const newPlaylist = {
          ...mockPlaylist,
          title: 'Default Privacy Playlist',
          privacyStatus: 'private' as const,
        };

        mockClient.findPlaylistByTitle.mockResolvedValue(null);
        mockClient.createPlaylist.mockResolvedValue(newPlaylist);

        const result = await playlistService.findOrCreatePlaylist(payload);

        expect(mockClient.createPlaylist).toHaveBeenCalledWith({
          title: 'Default Privacy Playlist',
          description: undefined,
          privacyStatus: 'private',
          defaultLanguage: undefined,
        });
        expect(result).toEqual(newPlaylist);
      });

      it('should throw error when playlist not found and creation disabled', async () => {
        const payload = {
          title: 'Non-existent Playlist',
          allowCreate: false,
        };

        mockClient.findPlaylistByTitle.mockResolvedValue(null);

        await expect(playlistService.findOrCreatePlaylist(payload)).rejects.toThrow(
          'Playlist "Non-existent Playlist" not found and creation disabled.'
        );

        expect(mockClient.findPlaylistByTitle).toHaveBeenCalledWith('Non-existent Playlist');
        expect(mockClient.createPlaylist).not.toHaveBeenCalled();
      });

      it('should create playlist when allowCreate is explicitly true', async () => {
        const payload = {
          title: 'Explicitly Allowed Playlist',
          allowCreate: true,
        };

        const newPlaylist = {
          ...mockPlaylist,
          title: 'Explicitly Allowed Playlist',
        };

        mockClient.findPlaylistByTitle.mockResolvedValue(null);
        mockClient.createPlaylist.mockResolvedValue(newPlaylist);

        const result = await playlistService.findOrCreatePlaylist(payload);

        expect(mockClient.findPlaylistByTitle).toHaveBeenCalledWith('Explicitly Allowed Playlist');
        expect(mockClient.createPlaylist).toHaveBeenCalledWith({
          title: 'Explicitly Allowed Playlist',
          description: undefined,
          privacyStatus: 'private',
          defaultLanguage: undefined,
        });
        expect(result).toEqual(newPlaylist);
      });
    });

    describe('validation', () => {
      it('should throw error when neither playlistId nor title provided', async () => {
        const payload = {};

        await expect(playlistService.findOrCreatePlaylist(payload)).rejects.toThrow(
          'Either playlistId or title must be provided'
        );

        expect(mockClient.listPlaylists).not.toHaveBeenCalled();
        expect(mockClient.findPlaylistByTitle).not.toHaveBeenCalled();
        expect(mockClient.createPlaylist).not.toHaveBeenCalled();
      });

      it('should prioritize playlistId over title when both provided', async () => {
        const payload = {
          playlistId: 'priority-playlist-id',
          title: 'Should Be Ignored',
        };

        const existingPlaylist = {
          ...mockPlaylist,
          id: 'priority-playlist-id',
        };

        mockClient.listPlaylists.mockResolvedValue([existingPlaylist]);

        const result = await playlistService.findOrCreatePlaylist(payload);

        expect(mockClient.listPlaylists).toHaveBeenCalledWith();
        expect(result).toEqual(existingPlaylist);
        expect(mockClient.findPlaylistByTitle).not.toHaveBeenCalled();
      });

      it('should handle empty string title', async () => {
        const payload = {
          title: '',
        };

        await expect(playlistService.findOrCreatePlaylist(payload)).rejects.toThrow(
          'Either playlistId or title must be provided'
        );
      });

      it('should handle whitespace-only title', async () => {
        const payload = {
          title: '   ',
        };

        // The service should treat this as a valid title (implementation choice)
        mockClient.findPlaylistByTitle.mockResolvedValue(null);
        mockClient.createPlaylist.mockResolvedValue(mockPlaylist);

        await playlistService.findOrCreatePlaylist(payload);

        expect(mockClient.findPlaylistByTitle).toHaveBeenCalledWith('   ');
      });
    });

    describe('error handling', () => {
      it('should handle client errors when listing playlists for ID search', async () => {
        const payload = {
          playlistId: 'test-playlist-id',
        };

        const error = new Error('API error');
        mockClient.listPlaylists.mockRejectedValue(error);

        await expect(playlistService.findOrCreatePlaylist(payload)).rejects.toThrow('API error');
      });

      it('should handle client errors when finding by title', async () => {
        const payload = {
          title: 'Error Playlist',
        };

        const error = new Error('Search error');
        mockClient.findPlaylistByTitle.mockRejectedValue(error);

        await expect(playlistService.findOrCreatePlaylist(payload)).rejects.toThrow('Search error');
      });

      it('should handle client errors when creating playlist', async () => {
        const payload = {
          title: 'Creation Error Playlist',
        };

        const error = new Error('Creation failed');
        mockClient.findPlaylistByTitle.mockResolvedValue(null);
        mockClient.createPlaylist.mockRejectedValue(error);

        await expect(playlistService.findOrCreatePlaylist(payload)).rejects.toThrow('Creation failed');
      });
    });

    describe('complex scenarios', () => {
      it('should handle case-sensitive title matching', async () => {
        const payload = {
          title: 'Case Sensitive Playlist',
        };

        const existingPlaylist = {
          ...mockPlaylist,
          title: 'case sensitive playlist', // Different case
        };

        // Assuming the client handles case sensitivity
        mockClient.findPlaylistByTitle.mockResolvedValue(null);
        mockClient.createPlaylist.mockResolvedValue(mockPlaylist);

        await playlistService.findOrCreatePlaylist(payload);

        expect(mockClient.findPlaylistByTitle).toHaveBeenCalledWith('Case Sensitive Playlist');
        expect(mockClient.createPlaylist).toHaveBeenCalled();
      });

      it('should handle very long playlist titles', async () => {
        const longTitle = 'A'.repeat(200);
        const payload = {
          title: longTitle,
        };

        mockClient.findPlaylistByTitle.mockResolvedValue(null);
        mockClient.createPlaylist.mockResolvedValue(mockPlaylist);

        await playlistService.findOrCreatePlaylist(payload);

        expect(mockClient.findPlaylistByTitle).toHaveBeenCalledWith(longTitle);
        expect(mockClient.createPlaylist).toHaveBeenCalledWith(
          expect.objectContaining({
            title: longTitle,
          })
        );
      });

      it('should handle special characters in playlist titles', async () => {
        const specialTitle = 'Playlist: [Music & Videos] - 2024!';
        const payload = {
          title: specialTitle,
        };

        mockClient.findPlaylistByTitle.mockResolvedValue(null);
        mockClient.createPlaylist.mockResolvedValue(mockPlaylist);

        await playlistService.findOrCreatePlaylist(payload);

        expect(mockClient.findPlaylistByTitle).toHaveBeenCalledWith(specialTitle);
        expect(mockClient.createPlaylist).toHaveBeenCalledWith(
          expect.objectContaining({
            title: specialTitle,
          })
        );
      });
    });
  });
});