import type { GitHubClient } from "../../github/client.js";
import { parsePRIdentifier, formatPRIdentifier } from "../../utils/parser.js";
import {
  cursorToGitHubPagination,
  createNextCursor,
} from "../../utils/pagination.js";
import type {
  GetFailingTestsInput,
  GetFailingTestsOutput,
  FailedTest,
} from "./schema.js";
import type { Octokit } from "@octokit/rest";
import type { RestEndpointMethodTypes } from "@octokit/rest";

// Type definitions for GitHub API responses
type CheckRunData =
  RestEndpointMethodTypes["checks"]["get"]["response"]["data"];

/**
 * Get failing tests and CI status for a GitHub pull request
 * @param client - GitHub API client instance
 * @param input - Input parameters including PR identifier and options
 * @returns Promise resolving to failing tests and CI status
 */
export async function handleGetFailingTests(
  client: GitHubClient,
  input: GetFailingTestsInput,
): Promise<GetFailingTestsOutput> {
  const pr = parsePRIdentifier(input.pr);
  const octokit = client.getOctokit();

  // Fetch PR to get head SHA
  const pullRequest = await octokit.pulls.get({
    owner: pr.owner,
    repo: pr.repo,
    pull_number: pr.number,
  });

  const headSha = pullRequest.data.head.sha;

  // Convert cursor to GitHub pagination parameters
  const githubPagination = cursorToGitHubPagination(input.cursor, 10);

  // Get check runs for this commit with server-side pagination
  const checkRunsResponse = await octokit.checks.listForRef({
    owner: pr.owner,
    repo: pr.repo,
    ref: headSha,
    page: githubPagination.page,
    per_page: githubPagination.per_page,
  });

  // Check if there are more results by looking at response headers
  const hasMore =
    checkRunsResponse.headers.link?.includes('rel="next"') ?? false;

  // Create next cursor if there are more results
  const nextCursor = createNextCursor(
    input.cursor,
    githubPagination.per_page,
    hasMore,
  );

  const checkRuns = checkRunsResponse.data;

  // Determine status
  const runs = checkRuns.check_runs;

  if (runs.length === 0) {
    return {
      pr: formatPRIdentifier(pr),
      status: "unknown",
      failures: [],
      nextCursor,
      instructions: {
        summary: "No CI checks configured for this PR",
        commands: [],
      },
    };
  }

  const pending = runs.filter((r) => r.status !== "completed");
  const failed = runs.filter(
    (r) => r.status === "completed" && r.conclusion === "failure",
  );

  // If waiting and still pending
  if (input.wait && pending.length > 0) {
    return {
      pr: formatPRIdentifier(pr),
      status: "running",
      failures: [],
      nextCursor,
      instructions: {
        summary: `CI still running (${pending.length} checks pending)`,
        commands: [],
      },
      poll_info: {
        message: "CI is still running. Check back in 30 seconds.",
        retry_after_seconds: 30,
      },
    };
  }

  // Extract failures from failed checks with detailed error information
  const failures: FailedTest[] = [];

  for (const run of failed) {
    // Get detailed check run information
    const detailedRun = await octokit.checks.get({
      owner: pr.owner,
      repo: pr.repo,
      check_run_id: run.id,
    });

    const detailedData = detailedRun.data;

    // Extract more detailed error information
    const errorMessage = input.detailed_logs
      ? await extractDetailedErrorMessageWithLogs(octokit, pr, detailedData)
      : extractDetailedErrorMessage(detailedData);
    const testName = extractTestName(detailedData);

    failures.push({
      check_name: run.name,
      test_name: testName,
      error_message: errorMessage,
      log_url: run.html_url || "",
      confidence: "high",
    });

    // Bail on first if requested
    if (input.bail_on_first && input.wait && failures.length > 0) {
      break;
    }
  }

  // Determine overall status
  let status: GetFailingTestsOutput["status"];
  if (failed.length > 0) {
    status = "failed";
  } else if (pending.length > 0) {
    status = "running";
  } else if (
    runs.every((r) => r.status === "completed" && r.conclusion === "success")
  ) {
    status = "passed";
  } else {
    status = "unknown";
  }

  return {
    pr: formatPRIdentifier(pr),
    status,
    failures,
    nextCursor,
    instructions: {
      summary:
        failures.length > 0
          ? `${failures.length} test${failures.length === 1 ? "" : "s"} failed`
          : "All tests passed",
      commands:
        failures.length > 0
          ? ["Review the failures above and fix the failing tests"]
          : [],
    },
  };
}

