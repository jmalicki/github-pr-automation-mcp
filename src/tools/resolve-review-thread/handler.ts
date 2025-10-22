import { GitHubClient } from '../../github/client.js';
import { ResolveReviewThreadInput, ResolveReviewThreadInputSchema, ResolveReviewThreadOutput } from './schema.js';
import { parsePRIdentifier } from '../../utils/parser.js';

export async function handleResolveReviewThread(client: GitHubClient, input: ResolveReviewThreadInput): Promise<ResolveReviewThreadOutput> {
  const parsed = ResolveReviewThreadInputSchema.parse(input);
  // Parse PR for validation only (GraphQL operations use thread/comment node IDs)
  parsePRIdentifier(parsed.pr);

  const octokit = client.getOctokit();

  // Resolve thread id from comment if needed
  let threadId = parsed.thread_id;
  if (!threadId && parsed.comment_id) {
    const threadQuery = `
      query($commentId: ID!) {
        node(id: $commentId) {
          ... on PullRequestReviewComment {
            pullRequestReviewThread { id, isResolved }
          }
        }
      }
    `;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const resp = await octokit.graphql(threadQuery, { commentId: parsed.comment_id }) as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    threadId = resp?.node?.pullRequestReviewThread?.id;
    if (!threadId) {
      throw new Error('Unable to resolve thread_id from comment_id');
    }
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
  const statusResp = await octokit.graphql(statusQuery, { threadId }) as any;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const threadNode = statusResp?.node as { id?: string; isResolved?: boolean } | undefined;
  if (threadNode && threadNode.isResolved) {
    return { ok: true, thread_id: threadId!, alreadyResolved: true, message: 'Thread already resolved' };
  }

  const mutation = `
    mutation($threadId: ID!) {
      resolveReviewThread(input: { threadId: $threadId }) {
        thread { id isResolved }
      }
    }
  `;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
  const mutResp = await octokit.graphql(mutation, { threadId }) as any;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const isResolved = Boolean(mutResp?.resolveReviewThread?.thread?.isResolved);
  return { ok: isResolved, thread_id: threadId!, alreadyResolved: false };
}


