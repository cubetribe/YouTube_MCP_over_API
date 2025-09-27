/**
 * Factory for creating standardized errors from various sources
 */

import { OAuthError, type OAuthErrorType } from './oauth-error.js';
import { YouTubeAPIError, type YouTubeAPIErrorType } from './youtube-api-error.js';
import { ValidationError, type ValidationErrorType } from './validation-error.js';
import { BatchProcessingError, type BatchProcessingErrorType } from './batch-processing-error.js';
import { BaseError, type ErrorContext } from './base-error.js';
import { logger } from '../lib/logger.js';

/**
 * Centralized error factory for creating consistent error instances
 */
export class ErrorFactory {
  /**
   * Create error from Google API response
   */
  static fromGoogleAPIResponse(
    error: any,
    context: ErrorContext = {}
  ): YouTubeAPIError | OAuthError {
    // Determine if this is an OAuth or YouTube API error
    const errorCode = error.code || error.error;
    const errorMessage = error.message || error.error_description || 'API error occurred';

    // OAuth-related error codes
    const oauthErrorCodes = [
      'invalid_grant',
      'access_denied',
      'invalid_token',
      'invalid_client',
      'unsupported_grant_type',
      'invalid_scope',
      'authorization_pending',
      'slow_down',
      'expired_token'
    ];

    if (oauthErrorCodes.includes(errorCode) || errorMessage.includes('OAuth')) {
      logger.warn('Creating OAuth error from Google API response', 'auth', {
        errorCode,
        errorMessage: errorMessage.substring(0, 100)
      });
      return OAuthError.fromGoogleAPIError(error, context);
    }

    // Otherwise, treat as YouTube API error
    logger.warn('Creating YouTube API error from Google API response', 'api', {
      errorCode,
      errorMessage: errorMessage.substring(0, 100),
      status: error.status
    });
    return YouTubeAPIError.fromGoogleAPIError(error, context);
  }

  /**
   * Create error from HTTP response
   */
  static fromHTTPResponse(
    response: {
      status: number;
      statusText?: string;
      data?: any;
      headers?: Record<string, string>;
    },
    context: ErrorContext = {}
  ): YouTubeAPIError {
    const { status, statusText, data } = response;
    const message = data?.error?.message || statusText || `HTTP ${status} error`;

    let errorType: YouTubeAPIErrorType = 'INTERNAL_ERROR';

    switch (status) {
      case 400:
        errorType = 'BAD_REQUEST';
        break;
      case 401:
        errorType = 'INSUFFICIENT_PERMISSIONS';
        break;
      case 403:
        if (message.includes('quota')) {
          errorType = 'QUOTA_EXCEEDED';
        } else if (message.includes('rate')) {
          errorType = 'RATE_LIMITED';
        } else {
          errorType = 'FORBIDDEN';
        }
        break;
      case 404:
        if (message.includes('video')) {
          errorType = 'VIDEO_NOT_FOUND';
        } else if (message.includes('playlist')) {
          errorType = 'PLAYLIST_NOT_FOUND';
        } else {
          errorType = 'CHANNEL_NOT_FOUND';
        }
        break;
      case 408:
        errorType = 'TIMEOUT';
        break;
      case 409:
        errorType = 'CONCURRENT_UPDATES';
        break;
      case 429:
        errorType = 'RATE_LIMITED';
        break;
      case 500:
        errorType = 'INTERNAL_ERROR';
        break;
      case 503:
        errorType = 'SERVICE_UNAVAILABLE';
        break;
    }

    return new YouTubeAPIError(
      message,
      errorType,
      {
        status,
        details: data?.error?.message,
        reason: data?.error?.errors?.[0]?.reason
      },
      {
        ...context,
        httpStatus: status,
        metadata: {
          response: {
            status,
            statusText,
            headers: response.headers
          }
        }
      }
    );
  }

  /**
   * Create validation error for missing required field
   */
  static missingRequiredField(
    fieldName: string,
    context: ErrorContext = {}
  ): ValidationError {
    return ValidationError.custom(
      `Required field '${fieldName}' is missing`,
      fieldName,
      'non-empty value',
      'undefined',
      context
    );
  }

  /**
   * Create validation error for invalid format
   */
  static invalidFormat(
    fieldName: string,
    expected: string,
    received: unknown,
    context: ErrorContext = {}
  ): ValidationError {
    return ValidationError.custom(
      `Invalid format for field '${fieldName}'`,
      fieldName,
      expected,
      received,
      context
    );
  }

  /**
   * Create batch error for operation timeout
   */
  static batchTimeout(
    batchId: string,
    executionTime: number,
    processedItems: number,
    totalItems: number,
    context: ErrorContext = {}
  ): BatchProcessingError {
    return BatchProcessingError.timeout(
      batchId,
      executionTime,
      processedItems,
      totalItems,
      context
    );
  }

  /**
   * Create batch error for quota exhaustion
   */
  static batchQuotaExhausted(
    batchId: string,
    quotaUsed: number,
    quotaLimit: number,
    context: ErrorContext = {}
  ): BatchProcessingError {
    return BatchProcessingError.resourceExhausted(
      batchId,
      'quota',
      quotaUsed,
      quotaLimit,
      context
    );
  }

  /**
   * Create network-related error
   */
  static networkError(
    message: string,
    context: ErrorContext = {}
  ): YouTubeAPIError {
    return new YouTubeAPIError(
      message,
      'NETWORK_ERROR',
      {},
      context
    );
  }

