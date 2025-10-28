import type { Comment } from "../schema.js";

/**
 * Calculate comprehensive status indicators for a comment.
 *
 * This function analyzes a comment and its context to determine various
 * status indicators that help with prioritization and resolution tracking.
 *
 * ## Status Indicators Calculated
 *
 * ### Resolution Status
 * - **unresolved**: No human response, not outdated
 * - **acknowledged**: Has human response but not resolved
 * - **in_progress**: Has MCP action command (automated resolution)
 * - **resolved**: Outdated or explicitly resolved
 *
 * ### Priority Scoring (0-100)
 *
 * Priority is calculated based on multiple factors:
 * - **CodeRabbit Severity**: high=40, medium=25, low=10 points
 * - **Suggestion Type**: actionable=30, additional=20, nit=5 points
 * - **Response Status**: +10 for manual response, +15 for MCP action
 * - **Outdated Status**: -20 for outdated comments
 *
 * ### Actionability Indicators
 * - **needs_mcp_resolution**: Has MCP action command available
 * - **has_manual_response**: Human has replied to this comment
 * - **is_actionable**: Contains actionable keywords or CodeRabbit metadata
 * - **is_outdated**: Comment is marked as outdated by GitHub
 *
 * ## Context Analysis
 *
 * When `allComments` is provided, the function analyzes:
 * - **Reply Detection**: Looks for human replies to this comment
 * - **Self-Acknowledgement**: Avoids counting author's own responses
 * - **Bot Filtering**: Only considers human responses for acknowledgment
 *
 * @param comment - The comment to analyze
 * @param allComments - Optional array of all comments for context analysis
 * @returns Status indicators object with resolution status and priority
 *
 * @example
 * ```typescript
 * const indicators = calculateStatusIndicators(comment, allComments);
 * console.log(`Priority: ${indicators.priority_score}/100`);
 * console.log(`Status: ${indicators.resolution_status}`);
 * ```
 */
export function calculateStatusIndicators(
  comment: Comment,
  allComments?: Comment[],
): Comment["status_indicators"] {
  // Check if this comment has MCP action commands available
  const hasMcpAction = !!comment.action_commands.mcp_action;

  // Check if this comment has replies by looking for other comments that reply to it
  // Only consider human responses from different authors (avoid self-acks)
  const hasManualResponse = allComments
    ? allComments.some(
        (c) =>
          c.in_reply_to_id === comment.id && // This comment replies to our comment
          !c.is_bot && // Only humans count as responses
          c.author !== comment.author, // Avoid self-acknowledgments
      )
    : false;

  // Determine if this comment is actionable based on content or metadata
  const isActionable =
    comment.coderabbit_metadata?.suggestion_type === "actionable" || // CodeRabbit actionable
    comment.body.toLowerCase().includes("fix") || // Contains "fix"
    comment.body.toLowerCase().includes("suggest") || // Contains "suggest"
    comment.body.toLowerCase().includes("change"); // Contains "change"

  // Use GitHub API's outdated field (available for review comments)
  const isOutdated = comment.outdated || false;

  // Calculate priority score (0-100) based on multiple factors
  let priorityScore = 0;

  // Base priority from CodeRabbit metadata severity levels
  if (comment.coderabbit_metadata) {
    switch (comment.coderabbit_metadata.severity) {
      case "high":
        priorityScore += 40; // High severity gets highest base score
        break;
      case "medium":
        priorityScore += 25; // Medium severity gets moderate score
        break;
      case "low":
        priorityScore += 10; // Low severity gets minimal score
        break;
    }

    // Additional priority based on suggestion type
    switch (comment.coderabbit_metadata.suggestion_type) {
      case "actionable":
        priorityScore += 30; // Actionable items are high priority
        break;
      case "additional":
        priorityScore += 20; // Additional suggestions are medium priority
        break;
      case "nit":
        priorityScore += 5; // Nitpicks are low priority
        break;
      case "duplicate":
        priorityScore += 0; // Duplicates get no additional priority
        break;
    }
  }

  // Boost priority for bot comments with MCP actions (automated resolution available)
  if (comment.is_bot && hasMcpAction) {
    priorityScore += 20;
  }

  // Boost priority for actionable content (contains action keywords)
  if (isActionable) {
    priorityScore += 15;
  }

  // Reduce priority if already has manual response (acknowledged)
  if (hasManualResponse) {
    priorityScore -= 10;
  }

  // Reduce priority for outdated comments (less relevant)
  if (isOutdated) {
    priorityScore -= 20; // Significant reduction for outdated comments
  }

  // Ensure priority score stays within bounds (0-100)
  priorityScore = Math.min(100, Math.max(0, priorityScore));

  // Determine resolution status based on response and actionability
  let resolutionStatus:
    | "unresolved"
    | "acknowledged"
    | "in_progress"
    | "resolved";

  if (isOutdated) {
    // Outdated comments are considered resolved
    resolutionStatus = "resolved";
  } else if (hasMcpAction) {
    // Comments with MCP actions are in progress (automated resolution)
    resolutionStatus = "in_progress";
  } else if (hasManualResponse) {
    // Comments with manual responses are acknowledged (unless actionable)
    resolutionStatus = isActionable ? "in_progress" : "acknowledged";
  } else {
    // All other comments are unresolved
    resolutionStatus = "unresolved";
  }

  // Determine suggested action based on priority and context
  let suggestedAction: "reply" | "resolve" | "investigate" | "ignore";

  if (hasMcpAction && !hasManualResponse) {
    // Comments with MCP actions should be resolved automatically
    suggestedAction = "resolve";
  } else if (isActionable && !hasManualResponse) {
    // Actionable comments without responses need replies
    suggestedAction = "reply";
  } else if (priorityScore < 30) {
    // Low priority comments can be ignored
    suggestedAction = "ignore";
  } else {
    // All other comments need investigation
    suggestedAction = "investigate";
  }

  return {
    needs_mcp_resolution: hasMcpAction,
    has_manual_response: hasManualResponse,
    is_actionable: isActionable,
    is_outdated: isOutdated,
    priority_score: priorityScore,
    resolution_status: resolutionStatus,
    suggested_action: suggestedAction,
  };
}
