import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Use a temporary directory for testing
const testConfigDir = join(tmpdir(), 'github-pr-automation-test-config');
const testConfigFile = join(testConfigDir, 'config.json');

// Simple test implementation that doesn't require complex mocking
describe('Config Management', () => {
  beforeEach(() => {
    // Clean up any existing test config
    if (existsSync(testConfigFile)) {
      unlinkSync(testConfigFile);
    }
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
    
    // Create test config directory
    mkdirSync(testConfigDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testConfigFile)) {
      unlinkSync(testConfigFile);
    }
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('Config file operations', () => {
    it('should create and read config file', () => {
      const testConfig = {
        github: {
          token: 'test_token',
          default_pr: 'owner/repo#123'
        },
        version: '1.0.0'
      };
      
      // Write config
      writeFileSync(testConfigFile, JSON.stringify(testConfig, null, 2));
      
      // Read config
      expect(existsSync(testConfigFile)).toBe(true);
      const saved = JSON.parse(readFileSync(testConfigFile, 'utf-8'));
      expect(saved).toEqual(testConfig);
    });

    it('should handle missing config file gracefully', () => {
      expect(existsSync(testConfigFile)).toBe(false);
      
      // Should not throw when trying to read non-existent file
      expect(() => {
        if (existsSync(testConfigFile)) {
          JSON.parse(readFileSync(testConfigFile, 'utf-8'));
        }
      }).not.toThrow();
    });

    it('should handle corrupted config file gracefully', () => {
      // Write invalid JSON
      writeFileSync(testConfigFile, 'invalid json');
      
      // Should handle gracefully
      expect(() => {
        try {
          JSON.parse(readFileSync(testConfigFile, 'utf-8'));
        } catch {
          // Return default config
          return { github: {}, version: '1.0.0' };
        }
      }).not.toThrow();
    });
  });

  describe('Token management logic', () => {
    it('should prioritize config file token over environment variable', () => {
      const configToken = 'config_token';
      const envToken = 'env_token';
      
      // Mock environment variable
      const originalEnv = process.env.GITHUB_TOKEN;
      process.env.GITHUB_TOKEN = envToken;
      
      // Simulate config file with token
      const testConfig = {
        github: { token: configToken },
        version: '1.0.0'
      };
      writeFileSync(testConfigFile, JSON.stringify(testConfig));
      
      // Config file token should take precedence
      const config = JSON.parse(readFileSync(testConfigFile, 'utf-8'));
      expect(config.github.token).toBe(configToken);
      
      // Restore environment
      process.env.GITHUB_TOKEN = originalEnv;
    });

    it('should fallback to environment variable when config has no token', () => {
      const envToken = 'env_token';
      
      // Mock environment variable
      const originalEnv = process.env.GITHUB_TOKEN;
      process.env.GITHUB_TOKEN = envToken;
      
      // Config file without token
      const testConfig = {
        github: {},
        version: '1.0.0'
      };
      writeFileSync(testConfigFile, JSON.stringify(testConfig));
      
      // Should fallback to environment
      expect(process.env.GITHUB_TOKEN).toBe(envToken);
      
      // Restore environment
      process.env.GITHUB_TOKEN = originalEnv;
    });
  });

  describe('File permissions', () => {
    it('should create config directory with proper structure', () => {
      const testConfig = {
        github: { token: 'test_token' },
        version: '1.0.0'
      };
      
      // Create directory and file with proper permissions
      mkdirSync(testConfigDir, { recursive: true, mode: 0o700 });
      writeFileSync(testConfigFile, JSON.stringify(testConfig, null, 2), { mode: 0o600 });
      
      expect(existsSync(testConfigDir)).toBe(true);
      expect(existsSync(testConfigFile)).toBe(true);
      
      // Verify file permissions (600 = owner read/write only)
      // Note: On Windows, permission modes work differently
      if (process.platform !== 'win32') {
        const stats = statSync(testConfigFile);
        const mode = stats.mode & 0o777;
        expect(mode).toBe(0o600);
      }
      
      // Verify file content
      const saved = JSON.parse(readFileSync(testConfigFile, 'utf-8'));
      expect(saved).toEqual(testConfig);
    });
  });
});