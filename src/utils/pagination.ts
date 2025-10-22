import type { PaginationMeta, PaginatedResult } from '../types/index.js';

/**
 * Paginate an array of items
 */
export function paginateResults<T>(
  items: T[],
  page: number,
  pageSize: number
): PaginatedResult<T> {
  // Validate inputs to prevent Infinity/NaN
  if (!Number.isFinite(pageSize) || pageSize < 1) {
    throw new RangeError('pageSize must be a positive finite integer');
  }
  if (!Number.isFinite(page) || page < 1) {
    page = 1; // Default to first page if invalid
  }
  
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  
  // Validate page number
  const validPage = Math.max(1, Math.min(page, totalPages || 1));
  
  // Calculate slice indices
  const startIndex = (validPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  
  // Get page items
  const pageItems = items.slice(startIndex, endIndex);
  
  return {
    items: pageItems,
    pagination: createPaginationMeta(totalItems, validPage, pageSize)
  };
}

/**
 * Create pagination metadata
 */
export function createPaginationMeta(
  totalItems: number,
  page: number,
  pageSize: number
): PaginationMeta {
  // Validate inputs
  if (!Number.isFinite(pageSize) || pageSize < 1) {
    throw new RangeError('pageSize must be a positive finite integer');
  }
  
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const validPage = Math.max(1, Math.min(page, totalPages));
  
  return {
    page: validPage,
    page_size: pageSize,
    total_items: totalItems,
    total_pages: totalPages,
    has_next: validPage < totalPages,
    has_previous: validPage > 1
  };
}

