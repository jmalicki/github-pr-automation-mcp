import { describe, it, expect } from 'vitest';
import { handleGetFailingTests } from '../../src/tools/get-failing-tests/handler.js';
import { E2ETestSetup } from './setup.js';

describe('get-failing-tests E2E', () => {
  const setup = new E2ETestSetup();
  
  // Test: Complete CI failure analysis with real GitHub data
  // Requirement: get_failing_tests - End-to-end CI analysis
  it('[fast] should analyze real CI failures end-to-end', async () => {
    const { client } = await setup.setupPRScenario('api.github.com/paginate-issues');
    
    // Use real PR for recording, fallback to fake for playback
    const testPR = setup.isRecording() ? 'jmalicki/resolve-pr-mcp#2' : 'owner/repo#123';
    
    const result = await handleGetFailingTests(client, {
      pr: testPR,
      wait: false
    });
    
    expect(result.status).toBeDefined();
    expect(result.failures).toBeDefined();
    expect(result.instructions).toBeDefined();
    expect(result.instructions.summary).toBeDefined();
  });
  
  // Test: Wait mode with realistic CI progression
  // Requirement: get_failing_tests - Wait mode simulation
  it('[fast] should handle wait mode with realistic CI state progression', async () => {
    const { client } = await setup.setupPRScenario('api.github.com/paginate-issues');
    
    // Test immediate mode first
    const immediate = await handleGetFailingTests(client, {
      pr: 'owner/repo#123',
      wait: false
    });
    
    expect(immediate.status).toBeDefined();
    expect(immediate.failures).toBeDefined();
    
    // Test wait mode (would normally poll, but with fixtures it's immediate)
    const waitMode = await handleGetFailingTests(client, {
      pr: 'owner/repo#123',
      wait: true
    });
    
    expect(waitMode.status).toBeDefined();
    expect(waitMode.failures).toBeDefined();
  });
  
  // Test: Pagination with realistic CI data
  // Requirement: get_failing_tests - Pagination with real data
  it('[fast] should paginate test failures with realistic GitHub CI data', async () => {
    const { client } = await setup.setupPRScenario('api.github.com/paginate-issues');
    
    const page1 = await handleGetFailingTests(client, {
      pr: 'owner/repo#123',
      wait: false
    });
    
    expect(page1.failures).toBeDefined();
    expect(page1.nextCursor).toBeDefined();
    
    // Use cursor for subsequent pages
    const page2 = await handleGetFailingTests(client, {
      pr: 'owner/repo#123',
      wait: false,
      cursor: page1.nextCursor
    });
    
    expect(page2.failures).toBeDefined();
    expect(page2.nextCursor).toBeDefined();
  });
  
  // Test: Complete CI workflow with real GitHub API structure
  // Requirement: get_failing_tests - Complete workflow validation
  it('[slow] should handle complete CI analysis workflow with real GitHub data', async () => {
    const { client } = await setup.setupPRScenario('api.github.com/paginate-issues');
    
    // Test different scenarios
    const scenarios = [
      { wait: false },
      { wait: true },
      { wait: false, cursor: 'test-cursor' }
    ];
    
    for (const scenario of scenarios) {
    const result = await handleGetFailingTests(client, {
      pr: testPR,
        ...scenario
      });
      
      expect(result.status).toBeDefined();
      expect(result.failures).toBeDefined();
      expect(result.instructions).toBeDefined();
      expect(result.nextCursor).toBeDefined();
    }
  });
  
  // Test: Error handling with realistic GitHub API errors
  // Requirement: get_failing_tests - Error handling
  it('[fast] should handle GitHub API errors gracefully', async () => {
    const { client } = await setup.setupPRScenario('api.github.com/paginate-issues');
    
    // Test with invalid PR (should still return structured response)
    const result = await handleGetFailingTests(client, {
      pr: 'invalid/repo#999',
      wait: false
    });
    
    expect(result.status).toBeDefined();
    expect(result.failures).toBeDefined();
    expect(result.instructions).toBeDefined();
  });
});

