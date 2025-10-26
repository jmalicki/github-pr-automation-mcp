# CLI Installation Guide

## Overview

The GitHub PR Automation CLI can be installed in several ways depending on your needs and system setup.

## Installation Methods

### 1. Local Installation (Recommended)

Install to `~/.local/bin` for user-level access:

```bash
# Install to ~/.local/bin
npm run install:cli:local

# Or use the interactive installer
npm run install:cli
```

**Requirements:**
- Add `~/.local/bin` to your PATH
- Add this to your `~/.bashrc` or `~/.zshrc`:
  ```bash
  export PATH="$HOME/.local/bin:$PATH"
  ```

### 2. NPM Link (Development)

Link the package for development:

```bash
npm run install:cli:npm-link
```

**Usage:**
```bash
github-pr-automation --help
```

### 3. Global Installation

Install globally with npm:

```bash
npm run install:cli:global
```

**Usage:**
```bash
github-pr-automation --help
```

## Verification

After installation, verify the CLI works:

```bash
# Check if command is available
which github-pr-automation

# Test the CLI
github-pr-automation --help

# Test a specific command
github-pr-automation get-failing-tests --help
```

## Uninstallation

### Local Installation
```bash
npm run uninstall:local
```

### NPM Link
```bash
npm unlink github-pr-automation
```

### Global Installation
```bash
npm uninstall -g github-pr-automation
```

## Troubleshooting

### Command Not Found
If you get "command not found", check your PATH:

```bash
# Check if ~/.local/bin is in PATH
echo $PATH | grep -o ~/.local/bin

# Add to PATH if missing
export PATH="$HOME/.local/bin:$PATH"
```

### Permission Denied
Make sure the CLI is executable:

```bash
chmod +x ~/.local/bin/github-pr-automation
```

### Node.js Not Found
Ensure Node.js is installed and in your PATH:

```bash
node --version
npm --version
```

## Development Setup

For development, you can run the CLI directly:

```bash
# Build and run
npm run build
npm run cli -- --help

# Or use the dev script
npm run dev
```

## GitHub Token Setup

### Recommended: Import from GitHub CLI

The easiest way to set up your GitHub token is to import it from your existing GitHub CLI configuration:

```bash
# Import token from GitHub CLI (recommended)
github-pr-automation config import-token-from-gh
```

This will automatically:
- Read your token from `~/.config/gh/config.yml`
- Store it securely in the tool's config file
- Validate that the token works

### Alternative: Manual Setup

You can also set up your token manually:

**Option 1: Secure Config File**
```bash
github-pr-automation config set-token "your_token_here"
```

**Option 2: Environment Variable**
```bash
export GITHUB_TOKEN="your_token_here"
```

**Option 3: .env File**
```bash
echo "GITHUB_TOKEN=your_token_here" > .env
```

### Verify Setup

Check that your token is configured correctly:

```bash
github-pr-automation config show-token
```
