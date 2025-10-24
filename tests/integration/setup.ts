import { beforeAll, afterAll } from 'vitest';
import { Octokit } from '@octokit/rest';
import { GitHubClient } from '../../src/github/client.js';
import * as fs from 'fs/promises';
import * as path from 'path';

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
   * Load fixture data for a specific test scenario
   */
  async loadFixture(scenario: string): Promise<any> {
    console.log(`✓ Loading fixture: ${scenario}`);
    
    // Check if we're in playback mode
    if (process.env.RUN_INTEGRATION_TESTS !== 'true') {
      return null;
    }
    
    try {
      const fixturesDir = path.join(__dirname, 'fixtures');
      const fixturePath = path.join(fixturesDir, `${scenario.replace(/\//g, '-')}.json`);
      
      const data = await fs.readFile(fixturePath, 'utf8');
      const fixture = JSON.parse(data);
      console.log(`✓ Loaded fixture: ${scenario}`);
      return fixture;
    } catch (error) {
      console.log(`⚠️ No fixture found for ${scenario}, will use live API calls`);
      return null;
    }
  }

  /**
   * Save recorded API calls as fixtures
   */
  async saveFixture(scenario: string, data: any): Promise<void> {
    console.log(`✓ Saving fixture: ${scenario}`);
    
    // Only save fixtures in record mode
    if (process.env.RECORD_INTEGRATION_FIXTURES !== 'true') {
      return;
    }
    
    try {
      const fixturesDir = path.join(__dirname, 'fixtures');
      await fs.mkdir(fixturesDir, { recursive: true });
      
      const fixturePath = path.join(fixturesDir, `${scenario.replace(/\//g, '-')}.json`);
      await fs.writeFile(fixturePath, JSON.stringify(data, null, 2));
      console.log(`✓ Saved fixture: ${scenario}`);
    } catch (error) {
      console.error(`❌ Failed to save fixture ${scenario}:`, error);
    }
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

