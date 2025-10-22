import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryCache, CacheKeys } from '../../src/cache/cache.js';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache(10); // Small cache for testing
  });

  it('should store and retrieve data', () => {
    cache.set('test-key', { data: 'test-value' }, 1000);
    const result = cache.get('test-key');
    
    expect(result).toEqual({ data: 'test-value' });
  });

  it('should return null for non-existent keys', () => {
    const result = cache.get('non-existent');
    expect(result).toBeNull();
  });

  it('should return null for expired entries', async () => {
    cache.set('expired-key', { data: 'test' }, 100); // 100ms TTL
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const result = cache.get('expired-key');
    expect(result).toBeNull();
  });

  it('should not return expired entries', async () => {
    cache.set('key1', { data: 'value1' }, 50);
    cache.set('key2', { data: 'value2' }, 200);
    
    // Wait for first key to expire
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toEqual({ data: 'value2' });
  });

  it('should respect max size limit', () => {
    const smallCache = new MemoryCache(2);
    
    smallCache.set('key1', 'value1', 1000);
    smallCache.set('key2', 'value2', 1000);
    smallCache.set('key3', 'value3', 1000); // Should evict key1
    
    expect(smallCache.get('key1')).toBeNull();
    expect(smallCache.get('key2')).toBe('value2');
    expect(smallCache.get('key3')).toBe('value3');
  });

  it('should delete specific entries', () => {
    cache.set('key1', 'value1', 1000);
    cache.set('key2', 'value2', 1000);
    
    expect(cache.delete('key1')).toBe(true);
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBe('value2');
  });

  it('should clear all entries', () => {
    cache.set('key1', 'value1', 1000);
    cache.set('key2', 'value2', 1000);
    
    cache.clear();
    
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
  });

  it('should provide cache statistics', () => {
    cache.set('key1', 'value1', 1000);
    cache.set('key2', 'value2', 1000);
    
    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.maxSize).toBe(10);
  });

  it('should clean up expired entries', async () => {
    cache.set('key1', 'value1', 50);
    cache.set('key2', 'value2', 200);
    
    // Wait for first key to expire
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const cleaned = cache.cleanup();
    expect(cleaned).toBe(1);
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBe('value2');
  });
});

describe('CacheKeys', () => {
  it('should generate PR metadata keys', () => {
    const key = CacheKeys.prMetadata('owner', 'repo', 123);
    expect(key).toBe('pr:owner/repo#123');
  });

  it('should generate check runs keys', () => {
    const key = CacheKeys.checkRuns('owner', 'repo', 'abc123');
    expect(key).toBe('checks:owner/repo@abc123');
  });

  it('should generate PR comments keys', () => {
    const key = CacheKeys.prComments('owner', 'repo', 123);
    expect(key).toBe('comments:owner/repo#123');
  });

  it('should generate compare commits keys', () => {
    const key = CacheKeys.compareCommits('owner', 'repo', 'main', 'feature');
    expect(key).toBe('compare:owner/repo:main..feature');
  });
});
