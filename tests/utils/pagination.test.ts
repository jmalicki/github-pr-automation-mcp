import { describe, it, expect } from 'vitest';
import { paginateResults, encodeCursor, decodeCursor } from '../../src/utils/pagination.js';

/**
 * Tests for MCP-compliant cursor-based pagination
 * Reference: https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/pagination
 */
describe('Cursor pagination', () => {
  describe('encodeCursor / decodeCursor', () => {
    it('should encode and decode cursor correctly', () => {
      const cursor = encodeCursor(20, 10);
      const decoded = decodeCursor(cursor);
      
      expect(decoded.offset).toBe(20);
      expect(decoded.pageSize).toBe(10);
    });
    
    it('should produce opaque base64 cursor', () => {
      const cursor = encodeCursor(0, 10);
      
      // Should be base64
      expect(cursor).toMatch(/^[A-Za-z0-9+/]+=*$/);
      
      // Should be opaque (not obvious what it contains)
      expect(cursor).not.toContain('offset');
      expect(cursor).not.toContain('page');
    });
    
    it('should throw error for invalid cursor', () => {
      expect(() => decodeCursor('invalid-base64!@#')).toThrow('Invalid cursor');
    });
    
    it('should throw error for malformed cursor data', () => {
      const badCursor = Buffer.from('{"offset": -1}').toString('base64');
      expect(() => decodeCursor(badCursor)).toThrow('Invalid cursor');
    });
  });
  
  describe('paginateResults', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    
    it('should return first page when no cursor provided', () => {
      const result = paginateResults(items, undefined, 3);
      
      expect(result.items).toEqual(['a', 'b', 'c']);
      expect(result.nextCursor).toBeDefined(); // More results exist
    });
    
    it('should return next page using cursor', () => {
      // Get first page
      const page1 = paginateResults(items, undefined, 3);
      expect(page1.items).toEqual(['a', 'b', 'c']);
      
      // Get second page using nextCursor
      const page2 = paginateResults(items, page1.nextCursor, 3);
      expect(page2.items).toEqual(['d', 'e', 'f']);
      expect(page2.nextCursor).toBeDefined();
    });
    
    it('should not include nextCursor on last page', () => {
      // Navigate to last page
      const page1 = paginateResults(items, undefined, 3);
      const page2 = paginateResults(items, page1.nextCursor, 3);
      const page3 = paginateResults(items, page2.nextCursor, 3);
      const page4 = paginateResults(items, page3.nextCursor, 3);
      
      expect(page4.items).toEqual(['j']); // Last item
      expect(page4.nextCursor).toBeUndefined(); // No more results
    });
    
    it('should handle empty arrays', () => {
      const result = paginateResults([], undefined, 10);
      
      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });
    
    it('should handle items count less than page size', () => {
      const result = paginateResults(['a', 'b'], undefined, 10);
      
      expect(result.items).toEqual(['a', 'b']);
      expect(result.nextCursor).toBeUndefined(); // No more results
    });
    
    it('should handle exact page boundary', () => {
      const items3 = ['a', 'b', 'c'];
      const result = paginateResults(items3, undefined, 3);
      
      expect(result.items).toEqual(['a', 'b', 'c']);
      expect(result.nextCursor).toBeUndefined(); // Exactly one page
    });
    
    it('should throw error for invalid page size', () => {
      expect(() => paginateResults(items, undefined, 0)).toThrow('pageSize must be');
      expect(() => paginateResults(items, undefined, -1)).toThrow('pageSize must be');
      expect(() => paginateResults(items, undefined, Infinity)).toThrow('pageSize must be');
    });
    
    it('should respect page size from cursor', () => {
      // First page with size 5
      const page1 = paginateResults(items, undefined, 5);
      expect(page1.items).toEqual(['a', 'b', 'c', 'd', 'e']);
      
      // Second page should use same size (5) from cursor
      const page2 = paginateResults(items, page1.nextCursor, 10); // Different default
      expect(page2.items).toEqual(['f', 'g', 'h', 'i', 'j']); // Still 5 items
    });
  });
});
