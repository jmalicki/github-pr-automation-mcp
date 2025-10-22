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
  .name('resolve-pr-mcp')
  .description('GitHub PR automation tools - MCP server')
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
  .option('--sort <type>', 'Sort order (chronological|by_file|by_author)')
  .option('--json', 'Output as JSON')
  .action(async (options: {
    pr: string;
    includeBots?: boolean;
    excludeAuthors?: string;
    cursor?: string;
    sort?: string;
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
        ...(options.cursor && { cursor: options.cursor })
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
        console.log(`Total unresolved: ${result.total_unresolved}`);
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

await program.parseAsync(process.argv);
