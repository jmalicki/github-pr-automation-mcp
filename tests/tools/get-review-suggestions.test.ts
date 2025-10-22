import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGetReviewSuggestions } from '../../src/tools/get-review-suggestions/handler.js';
import { GitHubClient } from '../../src/github/client.js';

describe('handleGetReviewSuggestions', () => {
  let mockClient: GitHubClient;
  let mockOctokit: any;

  beforeEach(() => {
    mockOctokit = {
      pulls: {
        get: vi.fn(),
        listFiles: vi.fn()
      }
    };

    mockClient = {
      getOctokit: () => mockOctokit
    } as any;
  });

  it('should fetch PR metadata and files with server-side pagination', async () => {
    // Mock PR data
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        title: 'Test PR',
        body: 'Test description',
        user: { login: 'testuser' },
        labels: [{ name: 'bug' }, { name: 'enhancement' }],
        changed_files: 5,
        additions: 100,
        deletions: 50
      }
    });

    // Mock files response with pagination
    mockOctokit.pulls.listFiles.mockResolvedValue({
      data: [
        {
          filename: 'src/file1.ts',
          status: 'modified',
          additions: 10,
          deletions: 5
        },
        {
          filename: 'src/file2.ts',
          status: 'added',
          additions: 20,
          deletions: 0
        }
      ],
      headers: { link: '' } // No next page
    });

    const result = await handleGetReviewSuggestions(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.pr).toBe('owner/repo#123');
    expect(result.metadata.title).toBe('Test PR');
    expect(result.metadata.author).toBe('testuser');
    expect(result.metadata.labels).toEqual(['bug', 'enhancement']);
    expect(result.files).toHaveLength(2);
    expect(result.files[0].path).toBe('src/file1.ts');
    expect(result.files[0].status).toBe('modified');
    expect(result.nextCursor).toBeUndefined();
    expect(result.review_checklist).toHaveLength(4);
  });

  it('should handle pagination with next cursor', async () => {
    // Mock PR data
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        title: 'Test PR',
        body: 'Test description',
        user: { login: 'testuser' },
        labels: [],
        changed_files: 25,
        additions: 100,
        deletions: 50
      }
    });

    // Mock files response with next page
    mockOctokit.pulls.listFiles.mockResolvedValue({
      data: [
        {
          filename: 'src/file1.ts',
          status: 'modified',
          additions: 10,
          deletions: 5
        }
      ],
      headers: { link: '<https://api.github.com/repos/owner/repo/pulls/123/files?page=2>; rel="next"' }
    });

    const result = await handleGetReviewSuggestions(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.files).toHaveLength(1);
    expect(result.nextCursor).toBeDefined();
  });

  it('should handle cursor-based pagination', async () => {
    // Mock PR data
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        title: 'Test PR',
        body: 'Test description',
        user: { login: 'testuser' },
        labels: [],
        changed_files: 25,
        additions: 100,
        deletions: 50
      }
    });

    // Mock files response for second page
    mockOctokit.pulls.listFiles.mockResolvedValue({
      data: [
        {
          filename: 'src/file3.ts',
          status: 'deleted',
          additions: 0,
          deletions: 10
        }
      ],
      headers: { link: '' } // No next page
    });

    const cursor = Buffer.from(JSON.stringify({ offset: 20, pageSize: 20 })).toString('base64');
    const result = await handleGetReviewSuggestions(mockClient, {
      pr: 'owner/repo#123',
      cursor
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('src/file3.ts');
    expect(result.nextCursor).toBeUndefined();
    
    // Verify the correct page was requested
    expect(mockOctokit.pulls.listFiles).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      pull_number: 123,
      page: 2,
      per_page: 20
    });
  });

  it('should handle focus areas and diff options', async () => {
    // Mock PR data
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        title: 'Test PR',
        body: 'Test description',
        user: { login: 'testuser' },
        labels: [],
        changed_files: 5,
        additions: 100,
        deletions: 50
      }
    });

    // Mock files response
    mockOctokit.pulls.listFiles.mockResolvedValue({
      data: [
        {
          filename: 'src/file1.ts',
          status: 'modified',
          additions: 10,
          deletions: 5
        }
      ],
      headers: { link: '' }
    });

    const result = await handleGetReviewSuggestions(mockClient, {
      pr: 'owner/repo#123',
      focus_areas: ['security', 'performance'],
      include_diff: true,
      max_diff_lines: 1000
    });

    expect(result.pr).toBe('owner/repo#123');
    expect(result.files).toHaveLength(1);
  });

  it('should handle empty files list', async () => {
    // Mock PR data
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        title: 'Test PR',
        body: 'Test description',
        user: { login: 'testuser' },
        labels: [],
        changed_files: 0,
        additions: 0,
        deletions: 0
      }
    });

    // Mock empty files response
    mockOctokit.pulls.listFiles.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    const result = await handleGetReviewSuggestions(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.files).toHaveLength(0);
    expect(result.nextCursor).toBeUndefined();
  });

  it('should handle large PRs with multiple pages', async () => {
    // Mock PR data
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        title: 'Large PR',
        body: 'Many changes',
        user: { login: 'testuser' },
        labels: [],
        changed_files: 100,
        additions: 1000,
        deletions: 500
      }
    });

    // Mock files response with next page
    mockOctokit.pulls.listFiles.mockResolvedValue({
      data: Array.from({ length: 20 }, (_, i) => ({
        filename: `src/file${i}.ts`,
        status: 'modified',
        additions: 10,
        deletions: 5
      })),
      headers: { link: '<https://api.github.com/repos/owner/repo/pulls/123/files?page=2>; rel="next"' }
    });

    const result = await handleGetReviewSuggestions(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.files).toHaveLength(20);
    expect(result.nextCursor).toBeDefined();
    expect(result.summary).toContain('100 files');
  });
});
