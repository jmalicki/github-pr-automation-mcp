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
   */
  async validateToken() {
    try {
      const { data: user } = await this.octokit.users.getAuthenticated();
      
      // Check scopes
      const response = await this.octokit.request('GET /user');
      const scopes = response.headers['x-oauth-scopes']?.split(', ') || [];
      
      const hasRepo = scopes.includes('repo') || scopes.includes('public_repo');
      
      if (!hasRepo) {
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
   */
  async getPullRequest(pr: PRIdentifier) {
    const { data } = await this.octokit.pulls.get({
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.number
    });
    return data;
  }
  
  /**
   * Get rate limit status
   */
  async getRateLimit() {
    const { data } = await this.octokit.rateLimit.get();
    return data;
  }
  
  /**
   * Get the underlying Octokit instance for advanced usage
   */
  getOctokit(): Octokit {
    return this.octokit;
  }
}

