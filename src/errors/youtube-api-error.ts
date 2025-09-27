/**
 * YouTube API specific error handling
 */

import { BaseError, type ErrorContext, type RetryConfig } from './base-error.js';

export type YouTubeAPIErrorType =
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'VIDEO_NOT_FOUND'
  | 'PLAYLIST_NOT_FOUND'
  | 'CHANNEL_NOT_FOUND'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'INVALID_VIDEO_ID'
  | 'INVALID_PLAYLIST_ID'
  | 'VIDEO_UPLOAD_LIMIT'
  | 'CONCURRENT_UPDATES'
  | 'PROCESSING_FAILURE'
  | 'METADATA_TOO_LONG'
  | 'INVALID_PRIVACY_STATUS'
  | 'LIVE_STREAM_ERROR';

export interface YouTubeAPIErrorDetails {
  /** HTTP status code */
  status?: number;
  /** YouTube API error reason */
  reason?: string;
  /** YouTube API error domain */
  domain?: string;
  /** Quota cost of the failed operation */
  quotaCost?: number;
  /** Location in request that caused error */
  location?: string;
  /** Detailed error message from YouTube */
  details?: string;
}

export class YouTubeAPIError extends BaseError {
  public readonly details: YouTubeAPIErrorDetails;

  constructor(
    message: string,
    public readonly apiErrorType: YouTubeAPIErrorType,
    details: YouTubeAPIErrorDetails = {},
    context: ErrorContext = {},
    customRetryConfig?: Partial<RetryConfig>
  ) {
    const retryConfig: RetryConfig = {
      retryable: YouTubeAPIError.isRetryable(apiErrorType),
      maxRetries: YouTubeAPIError.getMaxRetries(apiErrorType),
      baseDelay: YouTubeAPIError.getBaseDelay(apiErrorType),
      maxDelay: 60000, // 1 minute max
      backoffMultiplier: 2,
      ...customRetryConfig
    };

    super(message, `YOUTUBE_API_${apiErrorType}`, context, retryConfig);
    this.details = details;
  }

  /**
   * Determine if an API error type is retryable
   */
  private static isRetryable(errorType: YouTubeAPIErrorType): boolean {
    const retryableTypes: YouTubeAPIErrorType[] = [
      'RATE_LIMITED',
      'INTERNAL_ERROR',
      'SERVICE_UNAVAILABLE',
      'TIMEOUT',
      'NETWORK_ERROR',
      'CONCURRENT_UPDATES',
      'PROCESSING_FAILURE'
    ];
    return retryableTypes.includes(errorType);
  }

  /**
   * Get maximum retries for error type
   */
  private static getMaxRetries(errorType: YouTubeAPIErrorType): number {
    switch (errorType) {
      case 'RATE_LIMITED':
        return 5;
      case 'NETWORK_ERROR':
      case 'TIMEOUT':
        return 3;
      case 'INTERNAL_ERROR':
      case 'SERVICE_UNAVAILABLE':
        return 2;
      case 'CONCURRENT_UPDATES':
      case 'PROCESSING_FAILURE':
        return 3;
      default:
        return 0;
    }
  }

  /**
   * Get base delay for error type
   */
  private static getBaseDelay(errorType: YouTubeAPIErrorType): number {
    switch (errorType) {
      case 'RATE_LIMITED':
        return 5000; // 5 seconds
      case 'QUOTA_EXCEEDED':
        return 3600000; // 1 hour
      case 'CONCURRENT_UPDATES':
        return 2000; // 2 seconds
      case 'PROCESSING_FAILURE':
        return 10000; // 10 seconds
      default:
        return 1000; // 1 second
    }
  }

