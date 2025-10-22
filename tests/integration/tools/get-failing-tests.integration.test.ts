import { describe, it, expect } from 'vitest';
import { GitHubClient } from '../../../src/github/client.js';
import { handleGetFailingTests } from '../../../src/tools/get-failing-tests/handler.js';

// These tests make REAL GitHub API calls
// They are disabled by default and only run when:
// 1. GITHUB_TOKEN is set
// 2. RUN_INTEGRATION_TESTS=true is set

describe('get_failing_tests integration', () => {
  let client: GitHubClient;

  // Use a real test PR in a test repository
  const TEST_PR = process.env.TEST_PR || 'jmalicki/resolve-pr-mcp#2';

  beforeAll(() => {
    client = new GitHubClient();
  });

  it('should fetch real PR data from GitHub', async () => {
    const result = await handleGetFailingTests(client, {
      pr: TEST_PR,
      wait: false,
      bail_on_first: false,
      page: 1,
      page_size: 10
    });

    // Verify we got real data back
    expect(result.pr).toContain('#');
    expect(result.status).toMatch(/passed|failed|running|unknown/);
    expect(result.pagination).toBeDefined();
    expect(result.instructions).toBeDefined();
  }, 10000); // 10 second timeout for API calls

  it('should handle pagination with real data', async () => {
    const page1 = await handleGetFailingTests(client, {
      pr: TEST_PR,
      wait: false,
      bail_on_first: false,
      page: 1,
      page_size: 5
    });

    expect(page1.pagination.page).toBe(1);
    expect(page1.pagination.page_size).toBe(5);
  }, 10000);

  it('should correctly identify PR status', async () => {
    const result = await handleGetFailingTests(client, {
      pr: TEST_PR,
      wait: false,
      bail_on_first: false,
      page: 1,
      page_size: 10
    });

    // Status should be one of the valid states
    expect(['passed', 'failed', 'running', 'unknown']).toContain(result.status);

    // If failed, should have failures
    if (result.status === 'failed') {
      expect(result.failures.length).toBeGreaterThan(0);
    }

    // If passed, should not have failures
    if (result.status === 'passed') {
      expect(result.failures).toHaveLength(0);
    }
  }, 15000);
});

