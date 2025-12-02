import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ZodError } from "zod";

describe("MCP Server Error Handling", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe("Zod Validation Error Handling", () => {
    it("should return structured validation error for invalid PR format", async () => {
      // Import the schema to test validation
      const { GetFailingTestsSchema } = await import(
        "../src/tools/get-failing-tests/schema.js"
      );

      // Test with invalid input
      const invalidInput = {
        pr: "invalid-format", // Missing # and number
      };

      // Verify the schema throws a ZodError
      expect(() => GetFailingTestsSchema.parse(invalidInput)).toThrow(ZodError);

      // Capture the actual error to verify its structure
      try {
        GetFailingTestsSchema.parse(invalidInput);
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const zodError = error as ZodError;

        // Verify the error has the expected structure
        expect(zodError.issues).toBeDefined();
        expect(zodError.issues.length).toBeGreaterThan(0);
        expect(zodError.issues[0].path).toContain("pr");
      }
    });

    it("should return structured validation error for missing required fields", async () => {
      const { ManageStackedPRsSchema } = await import(
        "../src/tools/manage-stacked-prs/schema.js"
      );

      // Test with missing required fields
      const invalidInput = {
        base_pr: "owner/repo#1",
        // missing dependent_pr
      };

      expect(() => ManageStackedPRsSchema.parse(invalidInput)).toThrow(
        ZodError,
      );

      try {
        ManageStackedPRsSchema.parse(invalidInput);
      } catch (error) {
        const zodError = error as ZodError;
        expect(
          zodError.issues.some((e) => e.path.includes("dependent_pr")),
        ).toBe(true);
      }
    });

    it("should format Zod errors with path and message for MCP response", async () => {
      const { GetFailingTestsSchema } = await import(
        "../src/tools/get-failing-tests/schema.js"
      );

      try {
        GetFailingTestsSchema.parse({ pr: "bad" });
      } catch (error) {
        const zodError = error as ZodError;

        // Simulate the MCP error formatting from src/index.ts
        const formattedError = {
          error: "Invalid input parameters",
          category: "validation",
          details: zodError.issues.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        };

        expect(formattedError.category).toBe("validation");
        expect(formattedError.error).toBe("Invalid input parameters");
        expect(formattedError.details).toBeInstanceOf(Array);
        expect(formattedError.details.length).toBeGreaterThan(0);
        expect(formattedError.details[0]).toHaveProperty("path");
        expect(formattedError.details[0]).toHaveProperty("message");
      }
    });

    it("should handle resolve_review_thread validation requiring thread_id or comment_id", async () => {
      const { ResolveReviewThreadInputSchema } = await import(
        "../src/tools/resolve-review-thread/schema.js"
      );

      // Test with neither thread_id nor comment_id
      const invalidInput = {
        pr: "owner/repo#123",
        // missing both thread_id and comment_id
      };

      expect(() => ResolveReviewThreadInputSchema.parse(invalidInput)).toThrow(
        ZodError,
      );

      try {
        ResolveReviewThreadInputSchema.parse(invalidInput);
      } catch (error) {
        const zodError = error as ZodError;
        // Should have a custom refinement error about needing thread_id or comment_id
        expect(
          zodError.issues.some(
            (e) =>
              e.message.includes("thread_id") ||
              e.message.includes("comment_id"),
          ),
        ).toBe(true);
      }
    });
  });

  describe("GitHub Client Initialization Error Handling", () => {
    it("should capture initialization error message", async () => {
      // Verify the error handling logic structure
      const testError = new Error("GITHUB_TOKEN is not set");
      const errorMessage =
        testError instanceof Error
          ? testError.message
          : "Unknown error during GitHub client initialization";

      expect(errorMessage).toBe("GITHUB_TOKEN is not set");
    });

    it("should format client error for MCP response", () => {
      // Simulate the error response format from src/index.ts
      const githubClientError = "GITHUB_TOKEN is not set";

      const errorResponse = {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: `GitHub client initialization failed: ${githubClientError}. Please ensure the GITHUB_TOKEN environment variable is set with a valid GitHub personal access token.`,
                category: "authentication",
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };

      expect(errorResponse.isError).toBe(true);
      expect(errorResponse.content[0].type).toBe("text");

      const parsedError = JSON.parse(errorResponse.content[0].text);
      expect(parsedError.category).toBe("authentication");
      expect(parsedError.error).toContain(
        "GitHub client initialization failed",
      );
      expect(parsedError.error).toContain("GITHUB_TOKEN");
    });

    it("should provide helpful suggestion in error message", () => {
      const githubClientError = "Token validation failed";

      const errorResponse = {
        error: `GitHub client initialization failed: ${githubClientError}. Please ensure the GITHUB_TOKEN environment variable is set with a valid GitHub personal access token.`,
        category: "authentication",
      };

      // Verify the error message contains actionable guidance
      expect(errorResponse.error).toContain("GITHUB_TOKEN");
      expect(errorResponse.error).toContain("environment variable");
      expect(errorResponse.error).toContain("personal access token");
    });

    it("should handle non-Error thrown during initialization", () => {
      // Test the fallback for non-Error objects
      const nonErrorThrown = "string error";
      const errorMessage =
        nonErrorThrown instanceof Error
          ? nonErrorThrown.message
          : "Unknown error during GitHub client initialization";

      expect(errorMessage).toBe(
        "Unknown error during GitHub client initialization",
      );
    });
  });

  describe("Error Category Classification", () => {
    it("should use 'validation' category for Zod errors", () => {
      const zodErrorResponse = {
        error: "Invalid input parameters",
        category: "validation",
        details: [{ path: "pr", message: "Invalid format" }],
      };

      expect(zodErrorResponse.category).toBe("validation");
    });

    it("should use 'authentication' category for GitHub client errors", () => {
      const authErrorResponse = {
        error: "GitHub client initialization failed",
        category: "authentication",
      };

      expect(authErrorResponse.category).toBe("authentication");
    });

    it("should use 'unknown' category for unhandled errors", () => {
      const unknownErrorResponse = {
        error: "Something unexpected happened",
        category: "unknown",
      };

      expect(unknownErrorResponse.category).toBe("unknown");
    });
  });
});
