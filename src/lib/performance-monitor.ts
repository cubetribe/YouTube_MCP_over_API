import { logger, type PerformanceMetrics } from './logger.js';
import type { OperationType } from '../youtube/quota.js';

export interface MonitoredOperation {
  operationType: OperationType;
  correlationId?: string;
  userId?: string;
  quotaCost?: number;
}

export class PerformanceMonitor {
  private activeOperations = new Map<string, { startTime: number; operation: MonitoredOperation }>();

  /**
   * Start monitoring an operation
   * @param operation - The operation details
   * @returns A unique operation ID for ending the monitoring
   */
  startOperation(operation: MonitoredOperation): string {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    this.activeOperations.set(operationId, {
      startTime,
      operation
    });

    logger.debug(
      `Starting operation: ${operation.operationType}`,
      'performance',
      {
        operationId,
        operationType: operation.operationType,
        correlationId: operation.correlationId,
        userId: operation.userId
      }
    );

    return operationId;
  }

  /**
   * End monitoring an operation and record metrics
   * @param operationId - The operation ID returned from startOperation
   * @param success - Whether the operation completed successfully
   * @param error - Optional error if the operation failed
   */
  endOperation(operationId: string, success: boolean, error?: Error): void {
    const activeOp = this.activeOperations.get(operationId);
    if (!activeOp) {
      logger.warn(
        `Attempted to end unknown operation: ${operationId}`,
        'performance'
      );
      return;
    }

    const duration = Date.now() - activeOp.startTime;
    const { operation } = activeOp;

    // Record performance metrics
    const metrics: PerformanceMetrics = {
      operationType: operation.operationType,
      duration,
      success,
      quotaCost: operation.quotaCost || 0,
      timestamp: new Date().toISOString(),
      correlationId: operation.correlationId
    };

    logger.recordPerformance(metrics);

    // Log completion
    const logLevel = success ? 'info' : 'error';
    logger[logLevel](
      `Operation ${operation.operationType} ${success ? 'completed' : 'failed'} in ${duration}ms`,
      'performance',
      {
        operationId,
        operationType: operation.operationType,
        duration,
        success,
        quotaCost: operation.quotaCost,
        correlationId: operation.correlationId,
        userId: operation.userId,
        ...(error && { error: { name: error.name, message: error.message } })
      }
    );

    // Clean up
    this.activeOperations.delete(operationId);
  }

  /**
   * Wrap a function to automatically monitor its performance
   * @param operation - The operation details
   * @param fn - The function to execute
   * @returns The result of the function
   */
  async wrapOperation<T>(
    operation: MonitoredOperation,
    fn: () => Promise<T>
  ): Promise<T> {
    const operationId = this.startOperation(operation);

    try {
      const result = await fn();
      this.endOperation(operationId, true);
      return result;
    } catch (error) {
      this.endOperation(operationId, false, error as Error);
      throw error;
    }
  }

  /**
   * Get current active operations for monitoring
   */
  getActiveOperations(): Array<{ operationId: string; operation: MonitoredOperation; duration: number }> {
    const now = Date.now();
    return Array.from(this.activeOperations.entries()).map(([operationId, { startTime, operation }]) => ({
      operationId,
      operation,
      duration: now - startTime
    }));
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const performanceMonitor = new PerformanceMonitor();