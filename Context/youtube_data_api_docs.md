# YouTube Data API v3 Documentation (2025)

## Overview

The YouTube Data API v3 allows you to incorporate functions normally executed on the YouTube website into your own website or application. This comprehensive reference covers API resources, authentication, implementation guides, and best practices.

**Last Updated:** September 2025  
**API Version:** v3  
**Official Documentation:** https://developers.google.com/youtube/v3

## Key Features

- **Video Management**: Upload, list, update, and delete videos
- **Playlist Operations**: Create, manage, and modify playlists
- **Channel Management**: Access channel information and statistics
- **Live Streaming**: Manage live broadcasts and streaming
- **Analytics**: Access viewing statistics and engagement metrics
- **Comments**: Retrieve, insert, update, and moderate comments

## Getting Started

### Prerequisites

1. **Google Account** - Required for API Console access
2. **Google Cloud Project** - Enable YouTube Data API v3
3. **API Credentials** - API key or OAuth 2.0 credentials
4. **Quota Management** - Understanding of daily quota limits

### Quick Setup Steps

1. Visit [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable YouTube Data API v3
4. Create credentials (API Key for public data, OAuth for user data)
5. Configure authorized domains and redirect URIs

## Authentication Methods

### API Key Authentication

For **public data access only**:

```javascript
const API_KEY = 'YOUR_API_KEY';
const response = await fetch(
  `https://www.googleapis.com/youtube/v3/videos?id=VIDEO_ID&key=${API_KEY}&part=snippet,statistics`
);
```

### OAuth 2.0 Authentication

For **user data and modifications**:

```javascript
// OAuth 2.0 Configuration
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',  // Critical for refresh tokens
  prompt: 'consent',       // Forces consent screen
  scope: ['https://www.googleapis.com/auth/youtube']
});
```

**Important OAuth Notes:**
- YouTube Data API does NOT support service accounts
- All operations require user-based OAuth flows
- Apps in "Testing" status have 7-day token expiration
- Move to "Published" status for production use

## Core Resources

### Videos Resource

**List Videos:**
```http
GET https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=VIDEO_ID
```

**Update Video Metadata:**
```http
PUT https://www.googleapis.com/youtube/v3/videos?part=snippet
Content-Type: application/json

{
  "id": "VIDEO_ID",
  "snippet": {
    "title": "Updated Title",
    "description": "Updated description with SEO keywords",
    "tags": ["keyword1", "keyword2"],
    "categoryId": "22"
  }
}
```

### Channels Resource

**Get Channel Information:**
```http
GET https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true
```

### Playlists Resource

**Create Playlist:**
```http
POST https://www.googleapis.com/youtube/v3/playlists?part=snippet,status
Content-Type: application/json

{
  "snippet": {
    "title": "My New Playlist",
    "description": "Playlist description"
  },
  "status": {
    "privacyStatus": "private"
  }
}
```

### Search Resource

**Search Videos:**
```http
GET https://www.googleapis.com/youtube/v3/search?part=snippet&q=search+terms&type=video&maxResults=25
```

## Quota System & Rate Limiting

### Daily Quota Allocation

- **Default Quota:** 10,000 units per day per project
- **Quota Reset:** Daily at midnight Pacific Time
- **Quota Increase:** Available through Google's audit process

### Operation Costs (Units)

| Operation | Quota Cost |
|-----------|------------|
| Video List | 1 unit |
| Video Upload | 1,600 units |
| Video Update | 50 units |
| Search | 100 units |
| Playlist Create | 50 units |
| Comments List | 1 unit |

### Rate Limiting Best Practices

```python
import time
import random

def retry_with_exponential_backoff(func, max_retries=5):
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if e.resp.status in [429] + list(range(500, 600)):
                delay = (2 ** attempt) + random.uniform(0, 1)
                time.sleep(delay)
                continue
            raise e
```

## Video Upload Implementation

### Resumable Upload Process

```javascript
// Initialize resumable upload
const uploadMetadata = {
  snippet: {
    title: 'Video Title',
    description: 'Video description with timestamps:\n\n00:00 Introduction\n05:30 Main Content',
    tags: ['tag1', 'tag2'],
    categoryId: '22'
  },
  status: {
    privacyStatus: 'private',
    publishAt: '2025-12-20T18:00:00Z'
  }
};

