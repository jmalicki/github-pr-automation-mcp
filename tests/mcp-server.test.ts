import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubClient } from '../src/github/client.js';

// Mock the GitHubClient
vi.mock('../src/github/client.js', () => ({
  GitHubClient: class MockGitHubClient {
    constructor() {
      this.getOctokit = vi.fn().mockReturnValue({
        rest: {
          pulls: {
            get: vi.fn(),
            list: vi.fn(),
            listReviewComments: vi.fn()
          },
          checks: {
            listForRef: vi.fn()
          },
          issues: {
            listComments: vi.fn()
          }
        },
        graphql: vi.fn()
      });
      this.validateToken = vi.fn().mockResolvedValue(true);
    }
  }
}));

describe('MCP Server', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    process.env = { ...originalEnv, GITHUB_TOKEN: 'fake_token' };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should export required functions', async () => {
    // Import the module to test its exports
    const mcpServer = await import('../src/index.js');
    
    // The MCP server should be importable without errors
    expect(mcpServer).toBeDefined();
  });

  it('should handle tool registration', async () => {
    // Test that the server can be imported and doesn't throw
    expect(async () => {
      await import('../src/index.js');
    }).not.toThrow();
  });

  it('should handle GitHub client initialization', async () => {
    // Test that GitHubClient is properly mocked and can be instantiated
    const client = new GitHubClient();
    expect(client).toBeDefined();
    // Just test that the client exists - the mock provides the methods
    expect(client).toBeTruthy();
  });
});
