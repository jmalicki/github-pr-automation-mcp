import type { ToolError, ErrorCategory } from '../types/index.js';

/**
 * Convert GitHub API error to ToolError
 */
export function handleGitHubError(error: unknown, context: string): ToolError {
  const apiError = error as {
    status?: number;
    message?: string;
    response?: {
      headers?: Record<string, string>;
      data?: { errors?: unknown[] };
    };
    code?: string;
  };
  
  // 404 - Not Found
  if (apiError.status === 404) {
    return {
      error: `Resource not found: ${context}`,
      category: 'user',
      suggestion: 'Verify the PR number and repository name are correct'
    };
  }
  
  // 401 - Unauthorized
  if (apiError.status === 401) {
    return {
      error: 'Authentication failed',
      category: 'authentication',
      suggestion: 'Check that GITHUB_TOKEN is set and valid'
    };
  }
  
  // 403 - Forbidden (often rate limiting)
  if (apiError.status === 403) {
    const rateLimitReset = apiError.response?.headers?.['x-ratelimit-reset'];
    const resetTime = rateLimitReset 
      ? new Date(parseInt(rateLimitReset) * 1000)
      : null;
    
    return {
      error: 'Rate limit exceeded',
      category: 'rate_limit',
      retry_after: resetTime 
        ? Math.ceil((resetTime.getTime() - Date.now()) / 1000)
        : 3600,
      suggestion: 'Wait for rate limit to reset'
    };
  }
  
  // 422 - Validation Failed
  if (apiError.status === 422) {
    return {
      error: `Invalid request: ${apiError.message || 'Validation failed'}`,
      category: 'user',
      details: apiError.response?.data?.errors as Record<string, unknown> | undefined
    };
  }
  
  // Network errors
  if (apiError.code === 'ENOTFOUND' || apiError.code === 'ETIMEDOUT') {
    return {
      error: 'Network error',
      category: 'network',
      suggestion: 'Check your internet connection'
    };
  }
  
  // Unknown error
  return {
    error: `Unexpected error: ${apiError.message || 'Unknown error'}`,
    category: 'unknown',
    details: { context }
  };
}

/**
 * Create a standardized error response
 */
export function createToolError(
  message: string,
  category: ErrorCategory,
  suggestion?: string
): ToolError {
  return {
    error: message,
    category,
    suggestion
  };
}

