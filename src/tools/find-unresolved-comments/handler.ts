import type { GitHubClient } from '../../github/client.js';
import { parsePRIdentifier, formatPRIdentifier } from '../../utils/parser.js';
import { cursorToGitHubPagination, createNextCursor } from '../../utils/pagination.js';
import type { FindUnresolvedCommentsInput, FindUnresolvedCommentsOutput, Comment } from './schema.js';
import { generateActionCommands } from './command-generator.js';
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import type { Octokit } from '@octokit/rest';

/**
 * Calculate status indicators for a comment
 */
function calculateStatusIndicators(comment: Comment, allComments?: Comment[]): Comment['status_indicators'] {
  const hasMcpAction = !!comment.action_commands.mcp_action;
  // Check if this comment has replies by looking for other comments that reply to it
  const hasManualResponse = allComments ? allComments.some(c => c.in_reply_to_id === comment.id) : false;
  const isActionable = comment.coderabbit_metadata?.suggestion_type === 'actionable' || 
                      comment.body.toLowerCase().includes('fix') ||
                      comment.body.toLowerCase().includes('suggest') ||
                      comment.body.toLowerCase().includes('change');
  
  // Use GitHub API's outdated field (available for review comments)
  const isOutdated = comment.outdated || false;
  
  // Calculate priority score (0-100)
  let priorityScore = 0;
  
  // Base priority from CodeRabbit metadata
  if (comment.coderabbit_metadata) {
    switch (comment.coderabbit_metadata.severity) {
      case 'high': priorityScore += 40; break;
      case 'medium': priorityScore += 25; break;
      case 'low': priorityScore += 10; break;
    }
    
    switch (comment.coderabbit_metadata.suggestion_type) {
      case 'actionable': priorityScore += 30; break;
      case 'additional': priorityScore += 20; break;
      case 'nit': priorityScore += 5; break;
      case 'duplicate': priorityScore += 0; break;
    }
  }
  
  // Boost priority for bot comments with MCP actions
  if (comment.is_bot && hasMcpAction) {
    priorityScore += 20;
  }
  
  // Boost priority for actionable content
  if (isActionable) {
    priorityScore += 15;
  }
  
  // Reduce priority if already has manual response
  if (hasManualResponse) {
    priorityScore -= 10;
  }
  
  // Reduce priority for outdated comments
  if (isOutdated) {
    priorityScore -= 20; // Significant reduction for outdated comments
  }
  
  // Cap at 100
  priorityScore = Math.min(100, Math.max(0, priorityScore));
  
  // Determine resolution status
  let resolutionStatus: 'unresolved' | 'acknowledged' | 'in_progress' | 'resolved';
  if (hasManualResponse && isActionable) {
    resolutionStatus = 'in_progress';
  } else if (hasManualResponse) {
    resolutionStatus = 'acknowledged';
  } else {
    resolutionStatus = 'unresolved';
  }
  
  // Determine suggested action
  let suggestedAction: 'reply' | 'resolve' | 'investigate' | 'ignore';
  if (hasMcpAction && !hasManualResponse) {
    suggestedAction = 'resolve';
  } else if (isActionable && !hasManualResponse) {
    suggestedAction = 'reply';
  } else if (priorityScore < 30) {
    suggestedAction = 'ignore';
  } else {
    suggestedAction = 'investigate';
  }
  
  return {
    needs_mcp_resolution: hasMcpAction,
    has_manual_response: hasManualResponse,
    is_actionable: isActionable,
    is_outdated: isOutdated,
    priority_score: priorityScore,
    resolution_status: resolutionStatus,
    suggested_action: suggestedAction
  };
}

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
  
  // Fetch GraphQL node IDs and resolved status for review comments and their threads
  const { nodeIdMap, resolvedThreadIds } = await fetchReviewCommentNodeIds(octokit, pr, reviewCommentsResponse.data.map(c => c.id));
  
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
  if (input.parse_review_bodies !== false) {
    const reviewsResponse = await octokit.pulls.listReviews({
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.number,
      page: githubPagination.page,
      per_page: githubPagination.per_page
    });
    
    reviewBodiesComments = parseReviewBodiesForActionableComments(
      reviewsResponse.data,
      pr,
      input.coderabbit_options,
      input.include_status_indicators
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
      const body = c.body || '';
      
      const comment: Comment = {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        outdated: Boolean((c as any).outdated),
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
      
      
      return comment;
    }),
    ...issueCommentsResponse.data.map(c => {
      const author = c.user?.login || 'unknown';
      const authorAssociation = c.author_association || 'NONE';
      const isBot = c.user?.type === 'Bot';
      const body = c.body || '';
      
      const comment: Comment = {
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
      
      
      return comment;
    })
  ];
  
  // Calculate status indicators for all comments (second pass)
  if (input.include_status_indicators !== false) {
    for (const comment of allComments) {
      comment.status_indicators = calculateStatusIndicators(comment, allComments);
    }
  }
  
  // Filter out resolved comments at the thread level
  let filtered = allComments.filter(comment => {
    // For review comments, check if the thread is resolved via GitHub API
    if (comment.type === 'review_comment') {
      const threadId = nodeIdMap.get(comment.id);
      if (threadId && resolvedThreadIds.has(threadId)) {
        return false; // Exclude ALL comments from resolved threads
      }
    }
    
    // Exclude reply comments - only return original thread starters
    if (comment.in_reply_to_id) {
      return false; // Exclude comments that are replies to other comments
    }
    
    // Issue comments don't have a resolved status in GitHub API
    // They remain as unresolved unless explicitly resolved by GitHub's system
    
    return true; // Include unresolved comments
  });
  
  // Filter by bots if requested
  if (!input.include_bots) {
    filtered = filtered.filter(c => !c.is_bot);
  }
  
  // Filter by excluded authors
  if (input.exclude_authors && input.exclude_authors.length > 0) {
    filtered = filtered.filter(c => !input.exclude_authors!.includes(c.author));
  }
  
  // Apply CodeRabbit-specific filtering and grouping
  if (input.coderabbit_options) {
    filtered = applyCodeRabbitFiltering(filtered, input.coderabbit_options);
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
    case 'priority':
      // Priority-based sorting when enabled
      if (input.priority_ordering !== false && input.include_status_indicators !== false) {
        filtered.sort((a, b) => {
          const scoreA = a.status_indicators?.priority_score || 0;
          const scoreB = b.status_indicators?.priority_score || 0;
          
          // First sort by priority score (descending)
          if (scoreA !== scoreB) {
            return scoreB - scoreA;
          }
          
          // Then by MCP resolution capability
          const mcpA = a.status_indicators?.needs_mcp_resolution ? 1 : 0;
          const mcpB = b.status_indicators?.needs_mcp_resolution ? 1 : 0;
          if (mcpA !== mcpB) {
            return mcpB - mcpA;
          }
          
          // Finally by creation date (newest first)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      } else {
        // Fall back to chronological if priority ordering is disabled
        filtered.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
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
  
  // Priority-based summary statistics
  let highPriorityCount = 0;
  let mediumPriorityCount = 0;
  let lowPriorityCount = 0;
  let needsMcpResolutionCount = 0;
  let hasManualResponsesCount = 0;
  let actionableItemsCount = 0;
  let outdatedCommentsCount = 0;
  
  // Status-based grouping
  const statusGroups: {
    unresolved: Comment[];
    acknowledged: Comment[];
    in_progress: Comment[];
    resolved: Comment[];
  } = {
    unresolved: [],
    acknowledged: [],
    in_progress: [],
    resolved: []
  };
  
  for (const comment of filtered) {
    byAuthor[comment.author] = (byAuthor[comment.author] || 0) + 1;
    byType[comment.type] = (byType[comment.type] || 0) + 1;
    if (comment.is_bot) botCount++;
    if (comment.reactions && comment.reactions.total_count > 0) withReactions++;
    
    // Process status indicators if available
    if (comment.status_indicators) {
      const indicators = comment.status_indicators;
      
      // Priority counts
      if (indicators.priority_score >= 70) {
        highPriorityCount++;
      } else if (indicators.priority_score >= 30) {
        mediumPriorityCount++;
      } else {
        lowPriorityCount++;
      }
      
      // Status counts
      if (indicators.needs_mcp_resolution) needsMcpResolutionCount++;
      if (indicators.has_manual_response) hasManualResponsesCount++;
      if (indicators.is_actionable) actionableItemsCount++;
      if (indicators.is_outdated) outdatedCommentsCount++;
      
      // Status grouping
      statusGroups[indicators.resolution_status].push(comment);
    }
  }
  
  // Build summary object
  const summary: FindUnresolvedCommentsOutput['summary'] = {
    comments_in_page: filtered.length, // Current page count
    by_author: byAuthor,
    by_type: byType,
    bot_comments: botCount,
    human_comments: filtered.length - botCount,
    with_reactions: withReactions
  };
  
  // Add priority summary if status indicators are enabled
  if (input.include_status_indicators !== false) {
    summary.priority_summary = {
      high_priority: highPriorityCount,
      medium_priority: mediumPriorityCount,
      low_priority: lowPriorityCount,
      needs_mcp_resolution: needsMcpResolutionCount,
      has_manual_responses: hasManualResponsesCount,
      actionable_items: actionableItemsCount,
      outdated_comments: outdatedCommentsCount
    };
  }
  
  // Add status groups if priority ordering is enabled
  if (input.priority_ordering !== false && input.include_status_indicators !== false) {
    summary.status_groups = statusGroups;
  }
  
  return {
    pr: formatPRIdentifier(pr),
    unresolved_in_page: filtered.length, // Current page count
    comments: filtered, // Current page comments
    nextCursor,
    summary
  };
}

/**
 * Fetch GraphQL node IDs and thread IDs for review comments
 * Maps REST API numeric comment IDs to GraphQL thread node IDs and tracks resolved status
 */
async function fetchReviewCommentNodeIds(
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

/**
 * Parse review bodies for actionable comments from AI review tools
 * Extracts structured actionable feedback from review bodies (e.g., CodeRabbit AI)
 */
function parseReviewBodiesForActionableComments(
  reviews: ReviewList,
  pr: { owner: string; repo: string; number: number },
  coderabbitOptions?: {
    include_nits?: boolean;
    include_duplicates?: boolean;
    include_additional?: boolean;
    suggestion_types?: string[];
    prioritize_actionable?: boolean;
    group_by_type?: boolean;
    extract_agent_prompts?: boolean;
  },
  includeStatusIndicators?: boolean
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
    const codeRabbitComments = parseCodeRabbitReviewBody(body, review, pr, author, authorAssociation, isBot, coderabbitOptions, includeStatusIndicators);
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
  isBot: boolean,
  coderabbitOptions?: {
    include_nits?: boolean;
    include_duplicates?: boolean;
    include_additional?: boolean;
    suggestion_types?: string[];
    prioritize_actionable?: boolean;
    group_by_type?: boolean;
    extract_agent_prompts?: boolean;
  },
  includeStatusIndicators?: boolean
): Comment[] {
  const comments: Comment[] = [];
  
  // Parse structured CodeRabbit sections
  const sections = parseCodeRabbitSections(body);
  
  for (const section of sections) {
    // Apply filtering based on coderabbit_options
    if (coderabbitOptions) {
      if (coderabbitOptions.suggestion_types && !coderabbitOptions.suggestion_types.includes(section.type)) {
        continue;
      }
      
      switch (section.type) {
        case 'nit':
          if (coderabbitOptions.include_nits === false) continue;
          break;
        case 'duplicate':
          if (coderabbitOptions.include_duplicates === false) continue;
          break;
        case 'additional':
          if (coderabbitOptions.include_additional === false) continue;
          break;
        case 'actionable':
          // Always include actionable items
          break;
      }
    }
    
    // Parse individual items in this section
    for (const item of section.items) {
      const comment = createCodeRabbitComment(
        item,
        section.type,
        review,
        pr,
        author,
        authorAssociation,
        isBot,
        coderabbitOptions,
        includeStatusIndicators
      );
      comments.push(comment);
    }
  }
  
  // Apply final filtering based on coderabbit_options
  if (coderabbitOptions) {
    return applyCodeRabbitFiltering(comments, coderabbitOptions);
  }
  
  return comments;
}

/**
 * Parse CodeRabbit structured sections from review body
 */
function parseCodeRabbitSections(body: string): Array<{
  type: 'nit' | 'duplicate' | 'additional' | 'actionable';
  title: string;
  count: number;
  content: string;
  items: Array<{
    file_path: string;
    line_range: string;
    title: string;
    description: string;
    code_suggestion?: {
      old_code: string;
      new_code: string;
      language: string;
    };
    severity: 'low' | 'medium' | 'high';
  }>;
}> {
  const sections: Array<{
    type: 'nit' | 'duplicate' | 'additional' | 'actionable';
    title: string;
    count: number;
    content: string;
    items: Array<{
      file_path: string;
      line_range: string;
      title: string;
      description: string;
      code_suggestion?: {
        old_code: string;
        new_code: string;
        language: string;
      };
      severity: 'low' | 'medium' | 'high';
    }>;
  }> = [];
  
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
  const lines = body.split('\n');
  let currentSection: any = null;
  let currentItem: any = null;
  let currentFile = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect section headers - handle multi-line format
    if (line.includes('<details>') && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const sectionMatch = nextLine.match(/<summary>\s*(🧹|♻️|♻|📜)\s*([^<]+)\s*\((\d+)\)\s*<\/summary>/u);
      if (sectionMatch) {
        const emoji = sectionMatch[1];
        const title = sectionMatch[2].trim();
        const count = parseInt(sectionMatch[3]);
        
        let type: 'nit' | 'duplicate' | 'additional' | 'actionable';
        if (emoji.includes('🧹')) type = 'nit';
        else if (emoji.includes('♻')) type = 'duplicate';
        else if (emoji.includes('📜')) type = 'additional';
        else type = 'actionable';
        
        currentSection = {
          type,
          title,
          count,
          content: '',
          items: []
        };
        sections.push(currentSection);
        i++; // Skip the summary line
        continue;
      }
      
      // Handle actionable comments without emoji
      const actionableMatch = nextLine.match(/<summary>\s*([^<]+)\s*:\s*(\d+)\s*<\/summary>/u);
      if (actionableMatch && nextLine.toLowerCase().includes('actionable')) {
        const title = actionableMatch[1].trim();
        const count = parseInt(actionableMatch[2]);
        
        currentSection = {
          type: 'actionable',
          title,
          count,
          content: '',
          items: []
        };
        sections.push(currentSection);
        i++; // Skip the summary line
        continue;
      }
    }
    
    // Detect file context within sections
    const fileMatch = line.match(/<summary>\s*`?([^<`]+?)`?\s*\((\d+)\)\s*<\/summary>/i);
    if (fileMatch && currentSection) {
      currentFile = fileMatch[1];
      continue;
    }
    
    // Detect line range and suggestion
    const lineRangeMatch = line.match(/^(?:`|\\`)?(\d+(?:-\d+)?)(?:`|\\`)?:\s*\*\*(.*?)\*\*/);
    if (lineRangeMatch && currentSection) {
      const lineRange = lineRangeMatch[1];
      const title = lineRangeMatch[2];
      
      // Extract description and code suggestion
      let description = title;
      let codeSuggestion: any = null;
      let inCodeBlock = false;
      let codeBlockContent = '';
      
      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        const nextLine = lines[j];
        
        if (nextLine.startsWith('```diff') || nextLine.startsWith('\\`\\`\\`diff')) {
          inCodeBlock = true;
          codeBlockContent = nextLine + '\n';
          description += '\n' + nextLine; // Include code block in description
        } else if (inCodeBlock) {
          codeBlockContent += nextLine + '\n';
          description += '\n' + nextLine; // Include code block in description
          if (nextLine.startsWith('```') || nextLine.startsWith('\\`\\`\\`')) {
            inCodeBlock = false;
            // Parse code suggestion
            const diffMatch = codeBlockContent.match(/```diff\n([\s\S]*?)\n```/) || codeBlockContent.match(/\\`\\`\\`diff\n([\s\S]*?)\n\\`\\`\\`/);
            if (diffMatch) {
              const diffContent = diffMatch[1];
              const oldLines = diffContent
                .split('\n')
                .filter(l => l.startsWith('-') && !l.startsWith('---'))
                .map(l => l.substring(1));
              const newLines = diffContent
                .split('\n')
                .filter(l => l.startsWith('+') && !l.startsWith('+++'))
                .map(l => l.substring(1));
              codeSuggestion = {
                old_code: oldLines.join('\n'),
                new_code: newLines.join('\n'),
                language: 'typescript'
              };
            }
            break;
          }
        } else if (nextLine.trim() && !nextLine.startsWith('---') && !nextLine.startsWith('</blockquote>') && !nextLine.startsWith('<summary>')) {
          description += '\n' + nextLine;
        } else if (nextLine.startsWith('---') || nextLine.startsWith('</blockquote>')) {
          break;
        }
      }
      
      currentItem = {
        file_path: currentFile || 'unknown-file',
        line_range: lineRange,
        title,
        description,
        code_suggestion: codeSuggestion,
        severity: currentSection.type === 'nit' ? 'low' : currentSection.type === 'actionable' ? 'high' : 'medium'
      };
      
      if (currentSection) {
        currentSection.items.push(currentItem);
      }
    }
  }
  
  return sections;
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
}

/**
 * Create a CodeRabbit comment with enhanced metadata
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
function createCodeRabbitComment(
  item: any,
  suggestionType: string,
  review: any,
  pr: { owner: string; repo: string; number: number },
  author: string,
  authorAssociation: string,
  isBot: boolean,
  coderabbitOptions?: any,
  includeStatusIndicators?: boolean
): Comment {
  const lineStart = parseInt(item.line_range.split('-')[0]);
  const lineEnd = item.line_range.includes('-') ? parseInt(item.line_range.split('-')[1]) : lineStart;
  
  // Generate agent prompt if requested
  let agentPrompt: string | undefined;
  if (coderabbitOptions?.extract_agent_prompts !== false) {
    agentPrompt = generateAgentPrompt(item, suggestionType);
  }
  
  const comment: Comment = {
    id: parseInt(`review-${review.id}-${item.line_range}`.replace(/\D/g, '')) || Date.now(),
    type: 'review',
    author,
    author_association: authorAssociation,
    is_bot: isBot,
    created_at: review.submitted_at || review.created_at,
    updated_at: review.submitted_at || review.created_at,
    file_path: item.file_path,
    line_number: lineStart,
    body: item.description,
    html_url: review.html_url,
    action_commands: generateActionCommands(
      pr,
      review.id,
      'review',
      item.description,
      item.file_path
    ),
    coderabbit_metadata: {
      suggestion_type: suggestionType as 'nit' | 'duplicate' | 'additional' | 'actionable',
      severity: item.severity,
      category: inferCategory(item.description),
      file_context: {
        path: item.file_path,
        line_start: lineStart,
        line_end: lineEnd
      },
      code_suggestion: item.code_suggestion,
      agent_prompt: agentPrompt,
      implementation_guidance: {
        priority: item.severity,
        effort_estimate: suggestionType === 'nit' ? 'Quick fix (1-2 minutes)' : 'Medium effort (2-5 minutes)',
        rationale: item.description
      }
    }
  };
  
  // Add status indicators if enabled
  if (includeStatusIndicators !== false) {
    comment.status_indicators = calculateStatusIndicators(comment);
  }
  
  return comment;
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
}

/**
 * Generate agent-friendly prompt from CodeRabbit suggestion
 */
function generateAgentPrompt(item: { file_path: string; line_range: string; code_suggestion?: { old_code: string; new_code: string }; description: string }, suggestionType: string): string {
  const basePrompt = `CodeRabbit ${suggestionType} suggestion for ${item.file_path}:${item.line_range}`;
  
  if (item.code_suggestion) {
    return `${basePrompt}
    
Current code:
\`\`\`typescript
${item.code_suggestion.old_code}
\`\`\`

Suggested change:
\`\`\`typescript
${item.code_suggestion.new_code}
\`\`\`

Context: ${item.description}
Priority: ${suggestionType === 'nit' ? 'Low' : 'Medium'}
Effort: Quick fix (1-2 minutes)`;
  }
  
  return `${basePrompt}
  
Description: ${item.description}
Priority: ${suggestionType === 'nit' ? 'Low' : 'Medium'}`;
}

/**
 * Infer category from suggestion description
 */
function inferCategory(description: string): string {
  const lowerDesc = description.toLowerCase();
  if (lowerDesc.includes('security') || lowerDesc.includes('vulnerability')) return 'security';
  if (lowerDesc.includes('performance') || lowerDesc.includes('slow') || lowerDesc.includes('optimize')) return 'performance';
  if (lowerDesc.includes('style') || lowerDesc.includes('format') || lowerDesc.includes('lint')) return 'style';
  if (lowerDesc.includes('error') || lowerDesc.includes('exception') || lowerDesc.includes('bug')) return 'bug';
  return 'general';
}

/**
 * Apply CodeRabbit-specific filtering and grouping
 */
function applyCodeRabbitFiltering(
  comments: Comment[],
  options: {
    include_nits?: boolean;
    include_duplicates?: boolean;
    include_additional?: boolean;
    suggestion_types?: string[];
    prioritize_actionable?: boolean;
    group_by_type?: boolean;
    extract_agent_prompts?: boolean;
  }
): Comment[] {
  let filtered = comments;
  
  // Filter CodeRabbit comments based on options
  filtered = filtered.filter(comment => {
    if (!comment.coderabbit_metadata) return true; // Keep non-CodeRabbit comments
    
    const { suggestion_type } = comment.coderabbit_metadata;
    
    // Apply type-based filtering
    if (options.suggestion_types && !options.suggestion_types.includes(suggestion_type)) {
      return false;
    }
    
    // Apply boolean filters
    switch (suggestion_type) {
      case 'nit':
        return options.include_nits !== false;
      case 'duplicate':
        return options.include_duplicates !== false;
      case 'additional':
        return options.include_additional !== false;
      case 'actionable':
        return true; // Always include actionable items
    }
    
    return true;
  });
  
  // Apply prioritization if requested
  if (options.prioritize_actionable) {
    filtered.sort((a, b) => {
      const aIsActionable = a.coderabbit_metadata?.suggestion_type === 'actionable';
      const bIsActionable = b.coderabbit_metadata?.suggestion_type === 'actionable';
      
      if (aIsActionable && !bIsActionable) return -1;
      if (!aIsActionable && bIsActionable) return 1;
      return 0;
    });
  }
  
  // Apply grouping if requested
  if (options.group_by_type) {
    filtered.sort((a, b) => {
      const aType = a.coderabbit_metadata?.suggestion_type || 'other';
      const bType = b.coderabbit_metadata?.suggestion_type || 'other';
      
      // Group by type, with actionable first
      const typeOrder: Record<string, number> = { actionable: 0, nit: 1, duplicate: 2, additional: 3, other: 4 };
      const aOrder = typeOrder[aType] ?? 4;
      const bOrder = typeOrder[bType] ?? 4;
      
      if (aOrder !== bOrder) return aOrder - bOrder;
      
      // Within same type, sort by file path
      const aFile = a.file_path || '';
      const bFile = b.file_path || '';
      return aFile.localeCompare(bFile);
    });
  }
  
  return filtered;
}

