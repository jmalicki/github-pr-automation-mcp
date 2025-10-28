import type { Octokit } from "@octokit/rest";

/**
 * Fetch GraphQL node IDs and thread IDs for review comments.
 *
 * This function bridges the gap between GitHub's REST API and GraphQL API:
 * - REST API returns numeric comment IDs (databaseId)
 * - GraphQL API uses globally unique string node IDs
 *
 * We need GraphQL node IDs to:
 * 1. Identify which review threads comments belong to (for resolution tracking)
 * 2. Use the resolve_review_thread MCP tool (which requires GraphQL node IDs)
 *
 * The function also tracks which threads are already resolved via GitHub's UI.
 *
 * @param octokit - GitHub API client instance (must support GraphQL queries)
 * @param pr - Pull request information (owner, repo, number)
 * @param commentIds - Array of REST API comment IDs to fetch GraphQL mappings for
 * @returns Promise resolving to:
 *   - nodeIdMap: Maps REST comment ID -> GraphQL thread ID
 *   - resolvedThreadIds: Set of thread IDs that are already resolved in GitHub UI
 */
export async function fetchReviewCommentNodeIds(
  octokit: InstanceType<typeof Octokit>,
  pr: { owner: string; repo: string; number: number },
  commentIds: number[],
): Promise<{ nodeIdMap: Map<number, string>; resolvedThreadIds: Set<string> }> {
  const nodeIdMap = new Map<number, string>(); // REST ID -> GraphQL thread ID
  const resolvedThreadIds = new Set<string>(); // Thread IDs marked as resolved in GitHub UI

  // Early return if no comments to process
  if (commentIds.length === 0) {
    return { nodeIdMap, resolvedThreadIds };
  }

  // GraphQL query to fetch review threads with their comments and resolved status
  // This query paginates through all review threads for the PR
  const query = `
    query($owner: String!, $repo: String!, $pr: Int!, $after: String) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100, after: $after) {
            nodes {
              id          # GraphQL thread node ID (needed for MCP resolution tool)
              isResolved  # Whether this thread is marked resolved in GitHub UI
              comments(first: 100) {
                nodes {
                  databaseId  # REST API numeric ID
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    }
  `;

  // Type the GraphQL response
  interface GraphQLResponse {
    repository?: {
      pullRequest?: {
        reviewThreads?: {
          nodes?: Array<{
            id: string;
            isResolved: boolean;
            comments?: {
              nodes?: Array<{
                databaseId: number;
              }>;
            };
          }>;
          pageInfo?: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
        };
      };
    };
  }

  try {
    const needed = new Set(commentIds); // Track which comment IDs we still need to map
    let after: string | null = null; // Pagination cursor

    // Paginate through all review threads until we've mapped all comments
    do {
      const response: GraphQLResponse = await octokit.graphql<GraphQLResponse>(
        query,
        {
          owner: pr.owner,
          repo: pr.repo,
          pr: pr.number,
          after,
        },
      );

      const rt = response?.repository?.pullRequest?.reviewThreads;
      const threads = rt?.nodes || [];

      // Process each review thread
      for (const thread of threads) {
        const threadId = thread.id; // GraphQL thread ID
        // Track which threads are already resolved in GitHub UI
        if (thread.isResolved) {
          resolvedThreadIds.add(threadId);
        }

        // Map each comment in the thread to its thread ID
        for (const comment of thread.comments?.nodes || []) {
          const dbId = comment.databaseId; // REST API numeric ID
          // Only map comments we're looking for
          if (dbId && needed.has(dbId)) {
            nodeIdMap.set(dbId, threadId); // Map REST ID -> GraphQL thread ID
            needed.delete(dbId); // Mark this comment as mapped
          }
        }
      }

      // Handle pagination
      const pageInfo = rt?.pageInfo;
      after = pageInfo?.hasNextPage ? (pageInfo.endCursor ?? null) : null;

      // Early exit optimization: stop paginating once all comments are mapped
      if (needed.size === 0) break;
    } while (after);
  } catch (error) {
    // Graceful degradation: If GraphQL fails, continue without MCP resolution capability
    // Comments will still work via the GitHub CLI resolve_command, just not MCP tool
    console.warn(
      `Failed to fetch GraphQL node IDs: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return { nodeIdMap, resolvedThreadIds };
}
