import type { GitHubClient } from '../../github/client.js';
import { parsePRIdentifier, formatPRIdentifier } from '../../utils/parser.js';
import { paginateResults } from '../../utils/pagination.js';
import type { FindUnresolvedCommentsInput, FindUnresolvedCommentsOutput, Comment } from './schema.js';
import { generateActionCommands } from './command-generator.js';

export async function handleFindUnresolvedComments(
  client: GitHubClient,
  input: FindUnresolvedCommentsInput
): Promise<FindUnresolvedCommentsOutput> {
  const pr = parsePRIdentifier(input.pr);
  const octokit = client.getOctokit();
  
  // Fetch review comments (inline comments on code)
  const reviewComments = await octokit.paginate(
    octokit.pulls.listReviewComments,
    {
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.number
    }
  );
  
  // Fetch issue comments (general PR comments)
  const issueComments = await octokit.paginate(
    octokit.issues.listComments,
    {
      owner: pr.owner,
      repo: pr.repo,
      issue_number: pr.number
    }
  );
  
  // Convert to our Comment type with action commands and hints
  const allComments: Comment[] = [
    ...reviewComments.map(c => {
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
        action_commands: generateActionCommands(pr, c.id, 'review_comment', body, c.path)
      };
    }),
    ...issueComments.map(c => {
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
  
  // Paginate using MCP cursor model (server-controlled page size: 20)
  const paginated = paginateResults(filtered, input.cursor, 20);
  
  // Generate summary statistics
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
    total_unresolved: filtered.length,
    comments: paginated.items,
    nextCursor: paginated.nextCursor,
    summary: {
      total_comments: filtered.length,
      by_author: byAuthor,
      by_type: byType,
      bot_comments: botCount,
      human_comments: filtered.length - botCount,
      with_reactions: withReactions
    }
  };
}

