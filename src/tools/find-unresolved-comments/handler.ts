import type { GitHubClient } from "../../github/client.js";
import { parsePRIdentifier, formatPRIdentifier } from "../../utils/parser.js";
import {
  cursorToGitHubPagination,
  createNextCursor,
} from "../../utils/pagination.js";
import type {
  FindUnresolvedCommentsInput,
  FindUnresolvedCommentsOutput,
  Comment,
} from "./schema.js";

// Import library functions
import { fetchReviewCommentNodeIds } from "./lib/graphql-fetcher.js";
import { mapReviewComments, mapIssueComments } from "./lib/comment-mapper.js";
import { calculateStatusIndicators } from "./lib/status-indicators.js";
import {
  filterUnresolvedComments,
  applyBasicFiltering,
  sortComments,
} from "./lib/filtering.js";
import { generateSummary } from "./lib/summary-generator.js";
import {
  processCodeRabbitReview,
  processCodeRabbitIssueComment,
} from "./lib/coderabbit.js";

/**
 * Find unresolved comments in a GitHub pull request
 * @param client - GitHub API client instance
 * @param input - Input parameters including PR identifier and options
 * @returns Promise resolving to unresolved comments and pagination info
 */
export async function handleFindUnresolvedComments(
  client: GitHubClient,
  input: FindUnresolvedCommentsInput,
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
    per_page: githubPagination.per_page,
  });

  // Fetch GraphQL node IDs and resolved status for review comments and their threads
  const { nodeIdMap, resolvedThreadIds } = await fetchReviewCommentNodeIds(
    octokit,
    pr,
    reviewCommentsResponse.data.map((c) => c.id),
  );

  // Fetch issue comments (general PR comments) with server-side pagination
  const issueCommentsResponse = await octokit.issues.listComments({
    owner: pr.owner,
    repo: pr.repo,
    issue_number: pr.number,
    page: githubPagination.page,
    per_page: githubPagination.per_page,
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
      per_page: githubPagination.per_page,
    });

    // Process CodeRabbit reviews with higher-level function
    for (const review of reviewsResponse.data) {
      if (!review.body || review.state === "PENDING") {
        continue;
      }

      const author = review.user?.login || "unknown";
      const authorAssociation = review.author_association || "NONE";
      const isBot = review.user?.type === "Bot";

      const codeRabbitComments = processCodeRabbitReview(
        review.body,
        review,
        pr,
        author,
        authorAssociation,
        isBot,
        input.coderabbit_options,
        input.include_status_indicators,
      );
      reviewBodiesComments.push(...codeRabbitComments);
    }
    hasMoreReviews =
      reviewsResponse.headers.link?.includes('rel="next"') ?? false;
  }

  // Process CodeRabbit content from issue comments with higher-level function
  let issueCommentBodiesComments: Comment[] = [];
  if (input.parse_review_bodies !== false) {
    for (const issueComment of issueCommentsResponse.data) {
      if (!issueComment.body) continue;

      const author = issueComment.user?.login || "unknown";
      const authorAssociation = issueComment.author_association || "NONE";
      const isBot = issueComment.user?.type === "Bot";

      const codeRabbitComments = processCodeRabbitIssueComment(
        issueComment.body,
        issueComment,
        pr,
        author,
        authorAssociation,
        isBot,
        input.coderabbit_options,
        input.include_status_indicators,
      );
      issueCommentBodiesComments.push(...codeRabbitComments);
    }
  }

  // Convert to our Comment type with action commands and hints
  const allComments: Comment[] = [
    ...reviewBodiesComments, // Add parsed actionable comments from review bodies
    ...issueCommentBodiesComments, // Add parsed actionable comments from issue comment bodies
    ...mapReviewComments(reviewCommentsResponse.data, pr, nodeIdMap),
    ...mapIssueComments(issueCommentsResponse.data, pr),
  ];

  // Calculate status indicators for all comments (second pass)
  if (input.include_status_indicators !== false) {
    for (const comment of allComments) {
      comment.status_indicators = calculateStatusIndicators(
        comment,
        allComments,
      );
    }
  }

  // Filter out resolved comments at the thread level
  let filtered = filterUnresolvedComments(
    allComments,
    nodeIdMap,
    resolvedThreadIds,
  );

  // Apply basic filtering
  filtered = applyBasicFiltering(
    filtered,
    input.include_bots ?? true,
    input.exclude_authors,
  );

  // Apply CodeRabbit-specific filtering and grouping
  if (input.coderabbit_options) {
    // Note: CodeRabbit filtering is already applied in parseReviewBodiesForActionableComments
    // Additional filtering can be added here if needed
  }

  // Sort comments
  filtered = sortComments(
    filtered,
    input.sort,
    input.priority_ordering,
    input.include_status_indicators,
  );

  // Check if there are more results by looking at response headers
  // GitHub API includes Link header with pagination info
  const hasMoreReviewComments =
    reviewCommentsResponse.headers.link?.includes('rel="next"') ?? false;
  const hasMoreIssueComments =
    issueCommentsResponse.headers.link?.includes('rel="next"') ?? false;
  const hasMore =
    hasMoreReviewComments || hasMoreIssueComments || hasMoreReviews;

  // Create next cursor if there are more results
  const nextCursor = createNextCursor(
    input.cursor,
    githubPagination.per_page,
    hasMore,
  );

  // Generate summary statistics
  const summary = generateSummary(
    filtered,
    input.include_status_indicators,
    input.priority_ordering,
  );

  return {
    pr: formatPRIdentifier(pr),
    unresolved_in_page: filtered.length, // Current page count
    comments: filtered, // Current page comments
    nextCursor,
    summary,
  };
}
