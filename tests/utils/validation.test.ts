import { describe, it, expect } from "vitest";
import {
  PRIdentifierStringSchema,
  PaginationSchema,
} from "../../src/utils/validation.js";

describe("validation", () => {
  describe("PRIdentifierStringSchema", () => {
    it("should validate owner/repo#123 format", () => {
      const result = PRIdentifierStringSchema.safeParse("owner/repo#123");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("owner/repo#123");
      }
    });

    it("should validate owner/repo/pull/123 format", () => {
      const result = PRIdentifierStringSchema.safeParse("owner/repo/pull/123");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("owner/repo/pull/123");
      }
    });

    it("should validate full GitHub URL format", () => {
      const result = PRIdentifierStringSchema.safeParse(
        "https://github.com/owner/repo/pull/123",
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("https://github.com/owner/repo/pull/123");
      }
    });

    it("should validate repo names with dots", () => {
      const result = PRIdentifierStringSchema.safeParse("owner/repo.name#123");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("owner/repo.name#123");
      }
    });

    it("should reject empty string", () => {
      const result = PRIdentifierStringSchema.safeParse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("PR identifier required");
      }
    });

    it("should reject invalid format", () => {
      const result = PRIdentifierStringSchema.safeParse("invalid-format");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Invalid PR format");
      }
    });

    it("should reject malformed URL", () => {
      const result = PRIdentifierStringSchema.safeParse(
        "https://github.com/owner/repo/issues/123",
      );
      expect(result.success).toBe(false);
    });
  });

  describe("PaginationSchema", () => {
    it("should validate valid pagination", () => {
      const result = PaginationSchema.safeParse({ page: 1, page_size: 10 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.page_size).toBe(10);
      }
    });

    it("should apply default page value", () => {
      const result = PaginationSchema.safeParse({ page_size: 10 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.page_size).toBe(10);
      }
    });

    it("should reject negative page", () => {
      const result = PaginationSchema.safeParse({ page: -1, page_size: 10 });
      expect(result.success).toBe(false);
    });

    it("should reject zero page", () => {
      const result = PaginationSchema.safeParse({ page: 0, page_size: 10 });
      expect(result.success).toBe(false);
    });

    it("should reject negative page_size", () => {
      const result = PaginationSchema.safeParse({ page: 1, page_size: -1 });
      expect(result.success).toBe(false);
    });

    it("should reject zero page_size", () => {
      const result = PaginationSchema.safeParse({ page: 1, page_size: 0 });
      expect(result.success).toBe(false);
    });

    it("should reject page_size over 100", () => {
      const result = PaginationSchema.safeParse({ page: 1, page_size: 101 });
      expect(result.success).toBe(false);
    });

    it("should accept page_size of 100", () => {
      const result = PaginationSchema.safeParse({ page: 1, page_size: 100 });
      expect(result.success).toBe(true);
    });
  });
});
