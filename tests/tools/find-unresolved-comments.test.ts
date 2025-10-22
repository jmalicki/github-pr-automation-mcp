import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleFindUnresolvedComments } from '../../src/tools/find-unresolved-comments/handler.js';
import { GitHubClient } from '../../src/github/client.js';

describe('handleFindUnresolvedComments', () => {
  let mockClient: GitHubClient;
  let mockOctokit: any;

  beforeEach(() => {
    mockOctokit = {
      paginate: vi.fn(),
      pulls: {
        listReviewComments: vi.fn()
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
    mockOctokit.paginate
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([
        {
          id: 2,
          user: { login: 'commenter', type: 'User' },
          author_association: 'CONTRIBUTOR',
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
          body: 'General comment',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        }
      ]);

    const result = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological'
    });

    expect(result.comments).toHaveLength(2);
    expect(result.comments[0].type).toBe('review_comment');
    expect(result.comments[0].file_path).toBe('src/file.ts');
    expect(result.comments[1].type).toBe('issue_comment');
    expect(result.summary.total_comments).toBe(2);
  });

  it('should filter out bot comments when include_bots is false', async () => {
    mockOctokit.paginate
      .mockResolvedValueOnce([
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
        },
        {
          id: 2,
          user: { login: 'human', type: 'User' },
          author_association: 'MEMBER',
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
          path: 'src/file.ts',
          line: 20,
          body: 'Human comment',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        }
      ])
      .mockResolvedValueOnce([]);

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
    mockOctokit.paginate
      .mockResolvedValueOnce([
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
        },
        {
          id: 2,
          user: { login: 'bob', type: 'User' },
          author_association: 'CONTRIBUTOR',
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
          path: 'src/file.ts',
          line: 20,
          body: 'Bob comment',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        }
      ])
      .mockResolvedValueOnce([]);

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
    mockOctokit.paginate
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([]);

    const result = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'by_file'
    });

    expect(result.comments[0].file_path).toBe('src/a.ts');
    expect(result.comments[1].file_path).toBe('src/b.ts');
  });

  it('should sort comments by author', async () => {
    mockOctokit.paginate
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([]);

    const result = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'by_author'
    });

    expect(result.comments[0].author).toBe('alice');
    expect(result.comments[1].author).toBe('zoe');
  });

  it('should paginate comments correctly with cursors', async () => {
    const manyComments = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      user: { login: `user${i}`, type: 'User' },
      author_association: 'MEMBER',
      created_at: `2024-01-01T${String(10 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`,
      updated_at: `2024-01-01T${String(10 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`,
      path: 'src/file.ts',
      line: i + 1,
      body: `Comment ${i}`,
      html_url: `https://github.com/owner/repo/pull/123#discussion_r${i}`,
      reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
    }));

    // Each handler call makes 2 paginate calls (review + issue comments)
    // We're calling handler 3 times, so need 6 mock responses
    mockOctokit.paginate
      .mockResolvedValueOnce(manyComments)  // Page 1: review comments
      .mockResolvedValueOnce([])            // Page 1: issue comments  
      .mockResolvedValueOnce(manyComments)  // Page 2: review comments
      .mockResolvedValueOnce([])            // Page 2: issue comments
      .mockResolvedValueOnce(manyComments)  // Page 3: review comments
      .mockResolvedValueOnce([]);           // Page 3: issue comments

    // First page (no cursor)
    const page1 = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological'
    });

    expect(page1.comments).toHaveLength(20); // Server page size
    expect(page1.nextCursor).toBeDefined(); // More results
    
    // Second page using cursor
    const page2 = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological',
      cursor: page1.nextCursor
    });
    
    expect(page2.comments).toHaveLength(20);
    expect(page2.nextCursor).toBeDefined();
    
    // Third page (last)
    const page3 = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological',
      cursor: page2.nextCursor
    });
    
    expect(page3.comments).toHaveLength(10); // Remaining
    expect(page3.nextCursor).toBeUndefined(); // No more
  });

  it('should generate summary statistics', async () => {
    mockOctokit.paginate
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([
        {
          id: 4,
          user: { login: 'bob', type: 'User' },
          author_association: 'CONTRIBUTOR',
          created_at: '2024-01-01T13:00:00Z',
          updated_at: '2024-01-01T13:00:00Z',
          body: 'Bob comment',
          reactions: { total_count: 0, '+1': 0, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 0, rocket: 0, eyes: 0 }
        }
      ]);

    const result = await handleFindUnresolvedComments(mockClient, {
      pr: 'owner/repo#123',
      include_bots: true,
      sort: 'chronological'
    });

    expect(result.summary.total_comments).toBe(4);
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
});

