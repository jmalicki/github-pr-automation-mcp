#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, chmodSync, cpSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const INSTALL_METHODS = {
  'npm-link': 'npm run build && npm link',
  'local-bin': 'npm run build && install-to-local-bin',
  'global': 'npm run build && npm install -g .'
};

async function installToLocalBin() {
  const localBinDir = join(homedir(), '.local', 'bin');
  const targetPath = join(localBinDir, 'github-pr-automation');
  const standaloneDir = join(homedir(), '.local', 'lib', 'github-pr-automation');
  
  // Create directories if they don't exist
  if (!existsSync(localBinDir)) {
    console.log(`Creating directory: ${localBinDir}`);
    mkdirSync(localBinDir, { recursive: true });
  }
  
  if (!existsSync(standaloneDir)) {
    console.log(`Creating standalone directory: ${standaloneDir}`);
    mkdirSync(standaloneDir, { recursive: true });
  }
  
  console.log('📦 Creating standalone installation...');
  
  // Copy essential files to standalone directory
  try {
    // Copy dist directory
    cpSync('dist', join(standaloneDir, 'dist'), { recursive: true });
    
    // Create a minimal package.json for standalone installation
    const minimalPackageJson = {
      "name": "github-pr-automation-standalone",
      "version": "0.1.1",
      "type": "module",
      "dependencies": {
        "@modelcontextprotocol/sdk": "^1.20.1",
        "@octokit/auth-app": "^8.1.1",
        "@octokit/rest": "^22.0.0",
        "commander": "^14.0.1",
        "zod": "^4.1.12"
      }
    };
    
    writeFileSync(
      join(standaloneDir, 'package.json'), 
      JSON.stringify(minimalPackageJson, null, 2)
    );
    
    // Install dependencies in standalone directory
    console.log('📦 Installing dependencies...');
    execSync('npm install --production --no-optional', { stdio: 'inherit', cwd: standaloneDir });
    
    // Create wrapper script that runs from standalone directory
    const wrapperScript = `#!/usr/bin/env node
// GitHub PR Automation CLI - Standalone Installation
// This script runs the CLI from the standalone installation directory

const { spawn } = require('child_process');
const { join } = require('path');
const { homedir } = require('os');

const standaloneDir = join(homedir(), '.local', 'lib', 'github-pr-automation');
const cliPath = join(standaloneDir, 'dist', 'cli.js');

const result = spawn(process.execPath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: standaloneDir
});

result.on('exit', (code) => {
  process.exit(code || 0);
});

result.on('error', (error) => {
  console.error('❌ Failed to run CLI:', error.message);
  process.exit(1);
});
`;

    // Write wrapper script
    console.log(`Installing CLI to: ${targetPath}`);
    writeFileSync(targetPath, wrapperScript);
    chmodSync(targetPath, 0o755);
    
    console.log('✅ CLI installed successfully!');
    console.log(`📁 CLI Location: ${targetPath}`);
    console.log(`📁 Standalone Directory: ${standaloneDir}`);
    console.log('🔧 Make sure ~/.local/bin is in your PATH');
    console.log('   Add this to your ~/.bashrc or ~/.zshrc:');
    console.log('   export PATH="$HOME/.local/bin:$PATH"');
    console.log('');
    console.log('🎉 This installation is completely standalone and portable!');
    
  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    throw error;
  }
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

async function main() {
  const method = process.argv[2] || 'local-bin';
  
  if (!INSTALL_METHODS[method]) {
    console.error(`❌ Unknown installation method: ${method}`);
    showUsage();
    process.exit(1);
  }
  
  console.log(`🚀 Installing GitHub PR Automation CLI using method: ${method}`);
  
  try {
  if (method === 'local-bin') {
    await installToLocalBin();
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

main().catch(console.error);
