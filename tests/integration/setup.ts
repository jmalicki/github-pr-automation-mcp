import { beforeAll, afterAll } from 'vitest';
import { Octokit } from '@octokit/rest';
import { GitHubClient } from '../../src/github/client.js';

/**
 * Integration Test Setup
 * 
 * Simple integration test setup that uses real GitHub API calls
 * with optional fixture recording for future enhancement
 */

export class IntegrationTestManager {
  private client: GitHubClient | null = null;

  async setup(): Promise<void> {
    console.log('🔴 Integration Test Mode: Using real GitHub API calls');
    
    // Create GitHub client with real token
    this.client = new GitHubClient();

    // Validate token
    try {
      const octokit = this.client.getOctokit();
      const { data: user } = await octokit.users.getAuthenticated();
      console.log(`✓ Authenticated as: ${user.login}`);
    } catch (error) {
      throw new Error(
        'Integration tests require GITHUB_TOKEN environment variable.\n' +
        'Set it with: export GITHUB_TOKEN=ghp_your_token_here'
      );
    }
  }

  getClient(): GitHubClient {
    if (!this.client) {
      throw new Error('Integration test manager not initialized. Call setup() first.');
    }
    return this.client;
  }

  async teardown(): Promise<void> {
    // No cleanup needed for real API calls
    console.log('✓ Integration test completed');
  }

  /**
   * Load fixture data for a specific test scenario (placeholder for future enhancement)
   */
  async loadFixture(scenario: string): Promise<any> {
    console.log(`✓ Loading fixture: ${scenario}`);
    return null; // Placeholder for future fixture support
  }

  /**
   * Save recorded API calls as fixtures (placeholder for future enhancement)
   */
  async saveFixture(scenario: string, data: any): Promise<void> {
    console.log(`✓ Saving fixture: ${scenario}`);
    // Placeholder for future fixture recording
  }
}

// Global integration test manager instance
export const integrationManager = new IntegrationTestManager();

// Vitest setup/teardown
beforeAll(async () => {
  // Verify required environment variables
  if (!process.env.GITHUB_TOKEN) {
    throw new Error(
      'Integration tests require GITHUB_TOKEN environment variable.\n' +
      'Set it with: export GITHUB_TOKEN=ghp_your_token_here'
    );
  }

  if (process.env.RUN_INTEGRATION_TESTS !== 'true') {
    throw new Error(
      'Integration tests require explicit opt-in.\n' +
      'Set RUN_INTEGRATION_TESTS=true to run integration tests.\n' +
      'These tests make real GitHub API calls and are slower.'
    );
  }

  await integrationManager.setup();
  
  console.log('✓ Integration tests enabled');
  console.log('✓ Using real GitHub API');
  console.log('✓ Token:', process.env.GITHUB_TOKEN?.substring(0, 10) + '...');
});

afterAll(async () => {
  await integrationManager.teardown();
});

