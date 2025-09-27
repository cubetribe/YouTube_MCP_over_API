import { youtube_v3 } from 'googleapis';

// YouTube API Response Fixtures
export const mockVideoResource: youtube_v3.Schema$Video = {
  kind: 'youtube#video',
  etag: 'test-etag',
  id: 'test-video-id',
  snippet: {
    publishedAt: '2024-01-01T00:00:00Z',
    channelId: 'test-channel-id',
    title: 'Test Video Title',
    description: 'Test video description',
    thumbnails: {
      default: { url: 'https://example.com/default.jpg', width: 120, height: 90 },
      medium: { url: 'https://example.com/medium.jpg', width: 320, height: 180 },
      high: { url: 'https://example.com/high.jpg', width: 480, height: 360 },
    },
    channelTitle: 'Test Channel',
    tags: ['test', 'video'],
    categoryId: '22',
    liveBroadcastContent: 'none',
    localized: {
      title: 'Test Video Title',
      description: 'Test video description',
    },
  },
  status: {
    uploadStatus: 'processed',
    privacyStatus: 'public',
    license: 'youtube',
    embeddable: true,
    publicStatsViewable: true,
  },
  statistics: {
    viewCount: '1000',
    likeCount: '50',
    dislikeCount: '2',
    favoriteCount: '0',
    commentCount: '10',
  },
  contentDetails: {
    duration: 'PT5M30S',
    dimension: '2d',
    definition: 'hd',
    caption: 'false',
    licensedContent: false,
    projection: 'rectangular',
  },
};

export const mockPlaylistResource: youtube_v3.Schema$Playlist = {
  kind: 'youtube#playlist',
  etag: 'test-playlist-etag',
  id: 'test-playlist-id',
  snippet: {
    publishedAt: '2024-01-01T00:00:00Z',
    channelId: 'test-channel-id',
    title: 'Test Playlist',
    description: 'Test playlist description',
    thumbnails: {
      default: { url: 'https://example.com/playlist-default.jpg' },
    },
    channelTitle: 'Test Channel',
    localized: {
      title: 'Test Playlist',
      description: 'Test playlist description',
    },
  },
  status: {
    privacyStatus: 'public',
  },
  contentDetails: {
    itemCount: 5,
  },
};

export const mockChannelResource: youtube_v3.Schema$Channel = {
  kind: 'youtube#channel',
  etag: 'test-channel-etag',
  id: 'test-channel-id',
  snippet: {
    title: 'Test Channel',
    description: 'Test channel description',
    publishedAt: '2020-01-01T00:00:00Z',
    thumbnails: {
      default: { url: 'https://example.com/channel-default.jpg' },
    },
    localized: {
      title: 'Test Channel',
      description: 'Test channel description',
    },
  },
  statistics: {
    viewCount: '100000',
    subscriberCount: '1000',
    hiddenSubscriberCount: false,
    videoCount: '50',
  },
};

export const mockOAuthTokens = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  scope: 'https://www.googleapis.com/auth/youtube',
  token_type: 'Bearer',
  expiry_date: Date.now() + 3600000, // 1 hour from now
};

export const mockVideoMetadata = {
  title: 'Updated Test Video Title',
  description: 'Updated test video description with more details',
  tags: ['updated', 'test', 'video', 'metadata'],
  categoryId: '22',
  defaultLanguage: 'en',
};

export const mockBatchOperation = {
  id: 'batch-123',
  type: 'schedule_videos' as const,
  status: 'pending' as const,
  progress: {
    completed: 0,
    total: 5,
    percentage: 0,
  },
  operations: [
    { id: 'op-1', status: 'pending' as const },
    { id: 'op-2', status: 'pending' as const },
    { id: 'op-3', status: 'pending' as const },
    { id: 'op-4', status: 'pending' as const },
    { id: 'op-5', status: 'pending' as const },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockVideoTranscript = {
  videoId: 'test-video-id',
  language: 'en',
  transcript: [
    { start: 0, duration: 3, text: 'Hello and welcome to this video' },
    { start: 3, duration: 4, text: 'Today we will be discussing' },
    { start: 7, duration: 3, text: 'important topics about testing' },
  ],
};

export const mockBackupData = {
  timestamp: '2024-01-01T00:00:00Z',
  version: '1.0',
  videos: [
    {
      id: 'test-video-id',
      title: 'Test Video Title',
      description: 'Test video description',
      tags: ['test', 'video'],
      publishedAt: '2024-01-01T00:00:00Z',
    },
  ],
};

// Error fixtures
export class MockYouTubeError extends Error {
  code: number;
  errors: Array<{ domain: string; reason: string; message: string }>;

  constructor(message: string, code: number = 400) {
    super(message);
    this.name = 'YouTubeError';
    this.code = code;
    this.errors = [
      {
        domain: 'youtube.video',
        reason: 'videoNotFound',
        message: message,
      },
    ];
  }
}

export const mockOAuthError = new Error('OAuth authentication failed');
export const mockNetworkError = new Error('Network request failed');
export const mockValidationError = new Error('Invalid input data');