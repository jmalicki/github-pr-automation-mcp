import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse } from 'yaml';

export interface GitHubConfig {
  token?: string;
  default_pr?: string;
  preferred_actions?: string[];
}

export interface ConfigFile {
  github: GitHubConfig;
  version: string;
}

const isWin = process.platform === 'win32';
const baseDir = isWin
  ? (process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'))
  : (process.env.XDG_CONFIG_HOME || (process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Application Support')
      : join(homedir(), '.config')));
const CONFIG_DIR = join(baseDir, 'github-pr-automation');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * Load configuration from file
 */
export function loadConfig(): ConfigFile {
  if (!existsSync(CONFIG_FILE)) {
    return {
      github: {},
      version: '1.0.0'
    };
  }

  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as ConfigFile;
  } catch (error) {
    console.warn('Failed to load config file, using defaults:', error);
    return {
      github: {},
      version: '1.0.0'
    };
  }
}

/**
 * Save configuration to file
 */
export async function saveConfig(config: ConfigFile): Promise<void> {
  try {
    // Ensure config directory exists with secure permissions
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }

    // Write file with secure permissions atomically
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
    
    // Verify permissions on non-Windows platforms
    if (process.platform !== 'win32') {
      const { chmodSync } = await import('fs');
      chmodSync(CONFIG_FILE, 0o600);
    }
  } catch (error) {
    throw new Error(`Failed to save config: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get GitHub token from config file or environment
 * Config file takes precedence over environment variable
 */
export function getGitHubToken(): string | undefined {
  const config = loadConfig();
  
  // Prefer config file token over environment variable
  if (config.github.token) {
    return config.github.token;
  }
  
  // Fallback to environment variable
  return process.env.GITHUB_TOKEN;
}

/**
 * Set GitHub token in config file
 */
export async function setGitHubToken(token: string): Promise<void> {
  const config = loadConfig();
  config.github.token = token;
  await saveConfig(config);
}

/**
 * Clear GitHub token from config file
 */
export async function clearGitHubToken(): Promise<void> {
  const config = loadConfig();
  delete config.github.token;
  await saveConfig(config);
}

/**
 * Get config file path for documentation purposes
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}

/**
 * Check if config file exists
 */
export function hasConfigFile(): boolean {
  return existsSync(CONFIG_FILE);
}

/**
 * Import GitHub token from GitHub CLI configuration
 */
export async function importTokenFromGitHubCLI(): Promise<string | null> {
  try {
    // Try to read from gh config file
    const ghConfigPath = join(homedir(), '.config', 'gh', 'config.yml');
    if (existsSync(ghConfigPath)) {
      const content = readFileSync(ghConfigPath, 'utf-8');
      const config = parse(content) as Record<string, unknown>;

      // Look for token in various possible locations
      const hosts = config?.hosts as Record<string, Record<string, unknown>>;
      const githubHost = hosts?.['github.com'] as Record<string, unknown> | undefined;
      const token = (githubHost?.oauth_token as string) ||
                   (config?.oauth_token as string) ||
                   (config?.token as string);

      if (token && typeof token === 'string') {
        return token;
      }
    }
    
    // Fallback: try to get from gh CLI directly
    try {
      const { execSync } = await import('child_process');
      const result = execSync('gh auth token', { encoding: 'utf-8' });
      return result.trim();
    } catch {
      return null;
    }
  } catch (error) {
    console.warn('Failed to import token from GitHub CLI:', error);
    return null;
  }
}
