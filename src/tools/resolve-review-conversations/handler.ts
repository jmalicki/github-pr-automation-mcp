import { GitHubClient } from '../../github/client.js';
import { ResolveReviewConversationsInput, ResolveReviewConversationsOutput, ResolveReviewConversationsInputSchema } from './schema.js';
import { parsePRIdentifier } from '../../utils/parser.js';
import { paginateResults } from '../../utils/pagination.js';

export async function handleResolveReviewConversations(client: GitHubClient, input: ResolveReviewConversationsInput): Promise<ResolveReviewConversationsOutput> {
  const parsed = ResolveReviewConversationsInputSchema.parse(input);
  
  // Parse PR identifier
  const pr = parsePRIdentifier(parsed.pr);
  
  // Fetch review threads using GraphQL
  const threads = await fetchReviewThreads(client, pr, parsed.only_unresolved, parsed.limit);
  
  // Generate MCP action for each thread
  const threadsWithCommands = threads.map(thread => ({
    ...thread,
    action_commands: {
      mcp_action: {
        tool: 'resolve_review_thread' as const,
        args: { pr: parsed.pr, thread_id: thread.id }
      },
      view_in_browser: generateViewCommand(pr, thread.id)
    }
  }));
  
  // Apply pagination
  const pageSize = 10; // Server-controlled page size
  const paginated = paginateResults(threadsWithCommands, parsed.cursor, pageSize);
  
  // Calculate summary
  const total = threads.length;
  const unresolved = threads.filter(t => !t.is_resolved).length;
  const suggested = threadsWithCommands.length;
  
  return {
    pr: parsed.pr,
    threads: paginated.items,
    nextCursor: paginated.nextCursor,
    summary: {
      total,
      unresolved,
      suggested
    }
  };
}

async function fetchReviewThreads(client: GitHubClient, pr: { owner: string; repo: string; number: number }, onlyUnresolved: boolean, limit?: number): Promise<Array<{ id: string; is_resolved: boolean; preview: string }>> {
  const query = `
    query($owner: String!, $repo: String!, $pr: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100) {
            nodes {
              id
              isResolved
              comments(first: 5) {
                nodes {
                  body
                  author { login }
                }
              }
            }
          }
        }
      }
    }
  `;
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const response = await client.getOctokit().graphql(query, {
      owner: pr.owner,
      repo: pr.repo,
      pr: pr.number
    }) as any;
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const threads = response.repository?.pullRequest?.reviewThreads?.nodes || [];
    
    // Filter by resolution status if requested
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const filtered = onlyUnresolved ? threads.filter((t: any) => !t.isResolved) : threads;
    
    // Apply limit if specified
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const limited = limit ? filtered.slice(0, limit) : filtered;
    
    // Transform to our format
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return limited.map((thread: any) => ({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      id: thread.id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      is_resolved: thread.isResolved,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      preview: thread.comments.nodes[0]?.body?.substring(0, 200) || 'No preview available'
    }));
  } catch (error) {
    throw new Error(`Failed to fetch review threads: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function generateViewCommand(pr: { owner: string; repo: string; number: number }, threadId: string): string {
  return `https://github.com/${pr.owner}/${pr.repo}/pull/${pr.number}#discussion_r${threadId}`;
}



