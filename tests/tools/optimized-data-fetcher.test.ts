import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OptimizedDataFetcher } from '../../src/tools/find-unresolved-comments/lib/optimized-data-fetcher.js';
import type { FindUnresolvedCommentsInput } from '../../src/tools/find-unresolved-comments/schema.js';

describe('OptimizedDataFetcher', () => {
  let mockOctokit: any;
  let dataFetcher: OptimizedDataFetcher;
  const mockPr = { owner: 'test-owner', repo: 'test-repo', number: 123 };

  beforeEach(() => {
    mockOctokit = {
      pulls: {
        listReviewComments: vi.fn(),
        listReviews: vi.fn()
      },
      issues: {
        listComments: vi.fn()
      },
      graphql: vi.fn()
    };
    
    dataFetcher = new OptimizedDataFetcher(mockOctokit, mockPr);
  });

  it('should fetch review comments with correct parameters', async () => {
    const mockResponse = { data: [], headers: {} };
    mockOctokit.pulls.listReviewComments.mockResolvedValue(mockResponse);

    const result = await dataFetcher.fetchReviewComments({ page: 1, per_page: 20 });

    expect(mockOctokit.pulls.listReviewComments).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      pull_number: 123,
      page: 1,
      per_page: 20
    });
    expect(result).toBe(mockResponse);
  });

  it('should fetch issue comments with correct parameters', async () => {
    const mockResponse = { data: [], headers: {} };
    mockOctokit.issues.listComments.mockResolvedValue(mockResponse);

    const result = await dataFetcher.fetchIssueComments({ page: 1, per_page: 20 });

    expect(mockOctokit.issues.listComments).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      page: 1,
      per_page: 20
    });
    expect(result).toBe(mockResponse);
  });

  it('should fetch reviews with correct parameters', async () => {
    const mockResponse = { data: [], headers: {} };
    mockOctokit.pulls.listReviews.mockResolvedValue(mockResponse);

    const result = await dataFetcher.fetchReviews({ page: 1, per_page: 20 });

    expect(mockOctokit.pulls.listReviews).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      pull_number: 123,
      page: 1,
      per_page: 20
    });
    expect(result).toBe(mockResponse);
  });

  it('should fetch optimized data with correct parameters', async () => {
    const mockInput: FindUnresolvedCommentsInput = {
      pr: 'test-owner/test-repo#123',
      include_bots: true,
      exclude_authors: ['bot-user'],
      sort: 'priority',
      parse_review_bodies: true,
      include_status_indicators: true,
      priority_ordering: true
    };

    const mockReviewComments = { data: [{ id: 1 }], headers: {} };
    const mockIssueComments = { data: [{ id: 2 }], headers: {} };
    const mockReviews = { data: [{ id: 3 }], headers: {} };
    const mockGraphQL = { nodeIdMap: new Map(), resolvedThreadIds: new Set() };

    mockOctokit.pulls.listReviewComments.mockResolvedValue(mockReviewComments);
    mockOctokit.issues.listComments.mockResolvedValue(mockIssueComments);
    mockOctokit.pulls.listReviews.mockResolvedValue(mockReviews);
    mockOctokit.graphql.mockResolvedValue({});

    // Mock the GraphQL fetcher
    vi.doMock('../../src/tools/find-unresolved-comments/lib/graphql-fetcher.js', () => ({
      fetchReviewCommentNodeIds: vi.fn().mockResolvedValue(mockGraphQL)
    }));

    const result = await dataFetcher.fetchOptimizedData(mockInput, { page: 1, per_page: 20 });

    expect(result.reviewCommentsResponse).toBe(mockReviewComments);
    expect(result.issueCommentsResponse).toBe(mockIssueComments);
    expect(result.reviewsResponse).toBe(mockReviews);
    expect(result.nodeIdMap).toBe(mockGraphQL.nodeIdMap);
    expect(result.resolvedThreadIds).toBe(mockGraphQL.resolvedThreadIds);
  });

  it('should skip reviews when parse_review_bodies is false', async () => {
    const mockInput: FindUnresolvedCommentsInput = {
      pr: 'test-owner/test-repo#123',
      include_bots: true,
      sort: 'priority',
      parse_review_bodies: false,
      include_status_indicators: true,
      priority_ordering: true
    };

    const mockReviewComments = { data: [{ id: 1 }], headers: {} };
    const mockIssueComments = { data: [{ id: 2 }], headers: {} };
    const mockGraphQL = { nodeIdMap: new Map(), resolvedThreadIds: new Set() };

    mockOctokit.pulls.listReviewComments.mockResolvedValue(mockReviewComments);
    mockOctokit.issues.listComments.mockResolvedValue(mockIssueComments);
    mockOctokit.graphql.mockResolvedValue({});

    vi.doMock('../../src/tools/find-unresolved-comments/lib/graphql-fetcher.js', () => ({
      fetchReviewCommentNodeIds: vi.fn().mockResolvedValue(mockGraphQL)
    }));

    const result = await dataFetcher.fetchOptimizedData(mockInput, { page: 1, per_page: 20 });

    expect(result.reviewsResponse.data).toEqual([]);
    expect(mockOctokit.pulls.listReviews).not.toHaveBeenCalled();
  });
});
