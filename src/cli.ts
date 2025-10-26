#!/usr/bin/env node

import { Command } from 'commander';
import { GitHubClient } from './github/client.js';
import { handleGetFailingTests } from './tools/get-failing-tests/handler.js';
import { handleFindUnresolvedComments } from './tools/find-unresolved-comments/handler.js';
import { handleManageStackedPRs } from './tools/manage-stacked-prs/handler.js';
import { GetFailingTestsSchema } from './tools/get-failing-tests/schema.js';
import { FindUnresolvedCommentsSchema } from './tools/find-unresolved-comments/schema.js';
import { ManageStackedPRsSchema } from './tools/manage-stacked-prs/schema.js';
import { handleResolveReviewThread } from './tools/resolve-review-thread/handler.js';
import { ResolveReviewThreadInputSchema } from './tools/resolve-review-thread/schema.js';
import { handleCheckPermissions } from './tools/check-github-permissions/handler.js';
import { CheckPermissionsSchema } from './tools/check-github-permissions/schema.js';
import { 
  setGitHubToken, 
  clearGitHubToken, 
  getGitHubToken, 
  getConfigPath, 
  hasConfigFile,
  loadConfig 
} from './config/config.js';

const program = new Command();

// Lazy initialization of GitHub client
let clientInstance: GitHubClient | null = null;
function getClient(): GitHubClient {
  if (!clientInstance) {
    clientInstance = new GitHubClient();
  }
  return clientInstance;
}

program
  .name('github-pr-automation')
  .description('MCP server and CLI for automated GitHub PR management, review resolution, and workflow optimization')
  .version('0.1.0');

