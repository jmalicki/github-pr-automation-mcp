import type { PRIdentifier } from '../types/index.js';

/**
 * Parse PR identifier from various formats
 * Supports:
 * - owner/repo#123
 * - owner/repo/pull/123
 * - owner/repo/pulls/123
 * - https://github.com/owner/repo/pull/123
 */
/**
 * Parse PR identifier string into structured format
 * @param input - PR identifier in various formats (owner/repo#123, GitHub URL, etc.)
 * @returns Parsed PR identifier with owner, repo, and number
 * @throws Error if input format is invalid
 */
export function parsePRIdentifier(input: string): PRIdentifier {
  const formats = [
    // Format: owner/repo#123
    // Note: GitHub usernames use [\w-]+, but repo names can include dots
    {
      regex: /^([\w-]+)\/([\w.-]+)#(\d+)$/,
      groups: [1, 2, 3]
    },
    // Format: owner/repo/pull/123 or owner/repo/pulls/123
    {
      regex: /^([\w-]+)\/([\w.-]+)\/pulls?\/(\d+)$/,
      groups: [1, 2, 3]
    },
    // Format: https://github.com/owner/repo/pull/123
    {
      regex: /^https?:\/\/github\.com\/([\w-]+)\/([\w.-]+)\/pull\/(\d+)$/,
      groups: [1, 2, 3]
    }
  ];
  
  for (const format of formats) {
    const match = input.match(format.regex);
    if (match) {
      return {
        owner: match[format.groups[0]],
        repo: match[format.groups[1]],
        number: parseInt(match[format.groups[2]], 10)
      };
    }
  }
  
  throw new Error(
    `Invalid PR identifier: "${input}"\n` +
    `Expected formats:\n` +
    `  - owner/repo#123\n` +
    `  - owner/repo/pull/123\n` +
    `  - https://github.com/owner/repo/pull/123`
  );
}

/**
 * Format PR identifier object into string representation
 * @param pr - PR identifier object
 * @returns Formatted string in owner/repo#number format
 */
export function formatPRIdentifier(pr: PRIdentifier): string {
  return `${pr.owner}/${pr.repo}#${pr.number}`;
}

/**
 * Normalize commit SHA to short format (7 characters)
 * @param sha - Full or partial commit SHA
 * @returns Shortened SHA string (7 characters)
 */
export function normalizeCommitSHA(sha: string): string {
  return sha.substring(0, 7);
}

