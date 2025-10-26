#!/usr/bin/env node

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

/**
 * Check GitHub token permissions and warn if issues are detected
 * This runs during installation to proactively warn users about potential issues
 */
async function checkGitHubPermissions() {
  console.log('🔍 Checking GitHub token permissions...');
  
  // Check if GITHUB_TOKEN is set
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('⚠️  GITHUB_TOKEN not set - some features may not work');
    console.log('   Set your token: export GITHUB_TOKEN=your_token_here');
    console.log('   Or use: github-pr-automation check-github-permissions --pr owner/repo#123');
    return;
  }
  
  // Check if the diagnostic tool is available
  const distPath = join(process.cwd(), 'dist');
  if (!existsSync(distPath)) {
    console.log('⚠️  Project not built - skipping permission check');
    console.log('   Run: npm run build');
    return;
  }
  
  try {
    // Try to run a basic permission check
    // We'll use a simple GitHub API call to test the token
    const testCommand = `node -e "
      const { Octokit } = require('@octokit/rest');
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      
      octokit.rest.users.getAuthenticated()
        .then(user => {
          console.log('✅ Token valid for user:', user.data.login);
          console.log('✅ Basic authentication working');
        })
        .catch(error => {
          console.log('❌ Token validation failed:', error.message);
          if (error.status === 401) {
            console.log('   Your token may be invalid or expired');
          } else if (error.status === 403) {
            console.log('   Your token may lack required permissions');
          }
          process.exit(1);
        });
    "`;
    
    execSync(testCommand, { stdio: 'inherit' });
    
    console.log('✅ GitHub token appears to be working correctly');
    console.log('💡 If you encounter permission errors later, run:');
    console.log('   github-pr-automation check-github-permissions --pr owner/repo#123');
    
  } catch (error) {
    console.log('⚠️  GitHub token permission check failed');
    console.log('   This may indicate token issues or network problems');
    console.log('   You can run a full diagnostic later with:');
    console.log('   github-pr-automation check-github-permissions --pr owner/repo#123');
  }
}

/**
 * Check if we're in a CI environment where permission checks should be skipped
 */
function isCIEnvironment() {
  return process.env.CI === 'true' || 
         process.env.GITHUB_ACTIONS === 'true' ||
         process.env.JENKINS_URL ||
         process.env.BUILDKITE ||
         process.env.CIRCLECI ||
         process.env.TRAVIS ||
         process.env.APPVEYOR ||
         process.env.CODEBUILD_BUILD_ID;
}

/**
 * Main function
 */
async function main() {
  // Skip permission checks in CI environments
  if (isCIEnvironment()) {
    console.log('🔍 Skipping permission check in CI environment');
    return;
  }
  
  // Skip if explicitly disabled
  if (process.env.SKIP_PERMISSION_CHECK === 'true') {
    console.log('🔍 Skipping permission check (SKIP_PERMISSION_CHECK=true)');
    return;
  }
  
  try {
    await checkGitHubPermissions();
  } catch (error) {
    console.log('⚠️  Permission check encountered an error:', error.message);
    console.log('   This is not critical - the tool will still work');
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkGitHubPermissions, isCIEnvironment };
