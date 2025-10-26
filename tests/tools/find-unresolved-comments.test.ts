import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleFindUnresolvedComments } from '../../src/tools/find-unresolved-comments/handler.js';
import type { GitHubClient } from '../../src/github/client.js';
import * as fixtures from '@octokit/fixtures';

describe('handleFindUnresolvedComments', () => {
  let mockClient: GitHubClient;
  let mockOctokit: any;

  beforeEach(() => {
    mockOctokit = {
      paginate: vi.fn(),
      graphql: vi.fn(),
      pulls: {
        listReviewComments: vi.fn(),
        listReviews: vi.fn()
      },
      issues: {
        listComments: vi.fn()
      }
    };

    mockClient = {
      getOctokit: () => mockOctokit
    } as any;
  });

  it('should fetch and combine review and issue comments', async () => {
    // Mock review comments response
    mockOctokit.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          user: { login: 'reviewer', type: 'User' },
          author_association: 'MEMBER',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          path: 'src/file.ts',
          line: 10,
          diff_hunk: '@@ -8,5 +8,5 @@',
          body: 'Please fix this',
          reactions: { total_count: 2, '+1': 2, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        }
      ],
      headers: { link: '' } // No next page
    });

    // Mock issue comments response
    mockOctokit.issues.listComments.mockResolvedValue({
      data: [
        {
          id: 2,
          user: { login: 'commenter', type: 'User' },
          author_association: 'CONTRIBUTOR',
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
          body: 'General comment',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        }
      ],
      headers: { link: '' } // No next page
    });

    // Mock reviews response (default is to parse review bodies)
    mockOctokit.pulls.listReviews.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    // Mock GraphQL response for node IDs
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: []
          }
        }
      }
    });

    const result = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological'
    });

    expect(result.comments).toHaveLength(2);
    expect(result.comments[0].type).toBe('review_comment');
    expect(result.comments[0].file_path).toBe('src/file.ts');
    expect(result.comments[1].type).toBe('issue_comment');
    expect(result.summary.comments_in_page).toBe(2);
  });

  it('should filter out bot comments when include_bots is false', async () => {
    // Mock review comments response
    mockOctokit.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          user: { login: 'coderabbitai', type: 'Bot' },
          author_association: 'NONE',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          path: 'src/file.ts',
          line: 10,
          body: 'Bot suggestion',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        }
      ],
      headers: { link: '' } // No next page
    });

    // Mock issue comments response
    mockOctokit.issues.listComments.mockResolvedValue({
      data: [
        {
          id: 2,
          user: { login: 'human', type: 'User' },
          author_association: 'MEMBER',
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
          body: 'Human comment',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        }
      ],
      headers: { link: '' } // No next page
    });

    // Mock reviews response (default is to parse review bodies)
    mockOctokit.pulls.listReviews.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    // Mock GraphQL response for node IDs
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: []
          }
        }
      }
    });

    const result = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: false,
      sort: 'chronological'
    });

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].author).toBe('human');
    expect(result.summary.bot_comments).toBe(0);
    expect(result.summary.human_comments).toBe(1);
  });

  it('should exclude specific authors', async () => {
    // Mock review comments response
    mockOctokit.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          user: { login: 'alice', type: 'User' },
          author_association: 'MEMBER',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          path: 'src/file.ts',
          line: 10,
          body: 'Alice comment',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        }
      ],
      headers: { link: '' } // No next page
    });

    // Mock issue comments response
    mockOctokit.issues.listComments.mockResolvedValue({
      data: [
        {
          id: 2,
          user: { login: 'bob', type: 'User' },
          author_association: 'CONTRIBUTOR',
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
          body: 'Bob comment',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        }
      ],
      headers: { link: '' } // No next page
    });

    // Mock reviews response (default is to parse review bodies)
    mockOctokit.pulls.listReviews.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    // Mock GraphQL response for node IDs
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: []
          }
        }
      }
    });

    const result = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: true,
      exclude_authors: ['alice'],
      sort: 'chronological'
    });

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].author).toBe('bob');
  });

  it('should sort comments by file', async () => {
    // Mock review comments response
    mockOctokit.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          user: { login: 'user1', type: 'User' },
          author_association: 'MEMBER',
          created_at: '2024-01-01T12:00:00Z',
          updated_at: '2024-01-01T12:00:00Z',
          path: 'src/b.ts',
          line: 5,
          body: 'Comment B',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        },
        {
          id: 2,
          user: { login: 'user2', type: 'User' },
          author_association: 'MEMBER',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          path: 'src/a.ts',
          line: 10,
          body: 'Comment A',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        }
      ],
      headers: { link: '' } // No next page
    });

    // Mock issue comments response
    mockOctokit.issues.listComments.mockResolvedValue({
      data: [],
      headers: { link: '' } // No next page
    });

    // Mock reviews response (default is to parse review bodies)
    mockOctokit.pulls.listReviews.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    // Mock GraphQL response for node IDs
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: []
          }
        }
      }
    });

    const result = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'by_file'
    });

    expect(result.comments[0].file_path).toBe('src/a.ts');
    expect(result.comments[1].file_path).toBe('src/b.ts');
  });

  it('should sort comments by author', async () => {
    // Mock review comments response
    mockOctokit.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          user: { login: 'zoe', type: 'User' },
          author_association: 'MEMBER',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          path: 'src/file.ts',
          line: 5,
          body: 'Zoe comment',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        },
        {
          id: 2,
          user: { login: 'alice', type: 'User' },
          author_association: 'CONTRIBUTOR',
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
          path: 'src/file.ts',
          line: 10,
          body: 'Alice comment',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        }
      ],
      headers: { link: '' } // No next page
    });

    // Mock issue comments response
    mockOctokit.issues.listComments.mockResolvedValue({
      data: [],
      headers: { link: '' } // No next page
    });

    // Mock reviews response (default is to parse review bodies)
    mockOctokit.pulls.listReviews.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    // Mock GraphQL response for node IDs
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: []
          }
        }
      }
    });

    const result = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'by_author'
    });

    expect(result.comments[0].author).toBe('alice');
    expect(result.comments[1].author).toBe('zoe');
  });

  it('should paginate comments correctly with real GitHub API fixture data', async () => {
    // Use real GitHub API fixture for pagination testing
    const paginationFixture = fixtures.get('api.github.com/paginate-issues');
    
    // Transform fixture data to comment format with proper body content
    const transformToComment = (item: any) => ({
      ...item,
      body: item.body || `Comment body for ${item.title || 'item'}`,
      path: 'src/file.ts',
      line: 10,
      diff_hunk: '@@ -8,5 +8,5 @@',
      html_url: `https://github.com/owner/repo/pull/123#discussion_r${item.id}`,
      reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
    });
    
    // Create mock responses based on real GitHub API structure from fixtures
    const firstPageResponse = {
      data: paginationFixture[0].response.slice(0, 1).map(transformToComment), // First item from real fixture
      headers: { 
        link: '<https://api.github.com/repos/owner/repo/pulls/123/comments?page=2>; rel="next", <https://api.github.com/repos/owner/repo/pulls/123/comments?page=3>; rel="last"' 
      }
    };
    
    const secondPageResponse = {
      data: paginationFixture[0].response.slice(1, 2).map(transformToComment), // Second item from real fixture
      headers: { 
        link: '<https://api.github.com/repos/owner/repo/pulls/123/comments?page=1>; rel="prev", <https://api.github.com/repos/owner/repo/pulls/123/comments?page=3>; rel="next", <https://api.github.com/repos/owner/repo/pulls/123/comments?page=3>; rel="last"' 
      }
    };
    
    const thirdPageResponse = {
      data: paginationFixture[0].response.slice(2).map(transformToComment), // Remaining items from real fixture
      headers: { 
        link: '<https://api.github.com/repos/owner/repo/pulls/123/comments?page=2>; rel="prev"' 
      }
    };

    // Mock review comments with real GitHub API fixture data
    mockOctokit.pulls.listReviewComments
      .mockResolvedValueOnce(firstPageResponse)
      .mockResolvedValueOnce(secondPageResponse)
      .mockResolvedValueOnce(thirdPageResponse);

        // Mock issue comments (empty for all pages)
        mockOctokit.issues.listComments.mockResolvedValue({ data: [], headers: { link: '' } });

    // Mock reviews response (default is to parse review bodies)
    mockOctokit.pulls.listReviews.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    // Mock GraphQL response for node IDs
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: []
          }
        }
      }
    });

    // First page (no cursor) - test with real GitHub API fixture data
    const page1 = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological'
    });

    expect(page1.comments).toHaveLength(1); // Real GitHub API fixture data
    expect(page1.nextCursor).toBeDefined(); // More results available
    
    // Second page using cursor - test cursor-based pagination with real fixture data
    const page2 = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological',
      cursor: page1.nextCursor
    });
    
    expect(page2.comments).toHaveLength(1);
    expect(page2.nextCursor).toBeDefined();
    
    // Third page (last) - test final page with real GitHub API fixture data
    const page3 = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological',
      cursor: page2.nextCursor
    });
    
    expect(page3.comments).toHaveLength(paginationFixture[0].response.length - 2); // Remaining items from fixture
    expect(page3.nextCursor).toBeUndefined(); // No more pages
    
    // Verify that our pagination logic correctly handles real GitHub API fixture data
    expect(mockOctokit.pulls.listReviewComments).toHaveBeenCalledTimes(3);
  });

  it('should generate summary statistics', async () => {
    // Mock review comments response
    mockOctokit.pulls.listReviewComments.mockResolvedValue({
      data: [
        {
          id: 1,
          user: { login: 'alice', type: 'User' },
          author_association: 'MEMBER',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          path: 'src/file.ts',
          line: 10,
          body: 'Alice comment 1',
          reactions: { total_count: 2, '+1': 2, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        },
        {
          id: 2,
          user: { login: 'alice', type: 'User' },
          author_association: 'MEMBER',
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
          path: 'src/file.ts',
          line: 20,
          body: 'Alice comment 2',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        },
        {
          id: 3,
          user: { login: 'bot', type: 'Bot' },
          author_association: 'NONE',
          created_at: '2024-01-01T12:00:00Z',
          updated_at: '2024-01-01T12:00:00Z',
          path: 'src/file.ts',
          line: 30,
          body: 'Bot comment',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        }
      ],
      headers: { link: '' } // No next page
    });

    // Mock issue comments response
    mockOctokit.issues.listComments.mockResolvedValue({
      data: [
        {
          id: 4,
          user: { login: 'bob', type: 'User' },
          author_association: 'CONTRIBUTOR',
          created_at: '2024-01-01T13:00:00Z',
          updated_at: '2024-01-01T13:00:00Z',
          body: 'Bob comment',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        }
      ],
      headers: { link: '' } // No next page
    });

    // Mock reviews response (default is to parse review bodies)
    mockOctokit.pulls.listReviews.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    // Mock GraphQL response for node IDs
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: []
          }
        }
      }
    });

    const result = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological'
    });

    expect(result.summary.comments_in_page).toBe(4);
    expect(result.summary.by_author).toEqual({
      alice: 2,
      bot: 1,
      bob: 1
    });
    expect(result.summary.by_type).toEqual({
      review_comment: 3,
      issue_comment: 1
    });
    expect(result.summary.bot_comments).toBe(1);
    expect(result.summary.human_comments).toBe(3);
    expect(result.summary.with_reactions).toBe(1);
  });

  it('should parse review bodies for actionable comments when parse_review_bodies is true', async () => {
    // Mock review comments response
    mockOctokit.pulls.listReviewComments.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    // Mock issue comments response
    mockOctokit.issues.listComments.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    // Mock reviews response with CodeRabbit AI review body
    mockOctokit.pulls.listReviews.mockResolvedValue({
      data: [
        {
          id: 123,
          user: { login: 'coderabbitai[bot]', type: 'Bot' },
          author_association: 'CONTRIBUTOR',
          state: 'COMMENTED',
          submitted_at: '2024-01-01T10:00:00Z',
          created_at: '2024-01-01T10:00:00Z',
          body: `**Actionable comments posted: 0**

<details>
<summary>🧹 Nitpick comments (1)</summary>
<blockquote>

<details>
<summary>scripts/install-cli.js (1)</summary>
<blockquote>

\`36-41\`: **Consider copying the lockfile for reproducible builds.**

While the current approach works, copying only \`package.json\` without the lockfile means the standalone installation might pull different dependency versions.

If reproducibility is important, add lockfile copying after line 37:

\`\`\`diff
 // Copy package.json for dependencies
 copyFileSync('package.json', join(standaloneDir, 'package.json'));
+
+// Copy lockfile for reproducible builds
+const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
+for (const lockFile of lockFiles) {
+  if (existsSync(lockFile)) {
+    copyFileSync(lockFile, join(standaloneDir, lockFile));
+    break;
+  }
+}
\`\`\`

</blockquote>
</details>

</blockquote>
</details>`,
          html_url: 'https://github.com/test/repo/pull/123#pullrequestreview-123'
        }
      ],
      headers: { link: '' }
    });

    // Mock GraphQL response
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: { nodes: [] }
        }
      }
    });

    const result = await handleFindUnresolvedComments(mockClient, {
      pr: 'test/repo#123',
      parse_review_bodies: true,
      include_bots: true
    });

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].type).toBe('review');
    expect(result.comments[0].author).toBe('coderabbitai[bot]');
    expect(result.comments[0].is_bot).toBe(true);
    expect(result.comments[0].file_path).toBe('scripts/install-cli.js');
    expect(result.comments[0].line_number).toBe(36);
    expect(result.comments[0].body).toContain('Consider copying the lockfile for reproducible builds');
    expect(result.comments[0].body).toContain('```diff');
  });

  it('should not parse review bodies when parse_review_bodies is false', async () => {
    // Mock review comments response
    mockOctokit.pulls.listReviewComments.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    // Mock issue comments response
    mockOctokit.issues.listComments.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    // Mock reviews response (should not be called)
    mockOctokit.pulls.listReviews.mockResolvedValue({
      data: [
        {
          id: 123,
          user: { login: 'coderabbitai[bot]', type: 'Bot' },
          author_association: 'CONTRIBUTOR',
          state: 'COMMENTED',
          body: 'Review body with actionable comments'
        }
      ],
      headers: { link: '' }
    });

    // Mock GraphQL response
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: { nodes: [] }
        }
      }
    });

    const result = await handleFindUnresolvedComments(mockClient, {
      pr: 'test/repo#123',
      parse_review_bodies: false
    });

    expect(result.comments).toHaveLength(0);
    expect(mockOctokit.pulls.listReviews).not.toHaveBeenCalled();
  });

  it('should default parse_review_bodies to true', async () => {
    // Mock review comments response
    mockOctokit.pulls.listReviewComments.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    // Mock issue comments response
    mockOctokit.issues.listComments.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    // Mock reviews response
    mockOctokit.pulls.listReviews.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    // Mock GraphQL response
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: { nodes: [] }
        }
      }
    });

    // Not specifying parse_review_bodies to verify it defaults to true
    const result = await handleFindUnresolvedComments(mockClient, {
      pr: 'test/repo#123',
      include_bots: true
    });

    expect(mockOctokit.pulls.listReviews).toHaveBeenCalled();
  });

  describe('CodeRabbit parsing', () => {
    it('should parse CodeRabbit review body with nits', async () => {
      // Mock review comments response
      mockOctokit.pulls.listReviewComments.mockResolvedValue({
        data: [],
        headers: { link: '' }
      });

      // Mock issue comments response
      mockOctokit.issues.listComments.mockResolvedValue({
        data: [],
        headers: { link: '' }
      });

      // Mock CodeRabbit review with nits
      mockOctokit.pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: 124,
            user: { login: 'coderabbitai[bot]', type: 'Bot' },
            author_association: 'CONTRIBUTOR',
            state: 'COMMENTED',
            submitted_at: '2024-01-01T10:05:00Z',
            created_at: '2024-01-01T10:05:00Z',
            body: `<details>
<summary>🧹 Nitpick comments (2)</summary>
<blockquote>
<details>
<summary>src/file.ts (1)</summary>
<blockquote>
\`36-41\`: **Consider copying the lockfile for reproducible builds.**
While the current approach works, copying only \`package.json\` without the lockfile means the standalone installation might pull different dependency versions.

\`\`\`diff
- // Copy package.json for dependencies
- copyFileSync('package.json', join(standaloneDir, 'package.json'));
+ // Copy package.json for dependencies
+ copyFileSync('package.json', join(standaloneDir, 'package.json'));
+
+ // Copy lockfile for reproducible builds
+ const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
+ for (const lockFile of lockFiles) {
+   if (existsSync(lockFile)) {
+     copyFileSync(lockFile, join(standaloneDir, lockFile));
+     break;
+   }
+ }
\`\`\`
</blockquote>
</details>
</blockquote>
</details>`,
            html_url: 'https://github.com/test/repo/pull/123#pullrequestreview-124'
          }
        ],
        headers: { link: '' }
      });

      // Mock GraphQL response
      mockOctokit.graphql.mockResolvedValue({
        repository: {
          pullRequest: {
            reviewThreads: { nodes: [] }
          }
        }
      });

      const result = await handleFindUnresolvedComments(mockClient, {
        pr: 'test/repo#123',
        parse_review_bodies: true,
        include_bots: true
      });

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].coderabbit_metadata).toBeDefined();
      expect(result.comments[0].coderabbit_metadata?.suggestion_type).toBe('nit');
      expect(result.comments[0].coderabbit_metadata?.severity).toBe('low');
      expect(result.comments[0].coderabbit_metadata?.file_context?.path).toBe('src/file.ts');
      expect(result.comments[0].coderabbit_metadata?.file_context?.line_start).toBe(36);
      expect(result.comments[0].coderabbit_metadata?.agent_prompt).toContain('CodeRabbit nit suggestion');
    });

    it('should filter CodeRabbit comments by type', async () => {
      // Mock review comments response
      mockOctokit.pulls.listReviewComments.mockResolvedValue({
        data: [],
        headers: { link: '' }
      });

      // Mock issue comments response
      mockOctokit.issues.listComments.mockResolvedValue({
        data: [],
        headers: { link: '' }
      });

      // Mock CodeRabbit review with multiple types
      mockOctokit.pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: 124,
            user: { login: 'coderabbitai[bot]', type: 'Bot' },
            author_association: 'CONTRIBUTOR',
            state: 'COMMENTED',
            submitted_at: '2024-01-01T10:05:00Z',
            created_at: '2024-01-01T10:05:00Z',
            body: `<details>
<summary>🧹 Nitpick comments (1)</summary>
<blockquote>
<details>
<summary>src/file.ts (1)</summary>
<blockquote>
\`10\`: **Minor style suggestion**
</blockquote>
</details>
</blockquote>
</details>
<details>
<summary>♻️ Duplicate comments (1)</summary>
<blockquote>
<details>
<summary>src/file.ts (1)</summary>
<blockquote>
\`15\`: **This was already mentioned above**
</blockquote>
</details>
</blockquote>
</details>`,
            html_url: 'https://github.com/test/repo/pull/123#pullrequestreview-124'
          }
        ],
        headers: { link: '' }
      });

      // Mock GraphQL response
      mockOctokit.graphql.mockResolvedValue({
        repository: {
          pullRequest: {
            reviewThreads: { nodes: [] }
          }
        }
      });

      // Test filtering to only include nits
      const result = await handleFindUnresolvedComments(mockClient, {
        pr: 'test/repo#123',
        parse_review_bodies: true,
        include_bots: true,
        coderabbit_options: {
          include_nits: true,
          include_duplicates: false,
          include_additional: false
        }
      });

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].coderabbit_metadata?.suggestion_type).toBe('nit');
    });

    it('should prioritize actionable items when requested', async () => {
      // Mock review comments response
      mockOctokit.pulls.listReviewComments.mockResolvedValue({
        data: [],
        headers: { link: '' }
      });

      // Mock issue comments response
      mockOctokit.issues.listComments.mockResolvedValue({
        data: [],
        headers: { link: '' }
      });

      // Mock CodeRabbit review with mixed types
      mockOctokit.pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: 124,
            user: { login: 'coderabbitai[bot]', type: 'Bot' },
            author_association: 'CONTRIBUTOR',
            state: 'COMMENTED',
            submitted_at: '2024-01-01T10:05:00Z',
            created_at: '2024-01-01T10:05:00Z',
            body: `<details>
<summary>🧹 Nitpick comments (1)</summary>
<blockquote>
<details>
<summary>src/file.ts (1)</summary>
<blockquote>
\`10\`: **Minor style suggestion**
</blockquote>
</details>
</blockquote>
</details>
<details>
<summary>Actionable comments posted: 1</summary>
<blockquote>
<details>
<summary>src/file.ts (1)</summary>
<blockquote>
\`20\`: **Critical security issue that must be fixed**
</blockquote>
</details>
</blockquote>
</details>`,
            html_url: 'https://github.com/test/repo/pull/123#pullrequestreview-124'
          }
        ],
        headers: { link: '' }
      });

      // Mock GraphQL response
      mockOctokit.graphql.mockResolvedValue({
        repository: {
          pullRequest: {
            reviewThreads: { nodes: [] }
          }
        }
      });

      const result = await handleFindUnresolvedComments(mockClient, {
        pr: 'test/repo#123',
        parse_review_bodies: true,
        include_bots: true,
        coderabbit_options: {
          prioritize_actionable: true
        }
      });

      expect(result.comments).toHaveLength(2);
      // Actionable items should come first
      expect(result.comments[0].coderabbit_metadata?.suggestion_type).toBe('actionable');
      expect(result.comments[1].coderabbit_metadata?.suggestion_type).toBe('nit');
    });

    it('should group comments by type when requested', async () => {
      // Mock review comments response
      mockOctokit.pulls.listReviewComments.mockResolvedValue({
        data: [],
        headers: { link: '' }
      });

      // Mock issue comments response
      mockOctokit.issues.listComments.mockResolvedValue({
        data: [],
        headers: { link: '' }
      });

      // Mock CodeRabbit review with multiple types
      mockOctokit.pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: 124,
            user: { login: 'coderabbitai[bot]', type: 'Bot' },
            author_association: 'CONTRIBUTOR',
            state: 'COMMENTED',
            submitted_at: '2024-01-01T10:05:00Z',
            created_at: '2024-01-01T10:05:00Z',
            body: `<details>
<summary>🧹 Nitpick comments (1)</summary>
<blockquote>
<details>
<summary>src/file1.ts (1)</summary>
<blockquote>
\`10\`: **Minor style suggestion**
</blockquote>
</details>
</blockquote>
</details>
<details>
<summary>♻️ Duplicate comments (1)</summary>
<blockquote>
<details>
<summary>src/file2.ts (1)</summary>
<blockquote>
\`15\`: **This was already mentioned**
</blockquote>
</details>
</blockquote>
</details>`,
            html_url: 'https://github.com/test/repo/pull/123#pullrequestreview-124'
          }
        ],
        headers: { link: '' }
      });

      // Mock GraphQL response
      mockOctokit.graphql.mockResolvedValue({
        repository: {
          pullRequest: {
            reviewThreads: { nodes: [] }
          }
        }
      });

      const result = await handleFindUnresolvedComments(mockClient, {
        pr: 'test/repo#123',
        parse_review_bodies: true,
        include_bots: true,
        coderabbit_options: {
          group_by_type: true
        }
      });

      expect(result.comments).toHaveLength(2);
      // Should be grouped by type (nit first, then duplicate)
      expect(result.comments[0].coderabbit_metadata?.suggestion_type).toBe('nit');
      expect(result.comments[1].coderabbit_metadata?.suggestion_type).toBe('duplicate');
    });

    it('should generate agent prompts when requested', async () => {
      // Mock review comments response
      mockOctokit.pulls.listReviewComments.mockResolvedValue({
        data: [],
        headers: { link: '' }
      });

      // Mock issue comments response
      mockOctokit.issues.listComments.mockResolvedValue({
        data: [],
        headers: { link: '' }
      });

      // Mock CodeRabbit review with code suggestion
      mockOctokit.pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: 124,
            user: { login: 'coderabbitai[bot]', type: 'Bot' },
            author_association: 'CONTRIBUTOR',
            state: 'COMMENTED',
            submitted_at: '2024-01-01T10:05:00Z',
            created_at: '2024-01-01T10:05:00Z',
            body: `<details>
<summary>🧹 Nitpick comments (1)</summary>
<blockquote>
<details>
<summary>src/file.ts (1)</summary>
<blockquote>
\`10\`: **Use const instead of let**
\`\`\`diff
- let x = 1
+ const x = 1
\`\`\`
</blockquote>
</details>
</blockquote>
</details>`,
            html_url: 'https://github.com/test/repo/pull/123#pullrequestreview-124'
          }
        ],
        headers: { link: '' }
      });

      // Mock GraphQL response
      mockOctokit.graphql.mockResolvedValue({
        repository: {
          pullRequest: {
            reviewThreads: { nodes: [] }
          }
        }
      });

      const result = await handleFindUnresolvedComments(mockClient, {
        pr: 'test/repo#123',
        parse_review_bodies: true,
        include_bots: true,
        coderabbit_options: {
          extract_agent_prompts: true
        }
      });

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].coderabbit_metadata?.agent_prompt).toContain('CodeRabbit nit suggestion');
      expect(result.comments[0].coderabbit_metadata?.agent_prompt).toContain('Current code:');
      expect(result.comments[0].coderabbit_metadata?.agent_prompt).toContain('Suggested change:');
    });

    it('should not generate agent prompts when disabled', async () => {
      // Mock review comments response
      mockOctokit.pulls.listReviewComments.mockResolvedValue({
        data: [],
        headers: { link: '' }
      });

      // Mock issue comments response
      mockOctokit.issues.listComments.mockResolvedValue({
        data: [],
        headers: { link: '' }
      });

      // Mock CodeRabbit review
      mockOctokit.pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: 124,
            user: { login: 'coderabbitai[bot]', type: 'Bot' },
            author_association: 'CONTRIBUTOR',
            state: 'COMMENTED',
            submitted_at: '2024-01-01T10:05:00Z',
            created_at: '2024-01-01T10:05:00Z',
            body: `<details>
<summary>🧹 Nitpick comments (1)</summary>
<blockquote>
<details>
<summary>src/file.ts (1)</summary>
<blockquote>
\`10\`: **Minor suggestion**
</blockquote>
</details>
</blockquote>
</details>`,
            html_url: 'https://github.com/test/repo/pull/123#pullrequestreview-124'
          }
        ],
        headers: { link: '' }
      });

      // Mock GraphQL response
      mockOctokit.graphql.mockResolvedValue({
        repository: {
          pullRequest: {
            reviewThreads: { nodes: [] }
          }
        }
      });

      const result = await handleFindUnresolvedComments(mockClient, {
        pr: 'test/repo#123',
        parse_review_bodies: true,
        include_bots: true,
        coderabbit_options: {
          extract_agent_prompts: false
        }
      });

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].coderabbit_metadata?.agent_prompt).toBeUndefined();
    });

    it('should handle CodeRabbit options with defaults', async () => {
      // Mock review comments response
      mockOctokit.pulls.listReviewComments.mockResolvedValue({
        data: [],
        headers: { link: '' }
      });

      // Mock issue comments response
      mockOctokit.issues.listComments.mockResolvedValue({
        data: [],
        headers: { link: '' }
      });

      // Mock CodeRabbit review
      mockOctokit.pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: 124,
            user: { login: 'coderabbitai[bot]', type: 'Bot' },
            author_association: 'CONTRIBUTOR',
            state: 'COMMENTED',
            submitted_at: '2024-01-01T10:05:00Z',
            created_at: '2024-01-01T10:05:00Z',
            body: `<details>
<summary>🧹 Nitpick comments (1)</summary>
<blockquote>
<details>
<summary>src/file.ts (1)</summary>
<blockquote>
\`10\`: **Minor suggestion**
</blockquote>
</details>
</blockquote>
</details>`,
            html_url: 'https://github.com/test/repo/pull/123#pullrequestreview-124'
          }
        ],
        headers: { link: '' }
      });

      // Mock GraphQL response
      mockOctokit.graphql.mockResolvedValue({
        repository: {
          pullRequest: {
            reviewThreads: { nodes: [] }
          }
        }
      });

      // Test with empty coderabbit_options (should use defaults)
      const result = await handleFindUnresolvedComments(mockClient, {
        pr: 'test/repo#123',
        parse_review_bodies: true, // Explicitly set to test the coderabbit_options defaults
        include_bots: true,
        coderabbit_options: {}
      });

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].coderabbit_metadata?.suggestion_type).toBe('nit');
      expect(result.comments[0].coderabbit_metadata?.agent_prompt).toBeDefined(); // Should be generated by default
    });
  });
});

