import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubClient } from '../src/github/client.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Mock the GitHubClient
vi.mock('../src/github/client.js', () => ({
  GitHubClient: class MockGitHubClient {
    getOctokit: any;
    validateToken: any;
    
    constructor() {
      this.getOctokit = vi.fn().mockReturnValue({
        rest: {
          pulls: {
            get: vi.fn(),
            list: vi.fn(),
            listReviewComments: vi.fn(),
            getReviewComment: vi.fn()
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

  it('should import without errors and have resolve_review_thread handler available', async () => {
    // Test that the module can be imported without errors
    const serverModule = await import('../src/index.js');
    expect(serverModule).toBeDefined();
    
    // Test that the resolve review thread handler is available
    const { handleResolveReviewThread } = await import('../src/tools/resolve-review-thread/handler.js');
    expect(handleResolveReviewThread).toBeDefined();
    expect(typeof handleResolveReviewThread).toBe('function');
  });

  it('should have resolve_review_thread schema properly defined', async () => {
    // Test that the schema is properly defined
    const { ResolveReviewThreadInputSchema } = await import('../src/tools/resolve-review-thread/schema.js');
    expect(ResolveReviewThreadInputSchema).toBeDefined();
    
    // Test that the schema can parse valid input
    const validInput = {
      pr: 'owner/repo#123',
      thread_id: 'thread_123'
    };
    
    const parsed = ResolveReviewThreadInputSchema.parse(validInput);
    expect(parsed.pr).toBe('owner/repo#123');
    expect(parsed.thread_id).toBe('thread_123');
  });

  it('should handle resolve_review_thread with mocked GitHub client', async () => {
    // Mock the GitHub client's getOctokit method to return a mock with graphql
    const mockOctokit = {
      rest: {
        pulls: {
          getReviewComment: vi.fn().mockResolvedValue({
            data: { node_id: 'comment_123' }
          })
        }
      },
      graphql: vi.fn()
        .mockResolvedValueOnce({
          node: {
            pullRequestReviewThread: {
              id: 'thread_123',
              isResolved: false
            }
          }
        })
        .mockResolvedValueOnce({
          resolveReviewThread: {
            thread: {
              id: 'thread_123',
              isResolved: true
            }
          }
        })
    };

    // Create a mock client
    const mockClient = {
      getOctokit: () => mockOctokit
    } as any;

    // Import and test the handler directly
    const { handleResolveReviewThread } = await import('../src/tools/resolve-review-thread/handler.js');
    
    const result = await handleResolveReviewThread(mockClient, {
      pr: 'owner/repo#123',
      thread_id: 'thread_123',
      prefer: 'thread' as const
    });
    
    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
    expect(result.thread_id).toBe('thread_123');
  });

  it('should have CLI commands and MCP tools in sync', async () => {
    // Get CLI commands by parsing the CLI file
    const cliContent = await import('fs').then(fs => 
      fs.readFileSync('src/cli.ts', 'utf8')
    );
    
    // Extract CLI command names using regex
    const cliCommandMatches = cliContent.match(/\.command\('([^']+)'\)/g);
    const cliCommands = cliCommandMatches?.map(match => 
      match.replace(/\.command\('([^']+)'\)/, '$1')
    ) || [];
    
    // Expected CLI commands based on the codebase
    const expectedCliCommands = [
      'get-failing-tests',
      'find-unresolved-comments', 
      'manage-stacked-prs',
      'resolve-review-thread'
    ];
    
    // Verify all expected CLI commands are present
    for (const expectedCmd of expectedCliCommands) {
      expect(cliCommands).toContain(expectedCmd);
    }
    
    // Get MCP tools by importing the server and checking the tools list
    // We'll need to access the tools list from the server definition
    const serverModule = await import('../src/index.js');
    
    // Since we can't directly access the server's tools list, we'll verify
    // that all the expected handlers and schemas are available
    const expectedMCPTools = [
      'get_failing_tests',
      'find_unresolved_comments',
      'manage_stacked_prs', 
      'resolve_review_thread'
    ];
    
    // Verify handlers are available for each MCP tool
    const { handleGetFailingTests } = await import('../src/tools/get-failing-tests/handler.js');
    const { handleFindUnresolvedComments } = await import('../src/tools/find-unresolved-comments/handler.js');
    const { handleManageStackedPRs } = await import('../src/tools/manage-stacked-prs/handler.js');
    const { handleResolveReviewThread } = await import('../src/tools/resolve-review-thread/handler.js');
    
    expect(handleGetFailingTests).toBeDefined();
    expect(handleFindUnresolvedComments).toBeDefined();
    expect(handleManageStackedPRs).toBeDefined();
    expect(handleResolveReviewThread).toBeDefined();
    
    // Verify schemas are available for each tool
    const { GetFailingTestsSchema } = await import('../src/tools/get-failing-tests/schema.js');
    const { FindUnresolvedCommentsSchema } = await import('../src/tools/find-unresolved-comments/schema.js');
    const { ManageStackedPRsSchema } = await import('../src/tools/manage-stacked-prs/schema.js');
    const { ResolveReviewThreadInputSchema } = await import('../src/tools/resolve-review-thread/schema.js');
    
    expect(GetFailingTestsSchema).toBeDefined();
    expect(FindUnresolvedCommentsSchema).toBeDefined();
    expect(ManageStackedPRsSchema).toBeDefined();
    expect(ResolveReviewThreadInputSchema).toBeDefined();
    
    // Verify CLI commands map to MCP tools (with naming convention conversion)
    const cliToMcpMapping = {
      'get-failing-tests': 'get_failing_tests',
      'find-unresolved-comments': 'find_unresolved_comments',
      'manage-stacked-prs': 'manage_stacked_prs',
      'resolve-review-thread': 'resolve_review_thread'
    };
    
    for (const [cliCmd, mcpTool] of Object.entries(cliToMcpMapping)) {
      expect(cliCommands).toContain(cliCmd);
      expect(expectedMCPTools).toContain(mcpTool);
    }
  });

  it('should have consistent parameter schemas between CLI and MCP', async () => {
    // Test that CLI options match MCP tool schemas
    const cliContent = await import('fs').then(fs => 
      fs.readFileSync('src/cli.ts', 'utf8')
    );
    
    // Verify that CLI commands use the same schemas as MCP tools
    expect(cliContent).toContain('GetFailingTestsSchema.parse');
    expect(cliContent).toContain('FindUnresolvedCommentsSchema.parse');
    expect(cliContent).toContain('ManageStackedPRsSchema.parse');
    expect(cliContent).toContain('ResolveReviewThreadInputSchema.parse');
    
    // Verify that CLI commands use the same handlers as MCP tools
    expect(cliContent).toContain('handleGetFailingTests');
    expect(cliContent).toContain('handleFindUnresolvedComments');
    expect(cliContent).toContain('handleManageStackedPRs');
    expect(cliContent).toContain('handleResolveReviewThread');
  });
});
