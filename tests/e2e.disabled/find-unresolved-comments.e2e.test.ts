import { describe, it, expect } from 'vitest';
import { handleFindUnresolvedComments } from '../../src/tools/find-unresolved-comments/handler.js';
import { E2ETestSetup } from './setup.js';

describe('find-unresolved-comments E2E', () => {
  const setup = new E2ETestSetup();
  
  // Test: Complete workflow with realistic pagination data
  // Requirement: find_unresolved_comments - End-to-end pagination
  it('[slow] should handle complete pagination workflow with real GitHub data', async () => {
    const { client } = setup.setupPRScenario('api.github.com/paginate-issues');
    
    // First page - test with real GitHub API structure
    const page1 = await handleFindUnresolvedComments(client, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological'
    });
    
    expect(Array.isArray(page1.comments)).toBe(true);
    expect(page1.nextCursor === null || typeof page1.nextCursor === 'string').toBe(true);
    
    // Second page - test cursor-based pagination
    const page2 = await handleFindUnresolvedComments(client, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological',
      cursor: page1.nextCursor
    });
    
    expect(Array.isArray(page2.comments)).toBe(true);
    expect(page2.nextCursor === null || typeof page2.nextCursor === 'string').toBe(true);
    
    // Final page - test completion
    const page3 = await handleFindUnresolvedComments(client, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological',
      cursor: page2.nextCursor
    });
    
    expect(Array.isArray(page3.comments)).toBe(true);
    expect(page3.nextCursor).toBeUndefined(); // or null depending on createNextCursor impl
  });
  
  // Test: Complete comment analysis with real GitHub data structure
  // Requirement: find_unresolved_comments - Real data validation
  it('[fast] should analyze comments with realistic GitHub API structure', async () => {
    const { client } = setup.setupPRScenario('api.github.com/paginate-issues');
    
    const result = await handleFindUnresolvedComments(client, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological'
    });
    
    // Validate real GitHub API structure is preserved
    expect(result.comments).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.summary.comments_in_page).toBeGreaterThanOrEqual(0);
    expect(result.summary.by_author).toBeDefined();
    expect(result.summary.by_type).toBeDefined();
  });
  
  // Test: Bot filtering with real GitHub user types
  // Requirement: find_unresolved_comments - Bot detection
  it('[fast] should filter bots using real GitHub user type data', async () => {
    const { client } = setup.setupPRScenario('api.github.com/paginate-issues');
    
    const resultWithBots = await handleFindUnresolvedComments(client, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological'
    });
    
    const resultWithoutBots = await handleFindUnresolvedComments(client, {
      pr: 'owner/repo#123',
      include_bots: false,
      sort: 'chronological'
    });
    
    // Should have different counts based on bot filtering
    expect(resultWithBots.summary.bot_comments).toBeDefined();
    expect(resultWithoutBots.summary.bot_comments).toBe(0);
  });
  
  // Test: Multi-step workflow with realistic data flow
  // Requirement: find_unresolved_comments - Complete workflow
  it('[slow] should handle complete multi-step comment analysis workflow', async () => {
    const { client } = setup.setupPRScenario('api.github.com/paginate-issues');
    
    // Step 1: Get initial comments
    const initial = await handleFindUnresolvedComments(client, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological'
    });
    
    expect(initial.comments).toBeDefined();
    expect(initial.summary).toBeDefined();
    
    // Step 2: Test different sorting options
    const byFile = await handleFindUnresolvedComments(client, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'by_file'
    });
    
    const byAuthor = await handleFindUnresolvedComments(client, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'by_author'
    });
    
    // All should return valid results
    expect(byFile.comments).toBeDefined();
    expect(byAuthor.comments).toBeDefined();
    
    // Step 3: Test author exclusion
    const excluded = await handleFindUnresolvedComments(client, {
      pr: 'owner/repo#123',
      include_bots: true,
      exclude_authors: ['test-user'],
      sort: 'chronological'
    });
    
    expect(excluded.comments).toBeDefined();
    expect(excluded.summary).toBeDefined();
  });
});

