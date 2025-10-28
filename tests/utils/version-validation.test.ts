import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..", "..");

/**
 * Parse semantic version string into comparable parts
 */
function parseSemanticVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
} {
  // Remove 'v' prefix if present
  const cleanVersion = version.startsWith("v") ? version.slice(1) : version;

  const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || undefined,
  };
}

/**
 * Compare two semantic versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const versionA = parseSemanticVersion(a);
  const versionB = parseSemanticVersion(b);

  // Compare major, minor, patch
  if (versionA.major !== versionB.major) {
    return versionA.major - versionB.major;
  }
  if (versionA.minor !== versionB.minor) {
    return versionA.minor - versionB.minor;
  }
  if (versionA.patch !== versionB.patch) {
    return versionA.patch - versionB.patch;
  }

  // Handle prerelease versions
  if (versionA.prerelease && !versionB.prerelease) {
    return -1; // prerelease is lower than release
  }
  if (!versionA.prerelease && versionB.prerelease) {
    return 1; // release is higher than prerelease
  }
  if (versionA.prerelease && versionB.prerelease) {
    return versionA.prerelease.localeCompare(versionB.prerelease);
  }

  return 0;
}

/**
 * Get the latest git tag version
 */
function getLatestGitTag(): string | null {
  try {
    const output = execSync("git tag --sort=-version:refname", {
      cwd: rootDir,
      encoding: "utf8",
    }).trim();

    const tags = output.split("\n").filter((tag) => tag.trim());
    return tags.length > 0 ? tags[0] : null;
  } catch (error) {
    console.warn("Could not get git tags:", error);
    return null;
  }
}

/**
 * Get package.json version
 */
function getPackageVersion(): string {
  const packagePath = join(rootDir, "package.json");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  return packageJson.version;
}

describe("Version Validation", () => {
  let latestTag: string | null;
  let packageVersion: string;

  beforeAll(() => {
    latestTag = getLatestGitTag();
    packageVersion = getPackageVersion();
  });

  describe("Semantic Version Parsing", () => {
    it("should parse standard semantic versions", () => {
      const version = parseSemanticVersion("1.2.3");
      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
    });

    it("should parse versions with 'v' prefix", () => {
      const version = parseSemanticVersion("v1.2.3");
      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
      });
    });

    it("should parse prerelease versions", () => {
      const version = parseSemanticVersion("1.2.3-alpha.1");
      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: "alpha.1",
      });
    });

    it("should throw error for invalid versions", () => {
      expect(() => parseSemanticVersion("invalid")).toThrow(
        "Invalid semantic version",
      );
      expect(() => parseSemanticVersion("1.2")).toThrow(
        "Invalid semantic version",
      );
      expect(() => parseSemanticVersion("1.2.3.4")).toThrow(
        "Invalid semantic version",
      );
    });
  });

  describe("Version Comparison", () => {
    it("should compare major versions correctly", () => {
      expect(compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
      expect(compareVersions("2.0.0", "1.0.0")).toBeGreaterThan(0);
      expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    });

    it("should compare minor versions correctly", () => {
      expect(compareVersions("1.1.0", "1.2.0")).toBeLessThan(0);
      expect(compareVersions("1.2.0", "1.1.0")).toBeGreaterThan(0);
    });

    it("should compare patch versions correctly", () => {
      expect(compareVersions("1.0.1", "1.0.2")).toBeLessThan(0);
      expect(compareVersions("1.0.2", "1.0.1")).toBeGreaterThan(0);
    });

    it("should handle prerelease versions correctly", () => {
      expect(compareVersions("1.0.0-alpha.1", "1.0.0")).toBeLessThan(0);
      expect(compareVersions("1.0.0", "1.0.0-alpha.1")).toBeGreaterThan(0);
      expect(compareVersions("1.0.0-alpha.1", "1.0.0-beta.1")).toBeLessThan(0);
    });

    it("should handle 'v' prefix in comparisons", () => {
      expect(compareVersions("v1.0.0", "1.0.0")).toBe(0);
      expect(compareVersions("1.0.0", "v1.0.0")).toBe(0);
    });
  });

  describe("Package Version Validation", () => {
    it("should have a valid semantic version in package.json", () => {
      expect(() => parseSemanticVersion(packageVersion)).not.toThrow();
      console.log(`Package version: ${packageVersion}`);
    });

    it("should have package version at least as recent as latest git tag", () => {
      if (!latestTag) {
        console.warn("No git tags found, skipping version comparison test");
        return;
      }

      console.log(`Latest git tag: ${latestTag}`);
      console.log(`Package version: ${packageVersion}`);

      const comparison = compareVersions(packageVersion, latestTag);

      if (comparison < 0) {
        console.error(
          `❌ Package version ${packageVersion} is older than latest tag ${latestTag}`,
        );
        console.error(
          "This indicates a version regression. Please update package.json version to be at least as recent as the latest git tag.",
        );
        expect.fail(
          `Package version ${packageVersion} is older than latest tag ${latestTag}. This is a version regression that must be fixed.`,
        );
      }

      if (comparison === 0) {
        console.log("✅ Package version matches latest tag");
      } else {
        console.log("✅ Package version is newer than latest tag");
      }

      expect(comparison).toBeGreaterThanOrEqual(0);
    });

    it("should handle case when no git tags exist", () => {
      // This test ensures the validation doesn't break in repositories without tags
      const mockLatestTag = null;
      const mockPackageVersion = "0.1.0";

      if (mockLatestTag === null) {
        // Should not throw error when no tags exist
        expect(() => parseSemanticVersion(mockPackageVersion)).not.toThrow();
      }
    });

    it("should validate version format consistency", () => {
      // Ensure package.json version follows semantic versioning
      const versionRegex = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/;
      expect(packageVersion).toMatch(versionRegex);
    });
  });

  describe("Edge Cases", () => {
    it("should handle development versions", () => {
      const devVersion = "0.0.0-dev";
      expect(() => parseSemanticVersion(devVersion)).not.toThrow();

      const parsed = parseSemanticVersion(devVersion);
      expect(parsed.prerelease).toBe("dev");
    });

    it("should handle complex prerelease versions", () => {
      const complexVersion = "1.0.0-alpha.1+build.123";
      // Remove build metadata for comparison
      const cleanVersion = complexVersion.split("+")[0];
      expect(() => parseSemanticVersion(cleanVersion)).not.toThrow();

      const parsed = parseSemanticVersion(cleanVersion);
      expect(parsed.prerelease).toBe("alpha.1");
    });

    it("should handle zero versions", () => {
      const zeroVersion = "0.0.0";
      expect(() => parseSemanticVersion(zeroVersion)).not.toThrow();

      const parsed = parseSemanticVersion(zeroVersion);
      expect(parsed.major).toBe(0);
      expect(parsed.minor).toBe(0);
      expect(parsed.patch).toBe(0);
    });
  });
});
