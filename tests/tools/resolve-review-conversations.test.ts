import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleResolveReviewConversations } from '../../src/tools/resolve-review-conversations/handler.js';
import { GitHubClient } from '../../src/github/client.js';

// Mock GitHub client
const mockOctokit = {
  graphql: vi.fn()
};

const mockClient = {
  getOctokit: () => mockOctokit
} as unknown as GitHubClient;

describe('resolve-review-conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch and format review threads correctly', async () => {
    // Mock GraphQL response
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [
              {
                id: 'thread-1',
                isResolved: false,
                comments: {
                  nodes: [
                    {
                      body: 'This is a review comment that needs attention',
                      author: { login: 'reviewer1' }
                    }
                  ]
                }
              },
              {
                id: 'thread-2',
                isResolved: true,
                comments: {
                  nodes: [
                    {
                      body: 'This thread is already resolved',
                      author: { login: 'reviewer2' }
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    });

    const input = {
      pr: 'owner/repo#123',
      only_unresolved: true,
      dry_run: true
    };

    const result = await handleResolveReviewConversations(mockClient, input);

    expect(result.pr).toBe('owner/repo#123');
    expect(result.threads).toHaveLength(1); // Only unresolved thread
    expect(result.threads[0].id).toBe('thread-1');
    expect(result.threads[0].is_resolved).toBe(false);
    expect(result.threads[0].preview).toContain('This is a review comment');
    expect(result.threads[0].action_commands.mcp_action.tool).toBe('resolve_review_thread');
    expect(result.threads[0].action_commands.mcp_action.args.thread_id).toBe('thread-1');
    expect(result.threads[0].action_commands.view_in_browser).toContain('github.com/owner/repo/pull/123');
    expect(result.summary.total).toBe(1); // Only unresolved thread returned
    expect(result.summary.unresolved).toBe(1);
    expect(result.summary.suggested).toBe(1);
  });

  it('should include resolved threads when only_unresolved is false', async () => {
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [
              {
                id: 'thread-1',
                isResolved: false,
                comments: { nodes: [{ body: 'Unresolved comment', author: { login: 'user' } }] }
              },
              {
                id: 'thread-2',
                isResolved: true,
                comments: { nodes: [{ body: 'Resolved comment', author: { login: 'user' } }] }
              }
            ]
          }
        }
      }
    });

    const input = {
      pr: 'owner/repo#123',
      only_unresolved: false,
      dry_run: true
    };

    const result = await handleResolveReviewConversations(mockClient, input);

    expect(result.threads).toHaveLength(2);
    expect(result.summary.total).toBe(2);
    expect(result.summary.unresolved).toBe(1);
  });

  it('should apply limit when specified', async () => {
    const mockThreads = Array.from({ length: 5 }, (_, i) => ({
      id: `thread-${i}`,
      isResolved: false,
      comments: {
        nodes: [{ body: `Comment ${i}`, author: { login: 'user' } }]
      }
    }));

    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: { nodes: mockThreads }
        }
      }
    });

    const input = {
      pr: 'owner/repo#123',
      only_unresolved: true,
      dry_run: true,
      limit: 3
    };

    const result = await handleResolveReviewConversations(mockClient, input);

    expect(result.threads).toHaveLength(3);
    expect(result.summary.total).toBe(3); // Limited to 3 threads
  });

  it('should handle GraphQL errors gracefully', async () => {
    mockOctokit.graphql.mockRejectedValue(new Error('GraphQL error'));

    const input = {
      pr: 'owner/repo#123',
      only_unresolved: true,
      dry_run: true
    };

    await expect(handleResolveReviewConversations(mockClient, input))
      .rejects.toThrow('Failed to fetch review threads: GraphQL error');
  });

  it('should handle empty thread list', async () => {
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: { nodes: [] }
        }
      }
    });

    const input = {
      pr: 'owner/repo#123',
      only_unresolved: true,
      dry_run: true
    };

    const result = await handleResolveReviewConversations(mockClient, input);

    expect(result.threads).toHaveLength(0);
    expect(result.summary.total).toBe(0);
    expect(result.summary.unresolved).toBe(0);
  });

  it('should generate correct resolve commands', async () => {
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [
              {
                id: 'thread-abc123',
                isResolved: false,
                comments: {
                  nodes: [{ body: 'Test comment', author: { login: 'user' } }]
                }
              }
            ]
          }
        }
      }
    });

    const input = {
      pr: 'owner/repo#123',
      only_unresolved: true,
      dry_run: true
    };

    const result = await handleResolveReviewConversations(mockClient, input);

    expect(result.threads[0].action_commands.mcp_action.tool).toBe('resolve_review_thread');
    expect(result.threads[0].action_commands.mcp_action.args.thread_id).toBe('thread-abc123');
    expect(result.threads[0].action_commands.view_in_browser).toBe('https://github.com/owner/repo/pull/123#discussion_rthread-abc123');
  });
});