program
  .command('get-failing-tests')
  .description('Analyze PR CI failures')
  .requiredOption('--pr <identifier>', 'PR identifier (owner/repo#123)')
  .option('--wait', 'Wait for CI completion')
  .option('--bail-on-first', 'Bail on first failure')
  .option('--cursor <string>', 'Pagination cursor (from previous response)')
  .option('--json', 'Output as JSON')
  .action(async (options: {
    pr: string;
    wait?: boolean;
    bailOnFirst?: boolean;
    cursor?: string;
    json?: boolean;
  }) => {
    try {
      const client = getClient();
      // Build input and let Zod schema apply defaults
      const input = GetFailingTestsSchema.parse({
        pr: options.pr,
        ...(options.wait !== undefined && { wait: options.wait }),
        ...(options.bailOnFirst !== undefined && { bail_on_first: options.bailOnFirst }),
        ...(options.cursor && { cursor: options.cursor })
      });
      const result = await handleGetFailingTests(client, input);
      
      if (options.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(result, null, 2));
      } else {
        /* eslint-disable no-console */
        console.log(`\n📊 CI Status for ${result.pr}`);
        console.log(`Status: ${result.status}`);
        console.log(`Failures: ${result.failures.length}\n`);
        
        if (result.failures.length > 0) {
          console.log('Failed Tests:');
          result.failures.forEach((test, i) => {
            console.log(`\n${i + 1}. ${test.test_name} (${test.check_name})`);
            if (test.file_path) console.log(`   File: ${test.file_path}${test.line_number ? `:${test.line_number}` : ''}`);
            if (test.error_message) console.log(`   Error: ${test.error_message}`);
          });
        }
        
        if (result.instructions) {
          console.log(`\n📝 ${result.instructions.summary}`);
        }
        
        if (result.nextCursor) {
          console.log(`\n📄 More results available. Use --cursor "${result.nextCursor}"`);
        }
        /* eslint-enable no-console */
      }
      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('find-unresolved-comments')
  .description('Find unresolved PR comments')
  .requiredOption('--pr <identifier>', 'PR identifier (owner/repo#123)')
  .option('--include-bots', 'Include bot comments')
  .option('--exclude-authors <authors>', 'Comma-separated list of authors to exclude')
  .option('--cursor <string>', 'Pagination cursor (from previous response)')
  .option('--sort <type>', 'Sort order (chronological|by_file|by_author|priority)')
  .option('--include-status-indicators', 'Include status indicators and priority scoring')
  .option('--priority-ordering', 'Use priority-based ordering')
  .option('--json', 'Output as JSON')
  .action(async (options: {
    pr: string;
    includeBots?: boolean;
    excludeAuthors?: string;
    cursor?: string;
    sort?: string;
    includeStatusIndicators?: boolean;
    priorityOrdering?: boolean;
    json?: boolean;
  }) => {
    try {
      const client = getClient();
      // Build input and let Zod schema apply defaults
      const input = FindUnresolvedCommentsSchema.parse({
        pr: options.pr,
        ...(options.includeBots !== undefined && { include_bots: options.includeBots }),
        ...(options.excludeAuthors && { exclude_authors: options.excludeAuthors.split(',') }),
        ...(options.sort && { sort: options.sort }),
        ...(options.cursor && { cursor: options.cursor }),
        ...(options.includeStatusIndicators !== undefined && { include_status_indicators: options.includeStatusIndicators }),
        ...(options.priorityOrdering !== undefined && { priority_ordering: options.priorityOrdering })
      });
      const result = await handleFindUnresolvedComments(client, input);
      
      if (options.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(result, null, 2));
        if (result.nextCursor) {
          console.error(`\n⚠️  Large output detected. Use --cursor "${result.nextCursor}" for next page.`);
        }
      } else {
        /* eslint-disable no-console */
        console.log(`\n💬 Comments for ${result.pr}`);
        console.log(`Unresolved in page: ${result.unresolved_in_page}`);
        console.log(`Showing: ${result.comments.length}\n`);
        
        result.comments.forEach((comment, i) => {
          const icon = comment.is_bot ? '🤖' : '👤';
          
          console.log(`\n${i + 1}. ${icon} ${comment.author} (${comment.type})`);
          if (comment.file_path) console.log(`   File: ${comment.file_path}${comment.line_number ? `:${comment.line_number}` : ''}`);
          console.log(`   ${comment.body.substring(0, 150)}${comment.body.length > 150 ? '...' : ''}`);
          console.log(`   Created: ${comment.created_at}`);
          
          // Show action commands
          console.log(`\n   📝 Reply: ${comment.action_commands.reply_command}`);
          /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
          const ac: any = comment.action_commands as unknown as any; // display-only
          if (ac.mcp_action) {
            console.log(`   ✅ MCP: ${ac.mcp_action.tool} ${JSON.stringify(ac.mcp_action.args)}`);
            if (ac.resolve_condition) {
              console.log(`   ⚠️  ${ac.resolve_condition}`);
            }
          } else if (ac.resolve_command) {
            console.log(`   ✅ Resolve: ${ac.resolve_command}`);
            if (ac.resolve_condition) {
              console.log(`   ⚠️  ${ac.resolve_condition}`);
            }
          }
          /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
        });
        
        console.log(`\n📊 Summary:`);
        console.log(`   Bots: ${result.summary.bot_comments}, Humans: ${result.summary.human_comments}`);
        
        if (result.nextCursor) {
          console.log(`\n📄 More results available. Use --cursor "${result.nextCursor}"`);
        }
        /* eslint-enable no-console */
      }
      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('manage-stacked-prs')
  .description('Manage stacked PRs')
  .requiredOption('--base-pr <identifier>', 'Base PR (owner/repo#123)')
  .requiredOption('--dependent-pr <identifier>', 'Dependent PR (owner/repo#124)')
  .option('--auto-fix', 'Auto-fix test failures')
  .option('--use-onto', 'Use --onto rebase strategy')
  .option('--cursor <string>', 'Pagination cursor (from previous response)')
  .option('--json', 'Output as JSON')
  .action(async (options: {
    basePr: string;
    dependentPr: string;
    autoFix?: boolean;
    useOnto?: boolean;
    cursor?: string;
    json?: boolean;
  }) => {
    try {
      const client = getClient();
      // Build input and let Zod schema apply defaults
      const input = ManageStackedPRsSchema.parse({
        base_pr: options.basePr,
        dependent_pr: options.dependentPr,
        ...(options.autoFix !== undefined && { auto_fix: options.autoFix }),
        ...(options.useOnto !== undefined && { use_onto: options.useOnto }),
        ...(options.cursor && { cursor: options.cursor })
      });
      const result = await handleManageStackedPRs(client, input);
      
      if (options.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(result, null, 2));
      } else {
        /* eslint-disable no-console */
        console.log(`\n🔗 Stack Analysis`);
        console.log(`Base PR: ${result.base_pr}`);
        console.log(`Dependent PR: ${result.dependent_pr}`);
        console.log(`Is stacked: ${result.is_stacked ? '✅' : '❌'}\n`);
        
        if (result.change_summary) {
          console.log(`Changes: ${result.change_summary.new_commits_in_base} new commits in base`);
          console.log(`Files changed: ${result.change_summary.files_changed.length}`);
        }
        
        if (result.commands.length > 0) {
          console.log('\n📝 Rebase Commands:');
          result.commands.forEach((cmd) => {
            console.log(`\n${cmd.step}. ${cmd.description}`);
            console.log(`   $ ${cmd.command}`);
            if (cmd.estimated_duration) console.log(`   ⏱️  ${cmd.estimated_duration}`);
          });
        }
        
        console.log(`\n⏱️  Estimated time: ${result.summary.estimated_total_time}`);
        console.log(`⚠️  Risk level: ${result.summary.risk_level}`);
        
        if (result.nextCursor) {
          console.log(`\n📄 More commands available. Use --cursor "${result.nextCursor}"`);
        }
        /* eslint-enable no-console */
      }
      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('resolve-review-thread')
  .description('Resolve a specific review thread (or via comment id) immediately')
  .requiredOption('--pr <identifier>', 'PR identifier (owner/repo#123)')
  .option('--thread-id <id>', 'Review thread GraphQL node ID')
  .option('--comment-id <id>', 'Comment GraphQL node ID (will map to thread)')
  .option('--prefer <choice>', 'Prefer "thread" or "comment" when both are provided')
  .option('--json', 'Output as JSON')
  .action(async (options: {
    pr: string;
    threadId?: string;
    commentId?: string;
    prefer?: string;
    json?: boolean;
  }) => {
    try {
      const client = getClient();
      const input = ResolveReviewThreadInputSchema.parse({
        pr: options.pr,
        ...(options.threadId && { thread_id: options.threadId }),
        ...(options.commentId && { comment_id: options.commentId }),
        ...(options.prefer && { prefer: options.prefer })
      });
      const result = await handleResolveReviewThread(client, input);
      if (options.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(result, null, 2));
      } else {
        /* eslint-disable no-console */
        console.log(`\n✅ Resolved thread ${result.thread_id}${result.alreadyResolved ? ' (already resolved)' : ''}`);
        if (result.message) console.log(result.message);
        /* eslint-enable no-console */
      }
      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('check-github-permissions')
  .description('Diagnose GitHub token permissions and provide fix guidance')
  .requiredOption('--pr <identifier>', 'PR identifier (owner/repo#123)')
  .option('--actions <actions>', 'Comma-separated list of actions to test')
  .option('--detailed', 'Include detailed diagnostics')
  .option('--json', 'Output as JSON')
  .action(async (options: {
    pr: string;
    actions?: string;
    detailed?: boolean;
    json?: boolean;
  }) => {
    try {
      const client = getClient();
      const input = CheckPermissionsSchema.parse({
        pr: options.pr,
        ...(options.actions && { actions: options.actions.split(',') }),
        ...(options.detailed !== undefined && { detailed: options.detailed })
      });
      const result = await handleCheckPermissions(client, input);
      
      if (options.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(result, null, 2));
      } else {
        /* eslint-disable no-console */
        console.log(`\n🔍 GitHub Permissions Diagnostic`);
        console.log(`PR: ${options.pr}`);
        console.log(`Token: ${result.token_valid ? '✅ Valid' : '❌ Invalid'} (${result.token_type})`);
        if (result.user) console.log(`User: ${result.user}`);
        console.log(`Repository Access: ${result.repository_access ? '✅' : '❌'}`);
        console.log(`Overall Status: ${result.summary.overall_status.toUpperCase()}`);
        
        if (result.summary.primary_issue) {
          console.log(`\n⚠️  ${result.summary.primary_issue}`);
        }
        
        if (result.diagnostics.suggestions.length > 0) {
          console.log('\n📋 Issues Found:');
          result.diagnostics.suggestions.forEach(suggestion => {
            console.log(`   ${suggestion}`);
          });
        }
        
        if (result.fixes.token_update.length > 0) {
          console.log('\n🔧 Fix Instructions:');
          result.fixes.token_update.forEach(instruction => {
            console.log(`   ${instruction}`);
          });
        }
        
        if (Object.keys(result.fixes.alternative_commands).length > 0) {
          console.log('\n🔄 Alternative Commands:');
          Object.entries(result.fixes.alternative_commands).forEach(([action, command]) => {
            console.log(`   ${action}: ${command}`);
          });
        }
        
        console.log('\n💡 Run with --json for detailed output');
        /* eslint-enable no-console */
      }
      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Config management commands
const configCommand = program
  .command('config')
  .description('Manage GitHub token configuration');

configCommand
  .command('set-token')
  .description('Set GitHub token in secure config file')
  .argument('<token>', 'GitHub Personal Access Token')
  .action(async (token: string) => {
    try {
      await setGitHubToken(token);
      /* eslint-disable no-console */
      console.log('✅ GitHub token saved to config file');
      console.log(`📁 Location: ${getConfigPath()}`);
      if (process.platform === 'win32') {
        console.log('🔒 Config saved. Windows ACLs apply to your user profile; POSIX 600 not applicable.');
      } else {
        console.log('🔒 File permissions set to owner-only access (600)');
      }
      
      // Test the token
      try {
        const client = new GitHubClient();
        const octokit = client.getOctokit();
        const { data: user } = await octokit.rest.users.getAuthenticated();
        console.log(`👤 Token validated for user: ${user.login}`);
      } catch (error) {
        console.warn('⚠️  Token validation failed:', error instanceof Error ? error.message : String(error));
        console.warn('   Please check your token permissions');
      }
      /* eslint-enable no-console */
    } catch (error) {
      console.error(`❌ Failed to save token: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

configCommand
  .command('show-token')
  .description('Show current token status')
  .action(() => {
    const config = loadConfig();
    const hasConfig = hasConfigFile();
    const token = getGitHubToken();
    
    /* eslint-disable no-console */
    console.log('🔍 GitHub Token Status:');
    console.log(`📁 Config file exists: ${hasConfig ? '✅ Yes' : '❌ No'}`);
    console.log(`🔑 Config file has token: ${config.github.token ? '✅ Yes' : '❌ No'}`);
    console.log(`🌍 Environment variable: ${process.env.GITHUB_TOKEN ? '✅ Set' : '❌ Not set'}`);
    console.log(`🎯 Active token source: ${config.github.token ? 'Config file' : process.env.GITHUB_TOKEN ? 'Environment' : 'None'}`);
    
    if (token) {
      // Show masked token for verification
      const masked = token.substring(0, 8) + '...' + token.substring(token.length - 4);
      console.log(`🔐 Token preview: ${masked}`);
    } else {
      console.log('❌ No token available');
      console.log('💡 Run: github-pr-automation config set-token <your_token>');
    }
    /* eslint-enable no-console */
  });

configCommand
  .command('clear-token')
  .description('Remove token from config file')
  .action(async () => {
    try {
      await clearGitHubToken();
      /* eslint-disable no-console */
      console.log('✅ Token removed from config file');
      console.log('💡 You can still use GITHUB_TOKEN environment variable');
      /* eslint-enable no-console */
    } catch (error) {
      console.error(`❌ Failed to clear token: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

configCommand
  .command('show-path')
  .description('Show config file location')
  .action(() => {
    /* eslint-disable no-console */
    console.log('📁 Config file location:');
    console.log(`   ${getConfigPath()}`);
    console.log('');
    console.log('🔒 File permissions:');
    console.log('   Owner: read/write (600)');
    console.log('   Group: no access');
    console.log('   Other: no access');
    /* eslint-enable no-console */
  });

configCommand
  .command('show-config')
  .description('Show full configuration (token masked by default)')
  .option('--reveal-token', 'Print raw token (dangerous)')
  .action((opts: { revealToken?: boolean }) => {
    const config = loadConfig();
    const safeConfig = opts?.revealToken
      ? config
      : {
          ...config,
          github: {
            ...config.github,
            ...(config.github.token && {
              token: config.github.token.length <= 8
                ? '***'
                : `${config.github.token.slice(0, 4)}…${config.github.token.slice(-4)}`
            })
          }
        };
    /* eslint-disable no-console */
    console.log('📋 Current Configuration:');
    console.log(JSON.stringify(safeConfig, null, 2));
    /* eslint-enable no-console */
  });

// Default action for config command
configCommand.action(() => {
  /* eslint-disable no-console */
  console.log('Config management commands:');
  console.log('  set-token <token>  - Set GitHub token in config file');
  console.log('  show-token         - Show current token status');
  console.log('  clear-token        - Remove token from config file');
  console.log('  show-path          - Show config file location');
  console.log('  show-config        - Show full configuration');
  /* eslint-enable no-console */
});

await program.parseAsync(process.argv);
