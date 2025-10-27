import type { Octokit } from '@octokit/rest';
import type { FindUnresolvedCommentsInput } from '../schema.js';
import { fetchReviewCommentNodeIds } from './graphql-fetcher.js';

/**
 * Optimized data fetching that filters at the API level when possible
 * Reduces unnecessary data transfer and processing
 */
export class OptimizedDataFetcher {
  constructor(
    private octokit: InstanceType<typeof Octokit>,
    private pr: { owner: string; repo: string; number: number }
  ) {}

  /**
   * Fetch review comments with optional filtering
   * @param pagination - Pagination parameters
   * @param includeResolved - Whether to include resolved threads
   * @returns Promise resolving to review comments response
   */
  async fetchReviewComments(
    pagination: { page: number; per_page: number },
    _includeResolved: boolean = false
  ) {
    // Note: GitHub REST API doesn't support filtering resolved threads directly
    // We'll fetch all and filter in GraphQL, but this could be optimized further
    return await this.octokit.pulls.listReviewComments({
      owner: this.pr.owner,
      repo: this.pr.repo,
      pull_number: this.pr.number,
      page: pagination.page,
      per_page: pagination.per_page
    });
  }

  /**
   * Fetch issue comments with optional filtering
   * @param pagination - Pagination parameters
   * @param excludeAuthors - Authors to exclude
   * @returns Promise resolving to issue comments response
   */
  async fetchIssueComments(
    pagination: { page: number; per_page: number },
    _excludeAuthors?: string[]
  ) {
    // Note: GitHub REST API doesn't support filtering by author directly
    // We could potentially use GraphQL for this, but REST is simpler for basic filtering
    return await this.octokit.issues.listComments({
      owner: this.pr.owner,
      repo: this.pr.repo,
      issue_number: this.pr.number,
      page: pagination.page,
      per_page: pagination.per_page
    });
  }

  /**
   * Fetch reviews for parsing review bodies
   * @param pagination - Pagination parameters
   * @returns Promise resolving to reviews response
   */
  async fetchReviews(pagination: { page: number; per_page: number }) {
    return await this.octokit.pulls.listReviews({
      owner: this.pr.owner,
      repo: this.pr.repo,
      pull_number: this.pr.number,
      page: pagination.page,
      per_page: pagination.per_page
    });
  }

  /**
   * Fetch GraphQL data with optimized filtering
   * @param commentIds - Comment IDs to fetch
   * @param includeResolved - Whether to include resolved threads
   * @returns Promise resolving to GraphQL data
   */
  async fetchGraphQLData(commentIds: number[], includeResolved: boolean = false) {
    return await fetchReviewCommentNodeIds(
      this.octokit,
      this.pr,
      commentIds,
      includeResolved
    );
  }

  /**
   * Smart data fetching based on input parameters
   * Only fetches what's needed based on the filtering options
   * @param input - Input parameters
   * @param pagination - Pagination parameters
   * @returns Promise resolving to all fetched data
   */
  async fetchOptimizedData(
    input: FindUnresolvedCommentsInput,
    pagination: { page: number; per_page: number }
  ) {
    // Determine if we need resolved thread data
    const includeResolved = input.include_status_indicators === false;
    
    // Fetch data in parallel where possible
    const [reviewCommentsResponse, issueCommentsResponse, reviewsResponse] = await Promise.all([
      this.fetchReviewComments(pagination, includeResolved),
      this.fetchIssueComments(pagination, input.exclude_authors),
      input.parse_review_bodies !== false 
        ? this.fetchReviews(pagination)
        : Promise.resolve({ data: [], headers: {} })
    ]);

    // Fetch GraphQL data only for review comments
    const { nodeIdMap, resolvedThreadIds } = await this.fetchGraphQLData(
      reviewCommentsResponse.data.map(c => c.id),
      includeResolved
    );

    return {
      reviewCommentsResponse,
      issueCommentsResponse,
      reviewsResponse,
      nodeIdMap,
      resolvedThreadIds
    };
  }
}
