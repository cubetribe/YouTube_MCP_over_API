/**
 * Batch processing specific error handling
 */

import { BaseError, type ErrorContext, type RetryConfig } from './base-error.js';
import type { BatchOperationItem } from '../types/index.js';

export type BatchProcessingErrorType =
  | 'BATCH_NOT_FOUND'
  | 'BATCH_ALREADY_RUNNING'
  | 'BATCH_CANCELLED'
  | 'BATCH_TIMEOUT'
  | 'BATCH_ITEM_FAILED'
  | 'BATCH_PARTIAL_FAILURE'
  | 'BATCH_QUEUE_FULL'
  | 'BATCH_INVALID_STATE'
  | 'BATCH_DEPENDENCY_FAILED'
  | 'BATCH_RESOURCE_EXHAUSTED'
  | 'BATCH_SERIALIZATION_ERROR'
  | 'BATCH_DEADLOCK'
  | 'BATCH_CORRUPTION'
  | 'BATCH_ROLLBACK_FAILED';

export interface BatchErrorDetails {
  /** Total number of items in the batch */
  totalItems?: number;
  /** Number of successfully processed items */
  successfulItems?: number;
  /** Number of failed items */
  failedItems?: number;
  /** Number of pending items */
  pendingItems?: number;
  /** Failed batch item details */
  failedItemDetails?: Array<{
    itemId: string;
    error: string;
    retryCount: number;
  }>;
  /** Batch execution duration so far */
  executionDuration?: number;
  /** Estimated time remaining */
  estimatedTimeRemaining?: number;
  /** Resource usage information */
  resourceUsage?: {
    memoryUsage: number;
    cpuUsage: number;
    quotaUsed: number;
  };
}

export class BatchProcessingError extends BaseError {
  public readonly batchDetails: BatchErrorDetails;

  constructor(
    message: string,
    public readonly batchErrorType: BatchProcessingErrorType,
    batchDetails: BatchErrorDetails = {},
    context: ErrorContext = {},
    customRetryConfig?: Partial<RetryConfig>
  ) {
    const retryConfig: RetryConfig = {
      retryable: BatchProcessingError.isRetryable(batchErrorType),
      maxRetries: BatchProcessingError.getMaxRetries(batchErrorType),
      baseDelay: BatchProcessingError.getBaseDelay(batchErrorType),
      maxDelay: 300000, // 5 minutes max for batch operations
      backoffMultiplier: 1.5, // Gentler backoff for batch operations
      ...customRetryConfig
    };

    super(message, `BATCH_${batchErrorType}`, context, retryConfig);
    this.batchDetails = batchDetails;
  }

  /**
   * Determine if a batch error type is retryable
   */
  private static isRetryable(errorType: BatchProcessingErrorType): boolean {
    const retryableTypes: BatchProcessingErrorType[] = [
      'BATCH_TIMEOUT',
      'BATCH_ITEM_FAILED',
      'BATCH_PARTIAL_FAILURE',
      'BATCH_RESOURCE_EXHAUSTED',
      'BATCH_DEADLOCK'
    ];
    return retryableTypes.includes(errorType);
  }

  /**
   * Get maximum retries for error type
   */
  private static getMaxRetries(errorType: BatchProcessingErrorType): number {
    switch (errorType) {
      case 'BATCH_ITEM_FAILED':
        return 3; // Individual items can be retried
      case 'BATCH_PARTIAL_FAILURE':
        return 2; // Can retry failed portions
      case 'BATCH_TIMEOUT':
        return 1; // One retry for timeouts
      case 'BATCH_RESOURCE_EXHAUSTED':
        return 2; // Wait and retry
      case 'BATCH_DEADLOCK':
        return 3; // Deadlocks often resolve on retry
      default:
        return 0;
    }
  }

  /**
   * Get base delay for error type
   */
  private static getBaseDelay(errorType: BatchProcessingErrorType): number {
    switch (errorType) {
      case 'BATCH_TIMEOUT':
        return 30000; // 30 seconds
      case 'BATCH_RESOURCE_EXHAUSTED':
        return 60000; // 1 minute
      case 'BATCH_DEADLOCK':
        return 5000; // 5 seconds
      case 'BATCH_ITEM_FAILED':
        return 10000; // 10 seconds
      case 'BATCH_PARTIAL_FAILURE':
        return 15000; // 15 seconds
      default:
        return 5000; // 5 seconds
    }
  }

