import { describe, it, expect } from 'vitest';
import { cursorToGitHubPagination, createNextCursor } from '../../src/utils/pagination.js';

describe('Server-side pagination utilities', () => {
  describe('cursorToGitHubPagination', () => {
    it('should convert undefined cursor to first page', () => {
      const result = cursorToGitHubPagination(undefined, 20);
      expect(result).toEqual({ page: 1, per_page: 20 });
    });

    it('should convert cursor with offset 0 to first page', () => {
      const cursor = Buffer.from(JSON.stringify({ offset: 0, pageSize: 20 })).toString('base64');
      const result = cursorToGitHubPagination(cursor, 20);
      expect(result).toEqual({ page: 1, per_page: 20 });
    });

    it('should convert cursor with offset 20 to second page', () => {
      const cursor = Buffer.from(JSON.stringify({ offset: 20, pageSize: 20 })).toString('base64');
      const result = cursorToGitHubPagination(cursor, 20);
      expect(result).toEqual({ page: 2, per_page: 20 });
    });

    it('should convert cursor with offset 40 to third page', () => {
      const cursor = Buffer.from(JSON.stringify({ offset: 40, pageSize: 20 })).toString('base64');
      const result = cursorToGitHubPagination(cursor, 20);
      expect(result).toEqual({ page: 3, per_page: 20 });
    });

    it('should clamp page size to server default', () => {
      const cursor = Buffer.from(JSON.stringify({ offset: 0, pageSize: 100 })).toString('base64');
      const result = cursorToGitHubPagination(cursor, 20);
      expect(result).toEqual({ page: 1, per_page: 20 });
    });

    it('should handle partial page sizes', () => {
      const cursor = Buffer.from(JSON.stringify({ offset: 0, pageSize: 15 })).toString('base64');
      const result = cursorToGitHubPagination(cursor, 20);
      expect(result).toEqual({ page: 1, per_page: 15 });
    });

    it('should throw error for invalid cursor', () => {
      expect(() => cursorToGitHubPagination('invalid-cursor', 20)).toThrow('Invalid cursor');
    });

    it('should throw error for negative offset', () => {
      const cursor = Buffer.from(JSON.stringify({ offset: -1, pageSize: 20 })).toString('base64');
      expect(() => cursorToGitHubPagination(cursor, 20)).toThrow('Invalid cursor');
    });

    it('should throw error for invalid page size', () => {
      const cursor = Buffer.from(JSON.stringify({ offset: 0, pageSize: 0 })).toString('base64');
      expect(() => cursorToGitHubPagination(cursor, 20)).toThrow('Invalid cursor');
    });
  });

  describe('createNextCursor', () => {
    it('should return undefined when hasMore is false', () => {
      const result = createNextCursor(undefined, 20, false);
      expect(result).toBeUndefined();
    });

    it('should create next cursor for first page', () => {
      const result = createNextCursor(undefined, 20, true);
      expect(result).toBeDefined();
      
      // Decode to verify content
      const decoded = JSON.parse(Buffer.from(result!, 'base64').toString('utf-8'));
      expect(decoded).toEqual({ offset: 20, pageSize: 20 });
    });

    it('should create next cursor for subsequent pages', () => {
      const currentCursor = Buffer.from(JSON.stringify({ offset: 20, pageSize: 20 })).toString('base64');
      const result = createNextCursor(currentCursor, 20, true);
      expect(result).toBeDefined();
      
      // Decode to verify content
      const decoded = JSON.parse(Buffer.from(result!, 'base64').toString('utf-8'));
      expect(decoded).toEqual({ offset: 40, pageSize: 20 });
    });

    it('should handle different page sizes', () => {
      const result = createNextCursor(undefined, 10, true);
      expect(result).toBeDefined();
      
      // Decode to verify content
      const decoded = JSON.parse(Buffer.from(result!, 'base64').toString('utf-8'));
      expect(decoded).toEqual({ offset: 10, pageSize: 10 });
    });
  });

  describe('integration scenarios', () => {
    it('should handle pagination flow correctly', () => {
      // First page
      const page1 = cursorToGitHubPagination(undefined, 20);
      expect(page1).toEqual({ page: 1, per_page: 20 });
      
      const nextCursor1 = createNextCursor(undefined, 20, true);
      expect(nextCursor1).toBeDefined();
      
      // Second page
      const page2 = cursorToGitHubPagination(nextCursor1, 20);
      expect(page2).toEqual({ page: 2, per_page: 20 });
      
      const nextCursor2 = createNextCursor(nextCursor1, 20, true);
      expect(nextCursor2).toBeDefined();
      
      // Third page
      const page3 = cursorToGitHubPagination(nextCursor2, 20);
      expect(page3).toEqual({ page: 3, per_page: 20 });
      
      // No more pages
      const nextCursor3 = createNextCursor(nextCursor2, 20, false);
      expect(nextCursor3).toBeUndefined();
    });

    it('should handle edge case with single item per page', () => {
      const page1 = cursorToGitHubPagination(undefined, 1);
      expect(page1).toEqual({ page: 1, per_page: 1 });
      
      const nextCursor1 = createNextCursor(undefined, 1, true);
      const page2 = cursorToGitHubPagination(nextCursor1, 1);
      expect(page2).toEqual({ page: 2, per_page: 1 });
    });

    it('should handle large page sizes', () => {
      const page1 = cursorToGitHubPagination(undefined, 100);
      expect(page1).toEqual({ page: 1, per_page: 100 });
      
      const nextCursor1 = createNextCursor(undefined, 100, true);
      const page2 = cursorToGitHubPagination(nextCursor1, 100);
      expect(page2).toEqual({ page: 2, per_page: 100 });
    });
  });
});
