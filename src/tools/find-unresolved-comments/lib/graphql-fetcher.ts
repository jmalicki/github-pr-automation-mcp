import type { Octokit } from '@octokit/rest';

/**
 * Fetch GraphQL node IDs and thread IDs for review comments
 * Maps REST API numeric comment IDs to GraphQL thread node IDs and tracks resolved status
 * @param octokit - GitHub API client instance
 * @param pr - Pull request information
 * @param commentIds - Array of comment IDs to fetch node IDs for
 * @returns Promise resolving to node ID map and resolved thread IDs
 */
export async function fetchReviewCommentNodeIds(
  octokit: InstanceType<typeof Octokit>,
  pr: { owner: string; repo: string; number: number },
  commentIds: number[]
): Promise<{ nodeIdMap: Map<number, string>; resolvedThreadIds: Set<string> }> {
  const nodeIdMap = new Map<number, string>();
  const resolvedThreadIds = new Set<string>();
  
  if (commentIds.length === 0) {
    return { nodeIdMap, resolvedThreadIds };
  }
  
  // Fetch review threads with comments and resolved status via GraphQL
  const query = `
    query($owner: String!, $repo: String!, $pr: Int!, $after: String) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100, after: $after) {
            nodes {
              id
              isResolved
              comments(first: 100) {
                nodes {
                  databaseId
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
    const needed = new Set(commentIds);
    let after: string | null = null;
    
    do {
      const response: GraphQLResponse = await octokit.graphql<GraphQLResponse>(query, {
        owner: pr.owner,
        repo: pr.repo,
        pr: pr.number,
        after
      });

      const rt = response?.repository?.pullRequest?.reviewThreads;
      const threads = rt?.nodes || [];

      for (const thread of threads) {
        const threadId = thread.id;
        if (thread.isResolved) {
          resolvedThreadIds.add(threadId);
        }

        for (const comment of thread.comments?.nodes || []) {
          const dbId = comment.databaseId;
          if (dbId && needed.has(dbId)) {
            nodeIdMap.set(dbId, threadId);
            needed.delete(dbId);
          }
        }
      }

      const pageInfo = rt?.pageInfo;
      after = pageInfo?.hasNextPage ? pageInfo.endCursor ?? null : null;

      // Early exit when all IDs are mapped
      if (needed.size === 0) break;
    } while (after);
  } catch (error) {
    // If GraphQL fails, return empty map - comments will still work via resolve_command
    console.warn(`Failed to fetch GraphQL node IDs: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return { nodeIdMap, resolvedThreadIds };
}
