import { describe, it, expect, beforeAll } from 'vitest';
import { GitHubClient } from '../../../src/github/client.js';
import { handleFindUnresolvedComments } from '../../../src/tools/find-unresolved-comments/handler.js';

// These tests make REAL GitHub API calls
describe('find_unresolved_comments integration', () => {
  let client: GitHubClient;
  const TEST_PR = process.env.TEST_PR || 'jmalicki/resolve-pr-mcp#2';

  beforeAll(() => {
    client = new GitHubClient();
  });

  it('should fetch real comments from GitHub', async () => {
    const result = await handleFindUnresolvedComments(client, {
      pr: TEST_PR,
      include_bots: true,
      page: 1,
      page_size: 20,
      sort: 'chronological'
    });

    expect(result.pr).toContain('#');
    expect(result.total_unresolved).toBeGreaterThanOrEqual(0);
    expect(result.summary).toBeDefined();
    expect(result.nextCursor).toBeDefined();
  }, 10000);

  it('should filter bot comments', async () => {
    const withBots = await handleFindUnresolvedComments(client, {
      pr: TEST_PR,
      include_bots: true,
      page: 1,
      page_size: 100,
      sort: 'chronological'
    });

    const withoutBots = await handleFindUnresolvedComments(client, {
      pr: TEST_PR,
      include_bots: false,
      page: 1,
      page_size: 100,
      sort: 'chronological'
    });

    // Without bots should have fewer or equal comments
    expect(withoutBots.total_unresolved).toBeLessThanOrEqual(withBots.total_unresolved);
  }, 15000);
});

