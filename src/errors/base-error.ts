/**
 * Base error class for YouTube MCP Extended
 * Provides structured error handling with retry capabilities and context
 */

export interface ErrorContext {
  /** Operation that was being performed when the error occurred */
  operation?: string;
  /** Video ID if the error is related to a specific video */
  videoId?: string;
  /** Playlist ID if the error is related to a specific playlist */
  playlistId?: string;
  /** Batch ID if the error is related to a batch operation */
  batchId?: string;
  /** User ID if the error is related to authentication */
  userId?: string;
  /** API endpoint that was called */
  endpoint?: string;
  /** HTTP status code for API errors */
  httpStatus?: number;
  /** Original error that caused this error */
  cause?: Error;
  /** Additional metadata for debugging */
  metadata?: Record<string, unknown>;
}

export interface RetryConfig {
  /** Whether this error type is retryable */
  retryable: boolean;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff */
  baseDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier */
  backoffMultiplier?: number;
}

export abstract class BaseError extends Error {
  public readonly timestamp: string;
  public readonly errorId: string;
  public retryCount: number = 0;

  constructor(
    message: string,
    public readonly code: string,
    public readonly context: ErrorContext = {},
    public readonly retryConfig: RetryConfig = { retryable: false }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.errorId = this.generateErrorId();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Generate a unique error ID for tracking
   */
  private generateErrorId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `err_${timestamp}_${random}`;
  }

  /**
   * Check if this error can be retried
   */
  public canRetry(): boolean {
    const { retryable, maxRetries = 3 } = this.retryConfig;
    return retryable && this.retryCount < maxRetries;
  }

  /**
   * Calculate the next retry delay using exponential backoff
   */
  public getRetryDelay(): number {
    const {
      baseDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2
    } = this.retryConfig;

    const delay = baseDelay * Math.pow(backoffMultiplier, this.retryCount);
    const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
    return Math.min(delay + jitter, maxDelay);
  }

  /**
   * Increment retry count
   */
  public incrementRetryCount(): void {
    this.retryCount++;
  }

  /**
   * Convert error to JSON for serialization
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      errorId: this.errorId,
      timestamp: this.timestamp,
      retryCount: this.retryCount,
      context: this.context,
      retryConfig: this.retryConfig,
      stack: this.stack
    };
  }

  /**
   * Convert error to MCP-compatible format
   */
  public toMCPError(): { code: string; message: string; data?: unknown } {
    return {
      code: this.code,
      message: this.message,
      data: {
        errorId: this.errorId,
        timestamp: this.timestamp,
        context: this.context,
        retryable: this.retryConfig.retryable
      }
    };
  }

  /**
   * Create a user-friendly error message
   */
  public getUserMessage(): string {
    return this.message;
  }

  /**
   * Get error severity level
   */
  public abstract getSeverity(): 'low' | 'medium' | 'high' | 'critical';

  /**
   * Get suggested recovery actions
   */
  public abstract getRecoveryActions(): string[];
}