import * as fixtures from '@octokit/fixtures';
import { GitHubClient } from '../../src/github/client.js';

/**
 * E2E test setup using recorded Octokit fixtures
 * Provides realistic GitHub API interactions without network calls
 */
export class E2ETestSetup {
  private fixtureClient: typeof fixtures.default;
  
  constructor() {
    // Use recorded fixtures for realistic API responses
    this.fixtureClient = fixtures.default;
  }
  
  /**
   * Setup realistic PR scenario with recorded data
   * @param scenario - Fixture scenario name (e.g., 'api.github.com/check-runs-list')
   * @returns Object containing mocked GitHubClient and Octokit instance
   */
  setupPRScenario(scenario: string) {
    const fixture = this.fixtureClient.get(scenario);
    const mockOctokit = this.fixtureClient.mock(fixture);
    
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
    // @octokit/fixtures doesn't expose scenarios directly
    // Return common fixture names for testing
    return [
      'api.github.com/check-runs-list',
      'api.github.com/paginate-issues',
      'api.github.com/pulls-list'
    ];
  }
}
