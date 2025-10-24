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
    
    // Helper function to create paginated response with proper Link headers
    const createPaginatedResponse = (data: any[], page: number = 1, per_page: number = 10) => {
      const startIndex = (page - 1) * per_page;
      const endIndex = startIndex + per_page;
      const paginatedData = data.slice(startIndex, endIndex);
      const hasNextPage = endIndex < data.length;
      
      const linkHeader = hasNextPage 
        ? `<https://api.github.com/repos/owner/repo/issues?page=${page + 1}&per_page=${per_page}>; rel="next"`
        : '';
      
      return {
        data: paginatedData,
        headers: { link: linkHeader }
      };
    };
    
    // Create a mock Octokit that properly handles pagination
    const mockOctokit = {
      issues: {
        listComments: vi.fn().mockImplementation((params: any) => {
          const page = params?.page || 1;
          const per_page = params?.per_page || 10;
          const fixtureData = fixture[0]?.response || [];
          return Promise.resolve(createPaginatedResponse(fixtureData, page, per_page));
        }),
        listForRepo: vi.fn().mockImplementation((params: any) => {
          const page = params?.page || 1;
          const per_page = params?.per_page || 10;
          const fixtureData = fixture[0]?.response || [];
          return Promise.resolve(createPaginatedResponse(fixtureData, page, per_page));
        })
      },
      pulls: {
        listReviewComments: vi.fn().mockImplementation((params: any) => {
          const page = params?.page || 1;
          const per_page = params?.per_page || 10;
          const fixtureData = fixture[0]?.response || [];
          return Promise.resolve(createPaginatedResponse(fixtureData, page, per_page));
        }),
        get: vi.fn().mockResolvedValue({
          data: {
            number: 123,
            title: 'Test PR',
            state: 'open',
            head: { sha: 'abc123', ref: 'feature/test-pr' },
            base: { sha: 'def456', ref: 'main' }
          }
        })
      },
      repos: {
        compareCommits: vi.fn().mockResolvedValue({
          data: {
            ahead_by: 2,
            commits: [
              { sha: 'abcdef1', commit: { message: 'feat: update', author: { name: 'dev1' } } },
              { sha: 'abcdef2', commit: { message: 'fix: bug', author: { name: 'dev2' } } }
            ],
            files: [{ filename: 'src/index.ts' }]
          }
        })
      },
      checks: {
        listForRef: vi.fn().mockImplementation((params: any) => {
          const page = params?.page || 1;
          const per_page = params?.per_page || 10;
          // Ensure check runs have required fields
          const checkRuns = [
            { 
              id: 1, 
              name: 'unit-tests', 
              status: 'completed', 
              conclusion: 'success', 
              html_url: 'https://github.com/test', 
              output: { title: 'unit-tests', summary: 'All passed' } 
            },
            { 
              id: 2, 
              name: 'e2e-tests', 
              status: 'completed', 
              conclusion: 'failure',
              html_url: 'https://github.com/test', 
              output: { title: 'e2e-tests', summary: '2 failures' } 
            }
          ];
          return Promise.resolve({
            data: {
              check_runs: createPaginatedResponse(checkRuns, page, per_page).data
            },
            headers: createPaginatedResponse(checkRuns, page, per_page).headers
          });
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
