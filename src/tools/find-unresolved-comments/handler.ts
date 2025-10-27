import type { GitHubClient } from '../../github/client.js';
import { parsePRIdentifier, formatPRIdentifier } from '../../utils/parser.js';
import { cursorToGitHubPagination, createNextCursor } from '../../utils/pagination.js';
import type { FindUnresolvedCommentsInput, FindUnresolvedCommentsOutput, Comment } from './schema.js';

// Import library functions
import { parseReviewBodiesForActionableComments } from './lib/review-parser.js';
import { mapReviewComments, mapIssueComments } from './lib/comment-mapper.js';
import { calculateStatusIndicators } from './lib/status-indicators.js';
import { OptimizedFiltering } from './lib/filtering.js';
import { generateSummary } from './lib/summary-generator.js';
import { OptimizedDataFetcher } from './lib/optimized-data-fetcher.js';

/**
 * Find unresolved comments in a GitHub pull request
 * Optimized version that filters at the API level when possible
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
  
  // Use optimized data fetcher for better performance
  const dataFetcher = new OptimizedDataFetcher(octokit, pr);
  
  // Fetch all data with optimized filtering
  const {
    reviewCommentsResponse,
    issueCommentsResponse,
    reviewsResponse,
    nodeIdMap,
    resolvedThreadIds
  } = await dataFetcher.fetchOptimizedData(input, githubPagination);

  // Parse review bodies for actionable comments if requested
  let reviewBodiesComments: Comment[] = [];
  let hasMoreReviews = false;
  if (input.parse_review_bodies !== false && reviewsResponse.data) {
    reviewBodiesComments = parseReviewBodiesForActionableComments(
      reviewsResponse.data,
      pr,
      input.coderabbit_options,
      input.include_status_indicators
    );
    hasMoreReviews = (reviewsResponse.headers as { link?: string })?.link?.includes('rel="next"') ?? false;
  }
  
  // Convert to our Comment type with action commands and hints
  const allComments: Comment[] = [
    ...reviewBodiesComments, // Add parsed actionable comments from review bodies
    ...mapReviewComments(reviewCommentsResponse.data, pr, nodeIdMap),
    ...mapIssueComments(issueCommentsResponse.data, pr)
  ];
  
  // Calculate status indicators for all comments (second pass)
  if (input.include_status_indicators !== false) {
    for (const comment of allComments) {
      comment.status_indicators = calculateStatusIndicators(comment, allComments);
    }
  }
  
  // Apply optimized filtering and sorting
  const filtered = OptimizedFiltering.applyAllFilters(allComments, nodeIdMap, resolvedThreadIds, {
    includeBots: input.include_bots,
    excludeAuthors: input.exclude_authors,
    sort: input.sort,
    priorityOrdering: input.priority_ordering,
    includeStatusIndicators: input.include_status_indicators
  });
  
  // Check if there are more results by looking at response headers
  // GitHub API includes Link header with pagination info
  const hasMoreReviewComments = reviewCommentsResponse.headers.link?.includes('rel="next"') ?? false;
  const hasMoreIssueComments = issueCommentsResponse.headers.link?.includes('rel="next"') ?? false;
  const hasMore = hasMoreReviewComments || hasMoreIssueComments || hasMoreReviews;
  
  // Create next cursor if there are more results
  const nextCursor = createNextCursor(input.cursor, githubPagination.per_page, hasMore);
  
  // Generate summary statistics
  const summary = generateSummary(filtered, input.include_status_indicators, input.priority_ordering);
  
  return {
    pr: formatPRIdentifier(pr),
    unresolved_in_page: filtered.length, // Current page count
    comments: filtered, // Current page comments
    nextCursor,
    summary
  };
}