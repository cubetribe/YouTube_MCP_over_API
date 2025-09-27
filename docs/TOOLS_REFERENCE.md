# Tools Reference

Complete reference documentation for all MCP tools provided by YouTube MCP Extended. This guide covers syntax, parameters, examples, and expected responses for each tool.

## Table of Contents

- [Tool Overview](#tool-overview)
- [Authentication Tools](#authentication-tools)
- [Video Management Tools](#video-management-tools)
- [Metadata Tools](#metadata-tools)
- [Scheduling Tools](#scheduling-tools)
- [Playlist Tools](#playlist-tools)
- [Backup Tools](#backup-tools)
- [Batch Management Tools](#batch-management-tools)
- [Advanced Tools](#advanced-tools)
- [Configuration Tools](#configuration-tools)
- [Error Handling](#error-handling)
- [Tool Chaining Examples](#tool-chaining-examples)

## Tool Overview

YouTube MCP Extended provides 15 core MCP tools organized by functionality:

| Category | Tools | Description |
|----------|-------|-------------|
| Authentication | 2 | OAuth setup and management |
| Video Management | 2 | List videos and access transcripts |
| Metadata | 2 | Generate and apply metadata suggestions |
| Scheduling | 1 | Plan and execute video release schedules |
| Playlists | 3 | Create and organize playlists |
| Backup | 2 | Backup and restore video metadata |
| Batch Operations | 1 | Monitor batch job progress |
| Advanced Features | 1 | Thumbnail concept generation |
| Configuration | 2 | System configuration and status |

## Authentication Tools

### start_oauth_flow

Initiates the OAuth 2.0 authentication flow with Google.

#### Syntax

```json
{
  "tool": "start_oauth_flow",
  "arguments": {
    "scopes": ["scope1", "scope2"]  // Optional
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `scopes` | string[] | No | `["https://www.googleapis.com/auth/youtube", "https://www.googleapis.com/auth/youtube.upload"]` | OAuth scopes to request |

#### Available Scopes

- `https://www.googleapis.com/auth/youtube` - Read access to YouTube data
- `https://www.googleapis.com/auth/youtube.upload` - Upload and manage videos
- `https://www.googleapis.com/auth/youtubepartner-channel-audit` - Channel audit data

#### Example Usage

```
You: Start the YouTube OAuth flow
You: Start OAuth flow with custom scopes for read-only access
```

#### Response Format

```json
{
  "authUrl": "https://accounts.google.com/oauth2/auth?...",
  "state": "random-state-string",
  "message": "Open the URL, grant access, then use complete_oauth_flow"
}
```

#### Error Conditions

- Configuration missing (`OAUTH_CONFIG_MISSING`)
- Invalid scopes (`INVALID_SCOPES`)

---

### complete_oauth_flow

Completes the OAuth authentication using the authorization code.

#### Syntax

```json
{
  "tool": "complete_oauth_flow",
  "arguments": {
    "code": "authorization-code",
    "state": "state-parameter"
  }
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | Authorization code from Google redirect |
| `state` | string | Yes | State parameter for security validation |

#### Example Usage

```
You: Complete the OAuth flow with code: 4/0AfJohXk... and state: abc123def456
```

#### Response Format

```json
{
  "success": true,
  "tokens": {
    "access_token": "ya29.a0AfH6...",
    "refresh_token": "1//04...",
    "scope": "https://www.googleapis.com/auth/youtube...",
    "token_type": "Bearer",
    "expiry_date": 1640995200000
  }
}
```

#### Error Conditions

- Invalid authorization code (`INVALID_AUTH_CODE`)
- State mismatch (`STATE_MISMATCH`)
- Expired authorization code (`EXPIRED_AUTH_CODE`)

## Video Management Tools

### list_videos

Retrieves videos from the authenticated YouTube channel.

#### Syntax

```json
{
  "tool": "list_videos",
  "arguments": {
    "maxResults": 25,           // Optional
    "pageToken": "token",       // Optional
    "publishedAfter": "2024-01-01T00:00:00Z",  // Optional
    "publishedBefore": "2024-12-31T23:59:59Z", // Optional
    "order": "date"             // Optional
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `maxResults` | number | No | 25 | Number of videos to return (1-50) |
| `pageToken` | string | No | - | Token for pagination |
| `publishedAfter` | string | No | - | ISO 8601 date for filtering |
| `publishedBefore` | string | No | - | ISO 8601 date for filtering |
| `order` | string | No | "date" | Sort order: "date", "rating", "relevance", "title", "viewCount" |

#### Example Usage

```
You: List my recent YouTube videos
You: List my last 10 videos
You: List videos published in the last month
You: List videos ordered by view count
```

#### Response Format

```json
{
  "count": 25,
  "videos": [
    {
      "id": "video-id",
      "title": "Video Title",
      "description": "Video description...",
      "publishedAt": "2024-01-15T10:00:00Z",
      "viewCount": "1234",
      "likeCount": "56",
      "commentCount": "12",
      "duration": "PT5M30S",
      "privacyStatus": "public",
      "tags": ["tag1", "tag2"],
      "categoryId": "22",
      "thumbnails": {
        "default": { "url": "https://...", "width": 120, "height": 90 }
      }
    }
  ]
}
```

---

### get_video_transcript

Downloads the transcript/captions for a specific video.

#### Syntax

```json
{
  "tool": "get_video_transcript",
  "arguments": {
    "videoId": "video-id",
    "language": "en"            // Optional
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `videoId` | string | Yes | - | YouTube video ID |
| `language` | string | No | "en" | Language code for captions |

#### Example Usage

```
You: Get the transcript for video ABC123XYZ
You: Download German transcript for video ABC123XYZ
You: Get transcript for my latest video
```

#### Response Format

```json
{
  "videoId": "ABC123XYZ",
  "language": "en",
  "transcript": "Hello everyone, welcome to my channel...",
  "duration": 330,
  "available_languages": ["en", "es", "fr"],
  "auto_generated": false
}
```

#### Error Conditions

- Video not found (`VIDEO_NOT_FOUND`)
- No captions available (`NO_CAPTIONS_AVAILABLE`)
- Language not available (`LANGUAGE_NOT_AVAILABLE`)

## Metadata Tools

### generate_metadata_suggestions

Generates optimized metadata suggestions for a video using AI analysis.

#### Syntax

```json
{
  "tool": "generate_metadata_suggestions",
  "arguments": {
    "videoId": "video-id",
    "includeTranscript": true    // Optional
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `videoId` | string | Yes | - | YouTube video ID |
| `includeTranscript` | boolean | No | true | Include transcript in analysis |

#### Example Usage

```
You: Generate metadata suggestions for video ABC123XYZ
You: Generate suggestions without transcript analysis for ABC123XYZ
You: Create optimized metadata for my latest video
```

#### Response Format

```json
{
  "suggestionId": "suggestion-uuid",
  "status": "pending_review",
  "guardrails": [
    "Ensure title accuracy",
    "Verify description relevance",
    "Check tag appropriateness"
  ],
  "reviewChecklist": [
    "Title is engaging and accurate",
    "Description provides clear value",
    "Tags are relevant and searchable",
    "Content is appropriate for audience"
  ],
  "recommendedNextSteps": [
    "Review suggested metadata carefully",
    "Confirm guardrails are met",
    "Apply suggestions with acknowledgedGuardrails=true"
  ],
  "summary": {
    "requiresApproval": true,
    "overallConfidence": 0.85,
    "createdAt": "2024-01-15T10:00:00Z"
  },
  "suggestion": {
    "title": {
      "original": "Original Title",
      "suggested": "Optimized Engaging Title",
      "confidence": 0.9,
      "reasoning": "More engaging and SEO-friendly"
    },
    "description": {
      "original": "Brief description",
      "suggested": "Comprehensive description with key points...",
      "confidence": 0.8,
      "reasoning": "Provides more value and context"
    },
    "tags": {
      "original": ["tag1", "tag2"],
      "suggested": ["optimized-tag1", "relevant-tag2", "new-tag3"],
      "confidence": 0.75,
      "reasoning": "Better search relevance and discoverability"
    }
  }
}
```

---

### apply_metadata

Applies metadata changes to a video with safety guardrails.

#### Syntax

```json
{
  "tool": "apply_metadata",
  "arguments": {
    "videoId": "video-id",
    "suggestionId": "suggestion-id",    // Optional
    "acknowledgedGuardrails": true,     // Required for suggestions
    "title": "Custom Title",            // Optional override
    "description": "Custom Description", // Optional override
    "tags": ["tag1", "tag2"],          // Optional override
    "categoryId": "22",                // Optional override
    "privacyStatus": "public",         // Optional override
    "createBackup": true               // Optional
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `videoId` | string | Yes | - | YouTube video ID |
| `suggestionId` | string | No | - | ID from generate_metadata_suggestions |
| `acknowledgedGuardrails` | boolean | Conditional | false | Required when using suggestionId |
| `title` | string | No | - | Custom title override |
| `description` | string | No | - | Custom description override |
| `tags` | string[] | No | - | Custom tags override |
| `categoryId` | string | No | - | YouTube category ID |
| `privacyStatus` | string | No | - | "private", "unlisted", "public" |
| `createBackup` | boolean | No | true | Create backup before changes |

#### Example Usage

```
You: Apply metadata suggestions for video ABC123XYZ after reviewing guardrails
You: Apply suggestions but change title to "My Custom Title"
You: Update video metadata with custom title and description only
```

#### Response Format

```json
{
  "success": true,
  "suggestionId": "suggestion-uuid",
  "appliedFields": ["title", "description", "tags"],
  "backup": {
    "created": true,
    "backupId": "backup-20240115-100000",
    "location": "backups/2024-01-15/ABC123XYZ.json"
  }
}
```

#### Error Conditions

- Guardrails not acknowledged (`GUARDRAILS_NOT_ACKNOWLEDGED`)
- Suggestion not found (`SUGGESTION_NOT_FOUND`)
- Video not found (`VIDEO_NOT_FOUND`)
- Insufficient permissions (`INSUFFICIENT_PERMISSIONS`)

## Scheduling Tools

### schedule_videos

Creates and optionally applies a strategic release schedule for videos.

#### Syntax

```json
{
  "tool": "schedule_videos",
  "arguments": {
    "videoIds": ["id1", "id2"],
    "startDate": "2024-01-15",
    "endDate": "2024-02-15",      // Optional
    "timeSlots": ["09:00", "15:00"], // Optional
    "timezone": "America/New_York",  // Optional
    "mode": "preview",            // Optional: "preview" or "apply"
    "spacing": "optimal",         // Optional
    "overrides": {                // Optional
      "video-id": "2024-01-20T10:00:00Z"
    }
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `videoIds` | string[] | Yes | - | Array of video IDs to schedule |
| `startDate` | string | Yes | - | Start date (YYYY-MM-DD) |
| `endDate` | string | No | 30 days from start | End date (YYYY-MM-DD) |
| `timeSlots` | string[] | No | ["12:00"] | Preferred times (HH:MM) |
| `timezone` | string | No | "UTC" | Timezone for scheduling |
| `mode` | string | No | "preview" | "preview" or "apply" |
| `spacing` | string | No | "optimal" | "optimal", "even", "weekly" |
| `overrides` | object | No | {} | Specific dates for videos |

#### Example Usage

```
You: Create a preview schedule for these videos over the next month
You: Schedule videos every Tuesday and Thursday at 3 PM EST
You: Apply optimal scheduling for maximum engagement
```

#### Response Format

```json
{
  "schedule": {
    "summary": {
      "totalVideos": 10,
      "scheduledVideos": 10,
      "dateRange": "2024-01-15 to 2024-02-15",
      "timezone": "America/New_York"
    },
    "scheduled": [
      {
        "videoId": "ABC123",
        "title": "Video Title",
        "scheduledTime": "2024-01-15T15:00:00-05:00",
        "dayOfWeek": "Monday",
        "reasoning": "Optimal engagement time for your audience"
      }
    ],
    "conflicts": [],
    "recommendations": [
      "Consider spacing educational content throughout the week",
      "Weekend slots available for entertainment content"
    ]
  },
  "batchId": "batch-uuid"  // Only when mode="apply"
}
```

## Playlist Tools

### create_playlist

Creates a new YouTube playlist with specified settings.

#### Syntax

```json
{
  "tool": "create_playlist",
  "arguments": {
    "title": "Playlist Title",
    "description": "Playlist description",  // Optional
    "privacyStatus": "private",            // Optional
    "defaultLanguage": "en"                // Optional
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `title` | string | Yes | - | Playlist title |
| `description` | string | No | "" | Playlist description |
| `privacyStatus` | string | No | "private" | "private", "unlisted", "public" |
| `defaultLanguage` | string | No | "en" | Language code |

#### Example Usage

```
You: Create a new playlist called "Tutorial Series"
You: Create a public playlist for my cooking videos with description
```

#### Response Format

```json
{
  "id": "playlist-id",
  "title": "Playlist Title",
  "description": "Playlist description",
  "privacyStatus": "private",
  "url": "https://www.youtube.com/playlist?list=...",
  "itemCount": 0
}
```

---

### add_videos_to_playlist

Adds multiple videos to an existing playlist as a batch operation.

#### Syntax

```json
{
  "tool": "add_videos_to_playlist",
  "arguments": {
    "playlistId": "playlist-id",
    "videoIds": ["id1", "id2"],
    "position": 0                    // Optional
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `playlistId` | string | Yes | - | Target playlist ID |
| `videoIds` | string[] | Yes | - | Videos to add |
| `position` | number | No | end | Starting position (0-based) |

#### Example Usage

```
You: Add these 5 videos to my Tutorial Series playlist
You: Add videos to playlist at the beginning (position 0)
```

#### Response Format

```json
{
  "success": true,
  "batchId": "batch-uuid",
  "playlistId": "playlist-id",
  "videoCount": 5,
  "estimatedCompletion": "2024-01-15T10:05:00Z"
}
```

---

### organize_playlists

Automatically organizes videos into playlists using various strategies.

#### Syntax

```json
{
  "tool": "organize_playlists",
  "arguments": {
    "videoIds": ["id1", "id2"],
    "strategy": "category",          // "category" or "manual"
    "createMissingPlaylists": true,  // Optional
    "position": 0,                   // Optional
    "categoryMap": {                 // Optional for category strategy
      "22": {
        "playlistTitle": "People & Blogs",
        "description": "Personal content",
        "privacyStatus": "private"
      }
    },
    "groups": [                      // Required for manual strategy
      {
        "playlistTitle": "Group 1",
        "videoIds": ["id1", "id2"],
        "description": "Description",
        "privacyStatus": "private"
      }
    ]
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `videoIds` | string[] | Yes | - | Videos to organize |
| `strategy` | string | No | "category" | "category" or "manual" |
| `createMissingPlaylists` | boolean | No | true | Create playlists if missing |
| `position` | number | No | end | Starting position in playlists |
| `categoryMap` | object | No | {} | Category to playlist mapping |
| `groups` | object[] | Conditional | - | Manual grouping (required for manual strategy) |

#### Example Usage

```
You: Organize my recent videos into playlists by category
You: Create custom playlist groups for my cooking content
You: Organize videos with specific playlist settings
```

#### Response Format

```json
{
  "success": true,
  "batchId": "batch-uuid",
  "groups": [
    {
      "key": "22",
      "playlistId": "playlist-id",
      "playlistTitle": "People & Blogs",
      "videoCount": 5
    }
  ],
  "unassigned": ["video-id-without-category"]
}
```

## Backup Tools

### backup_video_metadata

Creates JSON backups of video metadata for preservation and restore purposes.

#### Syntax

```json
{
  "tool": "backup_video_metadata",
  "arguments": {
    "videoIds": ["id1", "id2"],      // Optional
    "includeAllVideos": false        // Optional
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `videoIds` | string[] | Conditional | - | Specific videos to backup |
| `includeAllVideos` | boolean | Conditional | false | Backup all channel videos |

Note: Either `videoIds` or `includeAllVideos` must be provided.

#### Example Usage

```
You: Create backup for these specific videos
You: Backup metadata for all my videos
You: Create a backup before making bulk changes
```

#### Response Format

```json
{
  "success": true,
  "backups": [
    "backups/2024-01-15/video1.json",
    "backups/2024-01-15/video2.json"
  ],
  "backupDate": "2024-01-15",
  "videoCount": 2,
  "location": "backups/2024-01-15/"
}
```

---

### restore_video_metadata

Restores video metadata from a previously created backup.

#### Syntax

```json
{
  "tool": "restore_video_metadata",
  "arguments": {
    "backupDate": "2024-01-15",
    "videoId": "video-id"
  }
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `backupDate` | string | Yes | Date of backup (YYYY-MM-DD) |
| `videoId` | string | Yes | Video ID to restore |

#### Example Usage

```
You: Restore video ABC123 from the January 15th backup
You: Undo changes by restoring from yesterday's backup
```

#### Response Format

```json
{
  "success": true,
  "videoId": "ABC123",
  "backupDate": "2024-01-15",
  "restoredFields": ["title", "description", "tags", "privacyStatus"],
  "backupLocation": "backups/2024-01-15/ABC123.json"
}
```

## Batch Management Tools

### get_batch_status

Monitors the progress and status of batch operations.

#### Syntax

```json
{
  "tool": "get_batch_status",
  "arguments": {
    "batchId": "batch-uuid"
  }
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `batchId` | string | Yes | Batch operation ID |

#### Example Usage

```
You: Check status of batch operation batch_123
You: Show detailed progress for the scheduling batch
You: Monitor playlist organization progress
```

#### Response Format

```json
{
  "id": "batch-uuid",
  "type": "playlist_management",
  "status": "running",
  "progress": {
    "total": 10,
    "completed": 7,
    "failed": 1,
    "remaining": 2,
    "percentage": 70
  },
  "operations": [
    {
      "id": "op-1",
      "status": "completed",
      "result": "Successfully added video to playlist",
      "completedAt": "2024-01-15T10:01:00Z"
    },
    {
      "id": "op-2",
      "status": "failed",
      "error": "Video not found",
      "failedAt": "2024-01-15T10:02:00Z"
    },
    {
      "id": "op-3",
      "status": "running",
      "startedAt": "2024-01-15T10:03:00Z"
    }
  ],
  "metadata": {
    "request": { "playlistId": "playlist-123" },
    "summary": { "targetPlaylist": "Tutorial Series" }
  },
  "createdAt": "2024-01-15T10:00:00Z",
  "estimatedCompletion": "2024-01-15T10:05:00Z"
}
```

## Advanced Tools

### generate_thumbnail_concepts

Generates creative thumbnail concept suggestions based on video content.

#### Syntax

```json
{
  "tool": "generate_thumbnail_concepts",
  "arguments": {
    "videoId": "video-id",
    "includeTranscript": true    // Optional
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `videoId` | string | Yes | - | YouTube video ID |
| `includeTranscript` | boolean | No | true | Include transcript analysis |

#### Example Usage

```
You: Generate thumbnail concepts for video ABC123
You: Create thumbnail ideas based on video content and transcript
```

#### Response Format

```json
{
  "videoId": "ABC123",
  "concepts": [
    {
      "title": "Bold Text Overlay",
      "description": "Use large, contrasting text highlighting key benefit",
      "elements": ["Bold text", "Bright background", "Clear focal point"],
      "colorScheme": ["#FF6B35", "#F7931E", "#FFFFFF"],
      "reasoning": "High contrast grabs attention in search results"
    },
    {
      "title": "Before/After Split",
      "description": "Show transformation or comparison",
      "elements": ["Split screen", "Clear labeling", "Visual contrast"],
      "reasoning": "Appeals to curiosity about transformation"
    }
  ],
  "generalTips": [
    "Use high contrast colors for visibility",
    "Keep text large and readable",
    "Include faces when possible for emotional connection"
  ]
}
```

## Configuration Tools

### get_configuration_status

Displays current configuration status with validation and diagnostics.

#### Syntax

```json
{
  "tool": "get_configuration_status",
  "arguments": {
    "section": "all",               // Optional
    "includeValidation": true,      // Optional
    "includeEnvironment": false     // Optional
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `section` | string | No | "all" | "all", "oauth", "security", "mcpServer", "youtubeAPI", "storage", "logging" |
| `includeValidation` | boolean | No | true | Include configuration validation |
| `includeEnvironment` | boolean | No | false | Include environment variables (filtered) |

#### Example Usage

```
You: Check the YouTube MCP configuration status
You: Validate OAuth configuration only
You: Show configuration with environment details
```

---

### reload_configuration

Reloads configuration from environment variables and validates settings.

#### Syntax

```json
{
  "tool": "reload_configuration",
  "arguments": {
    "validateAfterReload": true,    // Optional
    "notifyServices": false         // Optional
  }
}
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `validateAfterReload` | boolean | No | true | Validate after reloading |
| `notifyServices` | boolean | No | false | Notify services of changes |

#### Example Usage

```
You: Reload configuration after making changes
You: Refresh settings and validate them
```

## Error Handling

### Common Error Types

#### Authentication Errors

```json
{
  "error": "AUTH_REQUIRED",
  "message": "OAuth authentication required",
  "details": {
    "suggestion": "Run start_oauth_flow to authenticate"
  }
}
```

#### Validation Errors

```json
{
  "error": "INVALID_PARAMS",
  "message": "Required parameter missing",
  "details": {
    "missingParams": ["videoId"],
    "providedParams": ["title"]
  }
}
```

#### API Quota Errors

```json
{
  "error": "QUOTA_EXCEEDED",
  "message": "YouTube API quota exceeded",
  "details": {
    "currentUsage": 9500,
    "limit": 10000,
    "resetTime": "2024-01-16T00:00:00Z"
  }
}
```

#### Resource Not Found

```json
{
  "error": "VIDEO_NOT_FOUND",
  "message": "Video with ID ABC123 not found",
  "details": {
    "videoId": "ABC123",
    "suggestion": "Verify video ID and access permissions"
  }
}
```

### Error Recovery Strategies

#### Retry with Exponential Backoff

For temporary failures:
1. Wait 1 second, retry
2. Wait 2 seconds, retry
3. Wait 4 seconds, retry
4. Give up after 3 attempts

#### Quota Management

When quota exceeded:
1. Check current usage with configuration tools
2. Wait for quota reset (daily at midnight PT)
3. Optimize operations to reduce quota usage
4. Consider requesting quota increase from Google

#### Authentication Recovery

When auth fails:
1. Check token expiration
2. Attempt automatic refresh
3. Re-run OAuth flow if needed
4. Verify OAuth client configuration

## Tool Chaining Examples

### Complete Metadata Optimization Workflow

```
# Step 1: Generate suggestions
You: Generate metadata suggestions for video ABC123 with transcript analysis

# Step 2: Review and apply
You: Apply the metadata suggestions after confirming all guardrails are met

# Step 3: Monitor results
You: Create a backup of the updated metadata for future reference
```

### Bulk Channel Organization

```
# Step 1: Get video inventory
You: List all my videos from the past 6 months

# Step 2: Create playlist structure
You: Create playlists for "Tutorials", "Reviews", and "Behind the Scenes"

# Step 3: Organize content
You: Organize recent videos into the new playlists by category

# Step 4: Monitor progress
You: Check the status of the playlist organization batch
```

### Strategic Content Planning

```
# Step 1: Analyze existing content
You: List my recent videos and their performance metrics

# Step 2: Generate optimizations
You: Generate metadata suggestions for underperforming videos

# Step 3: Plan releases
You: Create an optimal release schedule for my upcoming videos

# Step 4: Execute plan
You: Apply the schedule and monitor batch progress
```

### Backup and Recovery Workflow

```
# Step 1: Create safety backup
You: Backup metadata for all videos before making bulk changes

# Step 2: Apply changes
You: Generate and apply metadata suggestions for multiple videos

# Step 3: Monitor results
You: Check video performance after metadata changes

# Step 4: Rollback if needed
You: Restore video metadata from backup if changes were ineffective
```

---

**Master the tools!** Use this reference to build powerful YouTube management workflows with Claude Desktop and YouTube MCP Extended.