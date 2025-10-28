import type { Comment } from "../schema.js";
import { generateActionCommands } from "../command-generator.js";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

// Type aliases for better readability
type ReviewComment =
  RestEndpointMethodTypes["pulls"]["listReviewComments"]["response"]["data"][number];
type IssueComment =
  RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"][number];

/**
 * Map GitHub review comments to our Comment type
 * @param reviewComments - Array of GitHub review comments
 * @param pr - Pull request information
 * @param nodeIdMap - Map of comment IDs to thread IDs
 * @returns Array of mapped Comment objects
 */
export function mapReviewComments(
  reviewComments: ReviewComment[],
  pr: { owner: string; repo: string; number: number },
  nodeIdMap: Map<number, string>,
): Comment[] {
  return reviewComments.map((c) => {
    const author = c.user?.login || "unknown";
    const authorAssociation = c.author_association || "NONE";
    const isBot = c.user?.type === "Bot";
    const body = c.body || "";

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
 * Map GitHub issue comments to our Comment type
 * @param issueComments - Array of GitHub issue comments
 * @param pr - Pull request information
 * @returns Array of mapped Comment objects
 */
export function mapIssueComments(
  issueComments: IssueComment[],
  pr: { owner: string; repo: string; number: number },
): Comment[] {
  return issueComments.map((c) => {
    const author = c.user?.login || "unknown";
    const authorAssociation = c.author_association || "NONE";
    const isBot = c.user?.type === "Bot";
    const body = c.body || "";

    const comment: Comment = {
      id: c.id,
      type: "issue_comment" as const,
      author,
      author_association: authorAssociation,
      is_bot: isBot,
      created_at: c.created_at,
      updated_at: c.updated_at,
      body,
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
