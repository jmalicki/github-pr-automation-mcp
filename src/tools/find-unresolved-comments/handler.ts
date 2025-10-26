import type { GitHubClient } from '../../github/client.js';
import { parsePRIdentifier, formatPRIdentifier } from '../../utils/parser.js';
import { cursorToGitHubPagination, createNextCursor } from '../../utils/pagination.js';
import type { FindUnresolvedCommentsInput, FindUnresolvedCommentsOutput, Comment } from './schema.js';
import { generateActionCommands } from './command-generator.js';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import type { Octokit } from '@octokit/rest';

// Type aliases for better readability
type ReviewList = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'];
type Review = ReviewList[number];

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

  // Fetch reviews to parse for actionable comments in review bodies
  let reviewBodiesComments: Comment[] = [];
  let hasMoreReviews = false;
  if (input.parse_review_bodies) {
    const reviewsResponse = await octokit.pulls.listReviews({
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.number,
      page: githubPagination.page,
      per_page: githubPagination.per_page
    });
    
    reviewBodiesComments = parseReviewBodiesForActionableComments(
      reviewsResponse.data,
      pr
    );
    hasMoreReviews = reviewsResponse.headers.link?.includes('rel="next"') ?? false;
  }
  
  // Convert to our Comment type with action commands and hints
  const allComments: Comment[] = [
    ...reviewBodiesComments, // Add parsed actionable comments from review bodies
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
  const hasMore = hasMoreReviewComments || hasMoreIssueComments || hasMoreReviews;
  
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
  octokit: InstanceType<typeof Octokit>,
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
    const idSet = new Set(commentIds);
    threads.forEach((thread) => {
      const threadId = thread.id;
      const comments = thread.comments?.nodes || [];
      comments.forEach((comment) => {
        const dbId = comment.databaseId;
        if (dbId != null && idSet.has(dbId)) {
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

/**
 * Parse review bodies for actionable comments from AI review tools
 * Extracts structured actionable feedback from review bodies (e.g., CodeRabbit AI)
 */
function parseReviewBodiesForActionableComments(
  reviews: ReviewList,
  pr: { owner: string; repo: string; number: number }
): Comment[] {
  const actionableComments: Comment[] = [];
  
  for (const review of reviews) {
    if (!review.body || review.state === 'PENDING') {
      continue;
    }
    
    const body = review.body;
    const author = review.user?.login || 'unknown';
    const authorAssociation = review.author_association || 'NONE';
    const isBot = review.user?.type === 'Bot';
    
    // Parse CodeRabbit AI review body for actionable comments
    const codeRabbitComments = parseCodeRabbitReviewBody(body, review, pr, author, authorAssociation, isBot);
    actionableComments.push(...codeRabbitComments);
    
    // Add support for other AI review tools here in the future
    // e.g., GitHub Copilot, SonarQube, etc.
  }
  return actionableComments;
}

/**
 * Parse CodeRabbit AI review body for actionable comments
 * Extracts nitpick comments, actionable suggestions, and other structured feedback
 */
function parseCodeRabbitReviewBody(
  body: string,
  review: Review,
  pr: { owner: string; repo: string; number: number },
  author: string,
  authorAssociation: string,
  isBot: boolean
): Comment[] {
  const comments: Comment[] = [];
  
  // Extract actionable suggestions from the review body
  const lines = body.split('\n');
  let currentFile = '';
  let currentLineRange = '';
  let currentSuggestion = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect file context:
    // - <summary>scripts/install-cli.js (1)</summary>
    // - `scripts/install-cli.js (1)` or plain "scripts/install-cli.js (1)"
    const fileMatch =
      line.match(/^<summary>\s*`?([^<`]+?)`?\s*\((\d+)\)\s*<\/summary>/i) ||
      line.match(/^\s*`?([^<`]+?)`?\s*\((\d+)\)\s*$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      continue;
    }
    
    // Detect line or line-range header:
    // - `36-41`: **...** or 36-41: **...**
    // - `36`: **...** or 36: **...**
    const lineRangeMatch = line.match(/^(?:`)?(\d+(?:-\d+)?)`?:\s*\*\*(.*?)\*\*/);
    if (lineRangeMatch) {
      currentLineRange = lineRangeMatch[1];
      currentSuggestion = lineRangeMatch[2];
      
      // Look for code suggestion in next few lines
      let suggestionBody = currentSuggestion;
      let inCodeBlock = false;
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const nextLine = lines[j];
        if (nextLine.startsWith('```diff') || nextLine.startsWith('```')) {
          inCodeBlock = true;
          suggestionBody += '\n\n' + nextLine;
        } else if (inCodeBlock) {
          suggestionBody += '\n' + nextLine;
          if (nextLine.startsWith('```')) {
            inCodeBlock = false;
            break;
          }
        } else if (nextLine.trim() && !nextLine.startsWith('---') && !nextLine.startsWith('</blockquote>') && !nextLine.startsWith('<summary>')) {
          suggestionBody += '\n' + nextLine;
        } else if (nextLine.startsWith('---') || nextLine.startsWith('</blockquote>')) {
          break;
        }
      }
      
      // Create actionable comment - use currentFile if available, otherwise try to extract from context
      if (currentSuggestion) {
        // If we don't have a file yet, try to find it in the recent context
        let fileToUse = currentFile;
        if (!fileToUse) {
          // Look backwards for file context
          for (let k = Math.max(0, i - 10); k < i; k++) {
            const prevLine = lines[k];
            const prevFileMatch =
              prevLine.match(/^<summary>\s*`?([^<`]+?)`?\s*\((\d+)\)\s*<\/summary>/i) ||
              prevLine.match(/^\s*`?([^<`]+?)`?\s*\((\d+)\)\s*$/);
            if (prevFileMatch) {
              fileToUse = prevFileMatch[1];
              break;
            }
          }
        }
        
        // If still no file, use a default
        if (!fileToUse) {
          fileToUse = 'unknown-file';
        }
        
        const commentId = `review-${review.id}-${currentLineRange}`;
        comments.push({
          id: parseInt(commentId.replace(/\D/g, '')) || Date.now(),
          type: 'review',
          author,
          author_association: authorAssociation,
          is_bot: isBot,
          created_at: review.submitted_at ?? '',
          updated_at: review.submitted_at ?? '',
          file_path: fileToUse,
          line_number: parseInt(currentLineRange.split('-')[0]),
          body: suggestionBody,
          html_url: review.html_url,
          action_commands: generateActionCommands(
            pr,
            review.id,
            'review',
            suggestionBody,
            fileToUse
          )
        });
      }
    }
  }
  
  
  return comments;
}

