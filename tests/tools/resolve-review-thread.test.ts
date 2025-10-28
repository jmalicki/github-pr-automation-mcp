import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleResolveReviewThread } from "../../src/tools/resolve-review-thread/handler.js";
import { GitHubClient } from "../../src/github/client.js";

const mockOctokit = {
  graphql: vi.fn(),
};

const mockClient = {
  getOctokit: () => mockOctokit,
} as unknown as GitHubClient;

describe("resolve-review-thread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should resolve a thread by thread_id", async () => {
    // Mock status check - thread is unresolved
    mockOctokit.graphql.mockResolvedValueOnce({
      node: {
        id: "thread-123",
        isResolved: false,
      },
    });

    // Mock resolution mutation
    mockOctokit.graphql.mockResolvedValueOnce({
      resolveReviewThread: {
        thread: {
          id: "thread-123",
          isResolved: true,
        },
      },
    });

    const result = await handleResolveReviewThread(mockClient, {
      pr: "owner/repo#123",
      thread_id: "thread-123",
    });

    expect(result.ok).toBe(true);
    expect(result.thread_id).toBe("thread-123");
    expect(result.alreadyResolved).toBe(false);
  });

  it("should handle already resolved threads", async () => {
    // Mock status check - thread already resolved
    mockOctokit.graphql.mockResolvedValueOnce({
      node: {
        id: "thread-456",
        isResolved: true,
      },
    });

    const result = await handleResolveReviewThread(mockClient, {
      pr: "owner/repo#123",
      thread_id: "thread-456",
    });

    expect(result.ok).toBe(true);
    expect(result.thread_id).toBe("thread-456");
    expect(result.alreadyResolved).toBe(true);
    expect(result.message).toBe("Thread already resolved");
  });

  it("should map comment_id to thread_id and resolve", async () => {
    // Mock comment-to-thread mapping
    mockOctokit.graphql.mockResolvedValueOnce({
      node: {
        pullRequestReviewThread: {
          id: "thread-789",
          isResolved: false,
        },
      },
    });

    // Mock status check
    mockOctokit.graphql.mockResolvedValueOnce({
      node: {
        id: "thread-789",
        isResolved: false,
      },
    });

    // Mock resolution mutation
    mockOctokit.graphql.mockResolvedValueOnce({
      resolveReviewThread: {
        thread: {
          id: "thread-789",
          isResolved: true,
        },
      },
    });

    const result = await handleResolveReviewThread(mockClient, {
      pr: "owner/repo#123",
      comment_id: "comment-999",
    });

    expect(result.ok).toBe(true);
    expect(result.thread_id).toBe("thread-789");
    expect(result.alreadyResolved).toBe(false);
  });

  it("should throw error if comment_id cannot be mapped to thread", async () => {
    // Mock comment-to-thread mapping with no thread
    mockOctokit.graphql.mockResolvedValueOnce({
      node: null,
    });

    await expect(
      handleResolveReviewThread(mockClient, {
        pr: "owner/repo#123",
        comment_id: "invalid-comment",
      }),
    ).rejects.toThrow("Unable to resolve thread_id from comment_id");
  });

  it("should validate input requires either thread_id or comment_id", async () => {
    await expect(
      handleResolveReviewThread(mockClient, {
        pr: "owner/repo#123",
      }),
    ).rejects.toThrow();
  });
});
