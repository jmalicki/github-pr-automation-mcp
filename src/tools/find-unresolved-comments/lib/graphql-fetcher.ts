import type { Octokit } from "@octokit/rest";

/**
 * Fetch GraphQL node IDs and thread resolution status for review comments.
 *
 * This function bridges the gap between GitHub's REST API and GraphQL API
 * to provide enhanced comment tracking capabilities. It maps REST comment IDs
 * to GraphQL thread IDs and tracks which threads are resolved.
 *
 * ## Why This Is Needed
 *
 * GitHub's REST API provides comment data but lacks some advanced features:
 * - No direct thread resolution status in comment objects
 * - No GraphQL node IDs for advanced operations
 * - Limited thread-level information
 *
 * The GraphQL API provides:
 * - Thread-level resolution status (`isResolved`)
 * - GraphQL node IDs for advanced operations
 * - Better thread management capabilities
 *
 * ## GraphQL Query Structure
 *
 * The query fetches review threads with:
 * - Thread ID (GraphQL node ID)
 * - Resolution status (`isResolved`)
 * - Associated comments with database IDs
 * - Pagination support for large PRs
 *
 * ## Mapping Strategy
 *
 * 1. **Fetch Threads**: Get all review threads for the PR
 * 2. **Map Comments**: Link REST comment IDs to GraphQL thread IDs
 * 3. **Track Resolution**: Record which threads are resolved
 * 4. **Early Exit**: Stop when all requested IDs are mapped
 *
 * ## Error Handling
 *
 * If GraphQL fails, the function returns empty maps rather than throwing.
 * This ensures the REST API fallback continues to work, though with
 * reduced functionality (no thread resolution status).
 *
 * @param octokit - GitHub API client instance
 * @param pr - Pull request information (owner, repo, number)
 * @param commentIds - Array of REST comment IDs to fetch node IDs for
 * @returns Promise resolving to node ID map and resolved thread IDs
 * 
 * @example
 * ```typescript
 * const { nodeIdMap, resolvedThreadIds } = await fetchReviewCommentNodeIds(
 *   octokit,
 *   { owner: 'owner', repo: 'repo', number: 123 },
 *   [12345, 12346]
 * );
 * 
 * // Check if a comment's thread is resolved
 * const threadId = nodeIdMap.get(12345);
 * const isResolved = resolvedThreadIds.has(threadId);
 * ```
 */
export async function fetchReviewCommentNodeIds(
  octokit: InstanceType<typeof Octokit>,
  pr: { owner: string; repo: string; number: number },
  commentIds: number[],
): Promise<{ nodeIdMap: Map<number, string>; resolvedThreadIds: Set<string> }> {
  // Initialize result containers
  const nodeIdMap = new Map<number, string>();      // Maps REST ID → GraphQL thread ID
  const resolvedThreadIds = new Set<string>();      // Set of resolved thread IDs

  // Early return if no comment IDs to process
  if (commentIds.length === 0) {
    return { nodeIdMap, resolvedThreadIds };
  }

  // GraphQL query to fetch review threads with comments and resolution status
  // This query gets all review threads for a PR with their associated comments
  const query = `
    query($owner: String!, $repo: String!, $pr: Int!, $after: String) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100, after: $after) {
            nodes {
              id                    # GraphQL thread node ID
              isResolved           # Whether this thread is resolved
              comments(first: 100) {
                nodes {
                  databaseId        # REST API comment ID
                }
              }
            }
            pageInfo {
              hasNextPage          # Pagination support
              endCursor
            }
          }
        }
      }
    }
  `;

  // TypeScript interface for GraphQL response structure
  // This ensures type safety when accessing nested response properties
  interface GraphQLResponse {
    repository?: {
      pullRequest?: {
        reviewThreads?: {
          nodes?: Array<{
            id: string;                    // GraphQL thread node ID
            isResolved: boolean;          // Thread resolution status
            comments?: {
              nodes?: Array<{
                databaseId: number;       // REST API comment ID
              }>;
            };
          }>;
          pageInfo?: {
            hasNextPage: boolean;        // Pagination indicator
            endCursor: string | null;    // Cursor for next page
          };
        };
      };
    };
  }

  try {
    // Track which comment IDs we still need to find
    const needed = new Set(commentIds);
    let after: string | null = null;  // Pagination cursor

    // Paginate through all review threads until we find all needed IDs
    do {
      // Execute GraphQL query with current pagination cursor
      const response: GraphQLResponse = await octokit.graphql<GraphQLResponse>(
        query,
        {
          owner: pr.owner,
          repo: pr.repo,
          pr: pr.number,
          after,
        },
      );

      // Extract review threads from response
      const rt = response?.repository?.pullRequest?.reviewThreads;
      const threads = rt?.nodes || [];

      // Process each thread
      for (const thread of threads) {
        const threadId = thread.id;
        
        // Track resolved threads
        if (thread.isResolved) {
          resolvedThreadIds.add(threadId);
        }

        // Map comment IDs to thread IDs
        for (const comment of thread.comments?.nodes || []) {
          const dbId = comment.databaseId;
          if (dbId && needed.has(dbId)) {
            nodeIdMap.set(dbId, threadId);  // Map REST ID → GraphQL thread ID
            needed.delete(dbId);            // Mark this ID as found
          }
        }
      }

      // Check pagination info
      const pageInfo = rt?.pageInfo;
      after = pageInfo?.hasNextPage ? (pageInfo.endCursor ?? null) : null;

      // Early exit optimization: stop when all IDs are mapped
      if (needed.size === 0) break;
    } while (after);
  } catch (error) {
    // Graceful degradation: if GraphQL fails, return empty maps
    // This allows the REST API fallback to continue working
    console.warn(
      `Failed to fetch GraphQL node IDs: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return { nodeIdMap, resolvedThreadIds };
}
