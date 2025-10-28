import type { Comment, FindUnresolvedCommentsOutput } from "../schema.js";

/**
 * Generate comprehensive summary statistics for filtered comments.
 *
 * This function aggregates data about the filtered comments to provide a high-level
 * overview of the PR review status. The summary helps users quickly understand:
 * - Who commented most
 * - What types of comments exist
 * - Priority distribution (high/medium/low)
 * - Status breakdown (unresolved/acknowledged/in_progress)
 *
 * The summary is used in the MCP output to give context about the overall comment landscape.
 *
 * @param comments - Filtered comments to analyze (already processed and sorted)
 * @param includeStatusIndicators - Whether status indicators are enabled (affects available metrics)
 * @param priorityOrdering - Whether priority ordering is enabled (affects available metrics)
 * @returns Summary object with aggregated statistics and breakdowns
 */
export function generateSummary(
  comments: Comment[],
  includeStatusIndicators?: boolean,
  priorityOrdering?: boolean,
): FindUnresolvedCommentsOutput["summary"] {
  // Initialize basic summary counters
  const byAuthor: Record<string, number> = {}; // Comments per author
  const byType: Record<string, number> = {}; // Comments per type (review_comment, issue_comment, review)
  let botCount = 0; // Total bot comments
  let withReactions = 0; // Comments with reactions (engagement)

  // Priority-based summary statistics (only if status indicators enabled)
  let highPriorityCount = 0; // Priority score >= 70
  let mediumPriorityCount = 0; // Priority score 30-69
  let lowPriorityCount = 0; // Priority score < 30
  let needsMcpResolutionCount = 0; // Can be resolved via MCP
  let hasManualResponsesCount = 0; // Has human replies
  let actionableItemsCount = 0; // Contains actionable suggestions
  let outdatedCommentsCount = 0; // On outdated code

  // Status-based grouping (only if priority ordering enabled)
  const statusGroups: {
    unresolved: Comment[];
    acknowledged: Comment[];
    in_progress: Comment[];
    resolved: Comment[];
  } = {
    unresolved: [],
    acknowledged: [],
    in_progress: [],
    resolved: [],
  };

  // Aggregate statistics from all comments
  for (const comment of comments) {
    // Basic categorization
    byAuthor[comment.author] = (byAuthor[comment.author] || 0) + 1;
    byType[comment.type] = (byType[comment.type] || 0) + 1;
    if (comment.is_bot) botCount++;
    if (comment.reactions && comment.reactions.total_count > 0) withReactions++;

    // Process status indicators if available (adds priority-based insights)
    if (comment.status_indicators) {
      const indicators = comment.status_indicators;

      // Priority distribution: High (70-100), Medium (30-69), Low (0-29)
      if (indicators.priority_score >= 70) {
        highPriorityCount++;
      } else if (indicators.priority_score >= 30) {
        mediumPriorityCount++;
      } else {
        lowPriorityCount++;
      }

      // Special status counts
      if (indicators.needs_mcp_resolution) needsMcpResolutionCount++;
      if (indicators.has_manual_response) hasManualResponsesCount++;
      if (indicators.is_actionable) actionableItemsCount++;
      if (indicators.is_outdated) outdatedCommentsCount++;

      // Group by resolution status
      statusGroups[indicators.resolution_status].push(comment);
    }
  }

  // Build base summary object (always present)
  const summary: FindUnresolvedCommentsOutput["summary"] = {
    comments_in_page: comments.length, // Count for current page
    by_author: byAuthor, // Author distribution
    by_type: byType, // Type distribution
    bot_comments: botCount, // Total bot comments
    human_comments: comments.length - botCount, // Total human comments
    with_reactions: withReactions, // Comments with reactions
  };

  // Add priority-based insights if status indicators enabled
  if (includeStatusIndicators !== false) {
    summary.priority_summary = {
      high_priority: highPriorityCount,
      medium_priority: mediumPriorityCount,
      low_priority: lowPriorityCount,
      needs_mcp_resolution: needsMcpResolutionCount,
      has_manual_responses: hasManualResponsesCount,
      actionable_items: actionableItemsCount,
      outdated_comments: outdatedCommentsCount,
    };
  }

  // Add status-based grouping if priority ordering enabled
  // Groups comments by their current resolution state
  if (priorityOrdering !== false && includeStatusIndicators !== false) {
    summary.status_groups = statusGroups;
  }

  return summary;
}
