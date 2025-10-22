import { readFile, writeFile, mkdir } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

export class PreferencesLoader {
  private configDir: string;
  private configPath: string;
  
  constructor() {
    this.configDir = join(homedir(), '.resolve-pr-mcp');
    this.configPath = join(this.configDir, 'preferences.json');
  }
  
  /**
   * Load user preferences for a specific tool
   */
  async loadUserPreferences(toolName: string): Promise<Record<string, unknown>> {
    try {
      const content = await readFile(this.configPath, 'utf-8');
      const config = JSON.parse(content) as { preferences?: Record<string, Record<string, unknown>> };
      return config.preferences?.[toolName] || {};
    } catch {
      // File doesn't exist or is invalid - return empty preferences
      return {};
    }
  }
  
  /**
   * Save user preferences for a specific tool
   */
  async saveUserPreferences(toolName: string, prefs: Record<string, unknown>): Promise<void> {
    try {
      // Ensure directory exists
      await mkdir(this.configDir, { recursive: true });
      
      // Load existing config
      let config: { version: string; preferences: Record<string, Record<string, unknown>> };
      try {
        const content = await readFile(this.configPath, 'utf-8');
        config = JSON.parse(content) as { version: string; preferences: Record<string, Record<string, unknown>> };
      } catch {
        config = { version: '1.0', preferences: {} };
      }
      
      // Update preferences
      config.preferences[toolName] = prefs;
      
      // Save
      await writeFile(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Failed to save preferences:', error);
      // Don't throw - preferences are optional
    }
  }
  
  /**
   * Get config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }
}

