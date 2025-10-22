import type { GitHubClient } from '../../github/client.js';
import { parsePRIdentifier, formatPRIdentifier } from '../../utils/parser.js';
import { cursorToGitHubPagination, createNextCursor } from '../../utils/pagination.js';
import type { FindUnresolvedCommentsInput, FindUnresolvedCommentsOutput, Comment } from './schema.js';
import { generateActionCommands } from './command-generator.js';

/**
 * Find unresolved comments in a GitHub pull request
 * @param client - GitHub API client instance
 * @param input - Input parameters including PR identifier and options
 * @returns Promise resolving to unresolved comments and pagination info
 */
export async function handleFindUnresolvedComments(
  client: GitHubClient,
  input: FindUnresolvedCommentsInput
): Promise<FindUnresolvedCommentsOutput> {
  const pr = parsePRIdentifier(input.pr);
  const octokit = client.getOctokit();
  
  // Convert cursor to GitHub pagination parameters
  const githubPagination = cursorToGitHubPagination(input.cursor, 20);
  
  // Fetch review comments with server-side pagination
  const reviewCommentsResponse = await octokit.pulls.listReviewComments({
    owner: pr.owner,
    repo: pr.repo,
    pull_number: pr.number,
    page: githubPagination.page,
    per_page: githubPagination.per_page
  });
  
  // Fetch GraphQL node IDs for review comments and their threads
  const nodeIdMap = await fetchReviewCommentNodeIds(octokit, pr, reviewCommentsResponse.data.map(c => c.id));
  
  // Fetch issue comments (general PR comments) with server-side pagination
  const issueCommentsResponse = await octokit.issues.listComments({
    owner: pr.owner,
    repo: pr.repo,
    issue_number: pr.number,
    page: githubPagination.page,
    per_page: githubPagination.per_page
  });
  
  // Convert to our Comment type with action commands and hints
  const allComments: Comment[] = [
    ...reviewCommentsResponse.data.map(c => {
      const author = c.user?.login || 'unknown';
      const authorAssociation = c.author_association || 'NONE';
      const isBot = c.user?.type === 'Bot';
      const body = c.body;
      
      return {
        id: c.id,
        type: 'review_comment' as const,
        author,
        author_association: authorAssociation,
        is_bot: isBot,
        created_at: c.created_at,
        updated_at: c.updated_at,
        file_path: c.path,
        line_number: c.line || undefined,
        start_line: c.start_line || undefined,
        diff_hunk: c.diff_hunk || undefined,
        body,
        in_reply_to_id: c.in_reply_to_id || undefined,
        reactions: c.reactions ? {
          total_count: c.reactions.total_count,
          '+1': c.reactions['+1'],
          '-1': c.reactions['-1'],
          laugh: c.reactions.laugh,
          hooray: c.reactions.hooray,
          confused: c.reactions.confused,
          heart: c.reactions.heart,
          rocket: c.reactions.rocket,
          eyes: c.reactions.eyes
        } : undefined,
        html_url: c.html_url,
        action_commands: generateActionCommands(
          pr, 
          c.id, 
          'review_comment', 
          body, 
          c.path,
          nodeIdMap.get(c.id) // Pass GraphQL thread ID if available
        )
      };
    }),
    ...issueCommentsResponse.data.map(c => {
      const author = c.user?.login || 'unknown';
      const authorAssociation = c.author_association || 'NONE';
      const isBot = c.user?.type === 'Bot';
      const body = c.body || '';
      
      return {
        id: c.id,
        type: 'issue_comment' as const,
        author,
        author_association: authorAssociation,
        is_bot: isBot,
        created_at: c.created_at,
        updated_at: c.updated_at,
        body,
        reactions: c.reactions ? {
          total_count: c.reactions.total_count,
          '+1': c.reactions['+1'],
          '-1': c.reactions['-1'],
          laugh: c.reactions.laugh,
          hooray: c.reactions.hooray,
          confused: c.reactions.confused,
          heart: c.reactions.heart,
          rocket: c.reactions.rocket,
          eyes: c.reactions.eyes
        } : undefined,
        html_url: c.html_url,
        action_commands: generateActionCommands(pr, c.id, 'issue_comment', body)
      };
    })
  ];
  
  // Filter by bots if requested
  let filtered = allComments;
  if (!input.include_bots) {
    filtered = filtered.filter(c => !c.is_bot);
  }
  
  // Filter by excluded authors
  if (input.exclude_authors && input.exclude_authors.length > 0) {
    filtered = filtered.filter(c => !input.exclude_authors!.includes(c.author));
  }
  
  // Sort comments
  switch (input.sort) {
    case 'chronological':
      filtered.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      break;
    case 'by_file':
      filtered.sort((a, b) => {
        const fileA = a.file_path || '';
        const fileB = b.file_path || '';
        return fileA.localeCompare(fileB);
      });
      break;
    case 'by_author':
      filtered.sort((a, b) => a.author.localeCompare(b.author));
      break;
  }
  
  // Check if there are more results by looking at response headers
  // GitHub API includes Link header with pagination info
  const hasMoreReviewComments = reviewCommentsResponse.headers.link?.includes('rel="next"') ?? false;
  const hasMoreIssueComments = issueCommentsResponse.headers.link?.includes('rel="next"') ?? false;
  const hasMore = hasMoreReviewComments || hasMoreIssueComments;
  
  // Create next cursor if there are more results
  const nextCursor = createNextCursor(input.cursor, githubPagination.per_page, hasMore);
  
  // Generate summary statistics for current page only
  const byAuthor: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let botCount = 0;
  let withReactions = 0;
  
  for (const comment of filtered) {
    byAuthor[comment.author] = (byAuthor[comment.author] || 0) + 1;
    byType[comment.type] = (byType[comment.type] || 0) + 1;
    if (comment.is_bot) botCount++;
    if (comment.reactions && comment.reactions.total_count > 0) withReactions++;
  }
  
  return {
    pr: formatPRIdentifier(pr),
    unresolved_in_page: filtered.length, // Current page count
    comments: filtered, // Current page comments
    nextCursor,
    summary: {
      comments_in_page: filtered.length, // Current page count
      by_author: byAuthor,
      by_type: byType,
      bot_comments: botCount,
      human_comments: filtered.length - botCount,
      with_reactions: withReactions
    }
  };
}

