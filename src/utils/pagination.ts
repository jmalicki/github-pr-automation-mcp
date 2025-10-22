import type { PaginatedResult } from '../types/index.js';

/**
 * MCP-compliant cursor-based pagination
 * Reference: https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/pagination
 * 
 * Cursors are opaque base64-encoded strings containing offset and page size.
 * Clients MUST NOT parse or modify cursors.
 */

interface CursorData {
  offset: number;
  pageSize: number;
}

/**
 * Encode pagination cursor from offset and page size
 * @param offset - Starting offset for pagination
 * @param pageSize - Number of items per page
 * @returns Base64-encoded cursor string
 */
export function encodeCursor(offset: number, pageSize: number): string {
  const data: CursorData = { offset, pageSize };
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

/**
 * Decode pagination cursor to offset and page size
 * @param cursor - Base64-encoded cursor string
 * @returns Decoded cursor data with offset and pageSize
 * @throws Error if cursor format is invalid
 */
export function decodeCursor(cursor: string): CursorData {
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
    const data = JSON.parse(json) as CursorData;
    
    // Validate cursor data - ensure integers
    if (!Number.isInteger(data.offset) || data.offset < 0) {
      throw new Error('Invalid cursor: offset must be non-negative integer');
    }
    if (!Number.isInteger(data.pageSize) || data.pageSize < 1 || data.pageSize > 100) {
      throw new Error('Invalid cursor: pageSize must be positive integer (1-100)');
    }
    
    return data;
  } catch (error) {
    // MCP error code -32602 for invalid params
    const err = new Error(
      `Invalid cursor: ${error instanceof Error ? error.message : 'malformed cursor'}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (err as any).code = -32602;
    throw err;
  }
}

/**
 * Convert MCP cursor to GitHub API pagination parameters
 * @param cursor - Optional MCP cursor string
 * @param defaultPageSize - Default page size to use if no cursor provided
 * @returns GitHub API pagination parameters (page, per_page)
 */
export function cursorToGitHubPagination(
  cursor: string | undefined,
  defaultPageSize: number
): { page: number; per_page: number } {
  // Validate page size
  if (!Number.isFinite(defaultPageSize) || defaultPageSize < 1) {
    throw new RangeError('defaultPageSize must be a positive finite integer');
  }
  
  // Decode cursor or start from beginning
  let offset: number;
  let pageSize: number;
  
  if (cursor) {
    const decoded = decodeCursor(cursor);
    offset = decoded.offset;
    // Clamp page size to server-controlled default to prevent abuse
    pageSize = Math.min(decoded.pageSize, defaultPageSize);
  } else {
    offset = 0;
    pageSize = defaultPageSize;
  }
  
  // Convert offset to GitHub page number (1-based)
  const page = Math.floor(offset / pageSize) + 1;
  
  return {
    page,
    per_page: pageSize
  };
}

/**
 * Create next cursor for pagination if more results exist
 * @param currentCursor - Current cursor string
 * @param pageSize - Size of the current page
 * @param hasMore - Whether more results exist
 * @returns Next cursor string or undefined if no more results
 */
export function createNextCursor(
  currentCursor: string | undefined,
  pageSize: number,
  hasMore: boolean
): string | undefined {
  if (!hasMore) {
    return undefined;
  }
  
  // Calculate next offset
  let nextOffset: number;
  if (currentCursor) {
    const decoded = decodeCursor(currentCursor);
    nextOffset = decoded.offset + pageSize;
  } else {
    nextOffset = pageSize;
  }
  
  return encodeCursor(nextOffset, pageSize);
}

/**
 * Paginate an array of items using MCP cursor-based pagination
 * @param items - Array of items to paginate
 * @param cursor - Optional cursor string for pagination
 * @param defaultPageSize - Number of items per page
 * @returns Paginated result with items and optional next cursor
 */
export function paginateResults<T>(
  items: T[],
  cursor: string | undefined,
  defaultPageSize: number
): PaginatedResult<T> {
  // Validate page size
  if (!Number.isFinite(defaultPageSize) || defaultPageSize < 1) {
    throw new RangeError('pageSize must be a positive finite integer');
  }
  
  // Decode cursor or start from beginning
  let offset: number;
  let pageSize: number;
  
  if (cursor) {
    const decoded = decodeCursor(cursor);
    offset = decoded.offset;
    // Clamp page size to server-controlled default to prevent abuse
    pageSize = Math.min(decoded.pageSize, defaultPageSize);
  } else {
    offset = 0;
    pageSize = defaultPageSize;
  }
  
  // Calculate slice indices
  const startIndex = offset;
  const endIndex = offset + pageSize;
  
  // Get page items
  const pageItems = items.slice(startIndex, endIndex);
  
  // Generate nextCursor only if more results exist
  const hasMore = endIndex < items.length;
  const nextCursor = hasMore ? encodeCursor(endIndex, pageSize) : undefined;
  
  return {
    items: pageItems,
    nextCursor
  };
}
