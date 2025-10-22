import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';

describe('CLI', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    process.env = { ...originalEnv };
    // Mock console methods to avoid output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('help commands', () => {
    it('should show help for main command', () => {
      expect(() => {
        execSync('node dist/cli.js --help', { 
          cwd: process.cwd(),
          encoding: 'utf8'
        });
      }).not.toThrow();
    });

    it('should show help for get-failing-tests command', () => {
      expect(() => {
        execSync('node dist/cli.js get-failing-tests --help', { 
          cwd: process.cwd(),
          encoding: 'utf8'
        });
      }).not.toThrow();
    });

    it('should show help for find-unresolved-comments command', () => {
      expect(() => {
        execSync('node dist/cli.js find-unresolved-comments --help', { 
          cwd: process.cwd(),
          encoding: 'utf8'
        });
      }).not.toThrow();
    });

    it('should show help for manage-stacked-prs command', () => {
      expect(() => {
        execSync('node dist/cli.js manage-stacked-prs --help', { 
          cwd: process.cwd(),
          encoding: 'utf8'
        });
      }).not.toThrow();
    });

    it('should show help for resolve-review-thread command', () => {
      expect(() => {
        execSync('node dist/cli.js resolve-review-thread --help', { 
          cwd: process.cwd(),
          encoding: 'utf8'
        });
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle missing required arguments', () => {
      expect(() => {
        execSync('node dist/cli.js get-failing-tests', { 
          cwd: process.cwd(),
          encoding: 'utf8'
        });
      }).toThrow();
    });

    it('should handle invalid command', () => {
      expect(() => {
        execSync('node dist/cli.js invalid-command', { 
          cwd: process.cwd(),
          encoding: 'utf8'
        });
      }).toThrow();
    });
  });

  describe('with fake token', () => {
    beforeEach(() => {
      process.env.GITHUB_TOKEN = 'fake_token';
    });

    it('should handle invalid PR format', () => {
      expect(() => {
        execSync('node dist/cli.js get-failing-tests --pr invalid-format', { 
          cwd: process.cwd(),
          encoding: 'utf8'
        });
      }).toThrow();
    });

    it('should handle missing required options for resolve-review-thread', () => {
      expect(() => {
        execSync('node dist/cli.js resolve-review-thread --pr owner/repo#123', { 
          cwd: process.cwd(),
          encoding: 'utf8'
        });
      }).toThrow();
    });
  });
});
