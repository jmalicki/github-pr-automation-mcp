/**
 * Parallel request handling for GitHub API
 *
 * Batches related API calls to improve performance and reduce
 * the number of round trips to GitHub's API.
 */

import type { GitHubClient } from "./client.js";
import { parsePRIdentifier } from "../utils/parser.js";

export interface BatchRequest<T> {
  key: string;
  fn: () => Promise<T>;
  priority: "high" | "normal" | "low";
}

export interface BatchResult<T> {
  key: string;
  data?: T;
  error?: Error;
}

export class ParallelRequestHandler {
  private client: GitHubClient;
  private maxConcurrency: number;

  constructor(client: GitHubClient, maxConcurrency = 5) {
    this.client = client;
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * Execute multiple requests in parallel with concurrency control
   */
  async executeBatch<T>(
    requests: BatchRequest<T>[],
  ): Promise<BatchResult<T>[]> {
    const results: BatchResult<T>[] = [];

    // Sort by priority
    const sortedRequests = requests.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Process in chunks to control concurrency
    for (let i = 0; i < sortedRequests.length; i += this.maxConcurrency) {
      const chunk = sortedRequests.slice(i, i + this.maxConcurrency);
      const chunkPromises = chunk.map((request) =>
        this.executeRequest(request),
      );
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Execute a single request
   */
  private async executeRequest<T>(
    request: BatchRequest<T>,
  ): Promise<BatchResult<T>> {
    try {
      const data = await request.fn();
      return { key: request.key, data };
    } catch (error) {
      return {
        key: request.key,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Batch PR metadata requests
   */
  async batchPRMetadata(prs: string[]): Promise<BatchResult<unknown>[]> {
    const requests: BatchRequest<unknown>[] = prs.map((pr) => ({
      key: pr,
      fn: () => {
        const parsed = parsePRIdentifier(pr);
        return this.client.getPullRequest(parsed);
      },
      priority: "high" as const,
    }));

    return this.executeBatch(requests);
  }

  /**
   * Batch check runs requests
   */
  async batchCheckRuns(
    commits: Array<{ owner: string; repo: string; sha: string }>,
  ): Promise<BatchResult<unknown>[]> {
    const requests: BatchRequest<unknown>[] = commits.map((commit) => ({
      key: `${commit.owner}/${commit.repo}@${commit.sha}`,
      fn: () =>
        this.client.getOctokit().rest.checks.listForRef({
          owner: commit.owner,
          repo: commit.repo,
          ref: commit.sha,
        }),
      priority: "normal" as const,
    }));

    return this.executeBatch(requests);
  }

  /**
   * Batch comment requests
   */
  async batchComments(
    prs: Array<{ owner: string; repo: string; number: number }>,
  ): Promise<BatchResult<unknown>[]> {
    const requests: BatchRequest<unknown>[] = prs.map((pr) => ({
      key: `${pr.owner}/${pr.repo}#${pr.number}`,
      fn: () =>
        this.client.getOctokit().rest.issues.listComments({
          owner: pr.owner,
          repo: pr.repo,
          issue_number: pr.number,
        }),
      priority: "normal" as const,
    }));

    return this.executeBatch(requests);
  }
}

/**
 * Create a parallel request handler for a GitHub client
 */
export function createParallelHandler(
  client: GitHubClient,
  maxConcurrency = 5,
): ParallelRequestHandler {
  return new ParallelRequestHandler(client, maxConcurrency);
}