  /**
   * Create timeout error
   */
  static timeoutError(
    operation: string,
    timeoutMs: number,
    context: ErrorContext = {}
  ): YouTubeAPIError {
    return new YouTubeAPIError(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      'TIMEOUT',
      {},
      {
        ...context,
        operation,
        metadata: { timeoutMs }
      }
    );
  }

  /**
   * Create permission denied error
   */
  static permissionDenied(
    resource: string,
    action: string,
    context: ErrorContext = {}
  ): YouTubeAPIError {
    return new YouTubeAPIError(
      `Permission denied for ${action} on ${resource}`,
      'INSUFFICIENT_PERMISSIONS',
      {
        reason: 'insufficientPermissions',
        domain: 'youtube.common'
      },
      {
        ...context,
        metadata: { resource, action }
      }
    );
  }

  /**
   * Create resource not found error
   */
  static resourceNotFound(
    resourceType: 'video' | 'playlist' | 'channel',
    resourceId: string,
    context: ErrorContext = {}
  ): YouTubeAPIError {
    const errorTypeMap: Record<string, YouTubeAPIErrorType> = {
      video: 'VIDEO_NOT_FOUND',
      playlist: 'PLAYLIST_NOT_FOUND',
      channel: 'CHANNEL_NOT_FOUND'
    };

    return new YouTubeAPIError(
      `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} '${resourceId}' not found`,
      errorTypeMap[resourceType],
      {
        status: 404,
        reason: 'notFound'
      },
      {
        ...context,
        [`${resourceType}Id`]: resourceId
      }
    );
  }

  /**
   * Create quota exceeded error
   */
  static quotaExceeded(
    quotaUsed: number,
    quotaLimit: number,
    context: ErrorContext = {}
  ): YouTubeAPIError {
    return new YouTubeAPIError(
      `YouTube API quota exceeded: ${quotaUsed}/${quotaLimit} units used`,
      'QUOTA_EXCEEDED',
      {
        status: 403,
        reason: 'quotaExceeded',
        quotaCost: quotaUsed
      },
      {
        ...context,
        metadata: { quotaUsed, quotaLimit }
      }
    );
  }

  /**
   * Create rate limit error
   */
  static rateLimited(
    retryAfterSeconds?: number,
    context: ErrorContext = {}
  ): YouTubeAPIError {
    const message = retryAfterSeconds
      ? `Rate limit exceeded. Retry after ${retryAfterSeconds} seconds`
      : 'Rate limit exceeded';

    return new YouTubeAPIError(
      message,
      'RATE_LIMITED',
      {
        status: 429,
        reason: 'rateLimitExceeded'
      },
      {
        ...context,
        metadata: { retryAfterSeconds }
      }
    );
  }

  /**
   * Create error from unknown exception
   */
  static fromUnknownError(
    error: unknown,
    context: ErrorContext = {}
  ): BaseError {
    if (error instanceof BaseError) {
      return error;
    }

    if (error instanceof Error) {
      // Try to determine error type from message patterns
      const message = error.message.toLowerCase();

      if (message.includes('oauth') || message.includes('token') || message.includes('auth')) {
        logger.warn('Converting unknown error to OAuth error', 'auth', { originalMessage: error.message });
        return new OAuthError(
          error.message,
          'INVALID_REQUEST',
          {
            ...context,
            cause: error
          }
        );
      }

      if (message.includes('quota') || message.includes('limit')) {
        logger.warn('Converting unknown error to API error', 'api', { originalMessage: error.message });
        return new YouTubeAPIError(
          error.message,
          'QUOTA_EXCEEDED',
          {},
          {
            ...context,
            cause: error
          }
        );
      }

      if (message.includes('timeout') || message.includes('timed out')) {
        return new YouTubeAPIError(
          error.message,
          'TIMEOUT',
          {},
          {
            ...context,
            cause: error
          }
        );
      }

      if (message.includes('network') || message.includes('connection')) {
        return new YouTubeAPIError(
          error.message,
          'NETWORK_ERROR',
          {},
          {
            ...context,
            cause: error
          }
        );
      }

      // Default to YouTube API internal error
      return new YouTubeAPIError(
        error.message,
        'INTERNAL_ERROR',
        {},
        {
          ...context,
          cause: error
        }
      );
    }

    // For non-Error objects, create a generic error
    return new YouTubeAPIError(
      `Unknown error occurred: ${String(error)}`,
      'INTERNAL_ERROR',
      {},
      {
        ...context,
        metadata: { originalError: error }
      }
    );
  }

  /**
   * Enhance existing error with additional context
   */
  static enhanceError(
    error: BaseError,
    additionalContext: ErrorContext
  ): BaseError {
    // Create new error with merged context
    const mergedContext = {
      ...error.context,
      ...additionalContext,
      metadata: {
        ...error.context.metadata,
        ...additionalContext.metadata
      }
    };

    // Return new instance with enhanced context
    if (error instanceof OAuthError) {
      return new OAuthError(
        error.message,
        error.oauthErrorType,
        mergedContext,
        error.retryConfig
      );
    }

    if (error instanceof YouTubeAPIError) {
      return new YouTubeAPIError(
        error.message,
        error.apiErrorType,
        error.details,
        mergedContext,
        error.retryConfig
      );
    }

    if (error instanceof ValidationError) {
      return new ValidationError(
        error.message,
        error.validationErrorType,
        error.issues,
        mergedContext
      );
    }

    if (error instanceof BatchProcessingError) {
      return new BatchProcessingError(
        error.message,
        error.batchErrorType,
        error.batchDetails,
        mergedContext,
        error.retryConfig
      );
    }

    return error;
  }
}