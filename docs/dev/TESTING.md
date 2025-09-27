# Testing Documentation

## Overview

YouTube MCP Extended uses a comprehensive testing strategy that includes unit tests, integration tests, and manual testing procedures. This document covers testing architecture, guidelines, and best practices.

## Testing Architecture

### Test Framework Stack

- **Test Runner**: Vitest (faster Vite-native Jest alternative)
- **Assertion Library**: Vitest's built-in assertions (Jest-compatible)
- **Mocking**: Vitest mocks with TypeScript support
- **Coverage**: c8 coverage reporting
- **TypeScript**: Native TypeScript support

### Test Organization

```
src/
├── __tests__/
│   ├── integration/         # Integration tests
│   ├── e2e/                # End-to-end tests
│   ├── fixtures/           # Test data and fixtures
│   ├── mocks/              # Shared mock implementations
│   └── utils/              # Test utilities
├── module-name/
│   ├── __tests__/          # Module-specific unit tests
│   │   ├── service.test.ts
│   │   └── utils.test.ts
│   ├── service.ts
│   └── utils.ts
```

### Test Types

1. **Unit Tests**: Test individual functions and classes in isolation
2. **Integration Tests**: Test component interactions and API integrations
3. **Contract Tests**: Validate MCP protocol compliance
4. **Performance Tests**: Measure response times and resource usage
5. **Manual Tests**: OAuth flows and Claude Desktop integration

## Unit Testing Guidelines

### Test Structure

Follow the AAA pattern (Arrange, Act, Assert):

```typescript
// src/youtube/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YouTubeClient } from '../client.js';
import type { OAuth2Client } from 'google-auth-library';

describe('YouTubeClient', () => {
  let client: YouTubeClient;
  let mockOAuth: vi.Mocked<OAuth2Client>;

  beforeEach(() => {
    // Arrange: Set up test environment
    mockOAuth = createMockOAuth();
    client = new YouTubeClient({
      oauthClient: mockOAuth,
      quotaLimit: 10000
    });
  });

  describe('listMyVideos', () => {
    it('should return videos with default pagination', async () => {
      // Arrange
      const expectedVideos = [createMockVideo()];
      mockOAuth.request.mockResolvedValue({
        data: { items: expectedVideos }
      });

      // Act
      const result = await client.listMyVideos();

      // Assert
      expect(result).toEqual(expectedVideos);
      expect(mockOAuth.request).toHaveBeenCalledWith({
        url: expect.stringContaining('youtube/v3/search'),
        method: 'GET',
        params: expect.objectContaining({
          part: 'snippet',
          forMine: true,
          type: 'video',
          maxResults: 25
        })
      });
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      const apiError = new Error('API quota exceeded');
      mockOAuth.request.mockRejectedValue(apiError);

      // Act & Assert
      await expect(client.listMyVideos()).rejects.toThrow('API quota exceeded');
    });

    it('should respect custom pagination parameters', async () => {
      // Arrange
      const options = { maxResults: 10, order: 'date' as const };
      mockOAuth.request.mockResolvedValue({ data: { items: [] } });

      // Act
      await client.listMyVideos(options);

      // Assert
      expect(mockOAuth.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            maxResults: 10,
            order: 'date'
          })
        })
      );
    });
  });

  describe('quota management', () => {
    it('should track quota usage correctly', async () => {
      // Arrange
      mockOAuth.request.mockResolvedValue({ data: { items: [] } });

      // Act
      await client.listMyVideos(); // Cost: 100
      await client.updateVideoMetadata('video-123', { title: 'New Title' }); // Cost: 50

      // Assert
      expect(client.getQuotaUsage()).toBe(150);
      expect(client.getRemainingQuota()).toBe(9850);
    });

    it('should throw error when quota exceeded', async () => {
      // Arrange
      client = new YouTubeClient({
        oauthClient: mockOAuth,
        quotaLimit: 50 // Very low limit
      });

      // Act & Assert
      await expect(
        client.updateVideoMetadata('video-123', { title: 'New Title' })
      ).rejects.toThrow('YouTube API quota exceeded');
    });
  });
});
```

### Mock Creation Utilities

