import type { GitHubClient } from "../../github/client.js";
import { parsePRIdentifier, formatPRIdentifier } from "../../utils/parser.js";

export interface CheckMergeReadinessInput {
  pr: string;
}

export interface CheckMergeReadinessOutput {
  pr: string;
  ready_to_merge: boolean;
  checks: {
    ci_passing: boolean;
    approvals_met: boolean;
    no_conflicts: boolean;
    up_to_date: boolean;
  };
  blocking_issues: Array<{
    category: string;
    description: string;
    action_required: string;
  }>;
  next_steps: Array<{
    action: string;
    description: string;
  }>;
}

export async function handleCheckMergeReadiness(
  client: GitHubClient,
  input: CheckMergeReadinessInput,
): Promise<CheckMergeReadinessOutput> {
  const pr = parsePRIdentifier(input.pr);
  const octokit = client.getOctokit();

  // Fetch PR and check runs
  const [pullRequest, checkRuns] = await Promise.all([
    octokit.pulls.get({
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.number,
    }),
    octokit.checks.listForRef({
      owner: pr.owner,
      repo: pr.repo,
      ref: (
        await octokit.pulls.get({
          owner: pr.owner,
          repo: pr.repo,
          pull_number: pr.number,
        })
      ).data.head.sha,
    }),
  ]);

  const data = pullRequest.data;

  // Check CI status
  const ciPassing =
    checkRuns.data.check_runs.length === 0 ||
    checkRuns.data.check_runs.every(
      (r) => r.status === "completed" && r.conclusion === "success",
    );

  // Check conflicts
  const noConflicts = data.mergeable !== false;

  // Simple checks (enhanced in later phases)
  const checks = {
    ci_passing: ciPassing,
    approvals_met: true, // Simplified - would need branch protection rules
    no_conflicts: noConflicts,
    up_to_date: true, // Simplified
  };

  const blockingIssues: CheckMergeReadinessOutput["blocking_issues"] = [];
  const nextSteps: CheckMergeReadinessOutput["next_steps"] = [];

  if (!ciPassing) {
    blockingIssues.push({
      category: "ci",
      description: "CI checks are failing",
      action_required: "Fix failing tests",
    });
    nextSteps.push({
      action: "fix_ci",
      description: "Review and fix failing CI checks",
    });
  }

  if (!noConflicts) {
    blockingIssues.push({
      category: "conflicts",
      description: "PR has merge conflicts",
      action_required: "Resolve conflicts with base branch",
    });
    nextSteps.push({
      action: "resolve_conflicts",
      description: "Merge or rebase with base branch to resolve conflicts",
    });
  }

  // If ready to merge, provide merge action
  if (Object.values(checks).every((v) => v)) {
    nextSteps.push({
      action: "merge",
      description: "PR is ready to merge",
    });
  }

  return {
    pr: formatPRIdentifier(pr),
    ready_to_merge: Object.values(checks).every((v) => v),
    checks,
    blocking_issues: blockingIssues,
    next_steps: nextSteps,
  };
}
