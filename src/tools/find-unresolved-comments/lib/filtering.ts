import type { Comment } from "../schema.js";

/**
 * Filters comments to only include unresolved ones.
 *
 * A comment is considered "unresolved" if it:
 * 1. Is NOT from a resolved review thread (for review_comment types)
 * 2. Is NOT a reply comment (only return thread starters)
 * 3. Is an active comment requiring attention
 *
 * This is the first filtering step that removes comments that have already been
 * addressed or are part of resolved conversations.
 *
 * @param comments - All comments to filter (can be review, issue, or synthetic review comments)
 * @param nodeIdMap - Map of REST comment ID -> GraphQL thread ID (for resolution tracking)
 * @param resolvedThreadIds - Set of thread IDs marked as resolved in GitHub UI
 * @returns Filtered comments that are unresolved and need attention
 */
export function filterUnresolvedComments(
  comments: Comment[],
  nodeIdMap: Map<number, string>,
  resolvedThreadIds: Set<string>,
): Comment[] {
  return comments.filter((comment) => {
    // For review comments, check if the thread is resolved via GitHub API
    if (comment.type === "review_comment") {
      const threadId = nodeIdMap.get(comment.id);
      if (threadId && resolvedThreadIds.has(threadId)) {
        return false; // Exclude ALL comments from resolved threads (thread is closed)
      }
    }

    // Exclude reply comments - only return original thread starters
    // Replies are responses to other comments, not actionable items themselves
    if (comment.in_reply_to_id) {
      return false; // This is a response, not an original comment needing action
    }

    // Issue comments don't have a resolved status in GitHub API
    // They remain as unresolved unless explicitly deleted/resolved by GitHub's system

    return true; // Include as unresolved comment
  });
}

/**
 * Apply basic filtering to comments based on user input options.
 *
 * This is the second filtering step that respects user preferences about
 * what types of comments to show (bots, specific authors, etc.).
 *
 * @param comments - Comments to filter (already filtered for unresolved only)
 * @param includeBots - Whether to include bot comments (e.g., @coderabbitai)
 * @param excludeAuthors - Array of author usernames to exclude from results
 * @returns Filtered comments matching user preferences
 */
export function applyBasicFiltering(
  comments: Comment[],
  includeBots: boolean,
  excludeAuthors?: string[],
): Comment[] {
  let filtered = comments;

  // Filter out bot comments if user doesn't want them
  if (!includeBots) {
    filtered = filtered.filter((c) => !c.is_bot);
  }

  // Filter out specific authors if requested (e.g., ignore certain reviewers)
  if (excludeAuthors && excludeAuthors.length > 0) {
    filtered = filtered.filter((c) => !excludeAuthors.includes(c.author));
  }

  return filtered;
}

/**
 * Sort comments based on the specified sort option.
 *
 * This is the final step that organizes comments for display.
 * Priority sorting uses the status_indicators calculated in status-indicators.ts
 * to intelligently rank comments by urgency and actionability.
 *
 * @param comments - Comments to sort (already filtered)
 * @param sort - Sort mode: 'chronological' | 'by_file' | 'by_author' | 'priority'
 * @param priorityOrdering - Whether to use intelligent priority-based sorting
 * @param includeStatusIndicators - Whether status indicators are available
 * @returns Sorted comments ready for display
 */
export function sortComments(
  comments: Comment[],
  sort: "chronological" | "by_file" | "by_author" | "priority",
  priorityOrdering?: boolean,
  includeStatusIndicators?: boolean,
): Comment[] {
  const sorted = [...comments]; // Create a copy to avoid mutating original

  switch (sort) {
    case "chronological":
      // Oldest comments first (address things in order)
      sorted.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      break;
    case "by_file":
      // Group comments by file path (useful for file-by-file review)
      sorted.sort((a, b) => {
        const fileA = a.file_path || "";
        const fileB = b.file_path || "";
        return fileA.localeCompare(fileB);
      });
      break;
    case "by_author":
      // Group by comment author (see all comments from each person)
      sorted.sort((a, b) => a.author.localeCompare(b.author));
      break;
    case "priority":
      // Intelligent priority-based sorting when enabled
      if (priorityOrdering !== false && includeStatusIndicators !== false) {
        sorted.sort((a, b) => {
          const scoreA = a.status_indicators?.priority_score || 0;
          const scoreB = b.status_indicators?.priority_score || 0;

          // Primary: Sort by priority score (higher = more urgent)
          if (scoreA !== scoreB) {
            return scoreB - scoreA;
          }

          // Secondary: Prefer comments that can be resolved via MCP (automated)
          const mcpA = a.status_indicators?.needs_mcp_resolution ? 1 : 0;
          const mcpB = b.status_indicators?.needs_mcp_resolution ? 1 : 0;
          if (mcpA !== mcpB) {
            return mcpB - mcpA;
          }

          // Tertiary: Show newer comments first (recent activity)
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
      } else {
        // Fall back to chronological if priority data unavailable
        sorted.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      }
      break;
  }

  return sorted;
}
