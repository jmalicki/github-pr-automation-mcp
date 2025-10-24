import { describe, it, expect } from 'vitest';
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
});
