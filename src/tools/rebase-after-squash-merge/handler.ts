import type { GitHubClient } from "../../github/client.js";
import { parsePRIdentifier, formatPRIdentifier } from "../../utils/parser.js";

export interface RebaseAfterSquashMergeInput {
  pr: string;
  upstream_pr?: string;
  target_branch?: string;
}

export interface RebaseAfterSquashMergeOutput {
  pr: string;
  analysis: {
    upstream_pr?: string;
    detected_squash_merge: boolean;
  };
  commands: Array<{
    step: number;
    command: string;
    description: string;
  }>;
  summary: {
    action_required: boolean;
    reason: string;
  };
}

export async function handleRebaseAfterSquashMerge(
  client: GitHubClient,
  input: RebaseAfterSquashMergeInput,
): Promise<RebaseAfterSquashMergeOutput> {
  const pr = parsePRIdentifier(input.pr);
  const octokit = client.getOctokit();

  const { data } = await octokit.pulls.get({
    owner: pr.owner,
    repo: pr.repo,
    pull_number: pr.number,
  });

  const targetBranch = input.target_branch || data.base.ref;

  // Basic implementation - enhanced in optimization phase
  const commands = [
    {
      step: 1,
      command: "git fetch origin",
      description: "Fetch latest changes from remote",
    },
    {
      step: 2,
      command: `git rebase --onto origin/${targetBranch} <last-upstream-commit> ${data.head.ref}`,
      description:
        "Rebase using --onto to skip squash-merged commits (replace <last-upstream-commit> with actual SHA)",
    },
    {
      step: 3,
      command: `git push --force-with-lease origin ${data.head.ref}`,
      description: "Update remote branch",
    },
  ];

  return {
    pr: formatPRIdentifier(pr),
    analysis: {
      upstream_pr: input.upstream_pr,
      detected_squash_merge: false, // Enhanced detection in optimization phase
    },
    commands,
    summary: {
      action_required: true,
      reason: "Manual upstream commit identification needed in this phase",
    },
  };
}
