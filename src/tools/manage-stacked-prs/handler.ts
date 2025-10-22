import type { GitHubClient } from '../../github/client.js';
import { parsePRIdentifier, formatPRIdentifier } from '../../utils/parser.js';
import { paginateResults } from '../../utils/pagination.js';
import type { ManageStackedPRsInput, ManageStackedPRsOutput, Command } from './schema.js';

export async function handleManageStackedPRs(
  client: GitHubClient,
  input: ManageStackedPRsInput
): Promise<ManageStackedPRsOutput> {
  const basePR = parsePRIdentifier(input.base_pr);
  const dependentPR = parsePRIdentifier(input.dependent_pr);
  const octokit = client.getOctokit();
  
  // Verify same repository
  if (basePR.owner !== dependentPR.owner || basePR.repo !== dependentPR.repo) {
    throw new Error('PRs must be in the same repository');
  }
  
  // Fetch both PRs
  const [base, dependent] = await Promise.all([
    octokit.pulls.get({ owner: basePR.owner, repo: basePR.repo, pull_number: basePR.number }),
    octokit.pulls.get({ owner: dependentPR.owner, repo: dependentPR.repo, pull_number: dependentPR.number })
  ]);
  
  const baseHeadBranch = base.data.head.ref;
  const dependentBaseBranch = dependent.data.base.ref;
  const isStacked = baseHeadBranch === dependentBaseBranch;
  
  // Compare commits to see if there are new changes
  const comparison = await octokit.repos.compareCommits({
    owner: basePR.owner,
    repo: basePR.repo,
    base: dependent.data.head.sha,
    head: base.data.head.sha
  });
  
  const newCommits = comparison.data.ahead_by;
  const changesDetected = newCommits > 0;
  
  // Build commands for rebase
  const commands: Command[] = [];
  
  if (changesDetected && isStacked) {
    commands.push({
      step: 1,
      type: 'git',
      command: `git fetch origin pull/${basePR.number}/head:pr-${basePR.number}`,
      description: `Fetch latest changes from base PR #${basePR.number}`,
      can_automate: true
    });
    
    commands.push({
      step: 2,
      type: 'git',
      command: `git checkout pr-${dependentPR.number}`,
      description: `Switch to dependent PR #${dependentPR.number} branch`,
      can_automate: true
    });
    
    // Decide rebase strategy
    const useOnto = input.use_onto ?? false; // Simple for now, enhanced in later phases
    
    if (useOnto && input.onto_base) {
      commands.push({
        step: 3,
        type: 'git',
        command: `git rebase --onto origin/${input.onto_base} pr-${basePR.number} pr-${dependentPR.number}`,
        description: `Rebase using --onto to skip base PR commits`,
        can_automate: true
      });
    } else {
      commands.push({
        step: 3,
        type: 'git',
        command: `git rebase pr-${basePR.number}`,
        description: `Rebase PR #${dependentPR.number} onto updated PR #${basePR.number}`,
        can_automate: true
      });
    }
    
    commands.push({
      step: 4,
      type: 'git',
      command: `git push --force-with-lease origin ${dependent.data.head.ref}`,
      description: 'Push rebased branch',
      can_automate: true
    });
  }
  
  // Paginate commands
  const paginated = paginateResults(commands, input.page, input.page_size);
  
  // Create visualization
  const visualization = isStacked
    ? `${base.data.base.ref} ← PR #${basePR.number} (${baseHeadBranch}) ← PR #${dependentPR.number}`
    : `Not stacked: PR #${dependentPR.number} base is ${dependentBaseBranch}, not ${baseHeadBranch}`;
  
  return {
    base_pr: formatPRIdentifier(basePR),
    dependent_pr: formatPRIdentifier(dependentPR),
    is_stacked: isStacked,
    stack_info: {
      base_branch: baseHeadBranch,
      dependent_base: dependentBaseBranch,
      matches: isStacked,
      visualization
    },
    changes_detected: changesDetected,
    change_summary: changesDetected ? {
      new_commits_in_base: newCommits,
      commits: comparison.data.commits.map(c => ({
        sha: c.sha.substring(0, 7),
        message: c.commit.message.split('\n')[0],
        author: c.commit.author?.name || 'unknown'
      })),
      files_changed: comparison.data.files?.map(f => f.filename) || []
    } : undefined,
    commands: paginated.items,
    pagination: paginated.pagination,
    summary: {
      action_required: changesDetected && isStacked,
      reason: changesDetected 
        ? `Base PR has ${newCommits} new commit${newCommits === 1 ? '' : 's'}` 
        : 'No new changes in base PR',
      estimated_total_time: changesDetected ? '5-10 minutes' : '0 minutes',
      risk_level: changesDetected ? 'medium' : 'low'
    }
  };
}

