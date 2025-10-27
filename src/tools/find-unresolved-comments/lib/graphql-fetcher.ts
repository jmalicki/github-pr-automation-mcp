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
    query($owner: String!, $repo: String!, $pr: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100) {
            nodes {
              id
              isResolved
              comments(first: 100) {
                nodes {
                  databaseId
                }
              }
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
        };
      };
    };
  }

  try {
    const response = await octokit.graphql<GraphQLResponse>(query, {
      owner: pr.owner,
      repo: pr.repo,
      pr: pr.number
    });
    
    const threads = response?.repository?.pullRequest?.reviewThreads?.nodes || [];
    
    // Map each comment's databaseId (numeric ID) to its thread's GraphQL node ID
    // Also track which threads are resolved
    threads.forEach((thread) => {
      const threadId = thread.id;
      const isResolved = thread.isResolved;
      
      // Track resolved threads
      if (isResolved) {
        resolvedThreadIds.add(threadId);
      }
      
      const comments = thread.comments?.nodes || [];
      comments.forEach((comment) => {
        const dbId = comment.databaseId;
        if (dbId && commentIds.includes(dbId)) {
          nodeIdMap.set(dbId, threadId);
        }
      });
    });
  } catch (error) {
    // If GraphQL fails, return empty map - comments will still work via resolve_command
    console.warn(`Failed to fetch GraphQL node IDs: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return { nodeIdMap, resolvedThreadIds };
}
