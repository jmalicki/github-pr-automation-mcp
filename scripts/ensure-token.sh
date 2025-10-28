#!/bin/bash

# Script to ensure GITHUB_TOKEN is available for tests
# If not set in environment, try to get it from GitHub CLI

if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN not set, attempting to get token from GitHub CLI..."
  
  # Check if gh CLI is available
  if command -v gh &> /dev/null; then
    # Try to get token from gh CLI
    TOKEN=$(gh auth token 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$TOKEN" ]; then
      echo "Using token from GitHub CLI"
      export GITHUB_TOKEN="$TOKEN"
    else
      echo "Failed to get token from GitHub CLI. Please:"
      echo "1. Run 'gh auth login' to authenticate with GitHub CLI, or"
      echo "2. Set GITHUB_TOKEN environment variable"
      exit 1
    fi
  else
    echo "GitHub CLI (gh) not found. Please:"
    echo "1. Install GitHub CLI: https://cli.github.com/"
    echo "2. Run 'gh auth login' to authenticate, or"
    echo "3. Set GITHUB_TOKEN environment variable"
    exit 1
  fi
else
  echo "Using existing GITHUB_TOKEN from environment"
fi

# Run the original command with the token set
# Handle environment variables properly
while [ $# -gt 0 ]; do
  case "$1" in
    "RECORD_INTEGRATION_FIXTURES=true")
      export RECORD_INTEGRATION_FIXTURES=true
      shift
      ;;
    "ROLLUP_FORCE_JS=1")
      export ROLLUP_FORCE_JS=1
      shift
      ;;
    *)
      break
      ;;
  esac
done

exec "$@"
