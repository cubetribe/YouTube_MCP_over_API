/**
 * Test fixtures for integration testing
 * Provides realistic test data that mimics production scenarios
 */

export const TEST_VIDEOS = [
  {
    id: 'test-video-1',
    title: 'Introduction to Machine Learning',
    description: 'A comprehensive guide to machine learning basics, covering supervised and unsupervised learning algorithms.',
    tags: ['machine learning', 'ai', 'tutorial', 'python'],
    categoryId: '27', // Education
    privacyStatus: 'private',
    publishedAt: '2023-01-15T10:00:00Z',
    duration: 'PT15M30S',
    viewCount: '1250',
    likeCount: '89',
    commentCount: '23',
    thumbnails: {
      default: { url: 'https://example.com/thumb1.jpg', width: 120, height: 90 },
      medium: { url: 'https://example.com/thumb1_medium.jpg', width: 320, height: 180 },
      high: { url: 'https://example.com/thumb1_high.jpg', width: 480, height: 360 }
    }
  },
  {
    id: 'test-video-2',
    title: 'Web Development with React',
    description: 'Learn how to build modern web applications using React, including hooks, state management, and routing.',
    tags: ['react', 'javascript', 'web development', 'frontend'],
    categoryId: '27', // Education
    privacyStatus: 'unlisted',
    publishedAt: '2023-02-01T14:30:00Z',
    duration: 'PT22M45S',
    viewCount: '2100',
    likeCount: '156',
    commentCount: '45',
    thumbnails: {
      default: { url: 'https://example.com/thumb2.jpg', width: 120, height: 90 },
      medium: { url: 'https://example.com/thumb2_medium.jpg', width: 320, height: 180 },
      high: { url: 'https://example.com/thumb2_high.jpg', width: 480, height: 360 }
    }
  },
  {
    id: 'test-video-3',
    title: 'Data Science Project Walkthrough',
    description: 'Step-by-step walkthrough of a real data science project from data collection to model deployment.',
    tags: ['data science', 'python', 'machine learning', 'analytics'],
    categoryId: '27', // Education
    privacyStatus: 'public',
    publishedAt: '2023-02-15T09:15:00Z',
    duration: 'PT18M20S',
    viewCount: '875',
    likeCount: '67',
    commentCount: '18',
    thumbnails: {
      default: { url: 'https://example.com/thumb3.jpg', width: 120, height: 90 },
      medium: { url: 'https://example.com/thumb3_medium.jpg', width: 320, height: 180 },
      high: { url: 'https://example.com/thumb3_high.jpg', width: 480, height: 360 }
    }
  }
];

export const TEST_PLAYLISTS = [
  {
    id: 'test-playlist-1',
    title: 'Machine Learning Series',
    description: 'Complete machine learning tutorial series for beginners',
    privacyStatus: 'public',
    itemCount: 5,
    publishedAt: '2023-01-01T00:00:00Z',
    thumbnails: {
      default: { url: 'https://example.com/playlist1.jpg', width: 120, height: 90 }
    }
  },
  {
    id: 'test-playlist-2',
    title: 'Web Development Fundamentals',
    description: 'Learn web development from scratch',
    privacyStatus: 'unlisted',
    itemCount: 8,
    publishedAt: '2023-01-15T00:00:00Z',
    thumbnails: {
      default: { url: 'https://example.com/playlist2.jpg', width: 120, height: 90 }
    }
  }
];

export const TEST_CHANNEL = {
  id: 'test-channel-1',
  title: 'Tech Education Channel',
  description: 'Educational content for developers and data scientists',
  customUrl: '@techeducation',
  publishedAt: '2022-01-01T00:00:00Z',
  thumbnails: {
    default: { url: 'https://example.com/channel.jpg', width: 88, height: 88 }
  },
  statistics: {
    viewCount: '50000',
    subscriberCount: '1500',
    videoCount: '25'
  }
};

export const TEST_TRANSCRIPTS = {
  'test-video-1': {
    transcript: [
      { text: 'Welcome to this introduction to machine learning.', start: 0, duration: 3 },
      { text: 'In this video, we will cover the basics of supervised learning.', start: 3, duration: 4 },
      { text: 'Machine learning is a subset of artificial intelligence.', start: 7, duration: 4 },
      { text: 'It allows computers to learn without being explicitly programmed.', start: 11, duration: 5 }
    ],
    language: 'en'
  },
  'test-video-2': {
    transcript: [
      { text: 'Today we are going to learn about React.', start: 0, duration: 3 },
      { text: 'React is a JavaScript library for building user interfaces.', start: 3, duration: 4 },
      { text: 'It was developed by Facebook and is widely used.', start: 7, duration: 4 },
      { text: 'Let me start by showing you how to create a component.', start: 11, duration: 5 }
    ],
    language: 'en'
  }
};

