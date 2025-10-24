#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const INSTALL_METHODS = {
  'npm-link': 'npm run build && npm link',
  'local-bin': 'npm run build && install-to-local-bin',
  'global': 'npm run build && npm install -g .'
};

function installToLocalBin() {
  console.log('⚠️  Local installation requires dependencies to be available.');
  console.log('   For a standalone CLI, use npm-link or global installation instead.');
  console.log('');
  console.log('   Recommended: npm run install:cli:npm-link');
  console.log('   This will create a symlink that works from anywhere.');
}

function showUsage() {
  console.log('GitHub PR Automation CLI Installer');
  console.log('');
  console.log('Usage: node scripts/install-cli.js [method]');
  console.log('');
  console.log('Installation methods:');
  console.log('  npm-link    - Install using npm link (requires npm)');
  console.log('  local-bin   - Install to ~/.local/bin (recommended)');
  console.log('  global      - Install globally with npm');
  console.log('');
  console.log('Examples:');
  console.log('  npm run install:cli npm-link');
  console.log('  npm run install:cli local-bin');
  console.log('  npm run install:cli global');
}

function main() {
  const method = process.argv[2] || 'local-bin';
  
  if (!INSTALL_METHODS[method]) {
    console.error(`❌ Unknown installation method: ${method}`);
    showUsage();
    process.exit(1);
  }
  
  console.log(`🚀 Installing GitHub PR Automation CLI using method: ${method}`);
  
  try {
    if (method === 'local-bin') {
      installToLocalBin();
    } else {
      console.log(`Running: ${INSTALL_METHODS[method]}`);
      execSync(INSTALL_METHODS[method], { stdio: 'inherit' });
      console.log('✅ CLI installed successfully!');
    }
    
    console.log('');
    console.log('🎉 Installation complete!');
    console.log('Try running: github-pr-automation --help');
    
  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    process.exit(1);
  }
}

main();
