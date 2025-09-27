import { logger } from './logger.js';
import type { OperationType } from '../youtube/quota.js';

export interface QuotaUsageEntry {
  timestamp: string;
  operation: OperationType;
  cost: number;
  totalUsage: number;
  remainingQuota: number;
  success: boolean;
  correlationId?: string;
}

export interface RateLimitEvent {
  timestamp: string;
  operation: OperationType;
  retryAfter?: number;
  correlationId?: string;
}

export class QuotaMonitor {
  private quotaHistory: QuotaUsageEntry[] = [];
  private rateLimitEvents: RateLimitEvent[] = [];
  private readonly maxHistoryEntries = 1000;
  private readonly maxRateLimitEntries = 100;

  /**
   * Record quota usage for an operation
   */
  recordQuotaUsage(entry: Omit<QuotaUsageEntry, 'timestamp'>): void {
    const quotaEntry: QuotaUsageEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    this.quotaHistory.push(quotaEntry);

    // Keep history size manageable
    if (this.quotaHistory.length > this.maxHistoryEntries) {
      this.quotaHistory = this.quotaHistory.slice(-this.maxHistoryEntries);
    }

    // Log quota usage
    const usagePercentage = ((entry.totalUsage / (entry.totalUsage + entry.remainingQuota)) * 100).toFixed(2);

    logger.info(
      `Quota used: ${entry.cost} units for ${entry.operation} (${usagePercentage}% of daily limit)`,
      'quota',
      {
        operation: entry.operation,
        cost: entry.cost,
        totalUsage: entry.totalUsage,
        remainingQuota: entry.remainingQuota,
        usagePercentage: Number(usagePercentage),
        success: entry.success,
        correlationId: entry.correlationId
      }
    );

    // Warn if quota is running low
    if (entry.remainingQuota < 1000) {
      logger.warn(
        `Low quota warning: Only ${entry.remainingQuota} units remaining`,
        'quota',
        {
          remainingQuota: entry.remainingQuota,
          totalUsage: entry.totalUsage,
          correlationId: entry.correlationId
        }
      );
    }

    // Error if quota is critically low
    if (entry.remainingQuota < 100) {
      logger.error(
        `Critical quota warning: Only ${entry.remainingQuota} units remaining`,
        'quota',
        undefined,
        {
          remainingQuota: entry.remainingQuota,
          totalUsage: entry.totalUsage,
          correlationId: entry.correlationId
        }
      );
    }
  }

  /**
   * Record a rate limit event
   */
  recordRateLimit(event: Omit<RateLimitEvent, 'timestamp'>): void {
    const rateLimitEntry: RateLimitEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };

    this.rateLimitEvents.push(rateLimitEntry);

    // Keep rate limit history manageable
    if (this.rateLimitEvents.length > this.maxRateLimitEntries) {
      this.rateLimitEvents = this.rateLimitEvents.slice(-this.maxRateLimitEntries);
    }

    // Log rate limit event
    logger.warn(
      `Rate limit encountered for ${event.operation}${event.retryAfter ? `, retry after ${event.retryAfter}s` : ''}`,
      'quota',
      {
        operation: event.operation,
        retryAfter: event.retryAfter,
        correlationId: event.correlationId
      }
    );
  }

  /**
   * Get quota usage statistics
   */
  getQuotaStatistics(since?: Date): {
    totalOperations: number;
    totalQuotaUsed: number;
    operationBreakdown: Record<OperationType, { count: number; totalCost: number }>;
    averageUsagePerHour: number;
    rateLimitCount: number;
  } {
    const sinceMs = since ? since.getTime() : 0;
    const relevantEntries = this.quotaHistory.filter(
      entry => new Date(entry.timestamp).getTime() >= sinceMs
    );

    const relevantRateLimits = this.rateLimitEvents.filter(
      event => new Date(event.timestamp).getTime() >= sinceMs
    );

    const totalOperations = relevantEntries.length;
    const totalQuotaUsed = relevantEntries.reduce((sum, entry) => sum + entry.cost, 0);

    const operationBreakdown = relevantEntries.reduce((breakdown, entry) => {
      if (!breakdown[entry.operation]) {
        breakdown[entry.operation] = { count: 0, totalCost: 0 };
      }
      breakdown[entry.operation].count++;
      breakdown[entry.operation].totalCost += entry.cost;
      return breakdown;
    }, {} as Record<OperationType, { count: number; totalCost: number }>);

    // Calculate average usage per hour
    const timeSpanMs = since
      ? Date.now() - since.getTime()
      : (relevantEntries.length > 0
        ? Date.now() - new Date(relevantEntries[0].timestamp).getTime()
        : 0);
    const timeSpanHours = timeSpanMs / (1000 * 60 * 60);
    const averageUsagePerHour = timeSpanHours > 0 ? totalQuotaUsed / timeSpanHours : 0;

    return {
      totalOperations,
      totalQuotaUsed,
      operationBreakdown,
      averageUsagePerHour,
      rateLimitCount: relevantRateLimits.length
    };
  }

  /**
   * Get recent quota usage entries
   */
  getQuotaHistory(since?: Date): QuotaUsageEntry[] {
    if (!since) return [...this.quotaHistory];
    const sinceMs = since.getTime();
    return this.quotaHistory.filter(entry => new Date(entry.timestamp).getTime() >= sinceMs);
  }

  /**
   * Get recent rate limit events
   */
  getRateLimitEvents(since?: Date): RateLimitEvent[] {
    if (!since) return [...this.rateLimitEvents];
    const sinceMs = since.getTime();
    return this.rateLimitEvents.filter(event => new Date(event.timestamp).getTime() >= sinceMs);
  }

  /**
   * Export quota monitoring data
   */
  exportQuotaData(): {
    exportedAt: string;
    quotaHistory: QuotaUsageEntry[];
    rateLimitEvents: RateLimitEvent[];
    statistics: ReturnType<typeof this.getQuotaStatistics>;
  } {
    return {
      exportedAt: new Date().toISOString(),
      quotaHistory: this.quotaHistory,
      rateLimitEvents: this.rateLimitEvents,
      statistics: this.getQuotaStatistics()
    };
  }
}

export const quotaMonitor = new QuotaMonitor();