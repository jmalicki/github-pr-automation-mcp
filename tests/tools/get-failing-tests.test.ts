import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGetFailingTests } from '../../src/tools/get-failing-tests/handler.js';
import { GitHubClient } from '../../src/github/client.js';

describe('handleGetFailingTests', () => {
  let mockClient: GitHubClient;
  let mockOctokit: any;

  beforeEach(() => {
    mockOctokit = {
      pulls: {
        get: vi.fn()
      },
      checks: {
        listForRef: vi.fn()
      }
    };

    mockClient = {
      getOctokit: () => mockOctokit
    } as any;
  });

  it('should handle PR with no CI checks', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: 'abc123' }
      }
    });

    mockOctokit.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: []
      }
    });

    const result = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: false,
      bail_on_first: true,
      page: 1,
      page_size: 10
    });

    expect(result.status).toBe('unknown');
    expect(result.failures).toHaveLength(0);
    expect(result.instructions.summary).toContain('No CI checks');
  });

  it('should handle passing CI checks', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: 'abc123' }
      }
    });

    mockOctokit.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            name: 'build',
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/owner/repo/runs/1'
          },
          {
            name: 'test',
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/owner/repo/runs/2'
          }
        ]
      }
    });

    const result = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: false,
      bail_on_first: true,
      page: 1,
      page_size: 10
    });

    expect(result.status).toBe('passed');
    expect(result.failures).toHaveLength(0);
    expect(result.instructions.summary).toContain('All tests passed');
  });

  it('should extract failures from failed checks', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: 'abc123' }
      }
    });

    mockOctokit.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            name: 'test',
            status: 'completed',
            conclusion: 'failure',
            html_url: 'https://github.com/owner/repo/runs/1',
            output: {
              title: 'Tests failed',
              summary: 'TypeError: Cannot read property "foo" of undefined'
            }
          }
        ]
      }
    });

    const result = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: false,
      bail_on_first: true,
      page: 1,
      page_size: 10
    });

    expect(result.status).toBe('failed');
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      check_name: 'test',
      test_name: 'Tests failed',
      error_message: 'TypeError: Cannot read property "foo" of undefined',
      log_url: 'https://github.com/owner/repo/runs/1',
      confidence: 'medium'
    });
    expect(result.instructions.summary).toContain('1 test failed');
  });

  it('should handle running CI with wait=true', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: 'abc123' }
      }
    });

    mockOctokit.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            name: 'build',
            status: 'in_progress',
            conclusion: null,
            html_url: 'https://github.com/owner/repo/runs/1'
          },
          {
            name: 'test',
            status: 'queued',
            conclusion: null,
            html_url: 'https://github.com/owner/repo/runs/2'
          }
        ]
      }
    });

    const result = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: true,
      bail_on_first: true,
      page: 1,
      page_size: 10
    });

    expect(result.status).toBe('running');
    expect(result.instructions.summary).toContain('CI still running');
    expect(result.poll_info).toBeDefined();
    expect(result.poll_info?.retry_after_seconds).toBe(30);
  });

  it('should paginate results correctly', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: 'abc123' }
      }
    });

    const failedChecks = Array.from({ length: 25 }, (_, i) => ({
      name: `test-${i}`,
      status: 'completed',
      conclusion: 'failure',
      html_url: `https://github.com/owner/repo/runs/${i}`,
      output: {
        title: `Test ${i} failed`,
        summary: `Error in test ${i}`
      }
    }));

    mockOctokit.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: failedChecks
      }
    });

    // Page 1
    const page1 = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: false,
      bail_on_first: false,
      page: 1,
      page_size: 10
    });

    expect(page1.failures).toHaveLength(10);
    expect(page1.pagination.page).toBe(1);
    expect(page1.pagination.total_items).toBe(25);
    expect(page1.pagination.total_pages).toBe(3);
    expect(page1.pagination.has_next).toBe(true);
    expect(page1.pagination.has_previous).toBe(false);

    // Page 2
    const page2 = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: false,
      bail_on_first: false,
      page: 2,
      page_size: 10
    });

    expect(page2.failures).toHaveLength(10);
    expect(page2.pagination.page).toBe(2);
    expect(page2.pagination.has_next).toBe(true);
    expect(page2.pagination.has_previous).toBe(true);

    // Page 3
    const page3 = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: false,
      bail_on_first: false,
      page: 3,
      page_size: 10
    });

    expect(page3.failures).toHaveLength(5);
    expect(page3.pagination.page).toBe(3);
    expect(page3.pagination.has_next).toBe(false);
    expect(page3.pagination.has_previous).toBe(true);
  });

  it('should handle mixed status checks', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: 'abc123' }
      }
    });

    mockOctokit.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            name: 'build',
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/owner/repo/runs/1'
          },
          {
            name: 'test',
            status: 'completed',
            conclusion: 'failure',
            html_url: 'https://github.com/owner/repo/runs/2',
            output: {
              title: 'Test failure',
              summary: 'Some tests failed'
            }
          },
          {
            name: 'lint',
            status: 'in_progress',
            conclusion: null,
            html_url: 'https://github.com/owner/repo/runs/3'
          }
        ]
      }
    });

    const result = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: false,
      bail_on_first: false,
      page: 1,
      page_size: 10
    });

    expect(result.status).toBe('failed');
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].check_name).toBe('test');
  });

  it('should handle PR identifier in different formats', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: 'abc123' }
      }
    });

    mockOctokit.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: []
      }
    });

    const formats = [
      'owner/repo#123',
      'owner/repo/pull/123',
      'https://github.com/owner/repo/pull/123'
    ];

    for (const format of formats) {
      const result = await handleGetFailingTests(mockClient, {
        pr: format,
        wait: false,
        bail_on_first: true,
        page: 1,
        page_size: 10
      });

      expect(result.pr).toBe('owner/repo#123');
      expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 123
      });
    }
  });
});

