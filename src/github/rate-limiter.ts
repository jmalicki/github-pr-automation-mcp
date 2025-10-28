/**
 * GitHub API rate limiting and backoff
 *
 * Implements exponential backoff and request queuing to respect
 * GitHub's rate limits and avoid 429 errors.
 */

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  used: number;
}

export interface QueuedRequest {
  id: string;
  fn: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  priority: "high" | "normal" | "low";
  timestamp: number;
}

/**
 * GitHub API rate limiter with exponential backoff
 *
 * Manages request queuing and rate limiting to respect GitHub's
 * API limits and implement proper backoff strategies.
 */
export class RateLimiter {
  private queue: QueuedRequest[] = [];
  private isProcessing = false;
  private currentLimit: RateLimitInfo | null = null;
  private backoffUntil: number = 0;

  /**
   * Update rate limit info from GitHub API response headers
   */
  updateRateLimit(headers: Record<string, string>): void {
    const limit = headers["x-ratelimit-limit"];
    const remaining = headers["x-ratelimit-remaining"];
    const reset = headers["x-ratelimit-reset"];
    const used = headers["x-ratelimit-used"];

    if (limit && remaining && reset && used) {
      this.currentLimit = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
        used: parseInt(used, 10),
      };
    }
  }

  /**
   * Check if we can make a request now
   * @returns true if request can be made immediately, false otherwise
   */
  canMakeRequest(): boolean {
    const now = Date.now() / 1000;

    // Check if we're in backoff period
    if (now < this.backoffUntil) {
      return false;
    }

    // Check rate limit
    if (this.currentLimit) {
      const timeUntilReset = this.currentLimit.reset - now;
      const requestsPerSecond =
        this.currentLimit.remaining / Math.max(timeUntilReset, 1);

      // If we have less than 1 request per second available, wait
      if (requestsPerSecond < 1) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate backoff delay based on remaining requests
   * @returns Backoff delay in milliseconds
   */
  private calculateBackoff(): number {
    if (!this.currentLimit) {
      return 1000; // Default 1 second
    }

    const now = Date.now() / 1000;
    const timeUntilReset = this.currentLimit.reset - now;

    if (this.currentLimit.remaining === 0) {
      // No requests left, wait until reset
      return Math.max(timeUntilReset * 1000, 1000);
    }

    // Exponential backoff based on how close we are to the limit
    const usageRatio = this.currentLimit.used / this.currentLimit.limit;
    const baseDelay = 1000;
    const maxDelay = 30000; // 30 seconds max

    return Math.min(baseDelay * Math.pow(2, usageRatio * 5), maxDelay);
  }

  /**
   * Queue a request for execution
   */
  async queueRequest<T>(
    fn: () => Promise<T>,
    priority: "high" | "normal" | "low" = "normal",
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: Math.random().toString(36).substring(2, 11),
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject: reject as (error: Error) => void,
        priority,
        timestamp: Date.now(),
      };

      // Insert based on priority
      const insertIndex = this.findInsertIndex(request);
      this.queue.splice(insertIndex, 0, request);

      // Start processing if not already running
      if (!this.isProcessing) {
        void this.processQueue();
      }
    });
  }

  /**
   * Find the correct position to insert request based on priority
   * @param request - Request to find insertion point for
   * @returns Index where request should be inserted
   */
  private findInsertIndex(request: QueuedRequest): number {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    const requestPriority = priorityOrder[request.priority];

    for (let i = 0; i < this.queue.length; i++) {
      const existingPriority = priorityOrder[this.queue[i].priority];
      if (requestPriority < existingPriority) {
        return i;
      }
    }

    return this.queue.length;
  }

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      // Wait if we can't make requests
      if (!this.canMakeRequest()) {
        const delay = this.calculateBackoff();
        await this.sleep(delay);
        continue;
      }

      const request = this.queue.shift();
      if (!request) {
        break;
      }

      try {
        const result = await request.fn();
        request.resolve(result);
      } catch (error) {
        request.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      }

      // Small delay between requests to be respectful
      await this.sleep(100);
    }

    this.isProcessing = false;
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after the specified time
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current queue status
   * @returns Object containing queue length and priority distribution
   */
  getQueueStatus(): { length: number; priorities: Record<string, number> } {
    const priorities = this.queue.reduce(
      (acc, req) => {
        acc[req.priority] = (acc[req.priority] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      length: this.queue.length,
      priorities,
    };
  }

  /**
   * Clear all queued requests
   */
  clearQueue(): void {
    this.queue.forEach((request) => {
      request.reject(new Error("Queue cleared"));
    });
    this.queue = [];
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();
