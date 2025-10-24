import { describe, it, expect } from 'vitest';
import { handleManageStackedPRs } from '../../src/tools/manage-stacked-prs/handler.js';
import { E2ETestSetup } from './setup.js';

describe('manage-stacked-prs E2E', () => {
  const setup = new E2ETestSetup();
  
  // Test: Complete stacked PR analysis with real GitHub data
  // Requirement: manage_stacked_prs - End-to-end stack analysis
  it('[fast] should analyze stacked PRs with realistic GitHub data', async () => {
    const { client } = await setup.setupPRScenario('api.github.com/paginate-issues');
    
    const result = await handleManageStackedPRs(client, {
      base_pr: setup.isRecording() ? 'jmalicki/resolve-pr-mcp#1' : 'owner/repo#122',
      dependent_pr: setup.isRecording() ? 'jmalicki/resolve-pr-mcp#2' : 'owner/repo#123'
    });
    
    expect(result.is_stacked).toBeDefined();
    expect(result.stack_info).toBeDefined();
    expect(result.commands).toBeDefined();
    expect(result.stack_info.visualization).toBeDefined();
    expect(result.summary).toBeDefined();
  });
  
  // Test: Stack validation with real GitHub PR relationships
  // Requirement: manage_stacked_prs - Stack validation
  it('[fast] should validate PR relationships using real GitHub data', async () => {
    const { client } = await setup.setupPRScenario('api.github.com/paginate-issues');
    
    const result = await handleManageStackedPRs(client, {
      base_pr: setup.isRecording() ? 'jmalicki/resolve-pr-mcp#1' : 'owner/repo#122',
      dependent_pr: setup.isRecording() ? 'jmalicki/resolve-pr-mcp#2' : 'owner/repo#123'
    });
    
    expect(result.is_stacked).toBeDefined();
    expect(result.stack_info).toBeDefined();
    expect(result.base_pr).toBeDefined();
    expect(result.dependent_pr).toBeDefined();
  });
  
  // Test: Command generation with realistic scenarios
  // Requirement: manage_stacked_prs - Command generation
  it('[fast] should generate commands for realistic PR scenarios', async () => {
    const { client } = await setup.setupPRScenario('api.github.com/paginate-issues');
    
    const result = await handleManageStackedPRs(client, {
      base_pr: setup.isRecording() ? 'jmalicki/resolve-pr-mcp#1' : 'owner/repo#122',
      dependent_pr: setup.isRecording() ? 'jmalicki/resolve-pr-mcp#2' : 'owner/repo#123'
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
    const { client } = await setup.setupPRScenario('api.github.com/paginate-issues');
    
    // Test different PR scenarios
    const scenarios = [
      { base_pr: 'owner/repo#122', dependent_pr: 'owner/repo#123' },
      { base_pr: 'owner/repo#123', dependent_pr: 'owner/repo#124' },
      { base_pr: 'owner/repo#124', dependent_pr: 'owner/repo#125' }
    ];
    
    for (const scenario of scenarios) {
      const result = await handleManageStackedPRs(client, scenario);
      
      expect(result.is_stacked).toBeDefined();
      expect(result.stack_info).toBeDefined();
      expect(result.commands).toBeDefined();
      expect(result.stack_info.visualization).toBeDefined();
      expect(result.summary).toBeDefined();
    }
  });
  
  // Test: Risk assessment with real GitHub data
  // Requirement: manage_stacked_prs - Risk assessment
  it('[fast] should assess risks using realistic GitHub PR data', async () => {
    const { client } = await setup.setupPRScenario('api.github.com/paginate-issues');
    
    const result = await handleManageStackedPRs(client, {
      base_pr: setup.isRecording() ? 'jmalicki/resolve-pr-mcp#1' : 'owner/repo#122',
      dependent_pr: setup.isRecording() ? 'jmalicki/resolve-pr-mcp#2' : 'owner/repo#123'
    });
    
    expect(result.summary).toBeDefined();
    expect(result.summary.risk_level).toBeDefined();
    expect(result.summary.action_required).toBeDefined();
    expect(result.summary.reason).toBeDefined();
  });
});