  /**
   * Create batch error from failed batch operation
   */
  public static fromFailedBatch(
    batchId: string,
    totalItems: number,
    failedItems: BatchOperationItem[],
    context: ErrorContext = {}
  ): BatchProcessingError {
    const successfulItems = totalItems - failedItems.length;
    const isPartialFailure = successfulItems > 0;

    const errorType: BatchProcessingErrorType = isPartialFailure
      ? 'BATCH_PARTIAL_FAILURE'
      : 'BATCH_ITEM_FAILED';

    const message = isPartialFailure
      ? `Batch ${batchId} partially failed: ${failedItems.length}/${totalItems} items failed`
      : `Batch ${batchId} failed: all ${totalItems} items failed`;

    const batchDetails: BatchErrorDetails = {
      totalItems,
      successfulItems,
      failedItems: failedItems.length,
      pendingItems: 0,
      failedItemDetails: failedItems.map(item => ({
        itemId: item.id,
        error: item.error || 'Unknown error',
        retryCount: 0 // This would be tracked elsewhere
      }))
    };

    return new BatchProcessingError(message, errorType, batchDetails, {
      ...context,
      batchId
    });
  }

  /**
   * Create timeout error for batch operation
   */
  public static timeout(
    batchId: string,
    executionDuration: number,
    processedItems: number,
    totalItems: number,
    context: ErrorContext = {}
  ): BatchProcessingError {
    const message = `Batch ${batchId} timed out after ${Math.round(executionDuration / 1000)}s (${processedItems}/${totalItems} items processed)`;

    const batchDetails: BatchErrorDetails = {
      totalItems,
      successfulItems: processedItems,
      failedItems: 0,
      pendingItems: totalItems - processedItems,
      executionDuration
    };

    return new BatchProcessingError(message, 'BATCH_TIMEOUT', batchDetails, {
      ...context,
      batchId
    });
  }

