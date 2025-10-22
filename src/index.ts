#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

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
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  
  try {
    switch (name) {
      case 'get_failing_tests':
        return {
          content: [{
            type: 'text',
            text: 'Tool not yet implemented. This is Phase 2 foundation - tool implementation comes in Phase 3.'
          }]
        };
      
      case 'find_unresolved_comments':
        return {
          content: [{
            type: 'text',
            text: 'Tool not yet implemented. This is Phase 2 foundation - tool implementation comes in Phase 3.'
          }]
        };
      
      case 'manage_stacked_prs':
        return {
          content: [{
            type: 'text',
            text: 'Tool not yet implemented. This is Phase 2 foundation - tool implementation comes in Phase 3.'
          }]
        };
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{
        type: 'text',
        text: `Error: ${errorMessage}`
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

