# Release Workflow

This document describes the comprehensive release workflow for GitHub PR Automation, including automated publishing to npm and MCP marketplaces.

## Overview

The release workflow follows MCP (Model Context Protocol) best practices and includes:

- **Automated version management** with semantic versioning
- **GitHub Actions workflows** for CI/CD
- **npm publishing** with proper MCP metadata
- **Pre-release support** for testing
- **Automated changelog updates**
- **Git tag management**

## Release Types

### 1. Patch Release (0.1.0 → 0.1.1)
For bug fixes and minor improvements:
```bash
npm run release:patch
```

### 2. Minor Release (0.1.0 → 0.2.0)
For new features and enhancements:
```bash
npm run release:minor
```

### 3. Major Release (0.1.0 → 1.0.0)
For breaking changes and major updates:
```bash
npm run release:major
```

### 4. Pre-release (0.1.0 → 0.1.1-alpha.1)
For testing and validation:
```bash
npm run release:prerelease
```

## Release Process

### Automated Release Steps

1. **Version Update**: Updates `package.json` with new version
2. **Changelog Update**: Updates `docs/CHANGELOG.md` with release notes
3. **Testing**: Runs full test suite with coverage
4. **Linting**: Validates code quality
5. **Build**: Compiles TypeScript to JavaScript
6. **Git Operations**: Creates commit and tag
7. **GitHub Actions**: Triggers automated publishing

### Manual Release Steps

1. **Run Release Script**:
   ```bash
   npm run release:patch  # or minor/major/prerelease
   ```

2. **GitHub Actions Automatically**:
   - Publishes to npm registry
   - Creates GitHub release
   - Updates package metadata

## GitHub Actions Workflows

### Release Workflow (`.github/workflows/release.yml`)
- Triggers on version tags (e.g., `v1.0.0`)
- Runs tests and linting
- Publishes to npm registry
- Creates GitHub release with changelog

### Pre-release Workflow (`.github/workflows/prerelease.yml`)
- Triggers on pre-release tags (e.g., `v1.0.0-alpha.1`)
- Publishes to npm with `beta` tag
- Creates GitHub pre-release

## Package Configuration

### MCP Metadata
The `package.json` includes MCP-specific metadata:

```json
{
  "mcp": {
    "version": "1.0.0",
    "protocol": "stdio",
    "server": "dist/index.js",
    "tools": [
      "get_failing_tests",
      "find_unresolved_comments",
      "manage_stacked_prs",
      "detect_merge_conflicts",
      "check_merge_readiness",
      "analyze_pr_impact",
      "get_review_suggestions",
      "rebase_after_squash_merge",
      "resolve_review_thread"
    ],
    "capabilities": {
      "tools": true,
      "resources": false,
      "prompts": false
    }
  }
}
```

### Keywords for Discovery
Enhanced keywords for MCP marketplace discovery:
- `mcp`, `mcp-server`, `model-context-protocol`
- `github`, `pull-request`, `automation`
- `claude`, `ai-tools`, `github-api`

## Release Scripts

### Main Release Script (`scripts/release.js`)
Handles the complete release process:

```bash
# Usage
node scripts/release.js <major|minor|patch|prerelease>

# Examples
node scripts/release.js patch     # 0.1.0 → 0.1.1
node scripts/release.js minor     # 0.1.0 → 0.2.0
node scripts/release.js major     # 0.1.0 → 1.0.0
node scripts/release.js prerelease # 0.1.0 → 0.1.1-alpha.1
```

### NPM Scripts
Convenient npm scripts for common operations:

```bash
npm run release:patch      # Patch release
npm run release:minor      # Minor release
npm run release:major      # Major release
npm run release:prerelease # Pre-release
```

## Prerequisites

### Required Secrets
Set up these GitHub secrets:

1. **NPM_TOKEN**: npm authentication token
   ```bash
   # Get token from https://www.npmjs.com/settings/tokens
   # Add to GitHub repository secrets
   ```

2. **GITHUB_TOKEN**: Automatically provided by GitHub Actions

### Required Permissions
- npm package publishing permissions
- GitHub repository write permissions
- Git tag creation permissions

## MCP Marketplace Publishing

### npm Registry (Primary)
- Most MCP clients look for packages on npm
- Automatic publishing via GitHub Actions
- Proper MCP metadata for discovery

### MCP Marketplaces (Secondary)
Manual registration on:
- MCP Market
- MCP.so
- Smithery
- Pulse MCP
- Cursor MCP Registry

## Release Checklist

### Before Release
- [ ] All tests passing
- [ ] Code linting clean
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version compatibility checked

### During Release
- [ ] Run appropriate release script
- [ ] Verify GitHub Actions triggered
- [ ] Check npm publication
- [ ] Verify GitHub release created

### After Release
- [ ] Test installation from npm
- [ ] Verify MCP client compatibility
- [ ] Update marketplace listings
- [ ] Announce release to community

## Troubleshooting

### Common Issues

1. **npm Publishing Fails**
   - Check NPM_TOKEN secret
   - Verify package name availability
   - Check npm permissions

2. **GitHub Actions Fails**
   - Check workflow syntax
   - Verify secrets configuration
   - Check repository permissions

3. **Version Conflicts**
   - Ensure version not already published
   - Check git tag conflicts
   - Verify package.json version

### Debug Commands

```bash
# Check current version
npm version

# Test build locally
npm run build

# Test package locally
npm pack

# Check git status
git status

# List git tags
git tag -l
```

## Best Practices

1. **Semantic Versioning**: Follow SemVer strictly
2. **Changelog**: Keep detailed changelog
3. **Testing**: Always test before release
4. **Documentation**: Update docs with changes
5. **Community**: Announce releases appropriately

## Support

For release-related issues:
- Check GitHub Actions logs
- Review npm package status
- Consult MCP documentation
- Open GitHub issue for help

---

This release workflow ensures consistent, automated, and professional releases that meet MCP marketplace standards and community expectations.
