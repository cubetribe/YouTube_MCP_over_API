/**
 * OAuth-specific error handling
 */

import { BaseError, type ErrorContext, type RetryConfig } from './base-error.js';

export type OAuthErrorType =
  | 'INVALID_GRANT'
  | 'ACCESS_DENIED'
  | 'EXPIRED_TOKEN'
  | 'INVALID_TOKEN'
  | 'INVALID_CLIENT'
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_GRANT_TYPE'
  | 'INVALID_SCOPE'
  | 'TOKEN_REFRESH_FAILED'
  | 'AUTHORIZATION_PENDING'
  | 'SLOW_DOWN'
  | 'DEVICE_FLOW_EXPIRED';

export class OAuthError extends BaseError {
  constructor(
    message: string,
    public readonly oauthErrorType: OAuthErrorType,
    context: ErrorContext = {},
    customRetryConfig?: Partial<RetryConfig>
  ) {
    const retryConfig: RetryConfig = {
      retryable: OAuthError.isRetryable(oauthErrorType),
      maxRetries: 3,
      baseDelay: 2000,
      maxDelay: 15000,
      backoffMultiplier: 2,
      ...customRetryConfig
    };

    super(message, `OAUTH_${oauthErrorType}`, context, retryConfig);
  }

  /**
   * Determine if an OAuth error type is retryable
   */
  private static isRetryable(errorType: OAuthErrorType): boolean {
    const retryableTypes: OAuthErrorType[] = [
      'EXPIRED_TOKEN',
      'TOKEN_REFRESH_FAILED',
      'AUTHORIZATION_PENDING',
      'SLOW_DOWN'
    ];
    return retryableTypes.includes(errorType);
  }

  /**
   * Create OAuth error from Google API response
   */
  public static fromGoogleAPIError(error: any, context: ErrorContext = {}): OAuthError {
    const errorMessage = error.message || 'OAuth error occurred';
    let errorType: OAuthErrorType = 'INVALID_REQUEST';

    // Map Google OAuth error codes to our types
    if (error.code) {
      switch (error.code) {
        case 'invalid_grant':
          errorType = 'INVALID_GRANT';
          break;
        case 'access_denied':
          errorType = 'ACCESS_DENIED';
          break;
        case 'invalid_token':
          errorType = 'INVALID_TOKEN';
          break;
        case 'invalid_client':
          errorType = 'INVALID_CLIENT';
          break;
        case 'unsupported_grant_type':
          errorType = 'UNSUPPORTED_GRANT_TYPE';
          break;
        case 'invalid_scope':
          errorType = 'INVALID_SCOPE';
          break;
        case 'authorization_pending':
          errorType = 'AUTHORIZATION_PENDING';
          break;
        case 'slow_down':
          errorType = 'SLOW_DOWN';
          break;
        case 'expired_token':
          errorType = 'EXPIRED_TOKEN';
          break;
      }
    } else if (errorMessage.includes('expired')) {
      errorType = 'EXPIRED_TOKEN';
    } else if (errorMessage.includes('refresh')) {
      errorType = 'TOKEN_REFRESH_FAILED';
    }

    return new OAuthError(errorMessage, errorType, {
      ...context,
      cause: error,
      metadata: {
        originalError: error
      }
    });
  }

  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    switch (this.oauthErrorType) {
      case 'EXPIRED_TOKEN':
      case 'TOKEN_REFRESH_FAILED':
        return 'medium';
      case 'ACCESS_DENIED':
      case 'INVALID_CLIENT':
        return 'high';
      case 'INVALID_GRANT':
      case 'INVALID_TOKEN':
        return 'critical';
      default:
        return 'medium';
    }
  }

  public getRecoveryActions(): string[] {
    switch (this.oauthErrorType) {
      case 'EXPIRED_TOKEN':
      case 'TOKEN_REFRESH_FAILED':
        return [
          'Attempting automatic token refresh',
          'If refresh fails, re-authentication will be required',
          'Use start_oauth_flow to begin new authentication'
        ];
      case 'ACCESS_DENIED':
        return [
          'User denied access to the application',
          'Re-run start_oauth_flow and ensure user grants permissions',
          'Check that required scopes are requested'
        ];
      case 'INVALID_CLIENT':
        return [
          'Check OAuth client configuration',
          'Verify YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET environment variables',
          'Ensure client is enabled in Google Cloud Console'
        ];
      case 'INVALID_GRANT':
      case 'INVALID_TOKEN':
        return [
          'Current tokens are invalid',
          'Clear stored tokens and re-authenticate',
          'Use start_oauth_flow to begin new authentication'
        ];
      case 'AUTHORIZATION_PENDING':
        return [
          'User has not yet completed authorization',
          'Wait for user to complete the authorization flow',
          'Retry in a few seconds'
        ];
      case 'SLOW_DOWN':
        return [
          'Too many token requests - backing off',
          'Wait before retrying token request',
          'Automatic retry will include appropriate delay'
        ];
      default:
        return [
          'Check OAuth configuration and try again',
          'If problem persists, re-authenticate using start_oauth_flow'
        ];
    }
  }

  public getUserMessage(): string {
    switch (this.oauthErrorType) {
      case 'EXPIRED_TOKEN':
        return 'Your authentication has expired. I\'ll attempt to refresh it automatically.';
      case 'ACCESS_DENIED':
        return 'Access was denied. Please re-authenticate and grant the required permissions.';
      case 'INVALID_CLIENT':
        return 'OAuth configuration error. Please check your client credentials.';
      case 'TOKEN_REFRESH_FAILED':
        return 'Failed to refresh authentication. Re-authentication may be required.';
      case 'AUTHORIZATION_PENDING':
        return 'Please complete the authorization process in your browser.';
      case 'SLOW_DOWN':
        return 'Too many requests. Please wait a moment before trying again.';
      default:
        return `Authentication error: ${this.message}`;
    }
  }

  /**
   * Check if this error indicates tokens should be cleared
   */
  public shouldClearTokens(): boolean {
    const clearTokenTypes: OAuthErrorType[] = [
      'INVALID_GRANT',
      'INVALID_TOKEN',
      'ACCESS_DENIED'
    ];
    return clearTokenTypes.includes(this.oauthErrorType);
  }

  /**
   * Check if this error requires user re-authentication
   */
  public requiresReauth(): boolean {
    const reauthTypes: OAuthErrorType[] = [
      'INVALID_GRANT',
      'INVALID_TOKEN',
      'ACCESS_DENIED',
      'EXPIRED_TOKEN' // If refresh fails
    ];
    return reauthTypes.includes(this.oauthErrorType);
  }
}