import { describe, it, expect, vi } from 'vitest';
import { GitHubClient } from '../../src/github/client.js';
import { E2ETestSetup } from './setup.js';

describe('GitHubClient Dependency Injection', () => {
  it('should accept injected Octokit instance', () => {
    // Create a mock Octokit instance
    const mockOctokit = {
      users: {
        getAuthenticated: () => Promise.resolve({
          data: { login: 'test-user' },
          headers: { 'x-oauth-scopes': 'repo' }
        })
      },
      rateLimit: {
        get: () => Promise.resolve({
          data: { core: { limit: 5000, remaining: 4999 } }
        })
      },
      pulls: {
        get: () => Promise.resolve({
          data: { number: 123, title: 'Test PR' }
        })
      }
    } as any;

    // Create GitHubClient with injected mock
    const client = new GitHubClient(undefined, mockOctokit);
    
    // Verify the client uses the injected instance
    expect(client.getOctokit()).toBe(mockOctokit);
  });

  it('should work with E2ETestSetup', () => {
    const setup = new E2ETestSetup();
    
    // This would normally use fixtures, but we're just testing the setup
    expect(setup).toBeDefined();
    expect(typeof setup.setupPRScenario).toBe('function');
    expect(typeof setup.getAvailableScenarios).toBe('function');
  });

  it('should fall back to token when no Octokit instance provided', () => {
    // This should throw an error since no token is provided
    expect(() => {
      new GitHubClient();
    }).toThrow('GitHub token not found');
  });

  it('should use token when provided and no Octokit instance', () => {
    // Test that constructor accepts token parameter
    expect(() => {
      new GitHubClient('test-token');
    }).not.toThrow();
  });

  it('should use environment variable when no token provided', () => {
    const originalEnv = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'env-token';

    try {
      // Test that constructor works with environment variable
      expect(() => {
        new GitHubClient();
      }).not.toThrow();
    } finally {
      process.env.GITHUB_TOKEN = originalEnv;
    }
  });

  it('should validate token with injected Octokit', async () => {
    const mockOctokit = {
      users: {
        getAuthenticated: vi.fn().mockResolvedValue({
          data: { login: 'test-user' },
          headers: { 'x-oauth-scopes': 'repo,public_repo' }
        })
      }
    } as any;

    const client = new GitHubClient(undefined, mockOctokit);
    const result = await client.validateToken();

    expect(result.valid).toBe(true);
    expect(result.user).toBe('test-user');
    expect(result.scopes).toEqual(['repo', 'public_repo']);
    expect(mockOctokit.users.getAuthenticated).toHaveBeenCalled();
  });

  it('should handle token validation errors', async () => {
    const mockOctokit = {
      users: {
        getAuthenticated: vi.fn().mockRejectedValue(new Error('Invalid token'))
      }
    } as any;

    const client = new GitHubClient(undefined, mockOctokit);
    const result = await client.validateToken();

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid token');
  });

  it('should get pull request with injected Octokit', async () => {
    const mockPR = { number: 123, title: 'Test PR', state: 'open' };
    const mockOctokit = {
      pulls: {
        get: vi.fn().mockResolvedValue({ data: mockPR })
      }
    } as any;

    const client = new GitHubClient(undefined, mockOctokit);
    const result = await client.getPullRequest({ owner: 'test', repo: 'test', number: 123 });

    expect(result).toBe(mockPR);
    expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
      owner: 'test',
      repo: 'test',
      pull_number: 123
    });
  });

  it('should get rate limit with injected Octokit', async () => {
    const mockRateLimit = { core: { limit: 5000, remaining: 4999 } };
    const mockOctokit = {
      rateLimit: {
        get: vi.fn().mockResolvedValue({ data: mockRateLimit })
      }
    } as any;

    const client = new GitHubClient(undefined, mockOctokit);
    const result = await client.getRateLimit();

    expect(result).toBe(mockRateLimit);
    expect(mockOctokit.rateLimit.get).toHaveBeenCalled();
  });
});
