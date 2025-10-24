import * as fixtures from '@octokit/fixtures';
import { vi } from 'vitest';
import { GitHubClient } from '../../src/github/client.js';

/**
 * E2E test setup using recorded Octokit fixtures
 * Provides realistic GitHub API interactions without network calls
 */
export class E2ETestSetup {
  private fixtureClient: typeof fixtures;
  
  constructor() {
    // Use recorded fixtures for realistic API responses
    this.fixtureClient = fixtures;
  }
  
  /**
   * Setup realistic PR scenario with recorded data
   * @param scenario - Fixture scenario name (e.g., 'api.github.com/check-runs-list')
   * @returns Object containing mocked GitHubClient and Octokit instance
   */
  setupPRScenario(scenario: string) {
    // Use available fixtures or fallback to paginate-issues
    const availableScenarios = this.getAvailableScenarios();
    const scenarioToUse = availableScenarios.includes(scenario) ? scenario : 'api.github.com/paginate-issues';
    
    const fixture = this.fixtureClient.get(scenarioToUse);
    
    // Create a mock Octokit that returns fixture data
    const mockOctokit = {
      issues: {
        listComments: vi.fn().mockResolvedValue({
          data: fixture[0]?.response || [],
          headers: { link: '' }
        }),
        listForRepo: vi.fn().mockResolvedValue({
          data: fixture[0]?.response || [],
          headers: { link: '' }
        })
      },
      pulls: {
        listReviewComments: vi.fn().mockResolvedValue({
          data: fixture[0]?.response || [],
          headers: { link: '' }
        }),
        get: vi.fn().mockResolvedValue({
          data: {
            number: 123,
            title: 'Test PR',
            state: 'open',
            head: { sha: 'abc123' },
            base: { sha: 'def456' }
          }
        })
      },
      checks: {
        listForRef: vi.fn().mockResolvedValue({
          data: {
            check_runs: fixture[0]?.response || []
          }
        })
      },
      graphql: vi.fn().mockResolvedValue({
        repository: {
          pullRequest: {
            reviewThreads: { nodes: [] }
          }
        }
      })
    };
    
    return {
      client: new GitHubClient(undefined, mockOctokit),
      octokit: mockOctokit
    };
  }
  
  /**
   * Get available fixture scenarios for testing
   * @returns Array of available scenario names
   */
  getAvailableScenarios(): string[] {
    return [
      'api.github.com/paginate-issues',      // Real pagination data - EXISTS
      'api.github.com/search-issues',         // Real issues data - EXISTS
      'api.github.com/get-organization',      // Real org data - EXISTS
      'api.github.com/get-root'               // Real root data - EXISTS
    ];
  }
}
