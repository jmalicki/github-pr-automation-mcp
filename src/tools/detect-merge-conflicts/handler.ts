import type { GitHubClient } from "../../github/client.js";
import { parsePRIdentifier, formatPRIdentifier } from "../../utils/parser.js";

export interface DetectMergeConflictsInput {
  pr: string;
  target_branch?: string;
}

export interface DetectMergeConflictsOutput {
  pr: string;
  has_conflicts: boolean;
  mergeable_state: string;
  message: string;
  target_branch?: string;
}

/**
 * Detect merge conflicts in a pull request
 * @param client - GitHub client instance
 * @param input - Input containing PR identifier and optional target branch
 * @returns Promise resolving to merge conflict status
 */
export async function handleDetectMergeConflicts(
  client: GitHubClient,
  input: DetectMergeConflictsInput,
): Promise<DetectMergeConflictsOutput> {
  const pr = parsePRIdentifier(input.pr);
  const octokit = client.getOctokit();

  const { data } = await octokit.pulls.get({
    owner: pr.owner,
    repo: pr.repo,
    pull_number: pr.number,
  });

  const hasConflicts = data.mergeable === false;
  const mergeableState = data.mergeable_state || "unknown";

  let message: string;
  if (hasConflicts) {
    message = "PR has merge conflicts that must be resolved";
  } else if (data.mergeable === true) {
    message = "PR has no conflicts and is ready to merge";
  } else {
    message = "Merge status is being calculated by GitHub";
  }

  return {
    pr: formatPRIdentifier(pr),
    has_conflicts: hasConflicts,
    mergeable_state: mergeableState,
    message,
    target_branch: input.target_branch,
  };
}
