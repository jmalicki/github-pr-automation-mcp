import type { Comment, FindUnresolvedCommentsOutput } from '../schema.js';

/**
 * Generate summary statistics for filtered comments
 * @param comments - Filtered comments to analyze
 * @param includeStatusIndicators - Whether status indicators are included
 * @param priorityOrdering - Whether priority ordering is enabled
 * @returns Summary object with statistics
 */
export function generateSummary(
  comments: Comment[],
  includeStatusIndicators?: boolean,
  priorityOrdering?: boolean
): FindUnresolvedCommentsOutput['summary'] {
  // Basic summary statistics
  const byAuthor: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let botCount = 0;
  let withReactions = 0;
  
  // Priority-based summary statistics
  let highPriorityCount = 0;
  let mediumPriorityCount = 0;
  let lowPriorityCount = 0;
  let needsMcpResolutionCount = 0;
  let hasManualResponsesCount = 0;
  let actionableItemsCount = 0;
  let outdatedCommentsCount = 0;
  
  // Status-based grouping
  const statusGroups: {
    unresolved: Comment[];
    acknowledged: Comment[];
    in_progress: Comment[];
    resolved: Comment[];
  } = {
    unresolved: [],
    acknowledged: [],
    in_progress: [],
    resolved: []
  };
  
  for (const comment of comments) {
    byAuthor[comment.author] = (byAuthor[comment.author] || 0) + 1;
    byType[comment.type] = (byType[comment.type] || 0) + 1;
    if (comment.is_bot) botCount++;
    if (comment.reactions && comment.reactions.total_count > 0) withReactions++;
    
    // Process status indicators if available
    if (comment.status_indicators) {
      const indicators = comment.status_indicators;
      
      // Priority counts
      if (indicators.priority_score >= 70) {
        highPriorityCount++;
      } else if (indicators.priority_score >= 30) {
        mediumPriorityCount++;
      } else {
        lowPriorityCount++;
      }
      
      // Status counts
      if (indicators.needs_mcp_resolution) needsMcpResolutionCount++;
      if (indicators.has_manual_response) hasManualResponsesCount++;
      if (indicators.is_actionable) actionableItemsCount++;
      if (indicators.is_outdated) outdatedCommentsCount++;
      
      // Status grouping
      statusGroups[indicators.resolution_status].push(comment);
    }
  }
  
  // Build summary object
  const summary: FindUnresolvedCommentsOutput['summary'] = {
    comments_in_page: comments.length, // Current page count
    by_author: byAuthor,
    by_type: byType,
    bot_comments: botCount,
    human_comments: comments.length - botCount,
    with_reactions: withReactions
  };
  
  // Add priority summary if status indicators are enabled
  if (includeStatusIndicators !== false) {
    summary.priority_summary = {
      high_priority: highPriorityCount,
      medium_priority: mediumPriorityCount,
      low_priority: lowPriorityCount,
      needs_mcp_resolution: needsMcpResolutionCount,
      has_manual_responses: hasManualResponsesCount,
      actionable_items: actionableItemsCount,
      outdated_comments: outdatedCommentsCount
    };
  }
  
  // Add status groups if priority ordering is enabled
  if (priorityOrdering !== false && includeStatusIndicators !== false) {
    summary.status_groups = statusGroups;
  }
  
  return summary;
}
