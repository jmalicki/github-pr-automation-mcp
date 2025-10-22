import { describe, it, expect } from 'vitest';
import { paginateResults, createPaginationMeta } from '../../src/utils/pagination.js';

describe('paginateResults', () => {
  const testItems = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
  
  // Test: Validates basic pagination functionality
  // Requirement: API Design - Pagination
  it('should paginate items correctly', () => {
    const result = paginateResults(testItems, 1, 10);
    
    expect(result.items).toHaveLength(10);
    expect(result.items[0].id).toBe(1);
    expect(result.items[9].id).toBe(10);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.total_pages).toBe(5);
    expect(result.pagination.has_next).toBe(true);
    expect(result.pagination.has_previous).toBe(false);
  });
  
  // Test: Validates pagination for middle page
  // Requirement: API Design - Pagination
  it('should handle middle page correctly', () => {
    const result = paginateResults(testItems, 3, 10);
    
    expect(result.items).toHaveLength(10);
    expect(result.items[0].id).toBe(21);
    expect(result.pagination.has_next).toBe(true);
    expect(result.pagination.has_previous).toBe(true);
  });
  
  // Test: Validates pagination for last page
  // Requirement: API Design - Pagination
  it('should handle last page correctly', () => {
    const result = paginateResults(testItems, 5, 10);
    
    expect(result.items).toHaveLength(10);
    expect(result.items[0].id).toBe(41);
    expect(result.pagination.has_next).toBe(false);
    expect(result.pagination.has_previous).toBe(true);
  });
  
  // Test: Validates handling of partial last page
  // Requirement: API Design - Pagination edge cases
  it('should handle partial last page', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
    const result = paginateResults(items, 3, 10);
    
    expect(result.items).toHaveLength(5);
    expect(result.pagination.total_pages).toBe(3);
  });
  
  // Test: Validates handling of invalid page numbers
  // Requirement: API Design - Pagination validation
  it('should clamp invalid page numbers', () => {
    const result = paginateResults(testItems, 999, 10);
    
    // Should return last page instead of empty
    expect(result.pagination.page).toBe(5);
    expect(result.items).toHaveLength(10);
  });
  
  // Test: Validates handling of empty arrays
  // Requirement: API Design - Pagination edge cases
  it('should handle empty arrays', () => {
    const result = paginateResults([], 1, 10);
    
    expect(result.items).toHaveLength(0);
    expect(result.pagination.total_pages).toBe(1);
    expect(result.pagination.has_next).toBe(false);
  });
});

describe('createPaginationMeta', () => {
  // Test: Validates pagination metadata creation
  // Requirement: API Design - Pagination metadata
  it('should create correct pagination metadata', () => {
    const meta = createPaginationMeta(50, 2, 10);
    
    expect(meta).toEqual({
      page: 2,
      page_size: 10,
      total_items: 50,
      total_pages: 5,
      has_next: true,
      has_previous: true
    });
  });
});