/**
 * Extract detailed error message with workflow run logs
 * @param octokit - GitHub API client
 * @param pr - Parsed PR identifier
 * @param checkRun - Detailed check run data from GitHub API
 * @returns Formatted error message with specific test failures from logs
 */
async function extractDetailedErrorMessageWithLogs(
  octokit: Octokit,
  pr: { owner: string; repo: string; number: number },
  checkRun: CheckRunData,
): Promise<string> {
  try {
    // First get basic error info
    let errorMessage = extractDetailedErrorMessage(checkRun);

    // Try to get workflow run logs if this is a workflow run
    if (checkRun.external_id) {
      // This is likely a workflow run, try to get the workflow run ID
      const workflowRuns = await octokit.actions.listWorkflowRunsForRepo({
        owner: pr.owner,
        repo: pr.repo,
        event: "pull_request",
        per_page: 10,
      });

      // Find the workflow run for this PR
      const matchingRun = workflowRuns.data.workflow_runs.find((run) =>
        run.pull_requests?.some((prRef) => prRef.number === pr.number),
      );

      if (matchingRun) {
        try {
          // Download workflow run logs
          const logsResponse = await octokit.actions.downloadWorkflowRunLogs({
            owner: pr.owner,
            repo: pr.repo,
            run_id: matchingRun.id,
          });

          // Parse logs for specific test failures
          const logFailures = parseWorkflowLogs(logsResponse.data as Buffer);
          if (logFailures.length > 0) {
            errorMessage += "\n\n**Detailed Log Analysis:**";
            errorMessage +=
              "\n" + logFailures.map((failure) => `- ${failure}`).join("\n");
          }
        } catch (logError) {
          // If we can't get logs, fall back to basic error message
          console.warn("Could not fetch workflow logs:", logError);
        }
      }
    }

    return errorMessage;
  } catch {
    // Fall back to basic error extraction
    return extractDetailedErrorMessage(checkRun);
  }
}

/**
 * Parse workflow run logs to extract test failures
 * @param _logsData - Raw logs data (ZIP buffer)
 * @returns Array of specific test failure messages
 */
function parseWorkflowLogs(_logsData: Buffer): string[] {
  // For now, return empty array since we'd need JSZip to parse ZIP files
  // This is a placeholder for future enhancement
  // TODO: Implement ZIP parsing with JSZip to extract specific test failures
  return [];
}

/**
 * Extract detailed error message from check run data
 * @param checkRun - Detailed check run data from GitHub API
 * @returns Formatted error message with last few lines of output
 */
function extractDetailedErrorMessage(checkRun: CheckRunData): string {
  const output = checkRun.output;
  if (!output) {
    return "No error details available";
  }

  // Combine title, summary, and last few lines of text
  const parts: string[] = [];

  if (output.title) {
    parts.push(`**${output.title}**`);
  }

  if (output.summary) {
    parts.push(output.summary);
  }

  if (output.text) {
    // Show last few lines of the output without interpretation
    const lines = output.text.split("\n");
    const lastLines = lines.slice(-5).filter((line) => line.trim()); // Last 5 non-empty lines

    if (lastLines.length > 0) {
      parts.push("\n**Last few lines of output:**");
      parts.push("```");
      parts.push(...lastLines);
      parts.push("```");
    }
  }

  return parts.join("\n\n") || "No details available";
}

/**
 * Extract test name from check run data
 * @param checkRun - Detailed check run data from GitHub API
 * @returns Specific test name or fallback
 */
function extractTestName(checkRun: CheckRunData): string {
  const output = checkRun.output;
  if (!output) {
    return "Unknown test";
  }

  // Try to extract specific test name from title or text
  if (output.title) {
    // Use the title directly as it's usually a good test name
    return output.title;
  }

  // Extract from text if available
  if (output.text) {
    const testMatch = output.text.match(/(?:FAIL|Error|Test)\s+([^\s\n\r]+)/i);
    if (testMatch) {
      return testMatch[1].trim();
    }
  }

  return output.title || "Unknown test";
}
