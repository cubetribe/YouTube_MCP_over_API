import type { YouTubeClient } from '../youtube/client.js';
import type { YouTubePlaylist } from '../types/index.js';

export class PlaylistService {
  constructor(private readonly client: YouTubeClient) {}

  async createPlaylist(payload: { title: string; description?: string; privacyStatus: 'private' | 'unlisted' | 'public'; defaultLanguage?: string; }): Promise<YouTubePlaylist> {
    return this.client.createPlaylist(payload);
  }

  async addVideos(playlistId: string, videoIds: string[], startPosition = 0): Promise<void> {
    await this.client.addVideosToPlaylist(playlistId, videoIds, startPosition);
  }

  async listPlaylists(): Promise<YouTubePlaylist[]> {
    return this.client.listPlaylists();
  }

  async findOrCreatePlaylist(payload: {
    playlistId?: string;
    title?: string;
    description?: string;
    privacyStatus?: 'private' | 'unlisted' | 'public';
    defaultLanguage?: string;
    allowCreate?: boolean;
  }): Promise<YouTubePlaylist> {
    if (payload.playlistId) {
      const playlists = await this.listPlaylists();
      const existing = playlists.find((playlist) => playlist.id === payload.playlistId);
      if (existing) return existing;
      throw new Error(`Playlist ${payload.playlistId} not found`);
    }

    if (!payload.title) {
      throw new Error('Either playlistId or title must be provided');
    }

    const existing = await this.client.findPlaylistByTitle(payload.title);
    if (existing) return existing;

    if (payload.allowCreate === false) {
      throw new Error(`Playlist "${payload.title}" not found and creation disabled.`);
    }

    return this.createPlaylist({
      title: payload.title,
      description: payload.description,
      privacyStatus: payload.privacyStatus ?? 'private',
      defaultLanguage: payload.defaultLanguage,
    });
  }
}
