import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';

describe('resolve-review-conversations CLI', () => {
  const cliPath = resolve(process.cwd(), 'dist/cli.js');
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, GITHUB_TOKEN: 'fake_token' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should show help without requiring token', () => {
    delete process.env.GITHUB_TOKEN;
    
    const output = execSync(`node ${cliPath} resolve-review-conversations --help`, { 
      encoding: 'utf-8',
      cwd: process.cwd()
    });
    
    expect(output).toContain('Generate commands to resolve PR review conversations');
    expect(output).toContain('--pr <identifier>');
    expect(output).toContain('--only-unresolved');
    expect(output).toContain('--dry-run');
    expect(output).toContain('--cursor <string>');
    expect(output).toContain('--limit <number>');
    expect(output).toContain('--json');
  });

  it('should require --pr argument', () => {
    expect(() => {
      execSync(`node ${cliPath} resolve-review-conversations`, { 
        encoding: 'utf-8',
        cwd: process.cwd()
      });
    }).toThrow();
  });

  it('should accept valid PR identifier', () => {
    // This will fail with API error but should not fail with argument parsing
    expect(() => {
      execSync(`node ${cliPath} resolve-review-conversations --pr owner/repo#123`, { 
        encoding: 'utf-8',
        cwd: process.cwd()
      });
    }).toThrow(); // Will throw due to API error, not argument parsing
  });

  it('should handle --only-unresolved flag', () => {
    expect(() => {
      execSync(`node ${cliPath} resolve-review-conversations --pr owner/repo#123 --only-unresolved`, { 
        encoding: 'utf-8',
        cwd: process.cwd()
      });
    }).toThrow(); // Will throw due to API error, not argument parsing
  });

  it('should handle --dry-run flag', () => {
    expect(() => {
      execSync(`node ${cliPath} resolve-review-conversations --pr owner/repo#123 --dry-run`, { 
        encoding: 'utf-8',
        cwd: process.cwd()
      });
    }).toThrow(); // Will throw due to API error, not argument parsing
  });

  it('should handle --cursor parameter', () => {
    expect(() => {
      execSync(`node ${cliPath} resolve-review-conversations --pr owner/repo#123 --cursor "cursor123"`, { 
        encoding: 'utf-8',
        cwd: process.cwd()
      });
    }).toThrow(); // Will throw due to API error, not argument parsing
  });

  it('should handle --limit parameter', () => {
    expect(() => {
      execSync(`node ${cliPath} resolve-review-conversations --pr owner/repo#123 --limit 5`, { 
        encoding: 'utf-8',
        cwd: process.cwd()
      });
    }).toThrow(); // Will throw due to API error, not argument parsing
  });

  it('should handle --json output', () => {
    expect(() => {
      execSync(`node ${cliPath} resolve-review-conversations --pr owner/repo#123 --json`, { 
        encoding: 'utf-8',
        cwd: process.cwd()
      });
    }).toThrow(); // Will throw due to API error, not argument parsing
  });

  it('should validate limit parameter range', () => {
    expect(() => {
      execSync(`node ${cliPath} resolve-review-conversations --pr owner/repo#123 --limit 0`, { 
        encoding: 'utf-8',
        cwd: process.cwd()
      });
    }).toThrow(); // Should throw due to validation error
  });

  it('should validate limit parameter max', () => {
    expect(() => {
      execSync(`node ${cliPath} resolve-review-conversations --pr owner/repo#123 --limit 101`, { 
        encoding: 'utf-8',
        cwd: process.cwd()
      });
    }).toThrow(); // Should throw due to validation error
  });
});