```typescript
// src/__tests__/mocks/index.ts
import type { OAuth2Client } from 'google-auth-library';
import type { YouTubeVideo, YouTubeChannel } from '../../types/index.js';

export function createMockOAuth(): vi.Mocked<OAuth2Client> {
  return {
    request: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-token' }),
    refreshAccessToken: vi.fn(),
    revokeCredentials: vi.fn(),
    // ... other OAuth2Client methods
  } as any;
}

export function createMockVideo(overrides: Partial<YouTubeVideo> = {}): YouTubeVideo {
  return {
    id: 'video-123',
    title: 'Test Video',
    description: 'Test video description',
    tags: ['test', 'video'],
    categoryId: '22',
    defaultLanguage: 'en',
    thumbnails: {
      default: { url: 'https://example.com/thumb.jpg' }
    },
    publishedAt: '2023-01-01T00:00:00Z',
    privacyStatus: 'private',
    viewCount: '1000',
    likeCount: '100',
    commentCount: '10',
    duration: 'PT5M30S',
    ...overrides
  };
}

export function createMockChannel(overrides: Partial<YouTubeChannel> = {}): YouTubeChannel {
  return {
    id: 'channel-123',
    title: 'Test Channel',
    description: 'Test channel description',
    publishedAt: '2020-01-01T00:00:00Z',
    customUrl: '@testchannel',
    thumbnails: {
      default: { url: 'https://example.com/channel-thumb.jpg' }
    },
    statistics: {
      viewCount: '100000',
      subscriberCount: '1000',
      videoCount: '50',
      hiddenSubscriberCount: false
    },
    ...overrides
  };
}
```

### Test Data Fixtures

```typescript
// src/__tests__/fixtures/youtube-api-responses.ts
export const mockVideoListResponse = {
  kind: 'youtube#searchListResponse',
  etag: 'mock-etag',
  items: [
    {
      kind: 'youtube#searchResult',
      etag: 'mock-video-etag',
      id: {
        kind: 'youtube#video',
        videoId: 'mock-video-id'
      },
      snippet: {
        publishedAt: '2023-01-01T00:00:00Z',
        channelId: 'mock-channel-id',
        title: 'Mock Video Title',
        description: 'Mock video description',
        thumbnails: {
          default: {
            url: 'https://i.ytimg.com/vi/mock-video-id/default.jpg'
          }
        },
        channelTitle: 'Mock Channel',
        tags: ['tag1', 'tag2'],
        categoryId: '22',
        defaultLanguage: 'en'
      }
    }
  ],
  pageInfo: {
    totalResults: 1,
    resultsPerPage: 25
  }
};
```

## Integration Testing

### Service Integration Tests

```typescript
// src/__tests__/integration/metadata-service.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MetadataService } from '../../metadata/metadata-service.js';
import { YouTubeClient } from '../../youtube/client.js';
import { createTestConfig, createTestOAuth } from '../utils/test-setup.js';

describe('MetadataService Integration', () => {
  let metadataService: MetadataService;
  let youtubeClient: YouTubeClient;

  beforeAll(async () => {
    const config = createTestConfig();
    const oauthClient = await createTestOAuth();

    youtubeClient = new YouTubeClient({
      oauthClient,
      quotaLimit: config.youtubeAPI.quotaLimit
    });

    metadataService = new MetadataService();
  });

  afterAll(async () => {
    // Cleanup test resources
  });

  it('should generate suggestions from real video data', async () => {
    // This test uses a known test video
    const testVideoId = 'dQw4w9WgXcQ'; // Rick Roll (safe test video)

    const suggestion = metadataService.generateSuggestion({
      videoId: testVideoId,
      title: 'Test Video',
      description: 'Test description',
      tags: ['test']
    });

    expect(suggestion).toMatchObject({
      videoId: testVideoId,
      suggestions: {
        title: expect.objectContaining({
          suggested: expect.any(String),
          confidence: expect.any(Number)
        })
      },
      overallConfidence: expect.any(Number),
      guardrails: expect.arrayContaining([
        expect.objectContaining({
          type: expect.stringMatching(/content_policy|brand_safety|accuracy/),
          status: expect.stringMatching(/pass|warning|fail/)
        })
      ])
    });
  });

  it('should handle batch operations correctly', async () => {
    const batchRequest = {
      type: 'metadata_update' as const,
      items: [
        createMockBatchItem('video-1'),
        createMockBatchItem('video-2')
      ]
    };

    const batch = await batchOrchestrator.enqueue(batchRequest);

    // Wait for processing
    await waitForBatchCompletion(batch.id, 30000);

    const finalStatus = batchManager.get(batch.id);
    expect(finalStatus?.status).toBe('completed');
    expect(finalStatus?.progress.completed).toBe(2);
    expect(finalStatus?.progress.failed).toBe(0);
  });
});
```

### API Integration Tests

```typescript
// src/__tests__/integration/youtube-api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { YouTubeClient } from '../../youtube/client.js';

describe('YouTube API Integration', () => {
  let client: YouTubeClient;

  beforeAll(async () => {
    // Set up real OAuth client for integration testing
    client = await createAuthenticatedClient();
  });

  it('should authenticate and fetch channel info', async () => {
    const channelInfo = await client.getChannelInfo();

    expect(channelInfo).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      publishedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    });
  });

  it('should handle rate limiting gracefully', async () => {
    // Make rapid requests to test rate limiting
    const promises = Array.from({ length: 10 }, () =>
      client.listMyVideos({ maxResults: 1 })
    );

    const results = await Promise.all(promises);

    // All requests should succeed (rate limiter should handle this)
    results.forEach(result => {
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
```

