import { Octokit } from "@octokit/rest";
import type { PRIdentifier } from "../types/index.js";

/**
 * GitHub API client wrapper with authentication and error handling.
 *
 * This class provides a high-level interface to the GitHub API with built-in
 * authentication, error handling, and token validation. It wraps the Octokit
 * client and adds application-specific functionality.
 *
 * ## Features
 *
 * - **Authentication**: Automatic token validation and scope checking
 * - **Error Handling**: Normalized GitHub API errors with context
 * - **Token Validation**: Support for both classic PATs and fine-grained tokens
 * - **Rate Limiting**: Built-in rate limit monitoring
 * - **Testing Support**: Dependency injection for testing
 *
 * ## Authentication
 *
 * The client requires a GitHub Personal Access Token (PAT) with appropriate
 * scopes. It supports both:
 * - **Classic PATs**: With `repo` scope for full repository access
 * - **Fine-grained tokens**: With repository-specific permissions
 *
 * ## Error Handling
 *
 * All API calls are wrapped with error handling that:
 * - Normalizes GitHub API errors into consistent format
 * - Provides context about the failed operation
 * - Throws structured errors with operation details
 *
 * @example
 * ```typescript
 * // Initialize with environment token
 * const client = new GitHubClient();
 *
 * // Initialize with explicit token
 * const client = new GitHubClient('ghp_your_token_here');
 *
 * // Initialize for testing
 * const client = new GitHubClient(undefined, mockOctokit);
 * ```
 */
export class GitHubClient {
  private octokit: Octokit;

  /**
   * Initialize GitHub client with authentication token or inject Octokit instance.
   *
   * The constructor handles authentication setup and validates that a token
   * is available. It supports both explicit tokens and environment variables,
   * as well as dependency injection for testing.
   *
   * ## Token Resolution Order
   *
   * 1. **Explicit Token**: If provided as parameter
   * 2. **Environment Variable**: `GITHUB_TOKEN` from process.env
   * 3. **Error**: If no token found, throws descriptive error
   *
   * ## Testing Support
   *
   * When `octokitInstance` is provided, the client skips token validation
   * and uses the provided instance directly. This enables easy mocking
   * in unit tests.
   *
   * @param token - GitHub Personal Access Token (optional, falls back to GITHUB_TOKEN env var)
   * @param octokitInstance - Pre-configured Octokit instance for testing (optional)
   * @throws Error if no token is found and no octokitInstance is provided
   */
  constructor(token?: string, octokitInstance?: Octokit) {
    // Use injected Octokit instance for testing
    if (octokitInstance) {
      this.octokit = octokitInstance;
    } else {
      // Resolve token from parameter or environment
      const githubToken = token || process.env.GITHUB_TOKEN;

      // Validate that token is available
      if (!githubToken) {
        throw new Error(
          "GitHub token not found. Set GITHUB_TOKEN environment variable.",
        );
      }

      // Initialize Octokit with authentication
      this.octokit = new Octokit({
        auth: githubToken,
      });
    }
  }

