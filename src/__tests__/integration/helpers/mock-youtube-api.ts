import { vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Mock YouTube API responses for integration testing
 */
export class MockYouTubeAPI extends EventEmitter {
  private apiCalls: Array<{ method: string; params: any; timestamp: Date }> = [];
  private responses: Map<string, any> = new Map();
  private quotaUsed: number = 0;
  private rateLimitCalls: number = 0;
  private lastRateLimitReset: Date = new Date();

  constructor() {
    super();
    this.setupDefaultResponses();
  }

  private setupDefaultResponses(): void {
    // Default channel response
    this.responses.set('channels.list', {
      data: {
        items: [{
          id: 'test-channel-id',
          snippet: {
            title: 'Test Channel',
            description: 'Test channel for integration testing',
            customUrl: '@testchannel',
            publishedAt: '2023-01-01T00:00:00Z',
            thumbnails: {
              default: { url: 'https://example.com/thumbnail.jpg' }
            }
          },
          statistics: {
            viewCount: '1000',
            subscriberCount: '100',
            videoCount: '50'
          }
        }]
      }
    });

    // Default videos list response
    this.responses.set('search.list', {
      data: {
        items: Array.from({ length: 10 }, (_, i) => ({
          id: { videoId: `test-video-${i + 1}` },
          snippet: {
            title: `Test Video ${i + 1}`,
            description: `Description for test video ${i + 1}`,
            publishedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
            thumbnails: {
              default: { url: `https://example.com/thumb${i + 1}.jpg` }
            },
            channelId: 'test-channel-id',
            channelTitle: 'Test Channel'
          }
        })),
        nextPageToken: 'next-page-token'
      }
    });

    // Default video details response
    this.responses.set('videos.list', {
      data: {
        items: [{
          id: 'test-video-1',
          snippet: {
            title: 'Test Video 1',
            description: 'Description for test video 1',
            tags: ['test', 'video', 'integration'],
            categoryId: '22',
            publishedAt: '2023-01-01T00:00:00Z',
            channelId: 'test-channel-id',
            channelTitle: 'Test Channel',
            thumbnails: {
              default: { url: 'https://example.com/thumb1.jpg' }
            }
          },
          status: {
            privacyStatus: 'private',
            uploadStatus: 'processed',
            publishAt: null
          },
          statistics: {
            viewCount: '100',
            likeCount: '10',
            commentCount: '5'
          },
          contentDetails: {
            duration: 'PT5M30S'
          }
        }]
      }
    });

    // Default playlists response
    this.responses.set('playlists.list', {
      data: {
        items: [{
          id: 'test-playlist-1',
          snippet: {
            title: 'Test Playlist',
            description: 'Test playlist for integration testing',
            publishedAt: '2023-01-01T00:00:00Z',
            channelId: 'test-channel-id',
            channelTitle: 'Test Channel',
            thumbnails: {
              default: { url: 'https://example.com/playlist-thumb.jpg' }
            }
          },
          status: {
            privacyStatus: 'private'
          },
          contentDetails: {
            itemCount: 5
          }
        }]
      }
    });

    // Default playlist creation response
    this.responses.set('playlists.insert', {
      data: {
        id: 'new-playlist-id',
        snippet: {
          title: 'New Playlist',
          description: 'Newly created playlist',
          publishedAt: new Date().toISOString(),
          channelId: 'test-channel-id',
          channelTitle: 'Test Channel'
        },
        status: {
          privacyStatus: 'private'
        }
      }
    });

    // Default video update response
    this.responses.set('videos.update', {
      data: {
        id: 'test-video-1',
        snippet: {
          title: 'Updated Video Title',
          description: 'Updated description',
          tags: ['updated', 'tags'],
          categoryId: '22'
        },
        status: {
          privacyStatus: 'public',
          publishAt: new Date().toISOString()
        }
      }
    });

    // Default captions response
    this.responses.set('captions.list', {
      data: {
        items: [{
          id: 'test-caption-1',
          snippet: {
            videoId: 'test-video-1',
            language: 'en',
            name: 'English',
            trackKind: 'standard'
          }
        }]
      }
    });
  }

  // Mock API method calls
  mockCall(method: string, params: any): Promise<any> {
    this.recordAPICall(method, params);
    this.checkRateLimit();
    this.updateQuota(method);

    const response = this.responses.get(method);
    if (!response) {
      throw new Error(`No mock response configured for ${method}`);
    }

    // Simulate network delay
    return new Promise(resolve => {
      setTimeout(() => {
        this.emit('apiCall', { method, params, response });
        resolve(response);
      }, Math.random() * 100 + 50);
    });
  }

  private recordAPICall(method: string, params: any): void {
    this.apiCalls.push({
      method,
      params,
      timestamp: new Date()
    });
  }

  private checkRateLimit(): void {
    const now = new Date();
    const timeDiff = now.getTime() - this.lastRateLimitReset.getTime();

    // Reset rate limit counter every minute
    if (timeDiff >= 60000) {
      this.rateLimitCalls = 0;
      this.lastRateLimitReset = now;
    }

    this.rateLimitCalls++;

    // Simulate rate limit error (100 calls per minute)
    if (this.rateLimitCalls > 100) {
      throw new Error('Rate limit exceeded');
    }
  }

  private updateQuota(method: string): void {
    const quotaCosts: Record<string, number> = {
      'channels.list': 1,
      'search.list': 100,
      'videos.list': 1,
      'videos.update': 50,
      'playlists.list': 1,
      'playlists.insert': 50,
      'playlistItems.insert': 50,
      'captions.list': 50,
      'captions.download': 200,
    };

    const cost = quotaCosts[method] || 1;
    this.quotaUsed += cost;

    // Simulate quota exceeded error (10,000 units per day)
    if (this.quotaUsed > 10000) {
      throw new Error('Quota exceeded');
    }
  }

  // Set custom response for a method
  setResponse(method: string, response: any): void {
    this.responses.set(method, response);
  }

  // Set error response for a method
  setError(method: string, error: Error): void {
    this.responses.set(method, { error });
  }

  // Get recorded API calls
  getAPICalls(): Array<{ method: string; params: any; timestamp: Date }> {
    return [...this.apiCalls];
  }

  // Get quota usage
  getQuotaUsed(): number {
    return this.quotaUsed;
  }

  // Get rate limit status
  getRateLimitStatus(): { calls: number; resetTime: Date } {
    return {
      calls: this.rateLimitCalls,
      resetTime: this.lastRateLimitReset
    };
  }

  // Reset all state
  reset(): void {
    this.apiCalls = [];
    this.quotaUsed = 0;
    this.rateLimitCalls = 0;
    this.lastRateLimitReset = new Date();
    this.setupDefaultResponses();
  }

  // Simulate specific error scenarios
  simulateNetworkError(): void {
    this.setError('*', new Error('Network error'));
  }

  simulateAuthError(): void {
    this.setError('*', new Error('Authentication required'));
  }

  simulateServerError(): void {
    this.setError('*', new Error('Internal server error'));
  }
}

/**
 * Mock OAuth client for testing
 */
export class MockOAuthClient {
  private accessToken: string = 'mock-access-token';
  private refreshToken: string = 'mock-refresh-token';
  private expiryDate: number = Date.now() + 3600000; // 1 hour from now
  private isExpired: boolean = false;

  constructor(options?: {
    accessToken?: string;
    refreshToken?: string;
    expiryDate?: number;
    isExpired?: boolean;
  }) {
    if (options) {
      this.accessToken = options.accessToken || this.accessToken;
      this.refreshToken = options.refreshToken || this.refreshToken;
      this.expiryDate = options.expiryDate || this.expiryDate;
      this.isExpired = options.isExpired || this.isExpired;
    }
  }

  async getAccessToken(): Promise<{ token: string }> {
    if (this.isExpired || Date.now() > this.expiryDate) {
      throw new Error('Token expired');
    }
    return { token: this.accessToken };
  }

  async refreshAccessToken(): Promise<{ credentials: any }> {
    this.accessToken = 'new-mock-access-token';
    this.expiryDate = Date.now() + 3600000;
    this.isExpired = false;

    return {
      credentials: {
        access_token: this.accessToken,
        refresh_token: this.refreshToken,
        expiry_date: this.expiryDate
      }
    };
  }

  setCredentials(credentials: any): void {
    if (credentials.access_token) {
      this.accessToken = credentials.access_token;
    }
    if (credentials.refresh_token) {
      this.refreshToken = credentials.refresh_token;
    }
    if (credentials.expiry_date) {
      this.expiryDate = credentials.expiry_date;
    }
  }

  // Simulate token expiration
  expireToken(): void {
    this.isExpired = true;
    this.expiryDate = Date.now() - 1000;
  }

  // Check if token is expired
  isTokenExpired(): boolean {
    return this.isExpired || Date.now() > this.expiryDate;
  }
}

/**
 * Factory function to create mock YouTube API client
 */
export function createMockYouTubeAPI(): MockYouTubeAPI {
  return new MockYouTubeAPI();
}

/**
 * Factory function to create mock OAuth client
 */
export function createMockOAuthClient(options?: any): MockOAuthClient {
  return new MockOAuthClient(options);
}