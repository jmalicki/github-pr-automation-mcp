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
        listForRef: vi.fn(),
        get: vi.fn()
      }
    };

    mockClient = {
      getOctokit: () => mockOctokit
    } as any;
  });

  it('should extract detailed error messages from check run output', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: 'abc123' }
      }
    });

    mockOctokit.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            id: 1,
            name: 'test',
            status: 'completed',
            conclusion: 'failure',
            html_url: 'https://github.com/test/repo/actions/runs/1'
          }
        ]
      },
      headers: { link: '' }
    });

    // Mock detailed check run with rich output
    mockOctokit.checks.get = vi.fn().mockResolvedValue({
      data: {
        id: 1,
        name: 'test',
        output: {
          title: 'Test Suite Failed',
          summary: '3 tests failed in the test suite',
          text: `FAIL tests/example.test.ts
  Error: Expected "hello" but received "world"
    at Object.<anonymous> (tests/example.test.ts:5:10)
  
FAIL tests/another.test.ts
  AssertionError: Expected 42 but received 0
    at expect (tests/another.test.ts:10:5)`
        }
      }
    });

    const result = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: false,
      bail_on_first: true
    });

    expect(result.status).toBe('failed');
    expect(result.failures).toHaveLength(1);
    
    const failure = result.failures[0];
    expect(failure.check_name).toBe('test');
    expect(failure.test_name).toBe('Test Suite Failed');
    expect(failure.error_message).toContain('**Test Suite Failed**');
    expect(failure.error_message).toContain('3 tests failed in the test suite');
    expect(failure.error_message).toContain('**Last few lines of output:**');
    expect(failure.error_message).toContain('AssertionError: Expected 42 but received 0');
    expect(failure.confidence).toBe('high');
  });

  it('should handle detailed_logs option', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: 'abc123' }
      }
    });

    mockOctokit.checks.listForRef.mockResolvedValue({
      data: {
        check_runs: [
          {
            id: 1,
            name: 'test',
            status: 'completed',
            conclusion: 'failure',
            html_url: 'https://github.com/test/repo/actions/runs/1',
            external_id: 'workflow-run-123'
          }
        ]
      },
      headers: { link: '' }
    });

    // Mock detailed check run
    mockOctokit.checks.get = vi.fn().mockResolvedValue({
      data: {
        id: 1,
        name: 'test',
        external_id: 'workflow-run-123',
        output: {
          title: 'Test Failed',
          summary: 'Basic error info'
        }
      }
    });

    // Mock workflow runs API
    mockOctokit.actions = {
      listWorkflowRunsForRepo: vi.fn().mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: 123,
              pull_requests: [{ number: 123 }]
            }
          ]
        }
      }),
      downloadWorkflowRunLogs: vi.fn().mockResolvedValue({
        data: Buffer.from('test log data')
      })
    };

    const result = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: false,
      bail_on_first: true,
      detailed_logs: true
    });

    expect(result.status).toBe('failed');
    expect(result.failures).toHaveLength(1);
    expect(mockOctokit.actions.listWorkflowRunsForRepo).toHaveBeenCalled();
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
      },
      headers: { link: '' } // No next page
    });

    const result = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: false,
      bail_on_first: true
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
      },
      headers: { link: '' } // No next page
    });

    const result = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: false,
      bail_on_first: true
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
            id: 1,
            name: 'test',
            status: 'completed',
            conclusion: 'failure',
            html_url: 'https://github.com/owner/repo/runs/1'
          }
        ]
      },
      headers: { link: '' } // No next page
    });

    // Mock detailed check run
    mockOctokit.checks.get.mockResolvedValue({
      data: {
        id: 1,
        name: 'test',
        output: {
          title: 'Tests failed',
          summary: 'TypeError: Cannot read property "foo" of undefined'
        }
      }
    });

    const result = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: false,
      bail_on_first: true
    });

    expect(result.status).toBe('failed');
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      check_name: 'test',
      test_name: 'Tests failed',
      error_message: '**Tests failed**\n\nTypeError: Cannot read property "foo" of undefined',
      log_url: 'https://github.com/owner/repo/runs/1',
      confidence: 'high'
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
      },
      headers: { link: '' } // No next page
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
    const PAGE_SIZE = 10; // Server-controlled page size constant
    const TOTAL_ITEMS = 25;
    
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        head: { sha: 'abc123' }
      }
    });

    const failedChecks = Array.from({ length: TOTAL_ITEMS }, (_, i) => ({
      id: i + 1,
      name: `test-${i}`,
      status: 'completed',
      conclusion: 'failure',
      html_url: `https://github.com/owner/repo/runs/${i}`
    }));

    // Mock pagination responses
    mockOctokit.checks.listForRef
      .mockResolvedValueOnce({
        data: {
          check_runs: failedChecks.slice(0, 10) // First page
        },
        headers: { link: '<https://api.github.com/repos/owner/repo/commits/abc123/check-runs?page=2>; rel="next"' }
      })
      .mockResolvedValueOnce({
        data: {
          check_runs: failedChecks.slice(10, 20) // Second page
        },
        headers: { link: '<https://api.github.com/repos/owner/repo/commits/abc123/check-runs?page=3>; rel="next"' }
      })
      .mockResolvedValueOnce({
        data: {
          check_runs: failedChecks.slice(20, 25) // Third page
        },
        headers: { link: '' } // No next page
      });

    // Mock detailed check run for each failed check
    mockOctokit.checks.get.mockImplementation(({ check_run_id }: any) => {
      const checkIndex = check_run_id - 1;
      return Promise.resolve({
        data: {
          id: check_run_id,
          name: `test-${checkIndex}`,
          output: {
            title: `Test ${checkIndex} failed`,
            summary: `Error in test ${checkIndex}`
          }
        }
      });
    });

    // First page (no cursor)
    const page1 = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: false,
      bail_on_first: false
    });

    expect(page1.failures).toHaveLength(10); // Server page size
    expect(page1.nextCursor).toBeDefined(); // More results exist

    // Second page using cursor from page1
    const page2 = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: false,
      bail_on_first: false,
      cursor: page1.nextCursor
    });

    expect(page2.failures).toHaveLength(10);
    expect(page2.nextCursor).toBeDefined(); // More results

    // Third page (last page) using cursor from page2
    const page3 = await handleGetFailingTests(mockClient, {
      pr: 'owner/repo#123',
      wait: false,
      bail_on_first: false,
      cursor: page2.nextCursor
    });

    expect(page3.failures).toHaveLength(5); // Partial last page
    expect(page3.nextCursor).toBeUndefined(); // No more results
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
            id: 1,
            name: 'build',
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/owner/repo/runs/1'
          },
          {
            id: 2,
            name: 'test',
            status: 'completed',
            conclusion: 'failure',
            html_url: 'https://github.com/owner/repo/runs/2'
          },
          {
            id: 3,
            name: 'lint',
            status: 'in_progress',
            conclusion: null,
            html_url: 'https://github.com/owner/repo/runs/3'
          }
        ]
      },
      headers: { link: '' } // No next page
    });

    // Mock detailed check run for the failed test
    mockOctokit.checks.get.mockResolvedValue({
      data: {
        id: 2,
        name: 'test',
        output: {
          title: 'Test failure',
          summary: 'Some tests failed'
        }
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
      },
      headers: { link: '' } // No next page
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

