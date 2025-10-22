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
    
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty('pr');
    expect(result).toHaveProperty('total_unresolved');
    expect(result).toHaveProperty('comments');
    expect(result).toHaveProperty('summary');
  }, 15000);

  it('should output human-readable format', async () => {
    if (!hasToken) {
      console.log(skipMessage);
      return;
    }

    const { stdout } = await execAsync(
      'GITHUB_TOKEN=$GITHUB_TOKEN node dist/cli.js find-unresolved-comments --pr "jmalicki/resolve-pr-mcp#2"'
    );
    
    expect(stdout).toContain('PR:');
    expect(stdout).toContain('Unresolved Comments:');
    expect(stdout).toContain('Summary:');
  }, 15000);

  it('should handle sorting options', async () => {
    if (!hasToken) {
      console.log(skipMessage);
      return;
    }

    const { stdout } = await execAsync(
      'GITHUB_TOKEN=$GITHUB_TOKEN node dist/cli.js find-unresolved-comments --pr "jmalicki/resolve-pr-mcp#2" --sort by_file --json'
    );
    
    const result = JSON.parse(stdout);
    expect(result.comments).toBeDefined();
  }, 15000);
});


