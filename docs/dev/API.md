# API Documentation

## Overview

YouTube MCP Extended provides a comprehensive API through the Model Context Protocol (MCP) for managing YouTube channels. This document covers internal API interfaces, service contracts, and integration patterns.

## MCP Protocol Interface

### Tool Registration

The server exposes 15 tools through the MCP protocol:

```typescript
interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}
```

### Resource Endpoints

The server provides 7 resource endpoints with subscription support:

```typescript
interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}
```

## Authentication API

### OAuth Service Interface

```typescript
interface OAuthService {
  generateAuthorizationUrl(scopes?: string[]): Promise<{
    url: string;
    state: string;
    codeVerifier: string;
  }>;

  completeAuthorization(code: string, state: string): Promise<Credentials>;

  getAuthorizedClient(): Promise<OAuth2Client>;

  refreshTokens(): Promise<Credentials>;

  revokeTokens(): Promise<void>;
}
```

#### OAuth Flow Details

1. **Authorization URL Generation**:
   ```typescript
   // Request
   {
     scopes?: string[];
     prompt?: 'none' | 'consent' | 'select_account';
     accessType?: 'online' | 'offline';
   }

   // Response
   {
     url: string;
     state: string;
     message: string;
   }
   ```

2. **Authorization Completion**:
   ```typescript
   // Request
   {
     code: string;
     state: string;
   }

   // Response
   {
     success: boolean;
     tokens: Credentials;
   }
   ```

### Token Storage Interface

```typescript
interface TokenStorage {
  saveTokens(tokens: Credentials): Promise<void>;
  getTokens(): Promise<Credentials | null>;
  deleteTokens(): Promise<void>;
  hasValidTokens(): Promise<boolean>;
}
```

## YouTube API Integration

### YouTube Client Interface

```typescript
interface YouTubeClient {
  // Video Management
  listMyVideos(options?: ListVideosOptions): Promise<YouTubeVideo[]>;
  getVideoDetails(videoIds: string | string[]): Promise<YouTubeVideo[]>;
  updateVideoMetadata(videoId: string, metadata: VideoMetadata): Promise<void>;

  // Playlist Management
  createPlaylist(options: CreatePlaylistOptions): Promise<YouTubePlaylist>;
  addVideoToPlaylist(playlistId: string, videoId: string, position?: number): Promise<void>;
  removeVideoFromPlaylist(playlistId: string, playlistItemId: string): Promise<void>;

  // Channel Information
  getChannelInfo(): Promise<YouTubeChannel>;

  // Quota Management
  getQuotaUsage(): number;
  getRemainingQuota(): number;
}
```

#### Video Metadata Structure

```typescript
interface VideoMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: 'private' | 'unlisted' | 'public';
  publishAt?: string;
  defaultLanguage?: string;
}
```

#### API Quota Costs

| Operation | Quota Cost | Description |
|-----------|------------|-------------|
| list videos | 1 | List channel videos |
| get video details | 1 | Get video metadata |
| update video | 50 | Update video metadata |
| create playlist | 50 | Create new playlist |
| add to playlist | 50 | Add video to playlist |
| remove from playlist | 50 | Remove video from playlist |

### Rate Limiting

```typescript
interface RateLimiter {
  isAllowed(): boolean;
  wait(): Promise<void>;
  getNextAvailableTime(): Date;
}

// Default Limits
const DEFAULT_LIMITS = {
  requestsPerSecond: 100,
  requestsPerMinute: 6000,
  quotaPerDay: 10000
};
```

## Service Layer APIs

### Metadata Service

```typescript
interface MetadataService {
  generateSuggestion(input: MetadataGenerationInput): MetadataSuggestion;
  optimizeForSEO(suggestion: MetadataSuggestion): MetadataSuggestion;
  optimizeForEngagement(suggestion: MetadataSuggestion): MetadataSuggestion;
  validateGuardrails(suggestion: MetadataSuggestion): MetadataGuardrail[];
}

interface MetadataGenerationInput {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  transcript?: string;
}

interface MetadataSuggestionDetails {
  suggested: string | string[];
  reason: string;
  confidence: number; // 0-1
  improvements?: string[];
}

interface MetadataGuardrail {
  type: 'content_policy' | 'brand_safety' | 'accuracy' | 'length_limits' | 'manual_review';
  status: 'pass' | 'warning' | 'fail';
  message: string;
}
```

