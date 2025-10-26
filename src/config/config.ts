import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface GitHubConfig {
  token?: string;
  default_pr?: string;
  preferred_actions?: string[];
}

export interface ConfigFile {
  github: GitHubConfig;
  version: string;
}

const CONFIG_DIR = join(homedir(), '.config', 'github-pr-automation');
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
    // Ensure config directory exists
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // Set secure permissions (readable only by owner)
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    
    // Set file permissions to 600 (read/write for owner only)
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
