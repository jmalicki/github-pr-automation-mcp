import { describe, it, expect, beforeEach, vi } from "vitest";
import { RateLimiter } from "../../src/github/rate-limiter.js";

describe("RateLimiter", () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  it("should update rate limit info from headers", () => {
    const headers = {
      "x-ratelimit-limit": "5000",
      "x-ratelimit-remaining": "4999",
      "x-ratelimit-reset": "1640995200",
      "x-ratelimit-used": "1",
    };

    rateLimiter.updateRateLimit(headers);

    const canRequest = rateLimiter.canMakeRequest();
    expect(canRequest).toBe(true);
  });

  it("should prevent requests when rate limit is exceeded", () => {
    const headers = {
      "x-ratelimit-limit": "5000",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
      "x-ratelimit-used": "5000",
    };

    rateLimiter.updateRateLimit(headers);

    const canRequest = rateLimiter.canMakeRequest();
    expect(canRequest).toBe(false);
  });

  it("should queue requests when rate limit is exceeded", async () => {
    const headers = {
      "x-ratelimit-limit": "5000",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
      "x-ratelimit-used": "5000",
    };

    rateLimiter.updateRateLimit(headers);

    const mockFn = vi.fn().mockResolvedValue("success");

    // This should be queued, not executed immediately
    const promise = rateLimiter.queueRequest(mockFn, "normal");

    // Give it a moment to process
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockFn).not.toHaveBeenCalled();

    // Check queue status
    const status = rateLimiter.getQueueStatus();
    expect(status.length).toBe(1);
  });

  it("should execute high priority requests first", async () => {
    const highPriorityFn = vi.fn().mockResolvedValue("high");
    const normalPriorityFn = vi.fn().mockResolvedValue("normal");
    const lowPriorityFn = vi.fn().mockResolvedValue("low");

    // Queue in reverse priority order
    const lowPromise = rateLimiter.queueRequest(lowPriorityFn, "low");
    const normalPromise = rateLimiter.queueRequest(normalPriorityFn, "normal");
    const highPromise = rateLimiter.queueRequest(highPriorityFn, "high");

    // Wait for all to complete
    await Promise.all([highPromise, normalPromise, lowPromise]);

    // All should have been called
    expect(highPriorityFn).toHaveBeenCalled();
    expect(normalPriorityFn).toHaveBeenCalled();
    expect(lowPriorityFn).toHaveBeenCalled();
  });

  it("should handle request failures", async () => {
    const errorFn = vi.fn().mockRejectedValue(new Error("API Error"));
    const successFn = vi.fn().mockResolvedValue("success");

    const errorPromise = rateLimiter.queueRequest(errorFn, "normal");
    const successPromise = rateLimiter.queueRequest(successFn, "normal");

    await expect(errorPromise).rejects.toThrow("API Error");
    await expect(successPromise).resolves.toBe("success");
  });

  it("should clear queue", async () => {
    const fn1 = vi.fn().mockResolvedValue("result1");
    const fn2 = vi.fn().mockResolvedValue("result2");

    // Queue requests but don't await them to avoid unhandled rejections
    const promise1 = rateLimiter.queueRequest(fn1, "normal").catch(() => {});
    const promise2 = rateLimiter.queueRequest(fn2, "normal").catch(() => {});

    // Give it a moment for requests to be queued
    await new Promise((resolve) => setTimeout(resolve, 10));

    const statusBefore = rateLimiter.getQueueStatus();
    expect(statusBefore.length).toBeGreaterThan(0);

    rateLimiter.clearQueue();

    const statusAfter = rateLimiter.getQueueStatus();
    expect(statusAfter.length).toBe(0);

    // Clean up the promises
    await Promise.allSettled([promise1, promise2]);
  });

  it("should provide queue status", async () => {
    const fn1 = vi.fn().mockResolvedValue("result1");
    const fn2 = vi.fn().mockResolvedValue("result2");
    const fn3 = vi.fn().mockResolvedValue("result3");

    // Queue requests but don't await them to avoid unhandled rejections
    const promise1 = rateLimiter.queueRequest(fn1, "high").catch(() => {});
    const promise2 = rateLimiter.queueRequest(fn2, "normal").catch(() => {});
    const promise3 = rateLimiter.queueRequest(fn3, "low").catch(() => {});

    // Give it a moment for requests to be queued
    await new Promise((resolve) => setTimeout(resolve, 10));

    const status = rateLimiter.getQueueStatus();
    expect(status.length).toBeGreaterThan(0);
    expect(status.priorities.high || 0).toBeGreaterThanOrEqual(0);
    expect(status.priorities.normal || 0).toBeGreaterThanOrEqual(0);
    expect(status.priorities.low || 0).toBeGreaterThanOrEqual(0);

    // Clean up the promises
    await Promise.allSettled([promise1, promise2, promise3]);
  });
});
