import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GitHubClient } from '../../src/github/client.js';
import { handleRebaseAfterSquashMerge } from '../../src/tools/rebase-after-squash-merge/handler.js';

describe('handleRebaseAfterSquashMerge', () => {
  let mockClient: GitHubClient;
  let mockOctokit: any;

  beforeEach(() => {
    mockOctokit = {
      pulls: {
        get: vi.fn()
      }
    };

    mockClient = {
      getOctokit: vi.fn().mockReturnValue(mockOctokit)
    } as any;
  });

  it('should return basic rebase commands with default target branch', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        base: { ref: 'main' },
        head: { ref: 'feature-branch' }
      }
    });

    const result = await handleRebaseAfterSquashMerge(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.pr).toBe('owner/repo#123');
    expect(result.analysis.upstream_pr).toBeUndefined();
    expect(result.analysis.detected_squash_merge).toBe(false);
    expect(result.commands).toHaveLength(3);
    expect(result.commands[0].step).toBe(1);
    expect(result.commands[0].command).toBe('git fetch origin');
    expect(result.commands[1].step).toBe(2);
    expect(result.commands[1].command).toContain('git rebase --onto origin/main');
    expect(result.commands[2].step).toBe(3);
    expect(result.commands[2].command).toBe('git push --force-with-lease origin feature-branch');
    expect(result.summary.action_required).toBe(true);
    expect(result.summary.reason).toBe('Manual upstream commit identification needed in this phase');
  });

  it('should use custom target branch when provided', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        base: { ref: 'main' },
        head: { ref: 'feature-branch' }
      }
    });

    const result = await handleRebaseAfterSquashMerge(mockClient, {
      pr: 'owner/repo#123',
      target_branch: 'develop'
    });

    expect(result.commands[1].command).toContain('git rebase --onto origin/develop');
  });

  it('should include upstream PR in analysis when provided', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        base: { ref: 'main' },
        head: { ref: 'feature-branch' }
      }
    });

    const result = await handleRebaseAfterSquashMerge(mockClient, {
      pr: 'owner/repo#123',
      upstream_pr: 'owner/repo#456'
    });

    expect(result.analysis.upstream_pr).toBe('owner/repo#456');
  });

  it('should provide detailed command descriptions', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        base: { ref: 'main' },
        head: { ref: 'feature-branch' }
      }
    });

    const result = await handleRebaseAfterSquashMerge(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.commands[0].description).toBe('Fetch latest changes from remote');
    expect(result.commands[1].description).toContain('Rebase using --onto to skip squash-merged commits');
    expect(result.commands[2].description).toBe('Update remote branch');
  });

  it('should handle different branch names', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        base: { ref: 'develop' },
        head: { ref: 'my-feature' }
      }
    });

    const result = await handleRebaseAfterSquashMerge(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.commands[1].command).toContain('git rebase --onto origin/develop');
    expect(result.commands[2].command).toBe('git push --force-with-lease origin my-feature');
  });

  it('should always indicate action is required', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        base: { ref: 'main' },
        head: { ref: 'feature-branch' }
      }
    });

    const result = await handleRebaseAfterSquashMerge(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.summary.action_required).toBe(true);
    expect(result.summary.reason).toBe('Manual upstream commit identification needed in this phase');
  });
});