  /**
   * Create resource exhaustion error
   */
  public static resourceExhausted(
    batchId: string,
    resourceType: string,
    usage: number,
    limit: number,
    context: ErrorContext = {}
  ): BatchProcessingError {
    const message = `Batch ${batchId} exceeded ${resourceType} limit: ${usage}/${limit}`;

    const batchDetails: BatchErrorDetails = {
      resourceUsage: {
        memoryUsage: resourceType === 'memory' ? usage : 0,
        cpuUsage: resourceType === 'cpu' ? usage : 0,
        quotaUsed: resourceType === 'quota' ? usage : 0
      }
    };

    return new BatchProcessingError(message, 'BATCH_RESOURCE_EXHAUSTED', batchDetails, {
      ...context,
      batchId,
      metadata: { resourceType, usage, limit }
    });
  }

  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    switch (this.batchErrorType) {
      case 'BATCH_CORRUPTION':
      case 'BATCH_ROLLBACK_FAILED':
        return 'critical';
      case 'BATCH_TIMEOUT':
      case 'BATCH_RESOURCE_EXHAUSTED':
        return 'high';
      case 'BATCH_PARTIAL_FAILURE':
      case 'BATCH_ITEM_FAILED':
        return 'medium';
      default:
        return 'low';
    }
  }

  public getRecoveryActions(): string[] {
    switch (this.batchErrorType) {
      case 'BATCH_NOT_FOUND':
        return [
          'Verify the batch ID is correct',
          'Check if the batch has expired or been cleaned up',
          'Create a new batch operation if needed'
        ];
      case 'BATCH_TIMEOUT':
        return [
          'Consider breaking large batches into smaller chunks',
          'Increase timeout limits if appropriate',
          'Resume processing from last checkpoint',
          'Automatic retry will continue from where it left off'
        ];
      case 'BATCH_PARTIAL_FAILURE':
        return [
          'Review failed items for patterns',
          'Retry only the failed items',
          'Check for data quality issues in failed items',
          'Consider adjusting batch size or processing strategy'
        ];
      case 'BATCH_ITEM_FAILED':
        return [
          'Review individual item errors for root cause',
          'Fix data issues in failed items',
          'Retry with corrected data',
          'Consider excluding problematic items'
        ];
      case 'BATCH_RESOURCE_EXHAUSTED':
        return [
          'Wait for resources to become available',
          'Reduce batch size to lower resource requirements',
          'Consider processing during off-peak hours',
          'Implement resource throttling'
        ];
      case 'BATCH_QUEUE_FULL':
        return [
          'Wait for current batches to complete',
          'Consider increasing queue capacity',
          'Implement batch prioritization',
          'Schedule batch for later execution'
        ];
      case 'BATCH_DEADLOCK':
        return [
          'Automatic retry will resolve most deadlocks',
          'Consider reordering operations to prevent deadlocks',
          'Implement deadlock detection and resolution',
          'Review concurrent access patterns'
        ];
      case 'BATCH_CORRUPTION':
        return [
          'Review batch data integrity',
          'Restore from backup if available',
          'Recreate the batch operation',
          'Investigate root cause of corruption'
        ];
      default:
        return [
          'Review batch configuration and retry',
          'Check system resources and status',
          'Contact support if problem persists'
        ];
    }
  }

  public getUserMessage(): string {
    switch (this.batchErrorType) {
      case 'BATCH_NOT_FOUND':
        return 'Batch operation not found. It may have expired or been removed.';
      case 'BATCH_TIMEOUT':
        return `Batch operation timed out. ${this.batchDetails.successfulItems || 0} of ${this.batchDetails.totalItems || 0} items were processed.`;
      case 'BATCH_PARTIAL_FAILURE':
        return `Batch completed with ${this.batchDetails.failedItems || 0} failed items out of ${this.batchDetails.totalItems || 0} total.`;
      case 'BATCH_ITEM_FAILED':
        return 'Batch operation failed. Please review the errors and try again.';
      case 'BATCH_RESOURCE_EXHAUSTED':
        return 'Batch operation exceeded resource limits. Please try again later or with a smaller batch.';
      case 'BATCH_QUEUE_FULL':
        return 'Batch queue is full. Please wait for current operations to complete.';
      default:
        return `Batch operation error: ${this.message}`;
    }
  }

  /**
   * Get batch processing statistics
   */
  public getProcessingStats(): {
    totalItems: number;
    successRate: number;
    failureRate: number;
    completionRate: number;
    estimatedTimeRemaining?: number;
  } {
    const { totalItems = 0, successfulItems = 0, failedItems = 0, pendingItems = 0 } = this.batchDetails;
    const processedItems = successfulItems + failedItems;

    return {
      totalItems,
      successRate: totalItems > 0 ? successfulItems / totalItems : 0,
      failureRate: totalItems > 0 ? failedItems / totalItems : 0,
      completionRate: totalItems > 0 ? processedItems / totalItems : 0,
      estimatedTimeRemaining: this.batchDetails.estimatedTimeRemaining
    };
  }

  /**
   * Check if batch can be resumed
   */
  public canResume(): boolean {
    const resumableTypes: BatchProcessingErrorType[] = [
      'BATCH_TIMEOUT',
      'BATCH_PARTIAL_FAILURE',
      'BATCH_RESOURCE_EXHAUSTED'
    ];
    return resumableTypes.includes(this.batchErrorType) &&
           (this.batchDetails.pendingItems || 0) > 0;
  }

  /**
   * Check if individual items can be retried
   */
  public canRetryItems(): boolean {
    const retryableTypes: BatchProcessingErrorType[] = [
      'BATCH_ITEM_FAILED',
      'BATCH_PARTIAL_FAILURE',
      'BATCH_DEADLOCK'
    ];
    return retryableTypes.includes(this.batchErrorType) &&
           (this.batchDetails.failedItems || 0) > 0;
  }

  /**
   * Get list of failed item IDs for retry
   */
  public getFailedItemIds(): string[] {
    return this.batchDetails.failedItemDetails?.map(item => item.itemId) || [];
  }
}