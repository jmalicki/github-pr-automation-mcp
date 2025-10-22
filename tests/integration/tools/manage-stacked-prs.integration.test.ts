import { describe, it, expect, beforeAll } from 'vitest';
import { GitHubClient } from '../../../src/github/client.js';
import { handleManageStackedPRs } from '../../../src/tools/manage-stacked-prs/handler.js';

// These tests make REAL GitHub API calls
describe('manage_stacked_prs integration', () => {
  let client: GitHubClient;
  
  // Use real stacked PRs for testing
  const BASE_PR = process.env.BASE_PR || 'jmalicki/resolve-pr-mcp#2';
  const DEPENDENT_PR = process.env.DEPENDENT_PR || 'jmalicki/resolve-pr-mcp#3';

  beforeAll(() => {
    client = new GitHubClient();
  });

  it('should analyze real stacked PRs', async () => {
    const result = await handleManageStackedPRs(client, {
      base_pr: BASE_PR,
      dependent_pr: DEPENDENT_PR,
      auto_fix: false,
      page: 1,
      page_size: 10
    });

    expect(result.base_pr).toContain('#');
    expect(result.dependent_pr).toContain('#');
    expect(typeof result.is_stacked).toBe('boolean');
    expect(typeof result.changes_detected).toBe('boolean');
    expect(result.stack_info).toBeDefined();
  }, 15000);

  it('should detect if PRs are stacked', async () => {
    const result = await handleManageStackedPRs(client, {
      base_pr: BASE_PR,
      dependent_pr: DEPENDENT_PR,
      auto_fix: false,
      page: 1,
      page_size: 10
    });

    // These specific PRs are designed to be stacked
    expect(result.is_stacked).toBe(true);
    expect(result.stack_info.matches).toBe(true);
  }, 15000);
});

