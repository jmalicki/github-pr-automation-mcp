import type { PRIdentifier } from '../types/index.js';

/**
 * Parse PR identifier from various formats
 * Supports:
 * - owner/repo#123
 * - owner/repo/pull/123
 * - owner/repo/pulls/123
 * - https://github.com/owner/repo/pull/123
 */
export function parsePRIdentifier(input: string): PRIdentifier {
  const formats = [
    // Format: owner/repo#123
    {
      regex: /^([\w-]+)\/([\w-]+)#(\d+)$/,
      groups: [1, 2, 3]
    },
    // Format: owner/repo/pull/123 or owner/repo/pulls/123
    {
      regex: /^([\w-]+)\/([\w-]+)\/pulls?\/(\d+)$/,
      groups: [1, 2, 3]
    },
    // Format: https://github.com/owner/repo/pull/123
    {
      regex: /^https?:\/\/github\.com\/([\w-]+)\/([\w-]+)\/pull\/(\d+)$/,
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
 * Format PR identifier as string
 */
export function formatPRIdentifier(pr: PRIdentifier): string {
  return `${pr.owner}/${pr.repo}#${pr.number}`;
}

/**
 * Normalize commit SHA to short format (7 chars)
 */
export function normalizeCommitSHA(sha: string): string {
  return sha.substring(0, 7);
}

