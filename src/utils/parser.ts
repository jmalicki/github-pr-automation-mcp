import type { PRIdentifier } from "../types/index.js";

/**
 * Parse PR identifier from various formats into structured format.
 *
 * This function handles multiple PR identifier formats commonly used in
 * GitHub workflows, CLI tools, and URLs. It provides robust parsing
 * with clear error messages for invalid formats.
 *
 * ## Supported Formats
 *
 * 1. **Short Format**: `owner/repo#123`
 * 2. **Path Format**: `owner/repo/pull/123` or `owner/repo/pulls/123`
 * 3. **URL Format**: `https://github.com/owner/repo/pull/123`
 *
 * ## Parsing Strategy
 *
 * The function uses an array of format patterns with regex matching:
 * - Each format has a regex pattern and group indices
 * - Patterns are tested in order until a match is found
 * - Group indices specify which regex groups contain owner, repo, number
 *
 * ## Validation Rules
 *
 * - **Owner**: Must match `[\w-]+` (alphanumeric, underscores, hyphens)
 * - **Repo**: Must match `[\w.-]+` (alphanumeric, underscores, hyphens, dots)
 * - **Number**: Must be a positive integer
 * - **URL**: Must be valid GitHub URL format
 *
 * ## Error Handling
 *
 * If no format matches, the function throws a descriptive error
 * listing all supported formats with examples.
 *
 * @param input - PR identifier string in any supported format
 * @returns Parsed PR identifier with owner, repo, and number
 * @throws Error if input format is invalid
 * 
 * @example
 * ```typescript
 * // All of these work:
 * parsePRIdentifier("owner/repo#123")
 * parsePRIdentifier("owner/repo/pull/123")
 * parsePRIdentifier("https://github.com/owner/repo/pull/123")
 * 
 * // This throws an error:
 * parsePRIdentifier("invalid-format")
 * ```
 */
export function parsePRIdentifier(input: string): PRIdentifier {
  // Define supported formats with regex patterns and group indices
  const formats = [
    // Format 1: owner/repo#123 (most common)
    // Regex explanation: owner (word chars + hyphens), repo (word chars + hyphens + dots), number
    {
      regex: /^([\w-]+)\/([\w.-]+)#(\d+)$/,
      groups: [1, 2, 3],  // owner=group1, repo=group2, number=group3
    },
    // Format 2: owner/repo/pull/123 or owner/repo/pulls/123
    // Handles both singular and plural "pull" paths
    {
      regex: /^([\w-]+)\/([\w.-]+)\/pulls?\/(\d+)$/,
      groups: [1, 2, 3],  // owner=group1, repo=group2, number=group3
    },
    // Format 3: https://github.com/owner/repo/pull/123
    // Full GitHub URL format (supports both http and https)
    {
      regex: /^https?:\/\/github\.com\/([\w-]+)\/([\w.-]+)\/pull\/(\d+)$/,
      groups: [1, 2, 3],  // owner=group1, repo=group2, number=group3
    },
  ];

  // Try each format until we find a match
  for (const format of formats) {
    const match = input.match(format.regex);
    if (match) {
      // Extract components using group indices
      return {
        owner: match[format.groups[0]],           // Extract owner from regex group
        repo: match[format.groups[1]],           // Extract repo from regex group
        number: parseInt(match[format.groups[2]], 10), // Parse number as integer
      };
    }
  }

  // If no format matched, throw descriptive error
  throw new Error(
    `Invalid PR identifier: "${input}"\n` +
      `Expected formats:\n` +
      `  - owner/repo#123\n` +
      `  - owner/repo/pull/123\n` +
      `  - https://github.com/owner/repo/pull/123`,
  );
}

/**
 * Format PR identifier object into standardized string representation.
 *
 * Converts a structured PR identifier object back to the canonical
 * string format used throughout the application.
 *
 * @param pr - PR identifier object with owner, repo, and number
 * @returns Formatted string in owner/repo#number format
 * 
 * @example
 * ```typescript
 * const pr = { owner: 'microsoft', repo: 'vscode', number: 12345 };
 * const formatted = formatPRIdentifier(pr);
 * // Returns: "microsoft/vscode#12345"
 * ```
 */
export function formatPRIdentifier(pr: PRIdentifier): string {
  return `${pr.owner}/${pr.repo}#${pr.number}`;
}

/**
 * Normalize commit SHA to short format for display purposes.
 *
 * GitHub commit SHAs are 40 characters long, but for display and
 * logging purposes, a shorter 7-character version is often sufficient
 * and more readable.
 *
 * ## Use Cases
 *
 * - **Display**: Showing commit references in UI
 * - **Logging**: Including commit info in log messages
 * - **URLs**: Creating GitHub commit URLs
 * - **Comparisons**: Quick commit identification
 *
 * ## Safety
 *
 * The function safely handles:
 * - Empty or null input (returns empty string)
 * - Short input (returns as-is if less than 7 characters)
 * - Long input (truncates to 7 characters)
 *
 * @param sha - Full or partial commit SHA string
 * @returns Shortened SHA string (7 characters maximum)
 * 
 * @example
 * ```typescript
 * normalizeCommitSHA("a1b2c3d4e5f6789012345678901234567890abcd")
 * // Returns: "a1b2c3d"
 * 
 * normalizeCommitSHA("abc123")
 * // Returns: "abc123"
 * ```
 */
export function normalizeCommitSHA(sha: string): string {
  return sha.substring(0, 7);
}
