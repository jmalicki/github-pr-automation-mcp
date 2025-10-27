import type { Comment } from '../schema.js';

/**
 * Calculate status indicators for a comment
 * @param comment - The comment to analyze
 * @param allComments - Optional array of all comments for context
 * @returns Status indicators object
 */
export function calculateStatusIndicators(comment: Comment, allComments?: Comment[]): Comment['status_indicators'] {
  const hasMcpAction = !!comment.action_commands.mcp_action;
  // Check if this comment has replies by looking for other comments that reply to it
  const hasManualResponse = allComments
    ? allComments.some(
        c =>
          c.in_reply_to_id === comment.id &&
          !c.is_bot &&                       // only humans
          c.author !== comment.author        // avoid self-acks
      )
    : false;
  const isActionable = comment.coderabbit_metadata?.suggestion_type === 'actionable' || 
                      comment.body.toLowerCase().includes('fix') ||
                      comment.body.toLowerCase().includes('suggest') ||
                      comment.body.toLowerCase().includes('change');
  
  // Use GitHub API's outdated field (available for review comments)
  const isOutdated = comment.outdated || false;
  
  // Calculate priority score (0-100)
  let priorityScore = 0;
  
  // Base priority from CodeRabbit metadata
  if (comment.coderabbit_metadata) {
    switch (comment.coderabbit_metadata.severity) {
      case 'high': priorityScore += 40; break;
      case 'medium': priorityScore += 25; break;
      case 'low': priorityScore += 10; break;
    }
    
    switch (comment.coderabbit_metadata.suggestion_type) {
      case 'actionable': priorityScore += 30; break;
      case 'additional': priorityScore += 20; break;
      case 'nit': priorityScore += 5; break;
      case 'duplicate': priorityScore += 0; break;
    }
  }
  
  // Boost priority for bot comments with MCP actions
  if (comment.is_bot && hasMcpAction) {
    priorityScore += 20;
  }
  
  // Boost priority for actionable content
  if (isActionable) {
    priorityScore += 15;
  }
  
  // Reduce priority if already has manual response
  if (hasManualResponse) {
    priorityScore -= 10;
  }
  
  // Reduce priority for outdated comments
  if (isOutdated) {
    priorityScore -= 20; // Significant reduction for outdated comments
  }
  
  // Cap at 100
  priorityScore = Math.min(100, Math.max(0, priorityScore));
  
  // Determine resolution status
  let resolutionStatus: 'unresolved' | 'acknowledged' | 'in_progress' | 'resolved';
  if (hasManualResponse && isActionable) {
    resolutionStatus = 'in_progress';
  } else if (hasManualResponse) {
    resolutionStatus = 'acknowledged';
  } else {
    resolutionStatus = 'unresolved';
  }
  
  // Determine suggested action
  let suggestedAction: 'reply' | 'resolve' | 'investigate' | 'ignore';
  if (hasMcpAction && !hasManualResponse) {
    suggestedAction = 'resolve';
  } else if (isActionable && !hasManualResponse) {
    suggestedAction = 'reply';
  } else if (priorityScore < 30) {
    suggestedAction = 'ignore';
  } else {
    suggestedAction = 'investigate';
  }
  
  return {
    needs_mcp_resolution: hasMcpAction,
    has_manual_response: hasManualResponse,
    is_actionable: isActionable,
    is_outdated: isOutdated,
    priority_score: priorityScore,
    resolution_status: resolutionStatus,
    suggested_action: suggestedAction
  };
}