## MCP Protocol Testing

### Tool Validation Tests

```typescript
// src/__tests__/mcp/tools.test.ts
import { describe, it, expect } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  ListVideosSchema,
  GenerateMetadataSuggestionsSchema
} from '../../types/index.js';

describe('MCP Tool Schemas', () => {
  it('should have valid JSON schemas for all tools', () => {
    const schemas = [
      { name: 'list_videos', schema: ListVideosSchema },
      { name: 'generate_metadata_suggestions', schema: GenerateMetadataSuggestionsSchema }
    ];

    schemas.forEach(({ name, schema }) => {
      const jsonSchema = zodToJsonSchema(schema);

      expect(jsonSchema).toMatchObject({
        type: 'object',
        properties: expect.any(Object)
      });

      expect(jsonSchema.properties).not.toEqual({});
    });
  });

  it('should validate tool inputs correctly', () => {
    const validInput = {
      maxResults: 25,
      order: 'date'
    };

    const invalidInput = {
      maxResults: 'invalid',
      order: 'invalid_order'
    };

    expect(() => ListVideosSchema.parse(validInput)).not.toThrow();
    expect(() => ListVideosSchema.parse(invalidInput)).toThrow();
  });
});
```

### Resource Endpoint Tests

```typescript
// src/__tests__/mcp/resources.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createMCPServer, createMockRequest } from '../utils/mcp-test-utils.js';

describe('MCP Resources', () => {
  let server: ReturnType<typeof createMCPServer>;

  beforeEach(() => {
    server = createMCPServer();
  });

  it('should list all available resources', async () => {
    const request = createMockRequest('resources/list', {});
    const response = await server.handleRequest(request);

    expect(response.result?.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uri: 'youtube://videos',
          name: expect.any(String),
          description: expect.any(String),
          mimeType: 'application/json'
        })
      ])
    );
  });

  it('should handle resource subscriptions', async () => {
    const subscribeRequest = createMockRequest('resources/subscribe', {
      uri: 'youtube://videos'
    });

    const response = await server.handleRequest(subscribeRequest);
    expect(response.error).toBeUndefined();
  });

  it('should return valid JSON for all resources', async () => {
    const resources = [
      'youtube://videos',
      'youtube://channels/mine',
      'youtube://playlists',
      'backups://list'
    ];

    for (const uri of resources) {
      const request = createMockRequest('resources/read', { uri });
      const response = await server.handleRequest(request);

      expect(response.result?.contents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            uri,
            mimeType: 'application/json',
            text: expect.any(String)
          })
        ])
      );

      // Validate JSON
      const content = response.result?.contents[0];
      expect(() => JSON.parse(content.text)).not.toThrow();
    }
  });
});
```

## Performance Testing

### Load Testing

```typescript
// src/__tests__/performance/load.test.ts
import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  it('should handle batch operations within time limits', async () => {
    const startTime = performance.now();

    const batchSize = 100;
    const batch = await createLargeBatch(batchSize);
    await processBatch(batch);

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should complete within reasonable time (adjust based on requirements)
    expect(duration).toBeLessThan(30000); // 30 seconds
  });

  it('should maintain memory usage within limits', async () => {
    const initialMemory = process.memoryUsage();

    // Perform memory-intensive operations
    const results = await Promise.all(
      Array.from({ length: 50 }, () => processLargeDataSet())
    );

    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

    // Memory increase should be reasonable (adjust based on requirements)
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
  });
});
```

### Benchmark Tests

```typescript
// src/__tests__/performance/benchmarks.test.ts
import { describe, it, expect } from 'vitest';

describe('Benchmark Tests', () => {
  it('should meet metadata generation performance requirements', async () => {
    const iterations = 100;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      await metadataService.generateSuggestion({
        videoId: `test-${i}`,
        title: 'Test Video Title',
        description: 'Test video description with moderate length content',
        tags: ['test', 'performance', 'benchmark']
      });

      const end = performance.now();
      times.push(end - start);
    }

    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

    expect(averageTime).toBeLessThan(1000); // 1 second average
    expect(p95Time).toBeLessThan(2000); // 2 seconds 95th percentile
  });
});
```

## Test Utilities

### Test Setup Utilities

