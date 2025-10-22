import { Octokit } from '@octokit/rest';
import type { PRIdentifier } from '../types/index.js';

export class GitHubClient {
  private octokit: Octokit;
  
  constructor(token?: string) {
    const githubToken = token || process.env.GITHUB_TOKEN;
    
    if (!githubToken) {
      throw new Error(
        'GitHub token not found. Set GITHUB_TOKEN environment variable.'
      );
    }
    
    this.octokit = new Octokit({
      auth: githubToken
    });
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
   * Get pull request
   * Throws normalized errors via handleGitHubError
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
   * Get rate limit status
   * Throws normalized errors via handleGitHubError
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
   * Get the underlying Octokit instance for advanced usage
   */
  getOctokit(): Octokit {
    return this.octokit;
  }
}

