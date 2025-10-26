#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { GitHubClient } from './github/client.js';
import { GetFailingTestsSchema } from './tools/get-failing-tests/schema.js';
import { FindUnresolvedCommentsSchema } from './tools/find-unresolved-comments/schema.js';
import { ManageStackedPRsSchema } from './tools/manage-stacked-prs/schema.js';
import { ResolveReviewThreadInputSchema } from './tools/resolve-review-thread/schema.js';
import { CheckPermissionsSchema } from './tools/check-github-permissions/schema.js';
import { handleGetFailingTests } from './tools/get-failing-tests/handler.js';
import { handleFindUnresolvedComments } from './tools/find-unresolved-comments/handler.js';
import { handleManageStackedPRs } from './tools/manage-stacked-prs/handler.js';
import { handleDetectMergeConflicts } from './tools/detect-merge-conflicts/handler.js';
import { handleCheckMergeReadiness } from './tools/check-merge-readiness/handler.js';
import { handleRebaseAfterSquashMerge } from './tools/rebase-after-squash-merge/handler.js';
import { handleResolveReviewThread } from './tools/resolve-review-thread/handler.js';
import { handleCheckPermissions } from './tools/check-github-permissions/handler.js';
import { handleGitHubError } from './github/errors.js';
import { PRIdentifierStringSchema } from './utils/validation.js';
import { z } from 'zod';

const server = new Server(
  {
    name: 'resolve-pr-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools for the MCP server
 * @returns List of available tools with their schemas and descriptions
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_failing_tests',
        description: 'Analyze PR CI failures and provide targeted fix instructions. 💾 Preference hints: bail_on_first',
        inputSchema: {
          type: 'object',
          properties: {
            pr: {
              type: 'string',
              description: 'PR identifier (owner/repo#123 or URL)'
            },
            wait: {
              type: 'boolean',
              description: 'Wait for CI completion (default: false)',
              default: false
            },
            bail_on_first: {
              type: 'boolean',
              description: '💾 Stop at first failure when waiting (default: true). User preference: fast feedback vs complete results',
              default: true
            },
            cursor: {
              type: 'string',
              description: 'MCP cursor for pagination (optional)'
            }
          },
          required: ['pr']
        },
        readOnlyHint: true
      },
      {
        name: 'find_unresolved_comments',
        description: 'Find unresolved PR comments. Returns raw data for LLM analysis. 💾 Preference hints: include_bots, sort',
        inputSchema: {
          type: 'object',
          properties: {
            pr: {
              type: 'string',
              description: 'PR identifier (owner/repo#123 or URL)'
            },
            include_bots: {
              type: 'boolean',
              description: '💾 Include bot comments (default: true). User preference: noise tolerance',
              default: true
            },
            exclude_authors: {
              type: 'array',
              description: 'Specific authors to exclude (optional)',
              items: { type: 'string' }
            },
            cursor: {
              type: 'string',
              description: 'MCP cursor for pagination (optional)'
            },
            sort: {
              type: 'string',
              description: '💾 Sort order: chronological, by_file, by_author (default: chronological). User preference',
              enum: ['chronological', 'by_file', 'by_author'],
              default: 'chronological'
            }
          },
          required: ['pr']
        },
        readOnlyHint: true
      },
      {
        name: 'manage_stacked_prs',
        description: 'Manage stacked PRs with rebase automation. Detects squash-merges and recommends --onto strategy. 💾 Preference hint: auto_fix',
        inputSchema: {
          type: 'object',
          properties: {
            base_pr: {
              type: 'string',
              description: 'Earlier PR in stack (owner/repo#123)'
            },
            dependent_pr: {
              type: 'string',
              description: 'Later PR in stack (owner/repo#124)'
            },
            auto_fix: {
              type: 'boolean',
              description: '💾 Auto-fix test failures (default: true). User preference: trust level',
              default: true
            },
            use_onto: {
              type: 'boolean',
              description: 'Use --onto for rebase (default: auto-detect based on squash-merge)'
            },
            onto_base: {
              type: 'string',
              description: 'Explicit base for --onto (e.g., "main")'
            },
            max_iterations: {
              type: 'number',
              description: 'Max fix iterations (default: 3)',
              default: 3
            },
            cursor: {
              type: 'string',
              description: 'MCP cursor for pagination (optional)'
            }
          },
          required: ['base_pr', 'dependent_pr']
        },
        readOnlyHint: true
      },
      {
        name: 'detect_merge_conflicts',
        description: 'Detect merge conflicts in a PR',
        inputSchema: {
          type: 'object',
          properties: {
            pr: {
              type: 'string',
              description: 'PR identifier (owner/repo#123)'
            },
            target_branch: {
              type: 'string',
              description: 'Target branch to check conflicts against (optional)'
            }
          },
          required: ['pr']
        },
        readOnlyHint: true
      },
      {
        name: 'check_merge_readiness',
        description: 'Check if PR is ready to merge',
        inputSchema: {
          type: 'object',
          properties: {
            pr: {
              type: 'string',
              description: 'PR identifier (owner/repo#123)'
            }
          },
          required: ['pr']
        },
        readOnlyHint: true
      },
      {
        name: 'rebase_after_squash_merge',
        description: 'Generate rebase commands after upstream PR was squash-merged, using --onto strategy',
        inputSchema: {
          type: 'object',
          properties: {
            pr: {
              type: 'string',
              description: 'Your PR identifier (owner/repo#123)'
            },
            upstream_pr: {
              type: 'string',
              description: 'Upstream PR that was squash-merged (optional, can auto-detect)'
            },
            target_branch: {
              type: 'string',
              description: 'Target branch (default: PR base branch)'
            }
          },
          required: ['pr']
        },
        readOnlyHint: true
      },
      {
        name: 'resolve_review_thread',
        description: 'Resolve a specific review thread (or via comment id) immediately',
        inputSchema: {
          type: 'object',
          properties: {
            pr: {
              type: 'string',
              description: 'PR identifier (owner/repo#123)'
            },
            thread_id: {
              type: 'string',
              description: 'Review thread GraphQL node ID (required if comment_id not provided)'
            },
            comment_id: {
              type: 'string',
              description: 'Comment ID (GraphQL node ID or numeric REST ID; will be mapped to thread, required if thread_id not provided)'
            },
            prefer: {
              type: 'string',
              description: 'Prefer "thread" or "comment" when both are provided',
              enum: ['thread', 'comment'],
              default: 'thread'
            }
          },
          required: ['pr'],
          anyOf: [
            { required: ['thread_id'] },
            { required: ['comment_id'] }
          ]
        },
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true
      },
      {
        name: 'check_github_permissions',
        description: 'Diagnose GitHub token permissions and provide fix guidance. Use when other tools fail with permission errors.',
        inputSchema: {
          type: 'object',
          properties: {
            pr: {
              type: 'string',
              description: 'PR identifier (owner/repo#123 or URL)'
            },
            actions: {
              type: 'array',
              description: 'Specific actions to test (optional)',
              items: {
                type: 'string',
                enum: ['read_comments', 'create_comments', 'resolve_threads', 'merge_pr', 'approve_pr', 'request_changes', 'read_ci', 'write_ci']
              }
            },
            detailed: {
              type: 'boolean',
              description: 'Include detailed diagnostics (default: false)',
              default: false
            }
          },
          required: ['pr']
        },
        readOnlyHint: true
      }
    ]
  };
});

