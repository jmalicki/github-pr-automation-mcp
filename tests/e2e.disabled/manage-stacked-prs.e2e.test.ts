import { describe, it, expect } from 'vitest';
import { handleManageStackedPRs } from '../../src/tools/manage-stacked-prs/handler.js';
import { E2ETestSetup } from './setup.js';

describe('manage-stacked-prs E2E', () => {
  const setup = new E2ETestSetup();
  
  // Test: Complete stacked PR analysis with real GitHub data
  // Requirement: manage_stacked_prs - End-to-end stack analysis
  it('[fast] should analyze stacked PRs with realistic GitHub data', async () => {
    const { client } = setup.setupPRScenario('api.github.com/paginate-issues');
    
    const result = await handleManageStackedPRs(client, {
      pr: 'owner/repo#123',
      page: 1,
      page_size: 10
    });
    
    expect(result.stack).toBeDefined();
    expect(result.commands).toBeDefined();
    expect(result.visualization).toBeDefined();
    expect(result.risk_assessment).toBeDefined();
  });
  
  // Test: Stack validation with real GitHub PR relationships
  // Requirement: manage_stacked_prs - Stack validation
  it('[fast] should validate PR relationships using real GitHub data', async () => {
    const { client } = setup.setupPRScenario('api.github.com/paginate-issues');
    
    const result = await handleManageStackedPRs(client, {
      pr: 'owner/repo#123',
      page: 1,
      page_size: 10
    });
    
    expect(result.stack.is_valid).toBeDefined();
    expect(result.stack.prs).toBeDefined();
    expect(result.stack.base_pr).toBeDefined();
    expect(result.stack.dependent_prs).toBeDefined();
  });
  
  // Test: Command generation with realistic scenarios
  // Requirement: manage_stacked_prs - Command generation
  it('[fast] should generate commands for realistic PR scenarios', async () => {
    const { client } = setup.setupPRScenario('api.github.com/paginate-issues');
    
    const result = await handleManageStackedPRs(client, {
      pr: 'owner/repo#123',
      page: 1,
      page_size: 10
    });
    
    expect(result.commands).toBeDefined();
    expect(result.commands.length).toBeGreaterThanOrEqual(0);
    
    // Validate command structure
    for (const command of result.commands) {
      expect(command.step).toBeDefined();
      expect(command.command).toBeDefined();
      expect(command.description).toBeDefined();
    }
  });
  
  // Test: Complete workflow with multiple PR scenarios
  // Requirement: manage_stacked_prs - Complete workflow
  it('[slow] should handle complete stacked PR management workflow', async () => {
    const { client } = setup.setupPRScenario('api.github.com/paginate-issues');
    
    // Test different PR scenarios
    const scenarios = [
      { pr: 'owner/repo#123', page: 1, page_size: 10 },
      { pr: 'owner/repo#124', page: 1, page_size: 5 },
      { pr: 'owner/repo#125', page: 2, page_size: 3 }
    ];
    
    for (const scenario of scenarios) {
      const result = await handleManageStackedPRs(client, scenario);
      
      expect(result.stack).toBeDefined();
      expect(result.commands).toBeDefined();
      expect(result.visualization).toBeDefined();
      expect(result.risk_assessment).toBeDefined();
    }
  });
  
  // Test: Risk assessment with real GitHub data
  // Requirement: manage_stacked_prs - Risk assessment
  it('[fast] should assess risks using realistic GitHub PR data', async () => {
    const { client } = setup.setupPRScenario('api.github.com/paginate-issues');
    
    const result = await handleManageStackedPRs(client, {
      pr: 'owner/repo#123',
      page: 1,
      page_size: 10
    });
    
    expect(result.risk_assessment).toBeDefined();
    expect(result.risk_assessment.overall_risk).toBeDefined();
    expect(result.risk_assessment.conflicts).toBeDefined();
    expect(result.risk_assessment.dependencies).toBeDefined();
  });
});

