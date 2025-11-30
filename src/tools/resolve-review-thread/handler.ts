import { GitHubClient } from "../../github/client.js";
import {
  ResolveReviewThreadInput,
  ResolveReviewThreadInputSchema,
  ResolveReviewThreadOutput,
} from "./schema.js";
import { parsePRIdentifier } from "../../utils/parser.js";

// Define proper TypeScript interfaces for GraphQL responses
interface RestCommentResponse {
  node_id?: string;
}

interface ThreadQueryResponse {
  node?: {
    pullRequestReviewThread?: {
      id?: string;
      isResolved?: boolean;
    };
  };
}

interface ThreadStatusResponse {
  node?: {
    id?: string;
    isResolved?: boolean;
  };
}

interface ResolveThreadMutationResponse {
  resolveReviewThread?: {
    thread?: {
      id?: string;
      isResolved?: boolean;
    };
  };
}

/**
 * Resolve a GitHub review thread
 * @param client - GitHub client instance
 * @param input - Input containing PR identifier and thread/comment ID
 * @returns Promise resolving to resolution status
 */
export async function handleResolveReviewThread(
  client: GitHubClient,
  input: ResolveReviewThreadInput,
): Promise<ResolveReviewThreadOutput> {
  const parsed = ResolveReviewThreadInputSchema.parse(input);
  // Parse PR (needed for REST API calls to convert numeric comment IDs)
  const pr = parsePRIdentifier(parsed.pr);

  const octokit = client.getOctokit();

  // Resolve thread id from comment if needed
  let threadId = parsed.thread_id;
  if (!threadId && parsed.comment_id) {
    // Support both GraphQL node IDs and numeric REST IDs for comment_id
    let commentNodeId = parsed.comment_id;
    if (/^\d+$/.test(parsed.comment_id)) {
      // Numeric ID - convert via REST API to get GraphQL node_id
      const { data } = await octokit.rest.pulls.getReviewComment({
        owner: pr.owner,
        repo: pr.repo,
        comment_id: Number(parsed.comment_id),
      });
      const restData = data as RestCommentResponse;
      if (!restData.node_id) {
        throw new Error("Unable to get GraphQL node_id from REST comment");
      }
      commentNodeId = restData.node_id;
    }

    const threadQuery = `
      query($commentId: ID!) {
        node(id: $commentId) {
          ... on PullRequestReviewComment {
            pullRequestReviewThread { id, isResolved }
          }
        }
      }
    `;
    const resp = await octokit.graphql<ThreadQueryResponse>(threadQuery, {
      commentId: commentNodeId,
    });
    threadId = resp?.node?.pullRequestReviewThread?.id;
    if (!threadId) {
      throw new Error("Unable to resolve thread_id from comment_id");
    }
  }

  // Ensure threadId is defined before proceeding
  if (!threadId) {
    throw new Error("Either thread_id or comment_id must be provided");
  }

  // Check current resolution status by fetching the specific thread
  const statusQuery = `
    query($threadId: ID!) {
      node(id: $threadId) {
        ... on PullRequestReviewThread {
          id
          isResolved
        }
      }
    }
  `;
  const statusResp = await octokit.graphql<ThreadStatusResponse>(statusQuery, {
    threadId,
  });
  const threadNode = statusResp?.node;
  if (!threadNode) {
    throw new Error("Thread not found");
  }
  if (threadNode.isResolved) {
    return {
      ok: true,
      thread_id: threadId,
      alreadyResolved: true,
      message: "Thread already resolved",
    };
  }

  const mutation = `
    mutation($threadId: ID!) {
      resolveReviewThread(input: { threadId: $threadId }) {
        thread { id isResolved }
      }
    }
  `;
  const mutResp = await octokit.graphql<ResolveThreadMutationResponse>(
    mutation,
    { threadId },
  );
  const isResolved = Boolean(mutResp?.resolveReviewThread?.thread?.isResolved);
  return { ok: isResolved, thread_id: threadId, alreadyResolved: false };
}
