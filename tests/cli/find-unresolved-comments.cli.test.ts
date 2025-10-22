import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('CLI: find-unresolved-comments', () => {
  const hasToken = !!process.env.GITHUB_TOKEN;
  const skipMessage = 'Skipping CLI test - GITHUB_TOKEN not set';

  it('should show help', async () => {
    const { stdout } = await execAsync('node dist/cli.js find-unresolved-comments --help');
    expect(stdout).toContain('Find unresolved PR comments');
    expect(stdout).toContain('--pr');
    expect(stdout).toContain('--include-bots');
  });

  it('should output JSON format', async () => {
    if (!hasToken) {
      console.log(skipMessage);
      return;
    }

    const { stdout } = await execAsync(
      'GITHUB_TOKEN=$GITHUB_TOKEN node dist/cli.js find-unresolved-comments --pr "jmalicki/resolve-pr-mcp#2" --json'
    );
    
    // Check if output is valid JSON (may be truncated for large outputs)
    let result;
    try {
      result = JSON.parse(stdout);
    } catch (error) {
      // If JSON parsing fails due to truncation, check if it starts with valid JSON
      expect(stdout.trim()).toMatch(/^\{.*$/);
      expect(stdout).toContain('"pr":');
      expect(stdout).toContain('"unresolved_in_page":');
      expect(stdout).toContain('⚠️  Large output detected');
      return; // Skip further assertions for truncated output
    }
    
    expect(result).toHaveProperty('pr');
    expect(result).toHaveProperty('unresolved_in_page');
    expect(result).toHaveProperty('comments');
    expect(result).toHaveProperty('summary');
  }, 30000);

  it('should output human-readable format', async () => {
    if (!hasToken) {
      console.log(skipMessage);
      return;
    }

    const { stdout } = await execAsync(
      'GITHUB_TOKEN=$GITHUB_TOKEN node dist/cli.js find-unresolved-comments --pr "jmalicki/resolve-pr-mcp#2"'
    );
    
    expect(stdout).toContain('Comments for');
    expect(stdout).toContain('Total unresolved:');
    expect(stdout).toContain('Summary:');
  }, 30000);

  it('should handle sorting options', async () => {
    if (!hasToken) {
      console.log(skipMessage);
      return;
    }

    const { stdout } = await execAsync(
      'GITHUB_TOKEN=$GITHUB_TOKEN node dist/cli.js find-unresolved-comments --pr "jmalicki/resolve-pr-mcp#2" --sort by_file --json'
    );
    
    // Check if output is valid JSON (may be truncated for large outputs)
    let result;
    try {
      result = JSON.parse(stdout);
      expect(result.comments).toBeDefined();
    } catch (error) {
      // If JSON parsing fails due to truncation, check if it starts with valid JSON
      expect(stdout.trim()).toMatch(/^\{.*$/);
      expect(stdout).toContain('"comments":');
      expect(stdout).toContain('⚠️  Large output detected');
      return; // Skip further assertions for truncated output
    }
  }, 30000);
});


