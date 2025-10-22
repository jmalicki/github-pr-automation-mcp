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
 * Encode cursor data to opaque base64 string
 */
export function encodeCursor(offset: number, pageSize: number): string {
  const data: CursorData = { offset, pageSize };
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

/**
 * Decode opaque cursor to extract offset and page size
 * Throws error for invalid cursors (MCP error code -32602)
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
 * Convert cursor-based pagination to GitHub API pagination parameters
 * 
 * @param cursor - Opaque cursor string (undefined = start from beginning)
 * @param defaultPageSize - Server-controlled page size
 * @returns GitHub API pagination parameters
 */
export function cursorToGitHubPagination(
  cursor: string | undefined,
  defaultPageSize: number
): { page: number; per_page: number } {
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
  
  // Convert offset to GitHub page number (1-based)
  const page = Math.floor(offset / pageSize) + 1;
  
  return {
    page,
    per_page: pageSize
  };
}

/**
 * Create next cursor from GitHub API response
 * 
 * @param currentCursor - Current cursor (undefined = first page)
 * @param pageSize - Page size used
 * @param hasMore - Whether there are more results (based on response length)
 * @returns Next cursor or undefined if no more results
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
 * 
 * @param items - Array to paginate
 * @param cursor - Opaque cursor string (undefined = start from beginning)
 * @param defaultPageSize - Server-controlled page size
 * @returns Paginated result with items and optional nextCursor
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
