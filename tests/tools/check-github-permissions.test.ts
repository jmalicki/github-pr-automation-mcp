import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCheckPermissions } from '../../src/tools/check-github-permissions/handler.js';
import { CheckPermissionsInput } from '../../src/tools/check-github-permissions/schema.js';

// Mock GitHub client
const mockOctokit = {
  rest: {
    users: {
      getAuthenticated: vi.fn()
    },
    repos: {
      get: vi.fn()
    },
    pulls: {
      get: vi.fn(),
      listReviewComments: vi.fn(),
      createReview: vi.fn()
    },
    issues: {
      createComment: vi.fn()
    },
    checks: {
      listForRef: vi.fn()
    },
    rateLimit: {
      get: vi.fn()
    }
  },
  graphql: vi.fn()
};

const mockClient = {
  getOctokit: () => mockOctokit
} as any;

describe('handleCheckPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default successful responses
    mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
      data: { login: 'testuser' }
    });
    
    mockOctokit.rest.repos.get.mockResolvedValue({
      data: {
        permissions: {
          admin: false,
          push: true,
          pull: true
        }
      }
    });
    
    mockOctokit.rest.pulls.get.mockResolvedValue({
      data: { number: 123, mergeable: true }
    });
    
    mockOctokit.rest.rateLimit.get.mockResolvedValue({
      data: {
        rate: {
          remaining: 4500,
          limit: 5000,
          reset: Date.now() / 1000 + 3600
        }
      }
    });
  });

  it('should validate token and check basic permissions', async () => {
    const input: CheckPermissionsInput = {
      pr: 'owner/repo#123'
    };

    const result = await handleCheckPermissions(mockClient, input);

    expect(result.token_valid).toBe(true);
    expect(result.user).toBe('testuser');
    expect(result.repository_access).toBe(true);
    expect(result.summary.overall_status).toBe('healthy');
  });

  it('should detect token issues', async () => {
    mockOctokit.rest.users.getAuthenticated.mockRejectedValue(
      new Error('Bad credentials')
    );

    const input: CheckPermissionsInput = {
      pr: 'owner/repo#123'
    };

    const result = await handleCheckPermissions(mockClient, input);

    expect(result.token_valid).toBe(false);
    expect(result.summary.overall_status).toBe('critical');
    expect(result.summary.primary_issue).toBe('Invalid GitHub token');
  });

  it('should detect repository access issues', async () => {
    mockOctokit.rest.repos.get.mockRejectedValue(
      new Error('Not Found')
    );

    const input: CheckPermissionsInput = {
      pr: 'owner/repo#123'
    };

    const result = await handleCheckPermissions(mockClient, input);

    expect(result.repository_access).toBe(false);
    expect(result.summary.overall_status).toBe('critical');
  });

  it('should test specific actions when provided', async () => {
    mockOctokit.rest.pulls.listReviewComments.mockRejectedValue(
      new Error('Resource not accessible')
    );

    const input: CheckPermissionsInput = {
      pr: 'owner/repo#123',
      actions: ['read_comments', 'create_comments']
    };

    const result = await handleCheckPermissions(mockClient, input);

    expect(result.action_results.read_comments.allowed).toBe(false);
    expect(result.action_results.read_comments.reason).toContain('Cannot read review comments');
    expect(result.diagnostics.missing_scopes).toContain('repo');
  });

  it('should provide fix recommendations for failed actions', async () => {
    mockOctokit.rest.pulls.listReviewComments.mockRejectedValue(
      new Error('Resource not accessible')
    );
    mockOctokit.rest.repos.get.mockRejectedValue(
      new Error('Resource not accessible')
    );

    const input: CheckPermissionsInput = {
      pr: 'owner/repo#123',
      actions: ['read_comments', 'resolve_threads']
    };

    const result = await handleCheckPermissions(mockClient, input);

    expect(result.fixes.token_update).toContain('Add "repo" scope to your GitHub token');
    expect(result.fixes.alternative_commands.read_comments).toContain('gh pr view');
    expect(result.fixes.alternative_commands.resolve_threads).toContain('gh pr review');
  });

  it('should check rate limits', async () => {
    mockOctokit.rest.rateLimit.get.mockResolvedValue({
      data: {
        rate: {
          remaining: 50,
          limit: 5000,
          reset: Date.now() / 1000 + 3600
        }
      }
    });

    const input: CheckPermissionsInput = {
      pr: 'owner/repo#123'
    };

    const result = await handleCheckPermissions(mockClient, input);

    expect(result.diagnostics.rate_limit_status).toBe('critical');
    expect(result.diagnostics.suggestions).toContain('⚠️ Rate limit critical: 50/5000 remaining');
  });
});