### Batch Orchestrator

```typescript
interface BatchOrchestrator {
  enqueue(batch: BatchDefinition): BatchOperation;
  getStatus(batchId: string): BatchOperation | null;
  cancel(batchId: string): Promise<boolean>;
  retry(batchId: string): Promise<BatchOperation>;
}

interface BatchDefinition {
  type: 'metadata_update' | 'schedule_videos' | 'playlist_management';
  metadata?: Record<string, unknown>;
  items: BatchExecutionItem[];
}

interface BatchExecutionItem {
  id: string;
  label: string;
  type: string;
  videoId?: string;
  playlistId?: string;
  description?: string;
  run: () => Promise<{ result?: any; context?: Record<string, unknown> }>;
}
```

### Scheduler Service

```typescript
interface VideoScheduler {
  schedule(videos: ScheduleVideoInput[]): ScheduleResult;
  preview(videos: ScheduleVideoInput[]): ScheduleResult;
  validateSchedule(schedule: ScheduleResult): ValidationResult;
}

interface ScheduleVideoInput {
  videoId: string;
  title: string;
  category?: string;
  priority?: number;
}

interface ScheduleResult {
  scheduled: ScheduledVideo[];
  conflicts: ScheduleConflict[];
  summary: ScheduleSummary;
}

interface ScheduledVideo {
  videoId: string;
  title: string;
  scheduledTime: string;
  timeSlot: string;
  category?: string;
}
```

### Playlist Service

```typescript
interface PlaylistService {
  createPlaylist(options: CreatePlaylistOptions): Promise<YouTubePlaylist>;
  findOrCreatePlaylist(options: FindOrCreateOptions): Promise<YouTubePlaylist>;
  organizeByCategory(videoIds: string[], categoryMap?: CategoryMapping): Promise<PlaylistGroupingResult>;
  organizeManually(groups: ManualGroup[]): Promise<PlaylistGroupingResult>;
}

interface FindOrCreateOptions {
  playlistId?: string;
  title?: string;
  description?: string;
  privacyStatus?: 'private' | 'unlisted' | 'public';
  allowCreate?: boolean;
}

interface PlaylistGroupingResult {
  groups: PlaylistGroupPlan[];
  unassigned: string[];
}
```

### Backup Service

```typescript
interface BackupService {
  backupVideo(video: YouTubeVideo): Promise<string>;
  backupChannel(channelId: string): Promise<string>;
  restoreVideo(backupDate: string, videoId: string): Promise<YouTubeVideo>;
  listBackups(): Promise<BackupEntry[]>;
  deleteBackup(backupDate: string, videoId?: string): Promise<void>;
}

interface BackupEntry {
  date: string;
  path: string;
  videoIds: string[];
  size: number;
  checksums: Record<string, string>;
}
```

### Transcript Manager

```typescript
interface TranscriptManager {
  getTranscript(videoId: string, language?: string): Promise<TranscriptResult>;
  listAvailableLanguages(videoId: string): Promise<string[]>;
  getTimestampedTranscript(videoId: string): Promise<TimestampedTranscript>;
}

interface TranscriptResult {
  videoId: string;
  language: string;
  transcript: string;
  isAutoGenerated: boolean;
  duration?: number;
}

interface TimestampedTranscript {
  videoId: string;
  language: string;
  segments: TranscriptSegment[];
}

interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}
```

## Configuration API

### Configuration Manager

```typescript
interface ConfigManager {
  load(): AppConfig;
  reload(): AppConfig;
  getConfig(): AppConfig;
  getEnv(): EnvironmentVariables;

  // Section-specific getters
  getOAuthConfig(): OAuthConfig;
  getSecurityConfig(): SecurityConfig;
  getMCPServerConfig(): MCPServerConfig;
  getYouTubeAPIConfig(): YouTubeAPIConfig;
  getStorageConfig(): StorageConfig;
  getLoggingConfig(): LoggingConfig;
  getFeatureFlags(): FeatureFlagsManager;

  // Environment checks
  isDevelopment(): boolean;
  isProduction(): boolean;
  isTest(): boolean;
}
```

### Feature Flags

