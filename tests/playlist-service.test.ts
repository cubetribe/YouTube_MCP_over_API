import { describe, expect, it } from 'vitest';

import { PlaylistService } from '../src/playlist/playlist-service.js';
import type { YouTubePlaylist } from '../src/types/index.js';

class FakeYouTubeClient {
  private playlists: YouTubePlaylist[] = [];

  constructor(initialPlaylists?: YouTubePlaylist[]) {
    this.playlists = initialPlaylists ? [...initialPlaylists] : [];
  }

  async createPlaylist(payload: {
    title: string;
    description?: string;
    privacyStatus: 'private' | 'unlisted' | 'public';
    defaultLanguage?: string;
  }): Promise<YouTubePlaylist> {
    const playlist: YouTubePlaylist = {
      id: `playlist-${this.playlists.length + 1}`,
      title: payload.title,
      description: payload.description ?? '',
      privacyStatus: payload.privacyStatus,
      itemCount: 0,
      url: `https://www.youtube.com/playlist?list=playlist-${this.playlists.length + 1}`,
      thumbnails: {},
    };
    this.playlists.push(playlist);
    return playlist;
  }

  async addVideosToPlaylist(_playlistId: string, _videoIds: string[], _startPosition = 0): Promise<void> {
    // no-op for unit tests
  }

  async listPlaylists(): Promise<YouTubePlaylist[]> {
    return [...this.playlists];
  }

  async findPlaylistByTitle(title: string): Promise<YouTubePlaylist | undefined> {
    return this.playlists.find((playlist) => playlist.title === title);
  }
}

describe('PlaylistService', () => {
  it('returns existing playlist when ID is provided', async () => {
    const existing: YouTubePlaylist = {
      id: 'playlist-1',
      title: 'Existing Playlist',
      description: 'Already there',
      privacyStatus: 'private',
      itemCount: 0,
      url: 'https://www.youtube.com/playlist?list=playlist-1',
      thumbnails: {},
    };
    const service = new PlaylistService(new FakeYouTubeClient([existing]) as any);

    const playlist = await service.findOrCreatePlaylist({ playlistId: 'playlist-1' });
    expect(playlist).toEqual(existing);
  });

  it('creates playlist when not found and allowed', async () => {
    const client = new FakeYouTubeClient();
    const service = new PlaylistService(client as any);

    const playlist = await service.findOrCreatePlaylist({
      title: 'New Playlist',
      description: 'Auto created',
      privacyStatus: 'unlisted',
    });

    expect(playlist.title).toBe('New Playlist');
    expect(playlist.privacyStatus).toBe('unlisted');
  });

  it('throws when playlist missing and creation disabled', async () => {
    const service = new PlaylistService(new FakeYouTubeClient() as any);

    await expect(
      service.findOrCreatePlaylist({
        title: 'Missing Playlist',
        allowCreate: false,
      })
    ).rejects.toThrow('Playlist "Missing Playlist" not found and creation disabled.');
  });
});
