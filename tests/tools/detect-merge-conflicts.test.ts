import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GitHubClient } from '../../src/github/client.js';
import { handleDetectMergeConflicts } from '../../src/tools/detect-merge-conflicts/handler.js';

describe('handleDetectMergeConflicts', () => {
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

  it('should detect no conflicts when mergeable is true', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        mergeable: true,
        mergeable_state: 'clean'
      }
    });

    const result = await handleDetectMergeConflicts(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.pr).toBe('owner/repo#123');
    expect(result.has_conflicts).toBe(false);
    expect(result.mergeable_state).toBe('clean');
    expect(result.message).toBe('PR has no conflicts and is ready to merge');
  });

  it('should detect conflicts when mergeable is false', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        mergeable: false,
        mergeable_state: 'dirty'
      }
    });

    const result = await handleDetectMergeConflicts(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.has_conflicts).toBe(true);
    expect(result.mergeable_state).toBe('dirty');
    expect(result.message).toBe('PR has merge conflicts that must be resolved');
  });

  it('should handle unknown merge status', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        mergeable: null,
        mergeable_state: 'unknown'
      }
    });

    const result = await handleDetectMergeConflicts(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.has_conflicts).toBe(false);
    expect(result.mergeable_state).toBe('unknown');
    expect(result.message).toBe('Merge status is being calculated by GitHub');
  });

  it('should handle undefined mergeable_state', async () => {
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        mergeable: true,
        mergeable_state: undefined
      }
    });

    const result = await handleDetectMergeConflicts(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.has_conflicts).toBe(false);
    expect(result.mergeable_state).toBe('unknown');
    expect(result.message).toBe('PR has no conflicts and is ready to merge');
  });

  it('should handle different mergeable states', async () => {
    const testCases = [
      { mergeable_state: 'behind', expected: false },
      { mergeable_state: 'blocked', expected: false },
      { mergeable_state: 'clean', expected: false },
      { mergeable_state: 'dirty', expected: true },
      { mergeable_state: 'draft', expected: false },
      { mergeable_state: 'unstable', expected: false }
    ];

    for (const testCase of testCases) {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          mergeable: testCase.expected ? false : true,
          mergeable_state: testCase.mergeable_state
        }
      });

      const result = await handleDetectMergeConflicts(mockClient, {
        pr: 'owner/repo#123'
      });

      expect(result.mergeable_state).toBe(testCase.mergeable_state);
      expect(result.has_conflicts).toBe(testCase.expected);
    }
  });
});
