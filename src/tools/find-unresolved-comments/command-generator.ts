import type { PRIdentifier } from "../../types/index.js";

/**
 * Generate GitHub CLI action commands for a comment
 *
 * IMPORTANT: These commands are templates. The AI agent:
 * - Fills in "YOUR_RESPONSE_HERE" with actual response text
 * - Decides when to execute reply vs resolve
 * - ONLY runs resolve_command AFTER verifying fix is complete
 */

export function generateActionCommands(
  pr: PRIdentifier,
  commentId: number,
  commentType: "review_comment" | "issue_comment" | "review",
  body: string,
  filePath?: string,
  threadId?: string,
): {
  reply_command: string;
  resolve_command?: string;
  resolve_condition: string;
  view_in_browser: string;
  mcp_action?: {
    tool: "resolve_review_thread";
    args: {
      pr: string;
      thread_id: string;
    };
  };
} {
  const prNumber = pr.number;
  const repo = `${pr.owner}/${pr.repo}`;

  // Generate reply command based on comment type
  let reply_command: string;
  if (commentType === "review_comment" && filePath) {
    // Inline code review comment
    reply_command = `gh api -X POST /repos/${repo}/pulls/${prNumber}/comments/${commentId}/replies -f body="YOUR_RESPONSE_HERE"`;
  } else {
    // General PR comment
    reply_command = `gh pr comment ${prNumber} --repo ${repo} --body "YOUR_RESPONSE_HERE"`;
  }

  // Generate resolve command (review comments can be resolved)
  let resolve_command: string | undefined;
  if (commentType === "review_comment") {
    // GitHub doesn't have a direct "resolve" API - typically done via UI
    // or by adding a resolving reply. We'll use a reply with a resolved marker.
    resolve_command = `gh api -X POST /repos/${repo}/pulls/${prNumber}/comments/${commentId}/replies -f body="✅ Fixed"`;
  }

  // Generate resolve condition - make it specific to the comment
  const firstLine = body.split("\n")[0].substring(0, 80);
  const resolve_condition = resolve_command
    ? `Run ONLY after you've verified the fix for: "${firstLine}..."`
    : "This comment type cannot be resolved via API";

  // Browser view command
  const view_in_browser = `gh pr view ${prNumber} --repo ${repo} --web`;

  // Generate MCP action for review comments if we have the GraphQL thread ID
  let mcp_action:
    | { tool: "resolve_review_thread"; args: { pr: string; thread_id: string } }
    | undefined;
  if (commentType === "review_comment" && threadId) {
    mcp_action = {
      tool: "resolve_review_thread",
      args: {
        pr: `${repo}#${prNumber}`,
        thread_id: threadId,
      },
    };
  }

  return {
    reply_command,
    resolve_command,
    resolve_condition,
    view_in_browser,
    ...(mcp_action && { mcp_action }),
  };
}