  /**
   * Create YouTube API error from Google API response
   */
  public static fromGoogleAPIError(error: any, context: ErrorContext = {}): YouTubeAPIError {
    const status = error.status || error.code || 500;
    const message = error.message || 'YouTube API error occurred';

    let errorType: YouTubeAPIErrorType = 'INTERNAL_ERROR';
    const details: YouTubeAPIErrorDetails = {
      status,
      reason: error.errors?.[0]?.reason,
      domain: error.errors?.[0]?.domain,
      location: error.errors?.[0]?.location,
      details: error.errors?.[0]?.message || message
    };

    // Map HTTP status codes and error reasons to our types
    if (status === 403) {
      if (error.errors?.[0]?.reason === 'quotaExceeded') {
        errorType = 'QUOTA_EXCEEDED';
      } else if (error.errors?.[0]?.reason === 'rateLimitExceeded') {
        errorType = 'RATE_LIMITED';
      } else {
        errorType = 'INSUFFICIENT_PERMISSIONS';
      }
    } else if (status === 404) {
      if (message.includes('video')) {
        errorType = 'VIDEO_NOT_FOUND';
      } else if (message.includes('playlist')) {
        errorType = 'PLAYLIST_NOT_FOUND';
      } else if (message.includes('channel')) {
        errorType = 'CHANNEL_NOT_FOUND';
      }
    } else if (status === 400) {
      if (error.errors?.[0]?.reason === 'invalidVideoId') {
        errorType = 'INVALID_VIDEO_ID';
      } else if (error.errors?.[0]?.reason === 'invalidPlaylistId') {
        errorType = 'INVALID_PLAYLIST_ID';
      } else if (message.includes('too long')) {
        errorType = 'METADATA_TOO_LONG';
      } else {
        errorType = 'BAD_REQUEST';
      }
    } else if (status === 409) {
      errorType = 'CONCURRENT_UPDATES';
    } else if (status === 429) {
      errorType = 'RATE_LIMITED';
    } else if (status === 500) {
      errorType = 'INTERNAL_ERROR';
    } else if (status === 503) {
      errorType = 'SERVICE_UNAVAILABLE';
    } else if (status === 408 || message.includes('timeout')) {
      errorType = 'TIMEOUT';
    } else if (message.includes('network') || message.includes('connection')) {
      errorType = 'NETWORK_ERROR';
    }

    return new YouTubeAPIError(message, errorType, details, {
      ...context,
      cause: error,
      httpStatus: status,
      metadata: {
        originalError: error,
        errorDetails: error.errors
      }
    });
  }

  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    switch (this.apiErrorType) {
      case 'QUOTA_EXCEEDED':
        return 'critical';
      case 'INSUFFICIENT_PERMISSIONS':
      case 'FORBIDDEN':
        return 'high';
      case 'RATE_LIMITED':
      case 'SERVICE_UNAVAILABLE':
        return 'medium';
      case 'VIDEO_NOT_FOUND':
      case 'PLAYLIST_NOT_FOUND':
      case 'INVALID_VIDEO_ID':
        return 'medium';
      case 'NETWORK_ERROR':
      case 'TIMEOUT':
        return 'low';
      default:
        return 'medium';
    }
  }

  public getRecoveryActions(): string[] {
    switch (this.apiErrorType) {
      case 'QUOTA_EXCEEDED':
        return [
          'YouTube API quota has been exceeded',
          'Wait until quota resets (typically at midnight Pacific Time)',
          'Consider reducing the number of API calls',
          'Implement quota monitoring to prevent future occurrences'
        ];
      case 'RATE_LIMITED':
        return [
          'Rate limit exceeded - backing off exponentially',
          'Automatic retry will occur with appropriate delay',
          'Consider implementing request batching to reduce API calls'
        ];
      case 'VIDEO_NOT_FOUND':
        return [
          'Video ID does not exist or is not accessible',
          'Verify the video ID is correct',
          'Check if video is private or has been deleted',
          'Ensure authenticated user has access to the video'
        ];
      case 'PLAYLIST_NOT_FOUND':
        return [
          'Playlist ID does not exist or is not accessible',
          'Verify the playlist ID is correct',
          'Check if playlist is private or has been deleted',
          'Ensure authenticated user has access to the playlist'
        ];
      case 'INSUFFICIENT_PERMISSIONS':
        return [
          'The authenticated user lacks required permissions',
          'Check OAuth scopes include necessary permissions',
          'Verify user owns the resource being modified',
          'Re-authenticate with appropriate scopes if needed'
        ];
      case 'CONCURRENT_UPDATES':
        return [
          'Multiple updates to the same resource detected',
          'Automatic retry will occur with backoff',
          'Consider implementing optimistic locking'
        ];
      case 'METADATA_TOO_LONG':
        return [
          'Metadata exceeds YouTube\'s length limits',
          'Title: max 100 characters',
          'Description: max 5000 characters',
          'Tags: max 500 characters total, 30 characters per tag'
        ];
      case 'NETWORK_ERROR':
      case 'TIMEOUT':
        return [
          'Network connectivity issue detected',
          'Automatic retry will occur',
          'Check internet connection if problem persists'
        ];
      case 'SERVICE_UNAVAILABLE':
        return [
          'YouTube API is temporarily unavailable',
          'Automatic retry will occur with exponential backoff',
          'Check YouTube API status if problem persists'
        ];
      default:
        return [
          'Unexpected YouTube API error occurred',
          'Review error details for specific guidance',
          'Contact support if problem persists'
        ];
    }
  }

  public getUserMessage(): string {
    switch (this.apiErrorType) {
      case 'QUOTA_EXCEEDED':
        return 'YouTube API quota exceeded. Operations will resume when quota resets.';
      case 'RATE_LIMITED':
        return 'Too many requests to YouTube. Automatically retrying with delay.';
      case 'VIDEO_NOT_FOUND':
        return 'Video not found. Please check the video ID and try again.';
      case 'PLAYLIST_NOT_FOUND':
        return 'Playlist not found. Please check the playlist ID and try again.';
      case 'INSUFFICIENT_PERMISSIONS':
        return 'Insufficient permissions. You may need to re-authenticate with additional permissions.';
      case 'METADATA_TOO_LONG':
        return 'Metadata is too long. Please shorten titles, descriptions, or tags.';
      case 'NETWORK_ERROR':
        return 'Network connection issue. Retrying automatically.';
      case 'SERVICE_UNAVAILABLE':
        return 'YouTube service is temporarily unavailable. Retrying automatically.';
      default:
        return `YouTube API error: ${this.message}`;
    }
  }

  /**
   * Get recommended retry delay in milliseconds
   */
  public getRetryDelay(): number {
    // For rate limits, respect any Retry-After header
    if (this.apiErrorType === 'RATE_LIMITED' && this.details.status === 429) {
      // If we had access to response headers, we'd check Retry-After
      // For now, use exponential backoff starting at 5 seconds
      return Math.min(5000 * Math.pow(2, this.retryCount), 60000);
    }

    return super.getRetryDelay();
  }

  /**
   * Check if this error indicates quota issues
   */
  public isQuotaRelated(): boolean {
    return this.apiErrorType === 'QUOTA_EXCEEDED' || this.apiErrorType === 'RATE_LIMITED';
  }

  /**
   * Check if this error indicates permission issues
   */
  public isPermissionRelated(): boolean {
    return this.apiErrorType === 'INSUFFICIENT_PERMISSIONS' || this.apiErrorType === 'FORBIDDEN';
  }

  /**
   * Check if this error indicates resource not found
   */
  public isNotFound(): boolean {
    const notFoundTypes: YouTubeAPIErrorType[] = [
      'VIDEO_NOT_FOUND',
      'PLAYLIST_NOT_FOUND',
      'CHANNEL_NOT_FOUND'
    ];
    return notFoundTypes.includes(this.apiErrorType);
  }
}