```typescript
// src/__tests__/utils/test-setup.ts
import type { AppConfig } from '../../config/schemas.js';
import type { OAuth2Client } from 'google-auth-library';

export function createTestConfig(): AppConfig {
  return {
    env: 'test',
    oauth: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
      scopes: ['https://www.googleapis.com/auth/youtube']
    },
    youtubeAPI: {
      quotaLimit: 10000,
      rateLimitRequestsPerSecond: 100,
      rateLimitRequestsPerMinute: 6000,
      defaultPageSize: 25
    },
    // ... other config sections
  };
}

export async function createTestOAuth(): Promise<OAuth2Client> {
  // Return mock OAuth client for testing
  return createMockOAuth();
}

export function waitForBatchCompletion(
  batchId: string,
  timeout = 10000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkStatus = () => {
      const batch = batchManager.get(batchId);

      if (!batch) {
        reject(new Error(`Batch ${batchId} not found`));
        return;
      }

      if (batch.status === 'completed' || batch.status === 'failed') {
        resolve();
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error(`Batch ${batchId} did not complete within ${timeout}ms`));
        return;
      }

      setTimeout(checkStatus, 100);
    };

    checkStatus();
  });
}
```

### Test Data Generators

```typescript
// src/__tests__/utils/data-generators.ts
export function generateTestVideos(count: number): YouTubeVideo[] {
  return Array.from({ length: count }, (_, i) => createMockVideo({
    id: `test-video-${i}`,
    title: `Test Video ${i}`,
    description: `Description for test video ${i}`,
    tags: [`tag${i}`, 'test'],
    publishedAt: new Date(Date.now() - i * 86400000).toISOString()
  }));
}

export function generateBatchOperation(
  type: string,
  itemCount: number
): BatchOperation {
  return {
    id: `batch-${Date.now()}`,
    type: type as any,
    status: 'pending',
    progress: {
      total: itemCount,
      completed: 0,
      failed: 0
    },
    operations: Array.from({ length: itemCount }, (_, i) => ({
      id: `item-${i}`,
      type: 'test-operation',
      status: 'pending',
      label: `Test Operation ${i}`,
      description: `Test operation description ${i}`
    }))
  };
}
```

## Test Commands

### Basic Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test src/youtube/__tests__/client.test.ts

# Run tests matching pattern
npm test -- --grep "metadata"
```

### Advanced Test Commands

```bash
# Run only unit tests
npm test src/**/__tests__/**/*.test.ts

# Run only integration tests
npm test src/__tests__/integration

# Run performance tests
npm test src/__tests__/performance

# Run tests with verbose output
npm test -- --reporter=verbose

# Run tests with specific timeout
npm test -- --testTimeout=30000
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
npm run test:coverage && open coverage/index.html

# Check coverage thresholds
npm run test:coverage -- --reporter=text-summary
```

## Continuous Integration

### GitHub Actions Test Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - uses: actions/checkout@v3

    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Type check
      run: npm run type-check

    - name: Lint
      run: npm run lint

    - name: Run tests
      run: npm run test:coverage

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
```

### Quality Gates

```javascript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

## Manual Testing Procedures

### OAuth Flow Testing

1. **Authorization URL Generation**:
   ```bash
   # Start server
   npm run dev:basic

   # Test URL generation
   curl -X POST http://localhost:3000/auth/start
   ```

2. **Manual OAuth Completion**:
   - Open generated URL in browser
   - Complete Google OAuth flow
   - Verify redirect with authorization code
   - Test token exchange

### Claude Desktop Integration

1. **MCP Server Setup**:
   - Configure Claude Desktop with server
   - Test tool discovery
   - Verify resource endpoints

2. **Tool Testing**:
   - Test each MCP tool through Claude
   - Verify error handling
   - Check response formatting

### End-to-End Scenarios

1. **Complete Workflow Test**:
   - Authenticate with YouTube
   - List videos
   - Generate metadata suggestions
   - Apply metadata changes
   - Create and organize playlists
   - Schedule video publishing

2. **Error Scenario Testing**:
   - Test quota exceeded scenarios
   - Test network failure recovery
   - Test invalid input handling
   - Test authentication errors

## Testing Best Practices

1. **Test Isolation**: Each test should be independent
2. **Descriptive Names**: Test names should clearly describe what is being tested
3. **Arrange-Act-Assert**: Follow the AAA pattern consistently
4. **Mock External Dependencies**: Don't rely on external services in unit tests
5. **Test Edge Cases**: Include boundary conditions and error scenarios
6. **Maintain Test Coverage**: Aim for >80% coverage on new code
7. **Fast Feedback**: Keep test execution time reasonable
8. **Realistic Test Data**: Use realistic test data that mirrors production scenarios

This testing framework ensures YouTube MCP Extended maintains high quality and reliability through comprehensive automated and manual testing procedures.