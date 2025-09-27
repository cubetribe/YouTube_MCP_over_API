import { vi } from 'vitest';
import { youtube_v3, google } from 'googleapis';
import { mockVideoResource, mockPlaylistResource, mockChannelResource, mockOAuthTokens } from '../fixtures/index.js';

// Mock googleapis
export const createMockYouTubeAPI = () => {
  const mockVideos = {
    list: vi.fn().mockResolvedValue({
      data: {
        items: [mockVideoResource],
        pageInfo: { totalResults: 1, resultsPerPage: 50 },
      },
    }),
    update: vi.fn().mockResolvedValue({
      data: mockVideoResource,
    }),
    insert: vi.fn().mockResolvedValue({
      data: mockVideoResource,
    }),
  };

  const mockPlaylists = {
    list: vi.fn().mockResolvedValue({
      data: {
        items: [mockPlaylistResource],
        pageInfo: { totalResults: 1, resultsPerPage: 50 },
      },
    }),
    insert: vi.fn().mockResolvedValue({
      data: mockPlaylistResource,
    }),
    update: vi.fn().mockResolvedValue({
      data: mockPlaylistResource,
    }),
  };

  const mockPlaylistItems = {
    list: vi.fn().mockResolvedValue({
      data: {
        items: [],
        pageInfo: { totalResults: 0, resultsPerPage: 50 },
      },
    }),
    insert: vi.fn().mockResolvedValue({
      data: {
        id: 'playlist-item-id',
        snippet: {
          playlistId: 'test-playlist-id',
          resourceId: { videoId: 'test-video-id' },
        },
      },
    }),
  };

  const mockChannels = {
    list: vi.fn().mockResolvedValue({
      data: {
        items: [mockChannelResource],
        pageInfo: { totalResults: 1, resultsPerPage: 1 },
      },
    }),
  };

  const mockCaptions = {
    list: vi.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: 'caption-id',
            snippet: {
              videoId: 'test-video-id',
              language: 'en',
              name: 'English',
            },
          },
        ],
      },
    }),
    download: vi.fn().mockResolvedValue({
      data: 'Test transcript content',
    }),
  };

  return {
    videos: mockVideos,
    playlists: mockPlaylists,
    playlistItems: mockPlaylistItems,
    channels: mockChannels,
    captions: mockCaptions,
  };
};

// Mock Google Auth
export const createMockOAuth2Client = () => {
  return {
    setCredentials: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue({
      token: mockOAuthTokens.access_token,
    }),
    refreshAccessToken: vi.fn().mockResolvedValue({
      credentials: mockOAuthTokens,
    }),
    generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/oauth/authorize?mock=true'),
    getToken: vi.fn().mockResolvedValue({
      tokens: mockOAuthTokens,
    }),
    credentials: mockOAuthTokens,
  };
};

// Mock File System
export const createMockFileSystem = () => {
  const mockFs = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    stat: vi.fn(),
    readdir: vi.fn(),
  };

  // Setup default behaviors
  mockFs.access.mockResolvedValue(undefined); // File exists
  mockFs.mkdir.mockResolvedValue(undefined);
  mockFs.writeFile.mockResolvedValue(undefined);
  mockFs.readFile.mockResolvedValue(JSON.stringify(mockOAuthTokens));
  mockFs.stat.mockResolvedValue({
    isDirectory: () => true,
    isFile: () => true,
  });
  mockFs.readdir.mockResolvedValue([]);

  return mockFs;
};

// Mock HTTP Client
export const createMockHttpClient = () => {
  return {
    get: vi.fn().mockResolvedValue({
      status: 200,
      data: {},
    }),
    post: vi.fn().mockResolvedValue({
      status: 200,
      data: {},
    }),
    put: vi.fn().mockResolvedValue({
      status: 200,
      data: {},
    }),
    delete: vi.fn().mockResolvedValue({
      status: 200,
      data: {},
    }),
  };
};

// Mock UUID
export const mockUUID = () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9);

// Mock Date
export const mockDate = (timestamp?: string) => {
  const date = timestamp ? new Date(timestamp) : new Date('2024-01-01T00:00:00Z');
  vi.setSystemTime(date);
  return date;
};

// Mock Logger
export const createMockLogger = () => {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
  };
};

// Mock Crypto for encryption tests
export const createMockCrypto = () => {
  return {
    randomBytes: vi.fn().mockReturnValue(Buffer.from('mock-random-bytes')),
    createCipher: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue('encrypted'),
      final: vi.fn().mockReturnValue(''),
    }),
    createDecipher: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue('decrypted'),
      final: vi.fn().mockReturnValue(''),
    }),
  };
};