#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, chmodSync, cpSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const INSTALL_METHODS = {
  'npm-link': 'npm run build && npm link',
  'local-bin': 'npm run build && install-to-local-bin',
  'global': 'npm run build && npm install -g .'
};

function installToLocalBin() {
  console.log('🔧 Installing to ~/.local/bin (standalone installation)');
  
  const localBinDir = join(homedir(), '.local', 'bin');
  const standaloneDir = join(homedir(), '.local', 'lib', 'github-pr-automation');
  
  // Ensure directories exist
  mkdirSync(localBinDir, { recursive: true });
  mkdirSync(standaloneDir, { recursive: true });
  
  try {
    // Ensure build exists
    const projectRoot = process.cwd();
    const distPath = join(projectRoot, 'dist');
    if (!existsSync(distPath)) {
      console.log('🔨 Building project (dist missing)...');
      execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });
    }
    
    // Copy dist directory
    cpSync(distPath, join(standaloneDir, 'dist'), { recursive: true });
    
    // Create a clean package.json for standalone installation (no dev dependencies)
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const cleanPackageJson = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      main: packageJson.main,
      bin: packageJson.bin,
      dependencies: packageJson.dependencies,
      engines: packageJson.engines
    };
    
    writeFileSync(join(standaloneDir, 'package.json'), JSON.stringify(cleanPackageJson, null, 2));
    
    // Install production dependencies
    console.log('📦 Installing production dependencies...');
    execSync('npm install --production --no-optional', { stdio: 'inherit', cwd: standaloneDir });
    
    // Create Unix wrapper script (CommonJS)
    const targetPath = join(localBinDir, 'github-pr-automation');
    const wrapperScript = `#!/usr/bin/env node
const { spawn } = require('child_process');
const { join } = require('path');
const { homedir } = require('os');

const standaloneDir = join(homedir(), '.local', 'lib', 'github-pr-automation');
const cliPath = join(standaloneDir, 'dist', 'cli.js');

const child = spawn(process.execPath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: standaloneDir
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
`;
    
    writeFileSync(targetPath, wrapperScript);
    chmodSync(targetPath, 0o755);
    
    // Create Windows .cmd shim for Windows CMD compatibility
    const windowsShimPath = join(localBinDir, 'github-pr-automation.cmd');
    const windowsShim = `@echo off
REM GitHub PR Automation CLI - Windows CMD Shim
REM This script runs the CLI from the standalone installation directory

set STANDALONE_DIR=%USERPROFILE%\\.local\\lib\\github-pr-automation
set CLI_PATH=%STANDALONE_DIR%\\dist\\cli.js

node "%CLI_PATH%" %*
`;
    
    console.log(`Installing Windows shim to: ${windowsShimPath}`);
    writeFileSync(windowsShimPath, windowsShim);
    
    console.log('✅ CLI installed successfully!');
    console.log(`📁 Unix CLI: ${targetPath}`);
    console.log(`📁 Windows CLI: ${windowsShimPath}`);
    console.log(`📁 Standalone Directory: ${standaloneDir}`);
    console.log('🔧 Make sure ~/.local/bin is in your PATH');
    console.log('   Add this to your ~/.bashrc or ~/.zshrc:');
    console.log('   export PATH="$HOME/.local/bin:$PATH"');
    console.log('');
    console.log('🎉 This installation is completely standalone and portable!');
    console.log('   Works on Unix (bash/zsh) and Windows (CMD/PowerShell)');
    
  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    process.exit(1);
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
