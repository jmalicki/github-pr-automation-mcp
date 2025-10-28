import type { Comment } from "../schema.js";
import { generateActionCommands } from "../command-generator.js";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

// Type aliases for better readability
type ReviewComment =
  RestEndpointMethodTypes["pulls"]["listReviewComments"]["response"]["data"][number];
type IssueComment =
  RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"][number];

/**
 * Map GitHub review comments (line-by-line code comments) to our unified Comment type.
 *
 * Review comments are line-specific feedback on PR code changes. They have:
 * - File paths and line numbers
 * - Diff context (diff_hunk)
 * - Can be part of threads (conversations)
 * - Can be marked as outdated if code changed
 *
 * @param reviewComments - Array of GitHub review comments from pulls.listReviewComments API
 * @param pr - Pull request information (owner, repo, number)
 * @param nodeIdMap - Map of REST API comment IDs to GraphQL thread IDs for resolution tracking
 * @returns Array of mapped Comment objects with standardized structure
 */
export function mapReviewComments(
  reviewComments: ReviewComment[],
  pr: { owner: string; repo: string; number: number },
  nodeIdMap: Map<number, string>,
): Comment[] {
  return reviewComments.map((c) => {
    // Extract author information with fallbacks
    const author = c.user?.login || "unknown";
    const authorAssociation = c.author_association || "NONE"; // e.g., 'OWNER', 'MEMBER', 'CONTRIBUTOR'
    const isBot = c.user?.type === "Bot";
    const body = c.body || "";

    // Build standardized comment object with review-specific fields
    const comment: Comment = {
      id: c.id,
      type: "review_comment" as const,
      author,
      author_association: authorAssociation,
      is_bot: isBot,
      created_at: c.created_at,
      updated_at: c.updated_at,
      file_path: c.path,
      line_number: c.line || undefined,
      start_line: c.start_line || undefined,
      diff_hunk: c.diff_hunk || undefined,
      body,
      in_reply_to_id: c.in_reply_to_id || undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      outdated: Boolean((c as any).outdated),
      reactions: c.reactions
        ? {
            total_count: c.reactions.total_count,
            "+1": c.reactions["+1"],
            "-1": c.reactions["-1"],
            laugh: c.reactions.laugh,
            hooray: c.reactions.hooray,
            confused: c.reactions.confused,
            heart: c.reactions.heart,
            rocket: c.reactions.rocket,
            eyes: c.reactions.eyes,
          }
        : undefined,
      html_url: c.html_url,
      action_commands: generateActionCommands(
        pr,
        c.id,
        "review_comment",
        body,
        c.path,
        nodeIdMap.get(c.id), // Pass GraphQL thread ID if available
      ),
    };

    return comment;
  });
}

/**
 * Map GitHub issue comments (PR-level general comments) to our unified Comment type.
 *
 * Issue comments are general PR-level comments that aren't tied to specific lines of code.
 * These are fetched via issues.listComments (GitHub treats PRs as issues internally).
 *
 * Unlike review comments, issue comments:
 * - Don't have file paths or line numbers
 * - Aren't part of review threads
 * - Can't be marked as outdated
 * - Are for general discussion about the PR
 *
 * @param issueComments - Array of GitHub issue comments from issues.listComments API
 * @param pr - Pull request information (owner, repo, number)
 * @returns Array of mapped Comment objects with standardized structure
 */
export function mapIssueComments(
  issueComments: IssueComment[],
  pr: { owner: string; repo: string; number: number },
): Comment[] {
  return issueComments.map((c) => {
    // Extract author information with fallbacks
    const author = c.user?.login || "unknown";
    const authorAssociation = c.author_association || "NONE";
    const isBot = c.user?.type === "Bot";
    const body = c.body || "";

    // Build standardized comment object for issue comments
    // Note: issue comments don't have file paths, line numbers, or thread associations
    const comment: Comment = {
      id: c.id,
      type: "issue_comment" as const, // General PR-level comment
      author,
      author_association: authorAssociation,
      is_bot: isBot,
      created_at: c.created_at,
      updated_at: c.updated_at,
      body, // No file_path, line_number, or diff_hunk for issue comments
      reactions: c.reactions
        ? {
            total_count: c.reactions.total_count,
            "+1": c.reactions["+1"],
            "-1": c.reactions["-1"],
            laugh: c.reactions.laugh,
            hooray: c.reactions.hooray,
            confused: c.reactions.confused,
            heart: c.reactions.heart,
            rocket: c.reactions.rocket,
            eyes: c.reactions.eyes,
          }
        : undefined,
      html_url: c.html_url,
      action_commands: generateActionCommands(pr, c.id, "issue_comment", body),
    };

    return comment;
  });
}
