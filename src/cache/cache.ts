/**
 * In-memory cache with TTL for GitHub API responses
 *
 * This cache helps reduce API calls and improve performance by storing
 * frequently accessed data like PR metadata and check runs.
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

/**
 * In-memory cache implementation with TTL support
 *
 * Provides efficient caching for GitHub API responses with automatic
 * expiration based on configurable TTL values.
 */
export class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly maxSize: number;

  /**
   * Create a new memory cache instance
   * @param maxSize - Maximum number of entries to store (default: 1000)
   */
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Get cached data if not expired
   * @param key - Cache key to retrieve
   * @returns Cached data or null if not found/expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached data with TTL
   * @param key - Cache key to store under
   * @param data - Data to cache
   * @param ttlMs - Time to live in milliseconds
   * @returns void
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  /**
   * Delete specific cache entry
   * @param key - Cache key to delete
   * @returns true if entry was deleted, false if not found
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   * @returns void
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns Object containing cache size and max size
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Clean up expired entries
   * @returns Number of entries cleaned up
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Global cache instance
export const cache = new MemoryCache();

// Cache key generators
export const CacheKeys = {
  prMetadata: (owner: string, repo: string, number: number) =>
    `pr:${owner}/${repo}#${number}`,

  checkRuns: (owner: string, repo: string, sha: string) =>
    `checks:${owner}/${repo}@${sha}`,

  prComments: (owner: string, repo: string, number: number) =>
    `comments:${owner}/${repo}#${number}`,

  compareCommits: (owner: string, repo: string, base: string, head: string) =>
    `compare:${owner}/${repo}:${base}..${head}`,
} as const;
