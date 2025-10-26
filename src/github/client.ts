import { Octokit } from '@octokit/rest';
import type { PRIdentifier } from '../types/index.js';
import { getGitHubToken } from '../config/config.js';

/**
 * GitHub API client wrapper with authentication and error handling
 */
export class GitHubClient {
  private octokit: Octokit;
  
  /**
   * Initialize GitHub client with authentication token or inject Octokit instance
   * @param token - GitHub token (optional, falls back to GITHUB_TOKEN env var)
   * @param octokitInstance - Pre-configured Octokit instance for testing (optional)
   */
  constructor(token?: string, octokitInstance?: Octokit) {
    if (octokitInstance) {
      this.octokit = octokitInstance;
    } else {
      const githubToken = token || getGitHubToken();
      
      if (!githubToken) {
        throw new Error(
          'GitHub token not found. Set GITHUB_TOKEN environment variable or use: github-pr-automation config set-token <token>\n' +
          '💡 Quick setup: github-pr-automation config import-token-from-gh (imports from GitHub CLI)'
        );
      }
      
      this.octokit = new Octokit({
        auth: githubToken
      });
    }
  }
  
  /**
   * Validate token and check permissions
   * Supports both classic PATs and fine-grained tokens
   */
  async validateToken() {
    try {
      // Use single request - reuse response headers
      const response = await this.octokit.users.getAuthenticated();
      const user = response.data;
      
      // Parse scopes header (may be undefined for fine-grained tokens)
      const scopeHeader = response.headers?.['x-oauth-scopes'] ?? '';
      const scopes = scopeHeader
        ? String(scopeHeader).split(',').map(s => s.trim()).filter(Boolean)
        : [];
      
      const hasRepo = scopes.includes('repo') || scopes.includes('public_repo');
      
      // Only enforce classic-scope check when header is present
      // Fine-grained tokens don't have x-oauth-scopes header
      if (scopes.length > 0 && !hasRepo) {
        return {
          valid: false,
          error: 'Token missing required "repo" scope'
        };
      }
      
      return {
        valid: true,
        user: user.login,
        scopes: scopes
      };
    } catch (error: unknown) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Get pull request details by identifier
   * @param pr - PR identifier containing owner, repo, and number
   * @returns Promise resolving to PR data
   * @throws Error with normalized GitHub API errors
   */
  async getPullRequest(pr: PRIdentifier) {
    try {
      const { data } = await this.octokit.pulls.get({
        owner: pr.owner,
        repo: pr.repo,
        pull_number: pr.number
      });
      return data;
    } catch (error) {
      // Normalize GitHub API errors
      const { handleGitHubError } = await import('./errors.js');
      const toolError = handleGitHubError(error, `GET /repos/${pr.owner}/${pr.repo}/pulls/${pr.number}`);
      throw new Error(JSON.stringify(toolError));
    }
  }
  
  /**
   * Get current GitHub API rate limit status
   * @returns Promise resolving to rate limit information
   * @throws Error with normalized GitHub API errors
   */
  async getRateLimit() {
    try {
      const { data } = await this.octokit.rateLimit.get();
      return data;
    } catch (error) {
      const { handleGitHubError } = await import('./errors.js');
      const toolError = handleGitHubError(error, 'GET /rate_limit');
      throw new Error(JSON.stringify(toolError));
    }
  }
  
  /**
   * Get the underlying Octokit instance for direct API access
   * @returns Octokit instance for advanced GitHub API operations
   */
  getOctokit(): Octokit {
    return this.octokit;
  }
}

