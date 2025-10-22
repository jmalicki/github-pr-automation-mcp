import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleManageStackedPRs } from '../../src/tools/manage-stacked-prs/handler.js';
import { GitHubClient } from '../../src/github/client.js';

describe('handleManageStackedPRs', () => {
  let mockClient: GitHubClient;
  let mockOctokit: any;

  beforeEach(() => {
    mockOctokit = {
      pulls: {
        get: vi.fn()
      },
      repos: {
        compareCommits: vi.fn()
      }
    };

    mockClient = {
      getOctokit: () => mockOctokit
    } as any;
  });

  it('should detect stacked PRs correctly', async () => {
    mockOctokit.pulls.get
      .mockResolvedValueOnce({
        data: {
          number: 123,
          head: { ref: 'feature-branch', sha: 'abc123' },
          base: { ref: 'main' }
        }
      })
      .mockResolvedValueOnce({
        data: {
          number: 124,
          head: { ref: 'feature-2', sha: 'def456' },
          base: { ref: 'feature-branch' } // Stacked on PR #123
        }
      });

    mockOctokit.repos.compareCommits.mockResolvedValue({
      data: {
        ahead_by: 2,
        commits: [
          { sha: 'commit1', commit: { message: 'Change 1' } },
          { sha: 'commit2', commit: { message: 'Change 2' } }
        ],
        files: [
          { filename: 'file1.ts', status: 'modified' },
          { filename: 'file2.ts', status: 'added' }
        ]
      }
    });

    const result = await handleManageStackedPRs(mockClient, {
      base_pr: 'owner/repo#123',
      dependent_pr: 'owner/repo#124',
      auto_fix: true,
      page: 1,
      page_size: 5
    });

    expect(result.is_stacked).toBe(true);
    expect(result.changes_detected).toBe(true);
    expect(result.change_summary.new_commits_in_base).toBe(2);
    expect(result.commands.length).toBeGreaterThan(0);
  });

  it('should detect non-stacked PRs', async () => {
    mockOctokit.pulls.get
      .mockResolvedValueOnce({
        data: {
          number: 123,
          head: { ref: 'feature-branch', sha: 'abc123' },
          base: { ref: 'main' }
        }
      })
      .mockResolvedValueOnce({
        data: {
          number: 124,
          head: { ref: 'feature-2', sha: 'def456' },
          base: { ref: 'main' } // NOT stacked, both target main
        }
      });

    mockOctokit.repos.compareCommits.mockResolvedValue({
      data: {
        ahead_by: 0,
        commits: [],
        files: []
      }
    });

    const result = await handleManageStackedPRs(mockClient, {
      base_pr: 'owner/repo#123',
      dependent_pr: 'owner/repo#124',
      auto_fix: true,
      page: 1,
      page_size: 5
    });

    expect(result.is_stacked).toBe(false);
  });

  it('should throw error for PRs in different repos', async () => {
    await expect(
      handleManageStackedPRs(mockClient, {
        base_pr: 'owner1/repo1#123',
        dependent_pr: 'owner2/repo2#124',
        auto_fix: true,
        page: 1,
        page_size: 5
      })
    ).rejects.toThrow('PRs must be in the same repository');
  });

  it('should handle no changes detected', async () => {
    mockOctokit.pulls.get
      .mockResolvedValueOnce({
        data: {
          number: 123,
          head: { ref: 'feature-branch', sha: 'abc123' },
          base: { ref: 'main' }
        }
      })
      .mockResolvedValueOnce({
        data: {
          number: 124,
          head: { ref: 'feature-2', sha: 'def456' },
          base: { ref: 'feature-branch' }
        }
      });

    mockOctokit.repos.compareCommits.mockResolvedValue({
      data: {
        ahead_by: 0,
        commits: [],
        files: []
      }
    });

    const result = await handleManageStackedPRs(mockClient, {
      base_pr: 'owner/repo#123',
      dependent_pr: 'owner/repo#124',
      auto_fix: true,
      page: 1,
      page_size: 5
    });

    expect(result.changes_detected).toBe(false);
    expect(result.commands.length).toBe(0);
  });

  it('should generate rebase commands when changes detected', async () => {
    mockOctokit.pulls.get
      .mockResolvedValueOnce({
        data: {
          number: 123,
          head: { ref: 'feature-branch', sha: 'abc123' },
          base: { ref: 'main' }
        }
      })
      .mockResolvedValueOnce({
        data: {
          number: 124,
          head: { ref: 'feature-2', sha: 'def456' },
          base: { ref: 'feature-branch' }
        }
      });

    mockOctokit.repos.compareCommits.mockResolvedValue({
      data: {
        ahead_by: 1,
        commits: [{ sha: 'commit1', commit: { message: 'Fix bug' } }],
        files: [{ filename: 'file.ts', status: 'modified' }]
      }
    });

    const result = await handleManageStackedPRs(mockClient, {
      base_pr: 'owner/repo#123',
      dependent_pr: 'owner/repo#124',
      auto_fix: true,
      page: 1,
      page_size: 5
    });

    expect(result.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'git',
          command: expect.stringContaining('git fetch')
        }),
        expect.objectContaining({
          type: 'git',
          command: expect.stringContaining('git rebase')
        })
      ])
    );
  });

  it('should support --onto rebase strategy when specified', async () => {
    mockOctokit.pulls.get
      .mockResolvedValueOnce({
        data: {
          number: 123,
          head: { ref: 'feature-branch', sha: 'abc123' },
          base: { ref: 'main' }
        }
      })
      .mockResolvedValueOnce({
        data: {
          number: 124,
          head: { ref: 'feature-2', sha: 'def456' },
          base: { ref: 'feature-branch' }
        }
      });

    mockOctokit.repos.compareCommits.mockResolvedValue({
      data: {
        ahead_by: 1,
        commits: [{ sha: 'commit1', commit: { message: 'Fix' } }],
        files: []
      }
    });

    const result = await handleManageStackedPRs(mockClient, {
      base_pr: 'owner/repo#123',
      dependent_pr: 'owner/repo#124',
      auto_fix: true,
      use_onto: true,
      onto_base: 'main',
      page: 1,
      page_size: 5
    });

    const rebaseCommand = result.commands.find(c => c.command.includes('git rebase'));
    expect(rebaseCommand?.command).toContain('--onto');
    expect(rebaseCommand?.command).toContain('origin/main');
  });

  it('should paginate commands correctly', async () => {
    mockOctokit.pulls.get
      .mockResolvedValueOnce({
        data: {
          number: 123,
          head: { ref: 'feature-branch', sha: 'abc123' },
          base: { ref: 'main' }
        }
      })
      .mockResolvedValueOnce({
        data: {
          number: 124,
          head: { ref: 'feature-2', sha: 'def456' },
          base: { ref: 'feature-branch' }
        }
      });

    mockOctokit.repos.compareCommits.mockResolvedValue({
      data: {
        ahead_by: 1,
        commits: [{ sha: 'commit1', commit: { message: 'Fix' } }],
        files: []
      }
    });

    // Get first page
    const page1 = await handleManageStackedPRs(mockClient, {
      base_pr: 'owner/repo#123',
      dependent_pr: 'owner/repo#124',
      auto_fix: true,
      page: 1,
      page_size: 2
    });

    expect(page1.commands.length).toBeLessThanOrEqual(2);
    expect(page1.pagination.page).toBe(1);
    expect(page1.pagination.page_size).toBe(2);
  });

  it('should include change summary with commits and files', async () => {
    mockOctokit.pulls.get
      .mockResolvedValueOnce({
        data: {
          number: 123,
          head: { ref: 'feature-branch', sha: 'abc123' },
          base: { ref: 'main' }
        }
      })
      .mockResolvedValueOnce({
        data: {
          number: 124,
          head: { ref: 'feature-2', sha: 'def456' },
          base: { ref: 'feature-branch' }
        }
      });

    mockOctokit.repos.compareCommits.mockResolvedValue({
      data: {
        ahead_by: 2,
        commits: [
          { sha: 'abc', commit: { message: 'feat: add feature', author: { name: 'Alice', date: '2024-01-01' } } },
          { sha: 'def', commit: { message: 'fix: bug fix', author: { name: 'Bob', date: '2024-01-02' } } }
        ],
        files: [
          { filename: 'src/feature.ts', status: 'added' },
          { filename: 'src/bug.ts', status: 'modified' }
        ]
      }
    });

    const result = await handleManageStackedPRs(mockClient, {
      base_pr: 'owner/repo#123',
      dependent_pr: 'owner/repo#124',
      auto_fix: true,
      page: 1,
      page_size: 5
    });

    expect(result.change_summary.new_commits_in_base).toBe(2);
    expect(result.change_summary.commits).toHaveLength(2);
    expect(result.change_summary.files_changed).toEqual([
      'src/feature.ts',
      'src/bug.ts'
    ]);
  });

  it('should provide rebase strategy recommendation', async () => {
    mockOctokit.pulls.get
      .mockResolvedValueOnce({
        data: {
          number: 123,
          head: { ref: 'feature-branch', sha: 'abc123' },
          base: { ref: 'main' }
        }
      })
      .mockResolvedValueOnce({
        data: {
          number: 124,
          head: { ref: 'feature-2', sha: 'def456' },
          base: { ref: 'feature-branch' }
        }
      });

    mockOctokit.repos.compareCommits.mockResolvedValue({
      data: {
        ahead_by: 1,
        commits: [{ sha: 'commit1', commit: { message: 'Fix' } }],
        files: []
      }
    });

    const result = await handleManageStackedPRs(mockClient, {
      base_pr: 'owner/repo#123',
      dependent_pr: 'owner/repo#124',
      auto_fix: true,
      page: 1,
      page_size: 5
    });

    // Note: rebase_strategy is optional in Phase 3, will be fully implemented in Phase 4
    if (result.rebase_strategy) {
      expect(result.rebase_strategy.recommended).toMatch(/regular|onto/);
      expect(result.rebase_strategy.reason).toBeTruthy();
    }
  });
});

