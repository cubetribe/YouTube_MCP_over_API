export interface RateLimiterOptions {
  maxRequestsPerMinute?: number;
  retryAttempts?: number;
  baseDelayMs?: number;
}

export class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private active = 0;
  private lastTimestamp = 0;
  private maxPerMinute: number;
  private retryAttempts: number;
  private baseDelay: number;

  constructor(options: RateLimiterOptions = {}) {
    this.maxPerMinute = options.maxRequestsPerMinute ?? 50;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.baseDelay = options.baseDelayMs ?? 500;
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithRetry(operation);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      void this.next();
    });
  }

  private async next(): Promise<void> {
    if (this.active > 0) return;
    const task = this.queue.shift();
    if (!task) return;
    const now = Date.now();
    const interval = 60_000 / this.maxPerMinute;
    const wait = Math.max(0, interval - (now - this.lastTimestamp));
    this.active++;
    setTimeout(async () => {
      try {
        await task();
      } finally {
        this.lastTimestamp = Date.now();
        this.active--;
        void this.next();
      }
    }, wait);
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await operation();
      } catch (error: any) {
        if (attempt >= this.retryAttempts || !this.isRetryable(error)) {
          throw error;
        }
        const delay = this.baseDelay * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        attempt++;
      }
    }
  }

  private isRetryable(error: any): boolean {
    const status = error?.code || error?.status || error?.response?.status;
    return status === 429 || (status >= 500 && status <= 599);
  }
}