const uploadUrl = await initializeResumableUpload(uploadMetadata);
const videoId = await uploadVideoFile(uploadUrl, videoFile);
```

### Upload Limitations

- **File Size:** Up to 256GB (with verification)
- **Upload Limit:** ~15 videos per day per channel (account-level limit)
- **Quota Cost:** 1,600 units per upload
- **Format Support:** MP4, MOV, AVI, WMV, FLV, 3GPP

## Recent API Changes (2025)

### July 2025 Updates

- **mostPopular Chart Changes:** Now features Trending Music, Movies, and Gaming instead of general Trending
- **Shorts View Counting:** Views now count on start/replay with no minimum watch time

### March 2025 Updates

- **Shorts Analytics:** New view counting methodology
- **API Fields:** Updated analytics fields for Shorts content

### Security Updates

- **OAuth 2.1 Support:** Enhanced security for remote servers
- **Resource Indicators:** Mandatory for preventing token misuse
- **Enhanced Authorization:** Improved access control mechanisms

## Error Handling

### Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Check request parameters |
| 401 | Unauthorized | Refresh OAuth token |
| 403 | Forbidden | Check API quotas or permissions |
| 404 | Not Found | Verify resource exists |
| 429 | Rate Limited | Implement exponential backoff |
| 500+ | Server Error | Retry with backoff |

### Error Response Example

```json
{
  "error": {
    "code": 403,
    "message": "The request cannot be completed because you have exceeded your quota.",
    "errors": [
      {
        "message": "The request cannot be completed because you have exceeded your quota.",
        "domain": "youtube.quota",
        "reason": "quotaExceeded"
      }
    ]
  }
}
```

## Best Practices

### Metadata Optimization

1. **Title Strategy:**
   - Front-load keywords in first 60 characters
   - Use compelling, searchable titles
   - Include relevant emojis sparingly

2. **Description Optimization:**
   - Use all 5,000 characters strategically
   - Include timestamps for longer videos
   - Add relevant hashtags (max 15)
   - Include links and calls-to-action

3. **Tags and Categories:**
   - Use 5-8 relevant tags
   - Mix broad and specific keywords
   - Select appropriate categoryId

### Performance Optimization

```javascript
// Batch requests where possible
const batchRequest = {
  requests: [
    { method: 'GET', url: '/youtube/v3/videos?id=VIDEO1&part=statistics' },
    { method: 'GET', url: '/youtube/v3/videos?id=VIDEO2&part=statistics' }
  ]
};

// Use resumable uploads for reliability
const chunkSize = 1024 * 1024 * 8; // 8MB chunks
```

### Database Tracking Pattern

```sql
CREATE TABLE video_uploads (
    local_file_path VARCHAR(500),
    local_file_hash VARCHAR(64),
    youtube_video_id VARCHAR(20),
    upload_status ENUM('pending', 'uploading', 'completed', 'failed'),
    session_uri TEXT,
    bytes_uploaded BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

## Security Considerations

### Data Retention Compliance

- **30-Day Rule:** Delete user data within 30 days
- **Compliance Monitoring:** Regular audit of data retention
- **User Privacy:** Respect user data deletion requests

### Terms of Service

- **Commercial Use:** Requires approval for monetization
- **Content Guidelines:** Respect YouTube community standards
- **API Limits:** No quota circumvention through multiple projects
- **Branding Requirements:** Maintain YouTube branding in player implementations

## Code Examples

### Complete Video Management Class

```typescript
class YouTubeManager {
  constructor(private oauth2Client: OAuth2Client) {}

  async uploadVideo(filePath: string, metadata: VideoMetadata): Promise<string> {
    const youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
    
    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: metadata.snippet,
        status: metadata.status
      },
      media: {
        body: fs.createReadStream(filePath)
      }
    });
    
    return response.data.id!;
  }

  async scheduleVideo(videoId: string, publishAt: string): Promise<void> {
    const youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
    
    await youtube.videos.update({
      part: ['status'],
      requestBody: {
        id: videoId,
        status: {
          privacyStatus: 'private',
          publishAt: publishAt
        }
      }
    });
  }

  async uploadThumbnail(videoId: string, thumbnailPath: string): Promise<void> {
    const youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
    
    await youtube.thumbnails.set({
      videoId: videoId,
      media: {
        body: fs.createReadStream(thumbnailPath)
      }
    });
  }
}
```

## Tools and Libraries

### Official Client Libraries

- **Python:** `google-api-python-client`
- **JavaScript/Node.js:** `googleapis`
- **Java:** `google-api-java-client`
- **PHP:** `google-api-php-client`
- **.NET:** `Google.Apis.YouTube.v3`

### Community Tools

- **youtube-studio (npm):** Unofficial access to YouTube Studio features
- **Reddit2Tube:** Bulk upload automation example
- **N8N Workflows:** No-code automation solutions

## Migration and Updates

### Deprecation Timeline

- **v2 API:** Fully deprecated (migrate to v3)
- **Featured Video/Website:** Deprecated December 2017
- **Less Secure Apps:** Deprecated March 2025 (OAuth required)

### API Explorer

Use the [APIs Explorer](https://developers.google.com/youtube/v3/docs) for:
- Testing API calls
- Exploring response formats
- OAuth authorization testing
- Parameter validation

## Support and Resources

### Official Resources

- **Documentation:** https://developers.google.com/youtube/v3
- **API Reference:** https://developers.google.com/youtube/v3/docs
- **Code Samples:** https://developers.google.com/youtube/v3/code_samples
- **Quota Calculator:** Available in Google Cloud Console

### Community Resources

- **Stack Overflow:** Use `youtube-api` tag
- **GitHub:** Various open-source implementations
- **YouTube Creator Community:** Best practices and tips

### Getting Help

- **Technical Issues:** Google Developer Forums
- **Quota Increases:** Google Cloud Console
- **Policy Questions:** YouTube Partner Support
- **API Explorer:** Built-in testing environment

---

*This documentation reflects the current state of YouTube Data API v3 as of September 2025. Always refer to the official Google documentation for the most up-to-date information.*