import type { GitHubClient } from '../../github/client.js';
import { parsePRIdentifier, formatPRIdentifier } from '../../utils/parser.js';

export interface AnalyzePRImpactInput {
  pr: string;
  depth?: 'summary' | 'detailed';
}

export interface AnalyzePRImpactOutput {
  pr: string;
  changes: {
    files_changed: number;
    additions: number;
    deletions: number;
    commits: number;
  };
  impact_areas: Array<{
    category: string;
    files: string[];
    risk_level: 'low' | 'medium' | 'high';
  }>;
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
}

export async function handleAnalyzePRImpact(
  client: GitHubClient,
  input: AnalyzePRImpactInput
): Promise<AnalyzePRImpactOutput> {
  const pr = parsePRIdentifier(input.pr);
  const octokit = client.getOctokit();
  
  const { data } = await octokit.pulls.get({
    owner: pr.owner,
    repo: pr.repo,
    pull_number: pr.number
  });
  
  // Get files changed
  const files = await octokit.paginate(
    octokit.pulls.listFiles,
    {
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.number
    }
  );
  
  // Categorize files (simple heuristics)
  const impactAreas: AnalyzePRImpactOutput['impact_areas'] = [];
  const testFiles = files.filter(f => f.filename.includes('test'));
  const srcFiles = files.filter(f => !f.filename.includes('test') && !f.filename.includes('docs'));
  
  if (testFiles.length > 0) {
    impactAreas.push({
      category: 'tests',
      files: testFiles.map(f => f.filename),
      risk_level: 'low'
    });
  }
  
  if (srcFiles.length > 0) {
    impactAreas.push({
      category: 'code',
      files: srcFiles.map(f => f.filename),
      risk_level: srcFiles.length > 20 ? 'high' : 'medium'
    });
  }
  
  // Assess overall risk
  let overallRisk: AnalyzePRImpactOutput['overall_risk'];
  if (data.changed_files > 50 || data.additions > 1000) {
    overallRisk = 'critical';
  } else if (data.changed_files > 20 || data.additions > 500) {
    overallRisk = 'high';
  } else if (data.changed_files > 10) {
    overallRisk = 'medium';
  } else {
    overallRisk = 'low';
  }
  
  return {
    pr: formatPRIdentifier(pr),
    changes: {
      files_changed: data.changed_files,
      additions: data.additions,
      deletions: data.deletions,
      commits: data.commits
    },
    impact_areas: impactAreas,
    overall_risk: overallRisk
  };
}

