import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParallelRequestHandler, createParallelHandler } from '../../src/github/parallel-requests.js';
import type { GitHubClient } from '../../src/github/client.js';

describe('ParallelRequestHandler', () => {
  let mockClient: GitHubClient;
  let handler: ParallelRequestHandler;

  beforeEach(() => {
    mockClient = {
      getPullRequest: vi.fn(),
      getOctokit: vi.fn().mockReturnValue({
        rest: {
          checks: {
            listForRef: vi.fn()
          },
          issues: {
            listComments: vi.fn()
          }
        }
      })
    } as any;

    handler = new ParallelRequestHandler(mockClient, 2); // Max 2 concurrent
  });

  it('should execute requests in parallel', async () => {
    const mockFn1 = vi.fn().mockResolvedValue('result1');
    const mockFn2 = vi.fn().mockResolvedValue('result2');
    const mockFn3 = vi.fn().mockResolvedValue('result3');

    const requests = [
      { key: 'req1', fn: mockFn1, priority: 'normal' as const },
      { key: 'req2', fn: mockFn2, priority: 'normal' as const },
      { key: 'req3', fn: mockFn3, priority: 'normal' as const }
    ];

    const results = await handler.executeBatch(requests);

    expect(results).toHaveLength(3);
    expect(results[0].key).toBe('req1');
    expect(results[0].data).toBe('result1');
    expect(results[1].key).toBe('req2');
    expect(results[1].data).toBe('result2');
    expect(results[2].key).toBe('req3');
    expect(results[2].data).toBe('result3');

    expect(mockFn1).toHaveBeenCalled();
    expect(mockFn2).toHaveBeenCalled();
    expect(mockFn3).toHaveBeenCalled();
  });

  it('should handle request failures', async () => {
    const mockFn1 = vi.fn().mockResolvedValue('success');
    const mockFn2 = vi.fn().mockRejectedValue(new Error('API Error'));

    const requests = [
      { key: 'req1', fn: mockFn1, priority: 'normal' as const },
      { key: 'req2', fn: mockFn2, priority: 'normal' as const }
    ];

    const results = await handler.executeBatch(requests);

    expect(results).toHaveLength(2);
    expect(results[0].key).toBe('req1');
    expect(results[0].data).toBe('success');
    expect(results[0].error).toBeUndefined();

    expect(results[1].key).toBe('req2');
    expect(results[1].data).toBeUndefined();
    expect(results[1].error).toBeInstanceOf(Error);
    expect(results[1].error?.message).toBe('API Error');
  });

  it('should respect priority ordering', async () => {
    const highFn = vi.fn().mockResolvedValue('high');
    const normalFn = vi.fn().mockResolvedValue('normal');
    const lowFn = vi.fn().mockResolvedValue('low');

    const requests = [
      { key: 'low', fn: lowFn, priority: 'low' as const },
      { key: 'normal', fn: normalFn, priority: 'normal' as const },
      { key: 'high', fn: highFn, priority: 'high' as const }
    ];

    await handler.executeBatch(requests);

    // All should have been called
    expect(highFn).toHaveBeenCalled();
    expect(normalFn).toHaveBeenCalled();
    expect(lowFn).toHaveBeenCalled();
  });

  it('should batch PR metadata requests', async () => {
    const prs = ['owner/repo#1', 'owner/repo#2', 'owner/repo#3'];
    
    vi.mocked(mockClient.getPullRequest)
      .mockResolvedValueOnce({ number: 1, title: 'PR 1' })
      .mockResolvedValueOnce({ number: 2, title: 'PR 2' })
      .mockResolvedValueOnce({ number: 3, title: 'PR 3' });

    const results = await handler.batchPRMetadata(prs);

    expect(results).toHaveLength(3);
    expect(mockClient.getPullRequest).toHaveBeenCalledTimes(3);
    expect(mockClient.getPullRequest).toHaveBeenCalledWith('owner/repo#1');
    expect(mockClient.getPullRequest).toHaveBeenCalledWith('owner/repo#2');
    expect(mockClient.getPullRequest).toHaveBeenCalledWith('owner/repo#3');
  });

  it('should batch check runs requests', async () => {
    const commits = [
      { owner: 'owner', repo: 'repo', sha: 'abc123' },
      { owner: 'owner', repo: 'repo', sha: 'def456' }
    ];

    const mockOctokit = {
      rest: {
        checks: {
          listForRef: vi.fn()
            .mockResolvedValueOnce({ data: { check_runs: [] } })
            .mockResolvedValueOnce({ data: { check_runs: [] } })
        }
      }
    };

    vi.mocked(mockClient.getOctokit).mockReturnValue(mockOctokit as any);

    const results = await handler.batchCheckRuns(commits);

    expect(results).toHaveLength(2);
    expect(mockOctokit.rest.checks.listForRef).toHaveBeenCalledTimes(2);
  });

  it('should batch comment requests', async () => {
    const prs = [
      { owner: 'owner', repo: 'repo', number: 1 },
      { owner: 'owner', repo: 'repo', number: 2 }
    ];

    const mockOctokit = {
      rest: {
        issues: {
          listComments: vi.fn()
            .mockResolvedValueOnce({ data: [] })
            .mockResolvedValueOnce({ data: [] })
        }
      }
    };

    vi.mocked(mockClient.getOctokit).mockReturnValue(mockOctokit as any);

    const results = await handler.batchComments(prs);

    expect(results).toHaveLength(2);
    expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledTimes(2);
  });
});

describe('createParallelHandler', () => {
  it('should create a parallel request handler', () => {
    const mockClient = {} as GitHubClient;
    const handler = createParallelHandler(mockClient, 3);

    expect(handler).toBeInstanceOf(ParallelRequestHandler);
  });
});
