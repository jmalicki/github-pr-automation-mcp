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
import { handleGetFailingTests } from './tools/get-failing-tests/handler.js';
import { handleFindUnresolvedComments } from './tools/find-unresolved-comments/handler.js';
import { handleManageStackedPRs } from './tools/manage-stacked-prs/handler.js';
import { handleDetectMergeConflicts } from './tools/detect-merge-conflicts/handler.js';
import { handleCheckMergeReadiness } from './tools/check-merge-readiness/handler.js';
import { handleAnalyzePRImpact } from './tools/analyze-pr-impact/handler.js';
import { handleGetReviewSuggestions } from './tools/get-review-suggestions/handler.js';
import { handleRebaseAfterSquashMerge } from './tools/rebase-after-squash-merge/handler.js';
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

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_failing_tests',
        description: 'Analyze PR CI failures and provide targeted fix instructions. 💾 Preference hints: bail_on_first, page_size',
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
            page: {
              type: 'number',
              description: 'Page number (default: 1)',
              default: 1
            },
            page_size: {
              type: 'number',
              description: '💾 Results per page (default: 10, max: 50). User preference: power users often prefer 20-50',
              default: 10
            }
          },
          required: ['pr']
        }
      },
      {
        name: 'find_unresolved_comments',
        description: 'Find unresolved PR comments. Returns raw data for LLM analysis. 💾 Preference hints: include_bots, sort, page_size',
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
            page: {
              type: 'number',
              description: 'Page number (default: 1)',
              default: 1
            },
            page_size: {
              type: 'number',
              description: '💾 Results per page (default: 20, max: 100). User preference',
              default: 20
            },
            sort: {
              type: 'string',
              description: '💾 Sort order: chronological, by_file, by_author (default: chronological). User preference',
              enum: ['chronological', 'by_file', 'by_author'],
              default: 'chronological'
            }
          },
          required: ['pr']
        }
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
            page: {
              type: 'number',
              description: 'Command page (default: 1)',
              default: 1
            },
            page_size: {
              type: 'number',
              description: 'Commands per page (default: 5, max: 20)',
              default: 5
            }
          },
          required: ['base_pr', 'dependent_pr']
        }
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
        }
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
        }
      },
      {
        name: 'analyze_pr_impact',
        description: 'Analyze the impact and scope of PR changes',
        inputSchema: {
          type: 'object',
          properties: {
            pr: {
              type: 'string',
              description: 'PR identifier (owner/repo#123)'
            },
            depth: {
              type: 'string',
              description: 'Analysis depth: summary or detailed',
              enum: ['summary', 'detailed'],
              default: 'summary'
            }
          },
          required: ['pr']
        }
      },
      {
        name: 'get_review_suggestions',
        description: 'Get AI-optimized review context and suggestions',
        inputSchema: {
          type: 'object',
          properties: {
            pr: {
              type: 'string',
              description: 'PR identifier (owner/repo#123)'
            },
            focus_areas: {
              type: 'array',
              description: 'Specific areas to focus on (e.g., security, performance)',
              items: { type: 'string' }
            },
            include_diff: {
              type: 'boolean',
              description: 'Include code diffs (default: true)',
              default: true
            },
            max_diff_lines: {
              type: 'number',
              description: 'Maximum diff lines to include (default: 500)',
              default: 500
            }
          },
          required: ['pr']
        }
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
        }
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

// Handle tool calls
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
      
      case 'analyze_pr_impact': {
        const input = z.object({ 
          pr: PRIdentifierStringSchema,
          depth: z.enum(['summary', 'detailed']).default('summary')
        }).parse(args);
        const result = await handleAnalyzePRImpact(githubClient, input);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      
      case 'get_review_suggestions': {
        const input = z.object({ 
          pr: PRIdentifierStringSchema,
          focus_areas: z.array(z.string()).optional(),
          include_diff: z.boolean().default(true),
          max_diff_lines: z.number().default(500)
        }).parse(args);
        const result = await handleGetReviewSuggestions(githubClient, input);
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
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: unknown) {
    // Handle GitHub API errors
    if (error && typeof error === 'object' && 'status' in error) {
      const toolError = handleGitHubError(error, name);
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

