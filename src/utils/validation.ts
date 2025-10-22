import { z } from 'zod';

/**
 * Zod schema for PR identifier string
 * Supports multiple formats
 */
export const PRIdentifierStringSchema = z.string()
  .min(1, "PR identifier required")
  .refine(
    (val) => {
      // Note: GitHub usernames use [\w-]+, but repo names can include dots
      const formats = [
        /^[\w-]+\/[\w.-]+#\d+$/,
        /^[\w-]+\/[\w.-]+\/pulls?\/\d+$/,
        /^https?:\/\/github\.com\/[\w-]+\/[\w.-]+\/pull\/\d+$/
      ];
      return formats.some(regex => regex.test(val));
    },
    {
      message: "Invalid PR format. Examples: 'owner/repo#123' or 'https://github.com/owner/repo/pull/123'"
    }
  );

/**
 * Common pagination schema
 */
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100) // Prevent excessive memory usage
});

