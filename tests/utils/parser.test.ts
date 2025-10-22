import { describe, it, expect } from 'vitest';
import { parsePRIdentifier, formatPRIdentifier, normalizeCommitSHA } from '../../src/utils/parser.js';

describe('parsePRIdentifier', () => {
  // Test: Validates that PR identifier parsing handles standard format
  // Requirement: API Design - PR Identifier Parsing
  it('should parse standard format "owner/repo#123"', () => {
    const result = parsePRIdentifier('octocat/hello-world#42');
    
    expect(result).toEqual({
      owner: 'octocat',
      repo: 'hello-world',
      number: 42
    });
  });
  
  // Test: Validates that PR identifier parsing handles pull format
  // Requirement: API Design - PR Identifier Parsing (multiple formats)
  it('should parse "owner/repo/pull/123" format', () => {
    const result = parsePRIdentifier('octocat/hello-world/pull/42');
    
    expect(result).toEqual({
      owner: 'octocat',
      repo: 'hello-world',
      number: 42
    });
  });
  
  // Test: Validates that PR identifier parsing handles pulls format
  // Requirement: API Design - PR Identifier Parsing (multiple formats)
  it('should parse "owner/repo/pulls/123" format', () => {
    const result = parsePRIdentifier('octocat/hello-world/pulls/42');
    
    expect(result).toEqual({
      owner: 'octocat',
      repo: 'hello-world',
      number: 42
    });
  });
  
  // Test: Validates that PR identifier parsing handles GitHub URL format
  // Requirement: API Design - PR Identifier Parsing (multiple formats)
  it('should parse GitHub URL format', () => {
    const result = parsePRIdentifier(
      'https://github.com/octocat/hello-world/pull/42'
    );
    
    expect(result).toEqual({
      owner: 'octocat',
      repo: 'hello-world',
      number: 42
    });
  });
  
  // Test: Validates error handling for invalid PR identifiers
  // Requirement: Error Handling - User Input Errors
  it('should throw error for invalid format', () => {
    expect(() => parsePRIdentifier('invalid')).toThrow('Invalid PR identifier');
    expect(() => parsePRIdentifier('owner#123')).toThrow('Invalid PR identifier');
    expect(() => parsePRIdentifier('owner/repo/123')).toThrow('Invalid PR identifier');
  });
  
  // Test: Validates handling of hyphens in owner and repo names
  // Requirement: API Design - PR Identifier Parsing
  it('should handle hyphens in owner and repo names', () => {
    const result = parsePRIdentifier('my-org/my-repo#123');
    
    expect(result).toEqual({
      owner: 'my-org',
      repo: 'my-repo',
      number: 123
    });
  });
});

describe('formatPRIdentifier', () => {
  // Test: Validates PR identifier formatting
  // Requirement: API Design - PR Identifier Format
  it('should format PR identifier as owner/repo#number', () => {
    const result = formatPRIdentifier({
      owner: 'octocat',
      repo: 'hello-world',
      number: 42
    });
    
    expect(result).toBe('octocat/hello-world#42');
  });
});

describe('normalizeCommitSHA', () => {
  // Test: Validates commit SHA normalization to short format
  // Requirement: GitHub Integration - Commit handling
  it('should normalize full SHA to 7 characters', () => {
    const result = normalizeCommitSHA('abc123def456789012345678901234567890');
    expect(result).toBe('abc123d');
  });
  
  // Test: Validates handling of already-short SHAs
  // Requirement: GitHub Integration - Commit handling
  it('should handle already-short SHAs', () => {
    const result = normalizeCommitSHA('abc123d');
    expect(result).toBe('abc123d');
  });
});

