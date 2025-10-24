import * as fixtures from '@octokit/fixtures';
import { GitHubClient } from '../../src/github/client.js';

/**
 * E2E test setup using recorded Octokit fixtures
 * Provides realistic GitHub API interactions without network calls
 */
export class E2ETestSetup {
  private fixtureClient: any;
  
  constructor() {
    // Use recorded fixtures for realistic API responses
    this.fixtureClient = fixtures.default;
  }
  
  /**
   * Setup realistic PR scenario with recorded data
   */
  setupPRScenario(scenario: string) {
    const fixture = this.fixtureClient.get(scenario);
    return {
      client: new GitHubClient(),
      octokit: fixture.mock()
    };
  }
  
  /**
   * Available recorded scenarios
   */
  getAvailableScenarios() {
    return [
      'api.github.com/paginate-issues',      // Real pagination data
      'api.github.com/pulls-get',            // Real PR data
      'api.github.com/check-runs-list',     // Real CI data
      'api.github.com/repos-compare-commits' // Real diff data
    ];
  }
}

