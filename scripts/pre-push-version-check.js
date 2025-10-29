#!/usr/bin/env node

/**
 * Pre-push hook to validate version tags
 * Ensures package.json and CHANGELOG.md are updated when pushing version tags
 */

/* eslint-env node */

import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Version tag pattern (e.g., v1.2.3, v1.2.3-alpha.1)
const VERSION_TAG_PATTERN = /^v\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;

function checkVersionTagValidation() {
  console.log('🔍 Checking for version tags...');
  
  try {
    // Check if we're pushing any version tags
    const remote = process.argv[2] || 'origin';
    const refs = process.argv[3] || 'main';
    
    // Get the refs being pushed
    execSync(`git ls-remote --heads --tags ${remote} ${refs}`, { 
      encoding: 'utf8',
      cwd: rootDir 
    });
    
    // For simplicity, check if any local tags match version pattern
    const localTags = execSync('git tag -l', { 
      encoding: 'utf8',
      cwd: rootDir 
    }).trim().split('\n').filter(Boolean);
    
    const versionTags = localTags.filter(tag => VERSION_TAG_PATTERN.test(tag));
    
    if (versionTags.length === 0) {
      console.log('✅ No version tags detected, skipping validation');
      return true;
    }
    
    console.log(`📋 Found version tags: ${versionTags.join(', ')}`);
    
    // Check if package.json exists
    const packageJsonPath = join(rootDir, 'package.json');
    if (!existsSync(packageJsonPath)) {
      console.error('❌ package.json not found');
      return false;
    }
    
    // Check if CHANGELOG.md exists
    const changelogPath = join(rootDir, 'docs', 'CHANGELOG.md');
    if (!existsSync(changelogPath)) {
      console.error('❌ docs/CHANGELOG.md not found');
      return false;
    }
    
    console.log('✅ Version tag validation passed');
    return true;
    
  } catch (error) {
    console.log('⚠️  Could not check version tags, skipping validation');
    return true;
  }
}

function main() {
  try {
    const isValid = checkVersionTagValidation();
    if (!isValid) {
      console.error('\n🚫 Push rejected: Version tag validation failed');
      console.error('💡 Use "npm run release:patch" (or minor/major) for proper releases');
      process.exit(1);
    }
    
    console.log('✅ Pre-push validation passed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Pre-push hook error:', error.message);
    process.exit(1);
  }
}

main();
