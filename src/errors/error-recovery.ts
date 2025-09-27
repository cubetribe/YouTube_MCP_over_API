/**
 * Error recovery strategies and utilities
 * Implements exponential backoff, retry logic, and circuit breaker patterns
 */

import { logger } from '../lib/logger.js';
import { BaseError } from './base-error.js';
import { OAuthError } from './oauth-error.js';
import { YouTubeAPIError } from './youtube-api-error.js';
import { ValidationError } from './validation-error.js';
import { BatchProcessingError } from './batch-processing-error.js';

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Whether to add jitter to delays */
  useJitter: boolean;
  /** Custom condition to determine if error is retryable */
  retryCondition?: (error: Error, attempt: number) => boolean;
  /** Callback called before each retry */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
  /** Callback called when all retries are exhausted */
  onFailure?: (error: Error, totalAttempts: number) => void;
}

export interface CircuitBreakerOptions {
  /** Number of failures before circuit opens */
  failureThreshold: number;
  /** Time in milliseconds to wait before attempting to close circuit */
  resetTimeout: number;
  /** Time window in milliseconds for counting failures */
  monitoringWindow: number;
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
}

/**
 * Circuit breaker implementation for protecting against cascading failures
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = {
    state: 'CLOSED',
    failureCount: 0,
    lastFailureTime: 0,
    lastSuccessTime: Date.now()
  };

  constructor(
    private options: CircuitBreakerOptions,
    private operationName: string
  ) {}

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state.state = 'HALF_OPEN';
        logger.info(`Circuit breaker ${this.operationName} transitioning to HALF_OPEN`, 'system');
      } else {
        throw new Error(`Circuit breaker ${this.operationName} is OPEN - operation not allowed`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    const now = Date.now();
    return now - this.state.lastFailureTime >= this.options.resetTimeout;
  }

  private onSuccess(): void {
    this.state.failureCount = 0;
    this.state.lastSuccessTime = Date.now();
    if (this.state.state === 'HALF_OPEN') {
      this.state.state = 'CLOSED';
      logger.info(`Circuit breaker ${this.operationName} closed after successful operation`, 'system');
    }
  }

  private onFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();

    if (this.state.failureCount >= this.options.failureThreshold) {
      this.state.state = 'OPEN';
      logger.warn(
        `Circuit breaker ${this.operationName} opened after ${this.state.failureCount} failures`,
        'system',
        { failureThreshold: this.options.failureThreshold }
      );
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: Date.now()
    };
    logger.info(`Circuit breaker ${this.operationName} manually reset`, 'system');
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export class RetryManager {
  private static readonly DEFAULT_OPTIONS: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    useJitter: true
  };

  /**
   * Execute an operation with retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const config = { ...RetryManager.DEFAULT_OPTIONS, ...options };
    let lastError: Error;
    let attempt = 0;

    while (attempt <= config.maxRetries) {
      try {
        const result = await operation();
        if (attempt > 0) {
          logger.info(`Operation succeeded after ${attempt} retries`, 'system');
        }
        return result;
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Check if error is retryable
        if (!RetryManager.shouldRetry(lastError, attempt, config)) {
          break;
        }

        if (attempt <= config.maxRetries) {
          const delay = RetryManager.calculateDelay(attempt - 1, config);

          if (config.onRetry) {
            config.onRetry(lastError, attempt, delay);
          }

          logger.info(
            `Retrying operation after failure (attempt ${attempt}/${config.maxRetries})`,
            'system',
            {
              error: lastError.message,
              delay,
              remainingAttempts: config.maxRetries - attempt
            }
          );

          await RetryManager.delay(delay);
        }
      }
    }

    // All retries exhausted
    if (config.onFailure) {
      config.onFailure(lastError, attempt);
    }

    logger.error(
      `Operation failed after ${attempt} attempts`,
      'system',
      lastError,
      { maxRetries: config.maxRetries }
    );

    throw lastError;
  }

  /**
   * Determine if an error should trigger a retry
   */
  private static shouldRetry(error: Error, attempt: number, config: RetryOptions): boolean {
    // Check custom retry condition first
    if (config.retryCondition) {
      return config.retryCondition(error, attempt);
    }

    // Don't retry if we've exceeded max attempts
    if (attempt > config.maxRetries) {
      return false;
    }

    // Check if error type supports retrying
    if (error instanceof BaseError) {
      return error.canRetry();
    }

    // For unknown errors, only retry for certain patterns
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /temporary/i,
      /rate limit/i,
      /quota/i
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private static calculateDelay(attempt: number, config: RetryOptions): number {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
    let delay = Math.min(exponentialDelay, config.maxDelay);

    if (config.useJitter) {
      // Add jitter of ±25%
      const jitterRange = delay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay = Math.max(0, delay + jitter);
    }

    return Math.round(delay);
  }

  /**
   * Simple delay utility
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Specialized recovery strategies for different error types
 */
export class ErrorRecoveryStrategies {
  private static oauthCircuitBreaker = new CircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 300000, // 5 minutes
    monitoringWindow: 60000 // 1 minute
  }, 'oauth-operations');

  private static apiCircuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitoringWindow: 30000 // 30 seconds
  }, 'youtube-api');

  /**
   * Handle OAuth errors with automatic token refresh
   */
  static async handleOAuthError(
    error: OAuthError,
    retryOperation: () => Promise<any>
  ): Promise<any> {
    // If tokens should be cleared, don't retry
    if (error.shouldClearTokens()) {
      logger.warn('OAuth tokens need to be cleared - manual re-authentication required', 'auth');
      throw error;
    }

    // For expired tokens, attempt refresh
    if (error.oauthErrorType === 'EXPIRED_TOKEN' || error.oauthErrorType === 'TOKEN_REFRESH_FAILED') {
      try {
        return await ErrorRecoveryStrategies.oauthCircuitBreaker.execute(async () => {
          logger.info('Attempting automatic token refresh', 'auth');

          // Import oauth service dynamically to avoid circular dependencies
          const { oauthService } = await import('../auth/oauth-service.js');
          await oauthService.refreshTokens();

          logger.info('Token refresh successful, retrying operation', 'auth');
          return await retryOperation();
        });
      } catch (refreshError) {
        logger.error('Token refresh failed', 'auth', refreshError);
        throw error; // Throw original error, not refresh error
      }
    }

    // For rate limiting, use retry with backoff
    if (error.oauthErrorType === 'SLOW_DOWN' || error.oauthErrorType === 'AUTHORIZATION_PENDING') {
      return await RetryManager.withRetry(retryOperation, {
        maxRetries: 3,
        baseDelay: 2000,
        maxDelay: 15000,
        backoffMultiplier: 2
      });
    }

    throw error;
  }

  /**
   * Handle YouTube API errors with appropriate recovery strategies
   */
  static async handleYouTubeAPIError(
    error: YouTubeAPIError,
    retryOperation: () => Promise<any>
  ): Promise<any> {
    // For quota exceeded, don't retry immediately
    if (error.apiErrorType === 'QUOTA_EXCEEDED') {
      logger.warn('YouTube API quota exceeded - operation cannot be retried until quota resets', 'api');
      throw error;
    }

    // For permission errors, don't retry
    if (error.isPermissionRelated()) {
      logger.warn('YouTube API permission error - manual intervention required', 'api');
      throw error;
    }

    // For not found errors, don't retry
    if (error.isNotFound()) {
      throw error;
    }

    // For retryable errors, use circuit breaker and retry logic
    if (error.canRetry()) {
      return await ErrorRecoveryStrategies.apiCircuitBreaker.execute(async () => {
        return await RetryManager.withRetry(retryOperation, {
          maxRetries: error.retryConfig.maxRetries || 3,
          baseDelay: error.retryConfig.baseDelay || 1000,
          maxDelay: error.retryConfig.maxDelay || 60000,
          backoffMultiplier: error.retryConfig.backoffMultiplier || 2,
          onRetry: (err, attempt, delay) => {
            logger.info(
              `Retrying YouTube API operation: ${error.apiErrorType}`,
              'api',
              { attempt, delay, errorType: error.apiErrorType }
            );
          }
        });
      });
    }

    throw error;
  }

  /**
   * Handle batch processing errors with recovery strategies
   */
  static async handleBatchError(
    error: BatchProcessingError,
    retryOperation?: () => Promise<any>
  ): Promise<any> {
    // For partial failures, we might want to retry only failed items
    if (error.batchErrorType === 'BATCH_PARTIAL_FAILURE' && error.canRetryItems()) {
      const failedIds = error.getFailedItemIds();
      logger.info(
        `Batch partial failure - ${failedIds.length} items can be retried`,
        'batch',
        { failedItems: failedIds }
      );

      // This would need to be handled by the calling code
      // as it requires knowledge of how to retry specific items
      throw error;
    }

    // For timeouts and resource exhaustion, retry the whole batch
    if (error.canResume() && retryOperation) {
      return await RetryManager.withRetry(retryOperation, {
        maxRetries: error.retryConfig.maxRetries || 2,
        baseDelay: error.retryConfig.baseDelay || 30000,
        maxDelay: error.retryConfig.maxDelay || 300000,
        backoffMultiplier: error.retryConfig.backoffMultiplier || 1.5,
        onRetry: (err, attempt, delay) => {
          logger.info(
            `Retrying batch operation: ${error.batchErrorType}`,
            'batch',
            {
              attempt,
              delay,
              batchId: error.context.batchId,
              processedItems: error.batchDetails.successfulItems,
              totalItems: error.batchDetails.totalItems
            }
          );
        }
      });
    }

    throw error;
  }

  /**
   * Handle validation errors (usually not retryable)
   */
  static async handleValidationError(
    error: ValidationError,
    retryOperation?: () => Promise<any>
  ): Promise<any> {
    // Most validation errors are not retryable
    if (!error.canRetry()) {
      logger.warn(
        `Validation error is not retryable: ${error.validationErrorType}`,
        'system',
        { issues: error.issues.length }
      );
      throw error;
    }

    // Business rule violations might be retryable after some delay
    if (error.validationErrorType === 'BUSINESS_RULE_VIOLATION' && retryOperation) {
      return await RetryManager.withRetry(retryOperation, {
        maxRetries: 1,
        baseDelay: 5000,
        maxDelay: 5000,
        backoffMultiplier: 1
      });
    }

    throw error;
  }

  /**
   * Get circuit breaker states for monitoring
   */
  static getCircuitBreakerStates(): Record<string, CircuitBreakerState> {
    return {
      oauth: ErrorRecoveryStrategies.oauthCircuitBreaker.getState(),
      youtubeAPI: ErrorRecoveryStrategies.apiCircuitBreaker.getState()
    };
  }

  /**
   * Reset all circuit breakers (for testing or manual intervention)
   */
  static resetCircuitBreakers(): void {
    ErrorRecoveryStrategies.oauthCircuitBreaker.reset();
    ErrorRecoveryStrategies.apiCircuitBreaker.reset();
    logger.info('All circuit breakers have been reset', 'system');
  }
}

