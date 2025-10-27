#!/usr/bin/env node

/**
 * Generate version info with git revision for build-time embedding
 * This script runs during the build process to capture git information
 * that will be embedded in the final package.
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function getPackageVersion() {
  const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
  return packageJson.version;
}

function getGitRevision() {
  try {
    // Get the current commit hash (short)
    const revision = execSync('git rev-parse --short HEAD', { 
      cwd: rootDir, 
      encoding: 'utf8' 
    }).trim();
    
    // Check if there are uncommitted changes
    const status = execSync('git status --porcelain', { 
      cwd: rootDir, 
      encoding: 'utf8' 
    }).trim();
    
    const isDirty = status.length > 0;
    
    return {
      revision,
      isDirty,
      fullRevision: execSync('git rev-parse HEAD', { 
        cwd: rootDir, 
        encoding: 'utf8' 
      }).trim()
    };
  } catch (error) {
    // If git is not available or not in a git repo, return fallback
    console.warn('Warning: Could not get git revision:', error.message);
    return {
      revision: 'unknown',
      isDirty: false,
      fullRevision: 'unknown'
    };
  }
}

function generateVersionInfo() {
  const packageVersion = getPackageVersion();
  const gitInfo = getGitRevision();
  
  const versionInfo = {
    version: packageVersion,
    gitRevision: gitInfo.revision,
    gitFullRevision: gitInfo.fullRevision,
    isDirty: gitInfo.isDirty,
    buildDate: new Date().toISOString(),
    buildTimestamp: Date.now()
  };
  
  // Write to both src and dist directories
  const srcOutputPath = join(rootDir, 'src', 'version-info.json');
  const distOutputPath = join(rootDir, 'dist', 'version-info.json');
  const distUtilsOutputPath = join(rootDir, 'dist', 'utils', 'version-info.json');
  
  writeFileSync(srcOutputPath, JSON.stringify(versionInfo, null, 2));
  writeFileSync(distOutputPath, JSON.stringify(versionInfo, null, 2));
  writeFileSync(distUtilsOutputPath, JSON.stringify(versionInfo, null, 2));
  
  console.log('Generated version info:', versionInfo);
  return versionInfo;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateVersionInfo();
}

export { generateVersionInfo };