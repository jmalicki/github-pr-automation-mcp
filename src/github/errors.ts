import type { ToolError, ErrorCategory } from "../types/index.js";

/**
 * Convert GitHub API error to standardized ToolError format
 * @param error - Unknown error from GitHub API
 * @param context - Context string describing the API operation that failed
 * @returns ToolError with standardized error information
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
      category: "user",
      suggestion: "Verify the PR number and repository name are correct",
    };
  }

  // 401 - Unauthorized
  if (apiError.status === 401) {
    return {
      error: "Authentication failed",
      category: "authentication",
      suggestion: "Check that GITHUB_TOKEN is set and valid",
    };
  }

  // 403 - Forbidden (may be rate limiting or insufficient permissions)
  if (apiError.status === 403) {
    const headers = apiError.response?.headers ?? {};
    const remaining = headers["x-ratelimit-remaining"];
    const retryAfter = headers["retry-after"];
    const reset = headers["x-ratelimit-reset"];

    // Determine if this is rate limiting or permission issue
    const isRateLimited =
      remaining === "0" || typeof retryAfter !== "undefined";

    if (isRateLimited) {
      // Calculate retry time: prefer Retry-After, fallback to x-ratelimit-reset
      const retry = retryAfter
        ? parseInt(String(retryAfter), 10)
        : reset
          ? Math.max(
              0,
              Math.ceil(
                (parseInt(String(reset), 10) * 1000 - Date.now()) / 1000,
              ),
            )
          : 3600;

      return {
        error: "Rate limit exceeded",
        category: "rate_limit",
        retry_after: Number.isFinite(retry) ? retry : 3600,
        suggestion: "Wait for rate limit to reset",
      };
    }

    // Not rate limited - permission issue
    return {
      error: "Forbidden: insufficient permissions",
      category: "authorization",
      suggestion: "Ensure the token has required repository permissions",
    };
  }

  // 429 - Too Many Requests (secondary limits/abuse detection)
  if (apiError.status === 429) {
    const retryAfter = apiError.response?.headers?.["retry-after"];
    const retry = retryAfter ? parseInt(String(retryAfter), 10) : 60;

    return {
      error: "Too many requests",
      category: "rate_limit",
      retry_after: Number.isFinite(retry) ? retry : 60,
      suggestion: "Reduce request rate or add backoff",
    };
  }

  // 422 - Validation Failed
  if (apiError.status === 422) {
    return {
      error: `Invalid request: ${apiError.message || "Validation failed"}`,
      category: "user",
      details: apiError.response?.data?.errors as
        | Record<string, unknown>
        | undefined,
    };
  }

  // Network errors
  if (apiError.code === "ENOTFOUND" || apiError.code === "ETIMEDOUT") {
    return {
      error: "Network error",
      category: "network",
      suggestion: "Check your internet connection",
    };
  }

  // Unknown error
  return {
    error: `Unexpected error: ${apiError.message || "Unknown error"}`,
    category: "unknown",
    details: { context },
  };
}

/**
 * Create a standardized ToolError response
 * @param message - Error message describing what went wrong
 * @param category - Error category for classification
 * @param suggestion - Optional suggestion for resolving the error
 * @returns ToolError with standardized format
 */
export function createToolError(
  message: string,
  category: ErrorCategory,
  suggestion?: string,
): ToolError {
  return {
    error: message,
    category,
    suggestion,
  };
}
