import type { GitHubClient } from '../../github/client.js';
import { parsePRIdentifier, formatPRIdentifier } from '../../utils/parser.js';
import { cursorToGitHubPagination, createNextCursor } from '../../utils/pagination.js';

export interface GetReviewSuggestionsInput {
  pr: string;
  focus_areas?: string[];
  include_diff?: boolean;
  max_diff_lines?: number;
  cursor?: string; // MCP cursor-based pagination
}

export interface GetReviewSuggestionsOutput {
  pr: string;
  metadata: {
    title: string;
    description: string;
    author: string;
    labels: string[];
  };
  files: Array<{
    path: string;
    status: string;
    additions: number;
    deletions: number;
  }>;
  review_checklist: string[];
  summary: string;
  nextCursor?: string; // MCP cursor-based pagination
}

export async function handleGetReviewSuggestions(
  client: GitHubClient,
  input: GetReviewSuggestionsInput
): Promise<GetReviewSuggestionsOutput> {
  const pr = parsePRIdentifier(input.pr);
  const octokit = client.getOctokit();
  
  // Convert cursor to GitHub pagination parameters
  const githubPagination = cursorToGitHubPagination(input.cursor, 20);
  
  const [pullRequest, filesResponse] = await Promise.all([
    octokit.pulls.get({ owner: pr.owner, repo: pr.repo, pull_number: pr.number }),
    octokit.pulls.listFiles({ 
      owner: pr.owner, 
      repo: pr.repo, 
      pull_number: pr.number,
      page: githubPagination.page,
      per_page: githubPagination.per_page
    })
  ]);
  
  const data = pullRequest.data;
  
  // Check if there are more results by looking at response headers
  const hasMore = filesResponse.headers.link?.includes('rel="next"') ?? false;
  
  // Create next cursor if there are more results
  const nextCursor = createNextCursor(input.cursor, githubPagination.per_page, hasMore);
  
  // Generate review checklist
  const checklist: string[] = [
    'Review code changes for correctness',
    'Check for potential security issues',
    'Verify test coverage for new code',
    'Ensure documentation is updated'
  ];
  
  return {
    pr: formatPRIdentifier(pr),
    metadata: {
      title: data.title,
      description: data.body || '',
      author: data.user?.login || 'unknown',
      labels: data.labels.map(l => typeof l === 'string' ? l : l.name)
    },
    files: filesResponse.data.map(f => ({
      path: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions
    })),
    review_checklist: checklist,
    summary: `PR changes ${data.changed_files} files with ${data.additions} additions and ${data.deletions} deletions`,
    nextCursor
  };
}

