import type { Comment } from "../schema.js";

/**
 * Filters comments to only include unresolved ones (not replies, not from resolved threads)
 * @param comments - All comments to filter
 * @param nodeIdMap - Map of comment IDs to thread IDs
 * @param resolvedThreadIds - Set of resolved thread IDs
 * @returns Filtered comments that are unresolved
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
        return false; // Exclude ALL comments from resolved threads
      }
    }

    // Exclude reply comments - only return original thread starters
    if (comment.in_reply_to_id) {
      return false; // Exclude comments that are replies to other comments
    }

    // Issue comments don't have a resolved status in GitHub API
    // They remain as unresolved unless explicitly resolved by GitHub's system

    return true; // Include unresolved comments
  });
}

/**
 * Apply basic filtering to comments based on input options
 * @param comments - Comments to filter
 * @param includeBots - Whether to include bot comments
 * @param excludeAuthors - Authors to exclude
 * @returns Filtered comments
 */
export function applyBasicFiltering(
  comments: Comment[],
  includeBots: boolean,
  excludeAuthors?: string[],
): Comment[] {
  let filtered = comments;

  // Filter by bots if requested
  if (!includeBots) {
    filtered = filtered.filter((c) => !c.is_bot);
  }

  // Filter by excluded authors
  if (excludeAuthors && excludeAuthors.length > 0) {
    filtered = filtered.filter((c) => !excludeAuthors.includes(c.author));
  }

  return filtered;
}

/**
 * Sort comments based on the specified sort option
 * @param comments - Comments to sort
 * @param sort - Sort option
 * @param priorityOrdering - Whether priority ordering is enabled
 * @param includeStatusIndicators - Whether status indicators are included
 * @returns Sorted comments
 */
export function sortComments(
  comments: Comment[],
  sort: "chronological" | "by_file" | "by_author" | "priority",
  priorityOrdering?: boolean,
  includeStatusIndicators?: boolean,
): Comment[] {
  const sorted = [...comments];

  switch (sort) {
    case "chronological":
      sorted.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      break;
    case "by_file":
      sorted.sort((a, b) => {
        const fileA = a.file_path || "";
        const fileB = b.file_path || "";
        return fileA.localeCompare(fileB);
      });
      break;
    case "by_author":
      sorted.sort((a, b) => a.author.localeCompare(b.author));
      break;
    case "priority":
      // Priority-based sorting when enabled
      if (priorityOrdering !== false && includeStatusIndicators !== false) {
        sorted.sort((a, b) => {
          const scoreA = a.status_indicators?.priority_score || 0;
          const scoreB = b.status_indicators?.priority_score || 0;

          // First sort by priority score (descending)
          if (scoreA !== scoreB) {
            return scoreB - scoreA;
          }

          // Then by MCP resolution capability
          const mcpA = a.status_indicators?.needs_mcp_resolution ? 1 : 0;
          const mcpB = b.status_indicators?.needs_mcp_resolution ? 1 : 0;
          if (mcpA !== mcpB) {
            return mcpB - mcpA;
          }

          // Finally by creation date (newest first)
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
      } else {
        // Fall back to chronological if priority ordering is disabled
        sorted.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      }
      break;
  }

  return sorted;
}