  /**
   * Validate GitHub token and check permissions.
   *
   * This method performs a lightweight authentication check by calling the
   * GitHub API to verify the token is valid and has appropriate permissions.
   * It supports both classic Personal Access Tokens and fine-grained tokens.
   *
   * ## Token Types Supported
   *
   * ### Classic Personal Access Tokens (PATs)
   * - Include `x-oauth-scopes` header with comma-separated scopes
   * - Require `repo` or `public_repo` scope for repository access
   * - Full repository access when properly scoped
   *
   * ### Fine-grained Personal Access Tokens
   * - Do not include `x-oauth-scopes` header
   * - Have repository-specific permissions
   * - More granular access control
   *
   * ## Validation Process
   *
   * 1. **API Call**: Call `GET /user` to verify token validity
   * 2. **Scope Parsing**: Extract scopes from response headers
   * 3. **Permission Check**: Verify `repo` scope for classic tokens
   * 4. **Fine-grained Handling**: Skip scope check for fine-grained tokens
   *
   * @returns Promise resolving to validation result with user info and scopes
   *
   * @example
   * ```typescript
   * const validation = await client.validateToken();
   * if (validation.valid) {
   *   console.log(`Authenticated as: ${validation.user}`);
   *   console.log(`Scopes: ${validation.scopes.join(', ')}`);
   * } else {
   *   console.error(`Token invalid: ${validation.error}`);
   * }
   * ```
   */
  async validateToken() {
    try {
      // Call GitHub API to verify token validity and get user info
      const response = await this.octokit.users.getAuthenticated();
      const user = response.data;

      // Parse scopes from response headers (may be undefined for fine-grained tokens)
      const scopeHeader = response.headers?.["x-oauth-scopes"] ?? "";
      const scopes = scopeHeader
        ? String(scopeHeader)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      // Check for required repository access scope
      const hasRepo = scopes.includes("repo") || scopes.includes("public_repo");

      // Only enforce classic-scope check when header is present
      // Fine-grained tokens don't have x-oauth-scopes header
      if (scopes.length > 0 && !hasRepo) {
        return {
          valid: false,
          error: 'Token missing required "repo" scope',
        };
      }

      // Return successful validation with user info
      return {
        valid: true,
        user: user.login,
        scopes: scopes,
      };
    } catch (error: unknown) {
      // Handle any authentication errors
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get pull request details by identifier.
   *
   * Fetches comprehensive pull request information from the GitHub API,
   * including metadata, diff stats, and status information. All errors
   * are normalized and include context about the failed operation.
   *
   * @param pr - PR identifier containing owner, repo, and number
   * @returns Promise resolving to complete PR data from GitHub API
   * @throws Error with normalized GitHub API errors and operation context
   *
   * @example
   * ```typescript
   * const pr = await client.getPullRequest({ owner: 'microsoft', repo: 'vscode', number: 12345 });
   * console.log(`PR Title: ${pr.title}`);
   * console.log(`State: ${pr.state}`);
   * ```
   */
  async getPullRequest(pr: PRIdentifier) {
    try {
      // Fetch PR data from GitHub API
      const { data } = await this.octokit.pulls.get({
        owner: pr.owner,
        repo: pr.repo,
        pull_number: pr.number,
      });
      return data;
    } catch (error) {
      // Normalize GitHub API errors with operation context
      const { handleGitHubError } = await import("./errors.js");
      const toolError = handleGitHubError(
        error,
        `GET /repos/${pr.owner}/${pr.repo}/pulls/${pr.number}`,
      );
      throw new Error(JSON.stringify(toolError));
    }
  }

  /**
   * Get current GitHub API rate limit status.
   *
   * Retrieves the current rate limit information for the authenticated token,
   * including remaining requests, reset time, and limit details. This is useful
   * for monitoring API usage and implementing rate limit-aware logic.
   *
   * @returns Promise resolving to rate limit information
   * @throws Error with normalized GitHub API errors
   *
   * @example
   * ```typescript
   * const rateLimit = await client.getRateLimit();
   * console.log(`Remaining requests: ${rateLimit.remaining}/${rateLimit.limit}`);
   * console.log(`Resets at: ${new Date(rateLimit.reset * 1000)}`);
   * ```
   */
  async getRateLimit() {
    try {
      // Fetch rate limit information from GitHub API
      const { data } = await this.octokit.rateLimit.get();
      return data;
    } catch (error) {
      // Normalize GitHub API errors with operation context
      const { handleGitHubError } = await import("./errors.js");
      const toolError = handleGitHubError(error, "GET /rate_limit");
      throw new Error(JSON.stringify(toolError));
    }
  }

  /**
   * Get the underlying Octokit instance for direct API access.
   *
   * This method provides access to the raw Octokit client for advanced
   * operations that aren't covered by the high-level methods. Use this
   * when you need direct access to GitHub API endpoints.
   *
   * @returns Octokit instance for advanced GitHub API operations
   *
   * @example
   * ```typescript
   * const octokit = client.getOctokit();
   * const { data: issues } = await octokit.issues.listForRepo({
   *   owner: 'microsoft',
   *   repo: 'vscode',
   *   state: 'open'
   * });
   * ```
   */
  getOctokit(): Octokit {
    return this.octokit;
  }
}