export const TEST_METADATA_SUGGESTIONS = {
  'test-video-1': {
    id: 'suggestion-1',
    videoId: 'test-video-1',
    status: 'pending',
    generatedAt: '2023-03-01T10:00:00Z',
    requiresApproval: true,
    overallConfidence: 0.85,
    suggestions: {
      title: {
        current: 'Introduction to Machine Learning',
        suggested: 'Complete Machine Learning Guide for Beginners (2023)',
        confidence: 0.9,
        reasoning: 'Added year and clarity for better SEO'
      },
      description: {
        current: 'A comprehensive guide to machine learning basics.',
        suggested: 'Learn machine learning from scratch! This comprehensive guide covers supervised learning, unsupervised learning, and practical Python examples. Perfect for beginners starting their AI journey.\n\n🎯 What you\'ll learn:\n- Supervised vs Unsupervised Learning\n- Popular ML Algorithms\n- Python Implementation\n- Real-world Examples\n\n⏰ Timestamps:\n0:00 Introduction\n2:30 Supervised Learning\n8:15 Unsupervised Learning\n12:45 Practical Examples',
        confidence: 0.88,
        reasoning: 'Enhanced with structure, timestamps, and engagement elements'
      },
      tags: {
        current: ['machine learning', 'ai', 'tutorial', 'python'],
        suggested: ['machine learning', 'artificial intelligence', 'python tutorial', 'data science', 'ML for beginners', 'supervised learning', 'unsupervised learning', 'AI tutorial'],
        confidence: 0.82,
        reasoning: 'Expanded with more specific and searchable terms'
      }
    },
    guardrails: [
      'Verify that all technical terms are explained correctly',
      'Ensure the difficulty level matches the target audience',
      'Check that promised content in description is delivered in video'
    ],
    reviewChecklist: [
      'Title is engaging and SEO-optimized',
      'Description provides clear value proposition',
      'Tags cover both broad and specific search terms',
      'Content matches the suggested metadata'
    ],
    recommendedNextSteps: [
      'Review and approve suggestions',
      'Consider creating a follow-up video on advanced topics',
      'Add to Machine Learning playlist'
    ]
  }
};

export const TEST_OAUTH_TOKENS = {
  valid: {
    access_token: 'ya29.test-access-token',
    refresh_token: 'test-refresh-token',
    scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload',
    token_type: 'Bearer',
    expiry_date: Date.now() + 3600000 // 1 hour from now
  },
  expired: {
    access_token: 'ya29.expired-access-token',
    refresh_token: 'test-refresh-token',
    scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload',
    token_type: 'Bearer',
    expiry_date: Date.now() - 3600000 // 1 hour ago
  }
};

export const TEST_BATCH_OPERATIONS = {
  scheduleVideos: {
    id: 'batch-schedule-1',
    type: 'schedule_videos',
    status: 'pending',
    createdAt: new Date().toISOString(),
    metadata: {
      request: {
        startDate: '2023-06-01',
        endDate: '2023-06-30',
        timezone: 'America/New_York',
        mode: 'apply'
      },
      summary: {
        totalVideos: 3,
        scheduledVideos: 3,
        conflicts: 0
      }
    },
    items: [
      {
        id: 'test-video-1',
        label: 'Introduction to Machine Learning',
        type: 'schedule_video',
        videoId: 'test-video-1',
        description: 'Schedule for 2023-06-01 09:00:00',
        status: 'pending'
      },
      {
        id: 'test-video-2',
        label: 'Web Development with React',
        type: 'schedule_video',
        videoId: 'test-video-2',
        description: 'Schedule for 2023-06-08 09:00:00',
        status: 'pending'
      }
    ]
  },
  organizePlaylist: {
    id: 'batch-playlist-1',
    type: 'playlist_management',
    status: 'pending',
    createdAt: new Date().toISOString(),
    metadata: {
      strategy: 'category',
      groupCount: 2,
      createMissingPlaylists: true
    },
    items: [
      {
        id: 'playlist_0_prepare',
        label: 'Machine Learning Series',
        type: 'playlist_prepare',
        description: 'Create or find playlist',
        status: 'pending'
      },
      {
        id: 'playlist_0_add_0',
        label: 'Add test-video-1',
        type: 'playlist_add_video',
        videoId: 'test-video-1',
        description: 'Add video to playlist',
        status: 'pending'
      }
    ]
  }
};

export const TEST_BACKUP_DATA = {
  'test-video-1': {
    id: 'test-video-1',
    title: 'Introduction to Machine Learning',
    description: 'A comprehensive guide to machine learning basics.',
    tags: ['machine learning', 'ai', 'tutorial', 'python'],
    categoryId: '27',
    privacyStatus: 'private',
    backedUpAt: '2023-03-01T10:00:00Z'
  }
};

export const TEST_CONFIGURATION = {
  oauth: {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/callback',
    scopes: ['https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/youtube.upload']
  },
  youtubeAPI: {
    quotaLimit: 10000,
    rateLimitRequestsPerSecond: 10,
    rateLimitRequestsPerMinute: 100
  },
  storage: {
    backupDir: './test-data/backups',
    metadataSuggestionsDir: './test-data/storage',
    tempDir: './test-data/temp'
  },
  security: {
    encryptionSecret: 'test-encryption-secret-32-chars-long',
    tokenStorageDir: './test-data/tokens'
  }
};

// Utility functions for test data
export function createTestVideo(overrides: Partial<typeof TEST_VIDEOS[0]> = {}) {
  return {
    ...TEST_VIDEOS[0],
    ...overrides,
    id: overrides.id || `test-video-${Date.now()}`
  };
}

export function createTestPlaylist(overrides: Partial<typeof TEST_PLAYLISTS[0]> = {}) {
  return {
    ...TEST_PLAYLISTS[0],
    ...overrides,
    id: overrides.id || `test-playlist-${Date.now()}`
  };
}

export function createTestBatch(type: string, overrides: any = {}) {
  const base = type === 'schedule_videos' ? TEST_BATCH_OPERATIONS.scheduleVideos : TEST_BATCH_OPERATIONS.organizePlaylist;
  return {
    ...base,
    ...overrides,
    id: overrides.id || `batch-${type}-${Date.now()}`
  };
}

export function createTestOAuthTokens(overrides: any = {}) {
  return {
    ...TEST_OAUTH_TOKENS.valid,
    ...overrides
  };
}