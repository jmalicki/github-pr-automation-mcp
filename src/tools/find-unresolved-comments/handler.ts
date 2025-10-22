import type { GitHubClient } from '../../github/client.js';
import { parsePRIdentifier, formatPRIdentifier } from '../../utils/parser.js';
import { paginateResults } from '../../utils/pagination.js';
import type { FindUnresolvedCommentsInput, FindUnresolvedCommentsOutput, Comment } from './schema.js';

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
  
  // Convert to our Comment type
  const allComments: Comment[] = [
    ...reviewComments.map(c => ({
      id: c.id,
      type: 'review_comment' as const,
      author: c.user?.login || 'unknown',
      author_association: c.author_association || 'NONE',
      is_bot: c.user?.type === 'Bot',
      created_at: c.created_at,
      updated_at: c.updated_at,
      file_path: c.path,
      line_number: c.line || undefined,
      start_line: c.start_line || undefined,
      diff_hunk: c.diff_hunk || undefined,
      body: c.body,
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
      html_url: c.html_url
    })),
    ...issueComments.map(c => ({
      id: c.id,
      type: 'issue_comment' as const,
      author: c.user?.login || 'unknown',
      author_association: c.author_association || 'NONE',
      is_bot: c.user?.type === 'Bot',
      created_at: c.created_at,
      updated_at: c.updated_at,
      body: c.body || '',
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
      html_url: c.html_url
    }))
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
  
  // Paginate
  const paginated = paginateResults(filtered, input.page, input.page_size);
  
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
    pagination: paginated.pagination,
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

