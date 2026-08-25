/**
 * Rate Limiter
 * ============
 * Controlled concurrency and rate limiting for API calls.
 *
 * Features:
 * - Configurable concurrency limit
 * - Exponential backoff for transient failures
 * - Request queuing
 */

/**
 * Rate limiter configuration.
 */
export interface RateLimiterConfig {
  /** Maximum concurrent requests */
  concurrency: number;
  /** Base delay between requests in ms (for rate limiting) */
  baseDelayMs?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Initial backoff delay in ms */
  initialBackoffMs?: number;
  /** Maximum backoff delay in ms */
  maxBackoffMs?: number;
}

/**
 * Controlled concurrency rate limiter.
 *
 * Usage:
 * ```typescript
 * const limiter = new RateLimiter({ concurrency: 3 });
 * const result = await limiter.run(() => callAPI());
 * ```
 */
export class RateLimiter {
  private concurrency: number;
  private baseDelayMs: number;
  private maxRetries: number;
  private initialBackoffMs: number;
  private maxBackoffMs: number;
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(config: RateLimiterConfig) {
    this.concurrency = config.concurrency;
    this.baseDelayMs = config.baseDelayMs ?? 100;
    this.maxRetries = config.maxRetries ?? 3;
    this.initialBackoffMs = config.initialBackoffMs ?? 1000;
    this.maxBackoffMs = config.maxBackoffMs ?? 30000;
  }

  /**
   * Acquire a concurrency slot.
   */
  private async acquire(): Promise<void> {
    if (this.running < this.concurrency) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  /**
   * Release a concurrency slot.
   */
  private release(): void {
    this.running--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run a function with rate limiting and retry logic.
   *
   * @param fn - The async function to execute
   * @param isRetryable - Optional function to determine if an error is retryable
   * @returns The result of the function
   * @throws The last error if all retries fail
   */
  async run<T>(
    fn: () => Promise<T>,
    isRetryable?: (error: Error) => boolean
  ): Promise<T> {
    await this.acquire();

    let lastError: Error | null = null;

    try {
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          // Add small delay between requests to avoid bursting
          if (attempt === 0 && this.baseDelayMs > 0) {
            await this.sleep(this.baseDelayMs);
          }

          return await fn();
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          // Check if error is retryable
          if (isRetryable && !isRetryable(lastError)) {
            throw lastError;
          }

          // Don't retry on last attempt
          if (attempt >= this.maxRetries) {
            break;
          }

          // Exponential backoff with jitter
          const backoff = Math.min(
            this.initialBackoffMs * Math.pow(2, attempt) + Math.random() * 1000,
            this.maxBackoffMs
          );
          await this.sleep(backoff);
        }
      }

      throw lastError ?? new Error("Unknown error after retries");
    } finally {
      this.release();
    }
  }

  /**
   * Check if a rate limit error should be retried.
   */
  static isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Retry on these error patterns
    const retryablePatterns = [
      "rate limit",
      "rate_limit",
      "429",
      "503",
      "502",
      "timeout",
      "econnreset",
      "econnrefused",
      "network",
    ];

    return retryablePatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Get current queue status.
   */
  status(): { running: number; queued: number; concurrency: number } {
    return {
      running: this.running,
      queued: this.queue.length,
      concurrency: this.concurrency,
    };
  }
}
