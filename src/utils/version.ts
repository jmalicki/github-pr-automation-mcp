/**
 * Version information module
 * This module provides access to build-time version information including git revision
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

export interface VersionInfo {
  version: string;
  gitRevision: string;
  gitFullRevision: string;
  isDirty: boolean;
  buildDate: string;
  buildTimestamp: number;
}

let versionInfo: VersionInfo | null = null;

function loadVersionInfo(): VersionInfo {
  if (versionInfo) {
    return versionInfo;
  }

  try {
    // Get the directory of the current module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const versionInfoPath = join(__dirname, "version-info.json");

    // Read the generated version info
    const versionData = readFileSync(versionInfoPath, "utf8");
    versionInfo = JSON.parse(versionData) as VersionInfo;
    return versionInfo;
  } catch (error) {
    // Fallback if version-info.json doesn't exist (e.g., during development or testing)
    // Only show warning if not in test environment
    if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
      console.warn(
        "Could not load version-info.json, using fallback version info:",
        error instanceof Error ? error.message : String(error),
      );
    }
    versionInfo = {
      version: "0.0.0-dev",
      gitRevision: "unknown",
      gitFullRevision: "unknown",
      isDirty: false,
      buildDate: new Date().toISOString(),
      buildTimestamp: Date.now(),
    };
    return versionInfo;
  }
}

export function getVersionInfo(): VersionInfo {
  return loadVersionInfo();
}

export function getVersionString(): string {
  const info = getVersionInfo();
  const dirtySuffix = info.isDirty ? "-dirty" : "";
  return `${info.version}+${info.gitRevision}${dirtySuffix}`;
}

export function getFullVersionString(): string {
  const info = getVersionInfo();
  const dirtySuffix = info.isDirty ? "-dirty" : "";
  return `${info.version}+${info.gitFullRevision}${dirtySuffix}`;
}
