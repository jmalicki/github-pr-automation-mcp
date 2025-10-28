import type { Comment } from "../schema.js";

/**
 * Calculate intelligent status indicators for a comment to help prioritize workflow.
 *
 * This function analyzes a comment and generates metadata about its urgency, actionability,
 * and recommended next steps. The status indicators power the priority-based sorting and
 * help users focus on the most important comments first.
 *
 * Key indicators calculated:
 * - needs_mcp_resolution: Can this be resolved via MCP tool (automated)?
 * - has_manual_response: Does it have human replies (acknowledgment)?
 * - is_actionable: Contains fixable suggestions?
 * - is_outdated: On changed/outdated code?
 * - priority_score: Numeric urgency (0-100)
 * - resolution_status: Current state (unresolved/acknowledged/in_progress)
 * - suggested_action: Recommended next step (reply/resolve/investigate/ignore)
 *
 * @param comment - The comment to analyze
 * @param allComments - Optional array of all comments to detect replies/responses
 * @returns Status indicators object with workflow metadata
 */
export function calculateStatusIndicators(
  comment: Comment,
  allComments?: Comment[],
): Comment["status_indicators"] {
  // Check if this comment can be resolved via MCP tool (GraphQL thread resolution)
  const hasMcpAction = !!comment.action_commands.mcp_action;

  // Detect if comment has human responses by checking if other non-bot comments reply to it
  // Self-acks from the same author don't count as responses
  const hasManualResponse = allComments
    ? allComments.some(
        (c) =>
          c.in_reply_to_id === comment.id &&
          !c.is_bot && // Only count human responses
          c.author !== comment.author, // Exclude self-acknowledgments
      )
    : false;

  // Detect if comment contains actionable suggestions (code changes, fixes)
  const isActionable =
    comment.coderabbit_metadata?.suggestion_type === "actionable" ||
    comment.body.toLowerCase().includes("fix") ||
    comment.body.toLowerCase().includes("suggest") ||
    comment.body.toLowerCase().includes("change");

  // Check if comment is on outdated/changed code (GitHub API field)
  const isOutdated = comment.outdated || false;

  // Calculate priority score (0-100) using additive scoring system
  let priorityScore = 0;

  // Base priority from CodeRabbit metadata (structured AI reviews)
  if (comment.coderabbit_metadata) {
    // Severity boosts (security issues, critical bugs get higher scores)
    switch (comment.coderabbit_metadata.severity) {
      case "high":
        priorityScore += 40;
        break;
      case "medium":
        priorityScore += 25;
        break;
      case "low":
        priorityScore += 10;
        break;
    }

    // Suggestion type boosts (actionable items more important than nits)
    switch (comment.coderabbit_metadata.suggestion_type) {
      case "actionable":
        priorityScore += 30;
        break;
      case "additional":
        priorityScore += 20;
        break;
      case "nit":
        priorityScore += 5;
        break;
      case "duplicate":
        priorityScore += 0;
        break;
    }
  }

  // Boost for bot comments that can be auto-resolved via MCP (fast wins)
  if (comment.is_bot && hasMcpAction) {
    priorityScore += 20;
  }

  // Boost for actionable content (comments with fixable suggestions)
  if (isActionable) {
    priorityScore += 15;
  }

  // Reduce priority if already acknowledged (has human responses)
  if (hasManualResponse) {
    priorityScore -= 10;
  }

  // Significant reduction for outdated comments (may no longer be relevant)
  if (isOutdated) {
    priorityScore -= 20;
  }

  // Clamp score to valid range
  priorityScore = Math.min(100, Math.max(0, priorityScore));

  // Determine current resolution status based on activity
  let resolutionStatus:
    | "unresolved"
    | "acknowledged"
    | "in_progress"
    | "resolved";
  if (hasManualResponse && isActionable) {
    resolutionStatus = "in_progress"; // Being actively worked on
  } else if (hasManualResponse) {
    resolutionStatus = "acknowledged"; // Responded but not fixed
  } else {
    resolutionStatus = "unresolved"; // No activity yet
  }

  // Suggest recommended next action based on comment characteristics
  let suggestedAction: "reply" | "resolve" | "investigate" | "ignore";
  if (hasMcpAction && !hasManualResponse) {
    suggestedAction = "resolve"; // Can be auto-resolved via MCP
  } else if (isActionable && !hasManualResponse) {
    suggestedAction = "reply"; // Needs human response
  } else if (priorityScore < 30) {
    suggestedAction = "ignore"; // Low priority, defer
  } else {
    suggestedAction = "investigate"; // Need more context
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