/**
 * Main error recovery orchestrator
 */
export class ErrorRecoveryOrchestrator {
  /**
   * Handle any error with appropriate recovery strategy
   */
  static async handleError(
    error: Error,
    retryOperation?: () => Promise<any>
  ): Promise<any> {
    // Log the error for monitoring
    logger.error(
      'Error occurred, attempting recovery',
      'system',
      error,
      {
        errorType: error.constructor.name,
        recoverable: retryOperation !== undefined
      }
    );

    // Route to appropriate recovery strategy
    if (error instanceof OAuthError) {
      if (!retryOperation) throw error;
      return await ErrorRecoveryStrategies.handleOAuthError(error, retryOperation);
    }

    if (error instanceof YouTubeAPIError) {
      if (!retryOperation) throw error;
      return await ErrorRecoveryStrategies.handleYouTubeAPIError(error, retryOperation);
    }

    if (error instanceof BatchProcessingError) {
      return await ErrorRecoveryStrategies.handleBatchError(error, retryOperation);
    }

    if (error instanceof ValidationError) {
      return await ErrorRecoveryStrategies.handleValidationError(error, retryOperation);
    }

    // For unknown errors, try basic retry if operation is provided
    if (retryOperation) {
      return await RetryManager.withRetry(retryOperation, {
        maxRetries: 2,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
      });
    }

    throw error;
  }
}