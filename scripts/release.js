#!/usr/bin/env node

/**
 * Release automation script for GitHub PR Automation
 * 
 * Usage:
 *   node scripts/release.js patch   # 0.1.0 -> 0.1.1
 *   node scripts/release.js minor   # 0.1.0 -> 0.2.0
 *   node scripts/release.js major   # 0.1.0 -> 1.0.0
 *   node scripts/release.js prerelease # 0.1.0 -> 0.1.1-alpha.1
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function getCurrentVersion() {
  const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
  return packageJson.version;
}

function updateVersion(type) {
  const currentVersion = getCurrentVersion();
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  let newVersion;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
    case 'prerelease':
      newVersion = `${major}.${minor}.${patch + 1}-alpha.1`;
      break;
    default:
      throw new Error(`Invalid version type: ${type}. Use major, minor, patch, or prerelease.`);
  }
  
  return newVersion;
}

function updatePackageJson(version) {
  const packagePath = join(rootDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  packageJson.version = version;
  writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`Updated package.json version to ${version}`);
}

function updateChangelog(version, type) {
  const changelogPath = join(rootDir, 'docs', 'CHANGELOG.md');
  const changelog = readFileSync(changelogPath, 'utf8');
  
  const today = new Date().toISOString().split('T')[0];
  const releaseHeader = `## [${version}] - ${today}`;
  
  // Replace [Unreleased] with the new version
  const updatedChangelog = changelog.replace(
    '## [Unreleased]',
    `## [Unreleased]\n\n${releaseHeader}`
  );
  
  writeFileSync(changelogPath, updatedChangelog);
  console.log(`Updated CHANGELOG.md with version ${version}`);
}

function runTests() {
  console.log('Running tests...');
  execSync('npm run test:coverage-check', { stdio: 'inherit', cwd: rootDir });
  console.log('Tests passed!');
}

function runLint() {
  console.log('Running linting...');
  execSync('npm run lint', { stdio: 'inherit', cwd: rootDir });
  console.log('Linting passed!');
}

function buildPackage() {
  console.log('Building package...');
  execSync('npm run build', { stdio: 'inherit', cwd: rootDir });
  console.log('Build completed!');
}

function createGitTag(version) {
  const tagName = `v${version}`;
  console.log(`Creating git tag: ${tagName}`);
  
  // Add changes
  execSync('git add .', { cwd: rootDir });
  
  // Commit changes
  execSync(`git commit -m "chore: release ${version}"`, { cwd: rootDir });
  
  // Create and push tag
  execSync(`git tag -a ${tagName} -m "Release ${version}"`, { cwd: rootDir });
  execSync(`git push origin main`, { cwd: rootDir });
  execSync(`git push origin ${tagName}`, { cwd: rootDir });
  
  console.log(`Tag ${tagName} created and pushed!`);
}

function main() {
  const type = process.argv[2];
  
  if (!type) {
    console.error('Usage: node scripts/release.js <major|minor|patch|prerelease>');
    process.exit(1);
  }
  
  try {
    console.log(`🚀 Starting release process for ${type} version...`);
    
    // Update version
    const newVersion = updateVersion(type);
    console.log(`Current version: ${getCurrentVersion()}`);
    console.log(`New version: ${newVersion}`);
    
    // Update files
    updatePackageJson(newVersion);
    updateChangelog(newVersion, type);
    
    // Run checks
    runTests();
    runLint();
    buildPackage();
    
    // Create release
    createGitTag(newVersion);
    
    console.log(`✅ Release ${newVersion} completed successfully!`);
    console.log(`📦 Package will be published to npm automatically via GitHub Actions`);
    console.log(`🏷️  GitHub release will be created automatically`);
    
  } catch (error) {
    console.error(`❌ Release failed: ${error.message}`);
    process.exit(1);
  }
}

main();