```typescript
interface FeatureFlagsManager {
  isEnabled(flag: string): boolean;
  getFlag(flag: string): FeatureFlag | null;
  getAllFlags(): Record<string, FeatureFlag>;
  getEnabledFlags(): string[];
  getDisabledFlags(): string[];
  getSummary(): FeatureFlagSummary;
}

interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  defaultValue: boolean;
  environment?: string[];
  deprecated?: boolean;
}
```

## Error Handling

### Error Types

```typescript
class MCPError extends Error {
  constructor(message: string, public code: string, public details?: any);
}

class AuthenticationError extends Error {
  constructor(message: string);
}

class ConfigurationError extends Error {
  constructor(message: string, public validationErrors?: any);
}

class YouTubeAPIError extends Error {
  constructor(message: string, public statusCode?: number, public quotaCost?: number);
}
```

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}
```

### Common Error Codes

| Code | Description | Recovery Action |
|------|-------------|-----------------|
| `AUTH_REQUIRED` | Authentication needed | Start OAuth flow |
| `INVALID_TOKEN` | Token expired/invalid | Refresh or re-authenticate |
| `QUOTA_EXCEEDED` | API quota exhausted | Wait for quota reset |
| `RATE_LIMITED` | Too many requests | Implement backoff |
| `INVALID_PARAMS` | Invalid input parameters | Validate and retry |
| `RESOURCE_NOT_FOUND` | Resource doesn't exist | Check resource ID |
| `PERMISSION_DENIED` | Insufficient permissions | Check OAuth scopes |

## Request/Response Formats

### Standard Request Format

```typescript
interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params: {
    name: string;
    arguments: Record<string, any>;
  };
}
```

### Standard Response Format

```typescript
interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: {
    content: Array<{
      type: "text";
      text: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}
```

## Validation Schemas

### Input Validation

All inputs are validated using Zod schemas:

```typescript
// Video metadata validation
const VideoMetadataSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string().min(1).max(500)).max(500).optional(),
  categoryId: z.string().regex(/^\d+$/).optional(),
  privacyStatus: z.enum(['private', 'unlisted', 'public']).optional(),
});

// Batch operation validation
const BatchOperationSchema = z.object({
  type: z.enum(['metadata_update', 'schedule_videos', 'playlist_management']),
  metadata: z.record(z.unknown()).optional(),
  items: z.array(BatchExecutionItemSchema).min(1),
});
```

### Output Validation

```typescript
// Response validation
const SuccessResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.unknown().optional(),
});
```

## Performance Considerations

### Caching Strategy

```typescript
interface CacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

// Cache TTL configurations
const CACHE_TTL = {
  VIDEO_DETAILS: 300, // 5 minutes
  CHANNEL_INFO: 3600, // 1 hour
  PLAYLIST_INFO: 1800, // 30 minutes
  TRANSCRIPT: 86400, // 24 hours
};
```

### Pagination

```typescript
interface PaginatedResponse<T> {
  items: T[];
  nextPageToken?: string;
  totalResults?: number;
  resultsPerPage: number;
}

interface PaginationOptions {
  maxResults?: number;
  pageToken?: string;
}
```

## Integration Examples

### Basic Video Listing

```typescript
// List videos with pagination
const videos = await youtubeClient.listMyVideos({
  maxResults: 25,
  order: 'date'
});

// Process results
for (const video of videos) {
  console.log(`Video: ${video.title} (${video.id})`);
}
```

### Batch Metadata Update

```typescript
// Create batch operation
const batch = batchOrchestrator.enqueue({
  type: 'metadata_update',
  metadata: { source: 'ai_suggestions' },
  items: videoIds.map(videoId => ({
    id: videoId,
    label: `Update ${videoId}`,
    type: 'metadata_update',
    videoId,
    run: async () => {
      await youtubeClient.updateVideoMetadata(videoId, metadata);
      return { result: { updated: true } };
    }
  }))
});

// Monitor progress
const status = batchOrchestrator.getStatus(batch.id);
```

### OAuth Integration

```typescript
// Start OAuth flow
const authResult = await oauthService.generateAuthorizationUrl([
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl'
]);

// Complete OAuth flow
const tokens = await oauthService.completeAuthorization(
  authorizationCode,
  state
);
```

This API documentation provides comprehensive coverage of all internal interfaces and integration patterns used throughout the YouTube MCP Extended system.