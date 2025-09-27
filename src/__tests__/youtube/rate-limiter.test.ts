import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter, type RateLimiterOptions } from '../../youtube/rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const rateLimiter = new RateLimiter();
      expect(rateLimiter).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const options: RateLimiterOptions = {
        maxRequestsPerMinute: 30,
        retryAttempts: 5,
        baseDelayMs: 1000,
      };
      const rateLimiter = new RateLimiter(options);
      expect(rateLimiter).toBeDefined();
    });

    it('should handle partial options', () => {
      const options: RateLimiterOptions = {
        maxRequestsPerMinute: 10,
      };
      const rateLimiter = new RateLimiter(options);
      expect(rateLimiter).toBeDefined();
    });
  });

  describe('rate limiting', () => {
    it('should execute single operation immediately', async () => {
      const rateLimiter = new RateLimiter({ maxRequestsPerMinute: 60 });
      const mockOperation = vi.fn().mockResolvedValue('success');

      const promise = rateLimiter.run(mockOperation);

      // Should execute immediately
      await vi.runOnlyPendingTimersAsync();

      const result = await promise;
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should delay subsequent operations based on rate limit', async () => {
      const rateLimiter = new RateLimiter({ maxRequestsPerMinute: 60 }); // 1 per second
      const mockOperation1 = vi.fn().mockResolvedValue('result1');
      const mockOperation2 = vi.fn().mockResolvedValue('result2');

      // Start first operation
      const promise1 = rateLimiter.run(mockOperation1);
      await vi.runOnlyPendingTimersAsync();
      const result1 = await promise1;

      // Start second operation immediately
      const promise2 = rateLimiter.run(mockOperation2);

      // Second operation should be delayed
      expect(mockOperation2).not.toHaveBeenCalled();

      // Advance time by 1 second (rate limit interval)
      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();

      const result2 = await promise2;
      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(mockOperation2).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple queued operations', async () => {
      const rateLimiter = new RateLimiter({ maxRequestsPerMinute: 30 }); // 2 second intervals
      const operations = Array.from({ length: 3 }, (_, i) =>
        vi.fn().mockResolvedValue(`result${i + 1}`)
      );

      // Queue all operations
      const promises = operations.map(op => rateLimiter.run(op));

      // First operation should execute immediately
      await vi.runOnlyPendingTimersAsync();
      expect(operations[0]).toHaveBeenCalledTimes(1);
      expect(operations[1]).not.toHaveBeenCalled();
      expect(operations[2]).not.toHaveBeenCalled();

      // Advance to execute second operation
      vi.advanceTimersByTime(2000);
      await vi.runOnlyPendingTimersAsync();
      expect(operations[1]).toHaveBeenCalledTimes(1);
      expect(operations[2]).not.toHaveBeenCalled();

      // Advance to execute third operation
      vi.advanceTimersByTime(2000);
      await vi.runOnlyPendingTimersAsync();
      expect(operations[2]).toHaveBeenCalledTimes(1);

      const results = await Promise.all(promises);
      expect(results).toEqual(['result1', 'result2', 'result3']);
    });

    it('should calculate correct intervals for different rate limits', async () => {
      const rateLimiter = new RateLimiter({ maxRequestsPerMinute: 120 }); // 0.5 second intervals
      const operation1 = vi.fn().mockResolvedValue('result1');
      const operation2 = vi.fn().mockResolvedValue('result2');

      const promise1 = rateLimiter.run(operation1);
      await vi.runOnlyPendingTimersAsync();
      await promise1;

      const promise2 = rateLimiter.run(operation2);

      // Should need 500ms delay (60000ms / 120 requests = 500ms)
      vi.advanceTimersByTime(499);
      await vi.runOnlyPendingTimersAsync();
      expect(operation2).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      await vi.runOnlyPendingTimersAsync();

      await promise2;
      expect(operation2).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry mechanism', () => {
    it('should retry on retryable errors', async () => {
      const rateLimiter = new RateLimiter({
        retryAttempts: 2,
        baseDelayMs: 100,
      });

      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Rate limited'))
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValue('success');

      // Mock retryable errors
      mockOperation.mockImplementation(() => {
        const error = new Error('Retryable error');
        (error as any).code = 429; // Rate limited
        if (mockOperation.mock.calls.length <= 2) {
          return Promise.reject(error);
        }
        return Promise.resolve('success');
      });

      const promise = rateLimiter.run(mockOperation);

      // Execute initial operation
      await vi.runOnlyPendingTimersAsync();

      // First retry after 100ms
      vi.advanceTimersByTime(100);
      await vi.runOnlyPendingTimersAsync();

      // Second retry after 200ms (exponential backoff)
      vi.advanceTimersByTime(200);
      await vi.runOnlyPendingTimersAsync();

      const result = await promise;
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff for retries', async () => {
      const rateLimiter = new RateLimiter({
        retryAttempts: 3,
        baseDelayMs: 100,
      });

      let callCount = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          const error = new Error('Server error');
          (error as any).code = 500;
          return Promise.reject(error);
        }
        return Promise.resolve('success');
      });

      const promise = rateLimiter.run(mockOperation);

      // Initial execution
      await vi.runOnlyPendingTimersAsync();

      // First retry: 100ms delay
      expect(mockOperation).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(100);
      await vi.runOnlyPendingTimersAsync();

      // Second retry: 200ms delay (100 * 2^1)
      expect(mockOperation).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(200);
      await vi.runOnlyPendingTimersAsync();

      const result = await promise;
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const rateLimiter = new RateLimiter({
        retryAttempts: 3,
        baseDelayMs: 100,
      });

      const mockOperation = vi.fn().mockImplementation(() => {
        const error = new Error('Bad request');
        (error as any).code = 400; // Non-retryable
        return Promise.reject(error);
      });

      await vi.runOnlyPendingTimersAsync();

      await expect(rateLimiter.run(mockOperation)).rejects.toThrow('Bad request');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retry attempts', async () => {
      const rateLimiter = new RateLimiter({
        retryAttempts: 2,
        baseDelayMs: 100,
      });

      const mockOperation = vi.fn().mockImplementation(() => {
        const error = new Error('Server error');
        (error as any).code = 500;
        return Promise.reject(error);
      });

      const promise = rateLimiter.run(mockOperation);

      // Initial execution
      await vi.runOnlyPendingTimersAsync();

      // First retry
      vi.advanceTimersByTime(100);
      await vi.runOnlyPendingTimersAsync();

      // Second retry
      vi.advanceTimersByTime(200);
      await vi.runOnlyPendingTimersAsync();

      await expect(promise).rejects.toThrow('Server error');
      expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should identify retryable errors correctly', async () => {
      const rateLimiter = new RateLimiter({ retryAttempts: 1 });

      const retryableCodes = [429, 500, 502, 503, 504];
      const nonRetryableCodes = [400, 401, 403, 404];

      for (const code of retryableCodes) {
        const mockOperation = vi.fn().mockImplementation(() => {
          const error = new Error(`Error ${code}`);
          (error as any).code = code;
          return Promise.reject(error);
        });

        await vi.runOnlyPendingTimersAsync();
        const promise = rateLimiter.run(mockOperation);

        await vi.runOnlyPendingTimersAsync();
        vi.advanceTimersByTime(500); // Wait for retry
        await vi.runOnlyPendingTimersAsync();

        await expect(promise).rejects.toThrow();
        expect(mockOperation).toHaveBeenCalledTimes(2); // Initial + 1 retry
      }

      for (const code of nonRetryableCodes) {
        const mockOperation = vi.fn().mockImplementation(() => {
          const error = new Error(`Error ${code}`);
          (error as any).code = code;
          return Promise.reject(error);
        });

        await vi.runOnlyPendingTimersAsync();
        await expect(rateLimiter.run(mockOperation)).rejects.toThrow();
        expect(mockOperation).toHaveBeenCalledTimes(1); // No retry
      }
    });
  });

  describe('error handling', () => {
    it('should handle synchronous errors', async () => {
      const rateLimiter = new RateLimiter();
      const mockOperation = vi.fn().mockImplementation(() => {
        throw new Error('Synchronous error');
      });

      await vi.runOnlyPendingTimersAsync();
      await expect(rateLimiter.run(mockOperation)).rejects.toThrow('Synchronous error');
    });

    it('should handle errors without status codes', async () => {
      const rateLimiter = new RateLimiter({ retryAttempts: 1 });
      const mockOperation = vi.fn().mockRejectedValue(new Error('Generic error'));

      await vi.runOnlyPendingTimersAsync();
      await expect(rateLimiter.run(mockOperation)).rejects.toThrow('Generic error');
      expect(mockOperation).toHaveBeenCalledTimes(1); // Should not retry
    });

    it('should handle errors with different error structures', async () => {
      const rateLimiter = new RateLimiter({ retryAttempts: 1 });

      // Error with status property
      const mockOperation1 = vi.fn().mockImplementation(() => {
        const error = new Error('Error with status');
        (error as any).status = 500;
        return Promise.reject(error);
      });

      // Error with response.status property
      const mockOperation2 = vi.fn().mockImplementation(() => {
        const error = new Error('Error with response status');
        (error as any).response = { status: 502 };
        return Promise.reject(error);
      });

      // Both should be retryable
      for (const operation of [mockOperation1, mockOperation2]) {
        await vi.runOnlyPendingTimersAsync();
        const promise = rateLimiter.run(operation);

        await vi.runOnlyPendingTimersAsync();
        vi.advanceTimersByTime(500);
        await vi.runOnlyPendingTimersAsync();

        await expect(promise).rejects.toThrow();
        expect(operation).toHaveBeenCalledTimes(2); // Initial + 1 retry
      }
    });
  });

  describe('concurrent operations', () => {
    it('should process operations sequentially', async () => {
      const rateLimiter = new RateLimiter({ maxRequestsPerMinute: 60 });
      const executionOrder: number[] = [];

      const createOperation = (id: number) => vi.fn().mockImplementation(async () => {
        executionOrder.push(id);
        return `result${id}`;
      });

      const operations = [1, 2, 3].map(createOperation);
      const promises = operations.map(op => rateLimiter.run(op));

      // Execute all operations with proper timing
      await vi.runOnlyPendingTimersAsync();
      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();
      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();

      await Promise.all(promises);
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('should handle multiple rate limiters independently', async () => {
      const rateLimiter1 = new RateLimiter({ maxRequestsPerMinute: 60 });
      const rateLimiter2 = new RateLimiter({ maxRequestsPerMinute: 120 });

      const operation1 = vi.fn().mockResolvedValue('result1');
      const operation2 = vi.fn().mockResolvedValue('result2');

      const promise1 = rateLimiter1.run(operation1);
      const promise2 = rateLimiter2.run(operation2);

      await vi.runOnlyPendingTimersAsync();

      // Both should execute immediately (first operation in each limiter)
      const results = await Promise.all([promise1, promise2]);
      expect(results).toEqual(['result1', 'result2']);
      expect(operation1).toHaveBeenCalledTimes(1);
      expect(operation2).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should handle zero retry attempts', async () => {
      const rateLimiter = new RateLimiter({ retryAttempts: 0 });
      const mockOperation = vi.fn().mockImplementation(() => {
        const error = new Error('Server error');
        (error as any).code = 500;
        return Promise.reject(error);
      });

      await vi.runOnlyPendingTimersAsync();
      await expect(rateLimiter.run(mockOperation)).rejects.toThrow('Server error');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should handle very high rate limits', async () => {
      const rateLimiter = new RateLimiter({ maxRequestsPerMinute: 6000 }); // 100ms intervals
      const operation1 = vi.fn().mockResolvedValue('result1');
      const operation2 = vi.fn().mockResolvedValue('result2');

      const promise1 = rateLimiter.run(operation1);
      await vi.runOnlyPendingTimersAsync();
      await promise1;

      const promise2 = rateLimiter.run(operation2);
      vi.advanceTimersByTime(10); // 10ms (less than 100ms interval)
      await vi.runOnlyPendingTimersAsync();
      expect(operation2).not.toHaveBeenCalled();

      vi.advanceTimersByTime(90); // Complete the 100ms interval
      await vi.runOnlyPendingTimersAsync();
      await promise2;
      expect(operation2).toHaveBeenCalledTimes(1);
    });

    it('should handle operations that resolve immediately', async () => {
      const rateLimiter = new RateLimiter();
      const mockOperation = vi.fn().mockResolvedValue('immediate');

      await vi.runOnlyPendingTimersAsync();
      const result = await rateLimiter.run(mockOperation);
      expect(result).toBe('immediate');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });
});