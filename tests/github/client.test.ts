import { describe, it, expect } from 'vitest';
import { GitHubClient } from '../../src/github/client.js';

describe('GitHubClient', () => {
  // Test: Validates that GitHubClient requires a token
  // Requirement: GitHub Integration - Authentication
  it('should throw error if no token provided', () => {
    delete process.env.GITHUB_TOKEN;
    
    expect(() => new GitHubClient()).toThrow('GitHub token not found');
  });
  
  // Test: Validates that GitHubClient can be created with token
  // Requirement: GitHub Integration - Authentication
  it('should create client with valid token', () => {
    const client = new GitHubClient('test-token');
    
    expect(client).toBeInstanceOf(GitHubClient);
    expect(client.getOctokit()).toBeDefined();
  });
  
  // Test: Validates that GitHubClient reads token from environment
  // Requirement: GitHub Integration - Environment configuration
  it('should read token from environment variable', () => {
    process.env.GITHUB_TOKEN = 'env-token';
    
    const client = new GitHubClient();
    
    expect(client).toBeInstanceOf(GitHubClient);
  });
});