// Initialize GitHub client
let githubClient: GitHubClient;
try {
  githubClient = new GitHubClient();
} catch (error) {
  console.error('Failed to initialize GitHub client:', error);
  process.exit(1);
}

/**
 * Handle tool execution requests
 * @param request - Tool execution request with name and arguments
 * @returns Tool execution result
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'get_failing_tests': {
        const input = GetFailingTestsSchema.parse(args);
        const result = await handleGetFailingTests(githubClient, input);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      case 'find_unresolved_comments': {
        const input = FindUnresolvedCommentsSchema.parse(args);
        const result = await handleFindUnresolvedComments(githubClient, input);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      case 'manage_stacked_prs': {
        const input = ManageStackedPRsSchema.parse(args);
        const result = await handleManageStackedPRs(githubClient, input);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      case 'detect_merge_conflicts': {
        const input = z.object({ 
          pr: PRIdentifierStringSchema,
          target_branch: z.string().optional()
        }).parse(args);
        const result = await handleDetectMergeConflicts(githubClient, input);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      case 'check_merge_readiness': {
        const input = z.object({ 
          pr: PRIdentifierStringSchema
        }).parse(args);
        const result = await handleCheckMergeReadiness(githubClient, input);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      case 'rebase_after_squash_merge': {
        const input = z.object({ 
          pr: PRIdentifierStringSchema,
          upstream_pr: PRIdentifierStringSchema.optional(),
          target_branch: z.string().optional()
        }).parse(args);
        const result = await handleRebaseAfterSquashMerge(githubClient, input);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      case 'resolve_review_thread': {
        const input = ResolveReviewThreadInputSchema.parse(args);
        const result = await handleResolveReviewThread(githubClient, input);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      case 'check_github_permissions': {
        const input = CheckPermissionsSchema.parse(args);
        const result = await handleCheckPermissions(githubClient, input);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: unknown) {
    // Handle GitHub API errors
    if (error && typeof error === 'object' && 'status' in error) {
      const toolError = handleGitHubError(error, name);
      
      // If the error suggests a diagnostic tool, include helpful context
      if (toolError.diagnostic_tool) {
        const enhancedError = {
          ...toolError,
          diagnostic_command: `Use MCP tool: ${toolError.diagnostic_tool}`,
          diagnostic_example: toolError.diagnostic_tool === 'check_github_permissions' 
            ? `Example: {"pr": "owner/repo#123", "actions": ["${name}"]}`
            : undefined
        };
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(enhancedError, null, 2)
          }],
          isError: true
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(toolError, null, 2)
        }],
        isError: true
      };
    }
    
    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: errorMessage,
          category: 'unknown'
        }, null, 2)
      }],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log to stderr (stdout is used for MCP protocol)
  console.error('Resolve PR MCP server running on stdio');
  console.error('Version: 0.1.0');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

