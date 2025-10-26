import * as fixtures from '@octokit/fixtures';
import { Octokit } from '@octokit/rest';
import { GitHubClient } from '../../src/github/client.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * E2E test setup with dual-mode operation:
 * - Record Mode: Records real GitHub API calls to fixtures
 * - Playback Mode: Uses recorded fixtures for fast, offline testing
 */
export class E2ETestSetup {
  private fixtureClient: typeof fixtures.default;
  private isRecordMode: boolean;
  private isPlaybackMode: boolean;
  
  constructor() {
    this.fixtureClient = fixtures.default;
    this.isRecordMode = process.env.RECORD_E2E_FIXTURES === 'true';
    this.isPlaybackMode = process.env.RUN_E2E_TESTS === 'true';
    
    console.log(`🔧 E2E Test Mode: ${this.isRecordMode ? 'RECORD' : this.isPlaybackMode ? 'PLAYBACK' : 'MOCK'}`);
  }
  
  /**
   * Setup realistic PR scenario with recorded data or live API
   * @param scenario - Fixture scenario name (e.g., 'api.github.com/check-runs-list')
   * @returns Object containing GitHubClient and Octokit instance
   */
  async setupPRScenario(scenario: string) {
    // Try to load recorded fixture first
    const fixture = await this.loadFixture(scenario);
    
    if (fixture && this.isPlaybackMode) {
      console.log(`✓ Using recorded fixture: ${scenario}`);
      // Create real Octokit instance
      const octokit = new Octokit();
      // Let the fixture intercept HTTP requests
      const mock = this.fixtureClient.mock(fixture);
      return {
        client: new GitHubClient(undefined, octokit),
        octokit: octokit,
        mock: mock,
        isRecorded: true
      };
    }
    
    // For mock mode, create a simple mock that doesn't make real API calls
    if (!this.isRecordMode && !this.isPlaybackMode) {
      console.log(`✓ Using simple mock for: ${scenario}`);
      const mockOctokit = this.createMockOctokit();
      return {
        client: new GitHubClient(undefined, mockOctokit),
        octokit: mockOctokit,
        mock: null,
        isRecorded: false
      };
    }
    
    // Fall back to @octokit/fixtures scenarios (for record mode)
    console.log(`✓ Using @octokit/fixtures scenario: ${scenario}`);
    const octokitFixture = this.fixtureClient.get(scenario);
    
    // Create real Octokit instance
    const octokit = new Octokit();
    // Let the fixture intercept HTTP requests
    const mock = this.fixtureClient.mock(octokitFixture);
    
    return {
      client: new GitHubClient(undefined, octokit),
      octokit: octokit,
      mock: mock,
      isRecorded: false
    };
  }
  
  /**
   * Load recorded fixture for a specific test scenario
   */
  async loadFixture(scenario: string): Promise<any> {
    if (!this.isPlaybackMode) {
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
      console.log(`⚠️ No fixture found for ${scenario}, using @octokit/fixtures`);
      return null;
    }
  }
  
  /**
   * Save recorded API calls as fixtures
   */
  async saveFixture(scenario: string, data: any): Promise<void> {
    if (!this.isRecordMode) {
      return;
    }
    
    try {
      const fixturesDir = path.join(__dirname, 'fixtures');
      await fs.mkdir(fixturesDir, { recursive: true });
      
      const fixturePath = path.join(fixturesDir, `${scenario.replace(/\//g, '-')}.json`);
      const fixtureData = {
        _metadata: {
          recorded_at: new Date().toISOString(),
          scenario: scenario,
          version: '1.0.0',
          source: 'e2e-tests'
        },
        data: data
      };
      
      await fs.writeFile(fixturePath, JSON.stringify(fixtureData, null, 2));
      console.log(`✓ Saved fixture: ${scenario}`);
    } catch (error) {
      console.error(`❌ Failed to save fixture ${scenario}:`, error);
    }
  }
  
  /**
   * Get available fixture scenarios for testing
   * @returns Array of available scenario names
   */
  getAvailableScenarios(): string[] {
    return [
      'api.github.com/check-runs-list',
      'api.github.com/paginate-issues',
      'api.github.com/pulls-list',
      'api.github.com/pulls-get',
      'api.github.com/repos-compare-commits'
    ];
  }
  
  /**
   * Check if we're in record mode
   */
  isRecording(): boolean {
    return this.isRecordMode;
  }
  
  /**
   * Check if we're in playback mode
   */
  isPlayingBack(): boolean {
    return this.isPlaybackMode;
  }

  /**
   * Create a simple mock Octokit instance for testing
   */
  private createMockOctokit(): any {
    return {
      pulls: {
        get: async () => ({
          data: {
            id: 123,
            number: 123,
            title: 'Test PR',
            head: { sha: 'abc123' },
            base: { sha: 'def456' }
          }
        }),
        listReviewComments: async () => ({
          data: [
            {
              id: 1,
              body: 'Test comment',
              user: { login: 'testuser', type: 'User' },
              created_at: '2023-01-01T00:00:00Z'
            }
          ],
          headers: { link: null }
        })
      },
      issues: {
        listComments: async () => ({
          data: [
            {
              id: 2,
              body: 'Test issue comment',
              user: { login: 'testuser', type: 'User' },
              created_at: '2023-01-01T00:00:00Z'
            }
          ],
          headers: { link: null }
        })
      },
      checks: {
        listForRef: async () => ({
          data: {
            check_runs: [
              {
                id: 1,
                name: 'Test Check',
                status: 'completed',
                conclusion: 'success',
                html_url: 'https://github.com/test/repo/actions/runs/1'
              }
            ]
          },
          headers: { 
            link: '<https://api.github.com/repos/test/repo/commits/abc123/check-runs?page=2>; rel="next"'
          }
        })
      },
      repos: {
        compareCommits: async () => ({
          data: {
            ahead_by: 1,
            behind_by: 0,
            status: 'ahead',
            commits: [
              {
                sha: 'abc123',
                commit: {
                  message: 'Test commit message'
                }
              }
            ]
          }
        })
      },
      graphql: async () => ({
        data: {
          node: {
            id: 'test-id',
            isResolved: false
          }
        }
      })
    };
  }
}