/**
 * Fetch GraphQL node IDs and thread IDs for review comments
 * Maps REST API numeric comment IDs to GraphQL thread node IDs
 */
async function fetchReviewCommentNodeIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  octokit: any,
  pr: { owner: string; repo: string; number: number },
  commentIds: number[]
): Promise<Map<number, string>> {
  const nodeIdMap = new Map<number, string>();
  
  if (commentIds.length === 0) {
    return nodeIdMap;
  }
  
  // Fetch review threads with comments via GraphQL
  const query = `
    query($owner: String!, $repo: String!, $pr: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100) {
            nodes {
              id
              comments(first: 10) {
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
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const response = await octokit.graphql(query, {
      owner: pr.owner,
      repo: pr.repo,
      pr: pr.number
    });
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const threads = response?.repository?.pullRequest?.reviewThreads?.nodes || [];
    
    // Map each comment's databaseId (numeric ID) to its thread's GraphQL node ID
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    threads.forEach((thread: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const threadId = thread.id as string;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const comments = thread.comments?.nodes || [];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      comments.forEach((comment: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const dbId = comment.databaseId as number;
        if (dbId && commentIds.includes(dbId)) {
          nodeIdMap.set(dbId, threadId);
        }
      });
    });
  } catch (error) {
    // If GraphQL fails, return empty map - comments will still work via resolve_command
    console.warn(`Failed to fetch GraphQL node IDs: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return nodeIdMap;
}

