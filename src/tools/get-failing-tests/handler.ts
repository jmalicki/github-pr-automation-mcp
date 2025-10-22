import type { GitHubClient } from '../../github/client.js';
import { parsePRIdentifier, formatPRIdentifier } from '../../utils/parser.js';
import { cursorToGitHubPagination, createNextCursor } from '../../utils/pagination.js';
import type { GetFailingTestsInput, GetFailingTestsOutput, FailedTest } from './schema.js';

export async function handleGetFailingTests(
  client: GitHubClient,
  input: GetFailingTestsInput
): Promise<GetFailingTestsOutput> {
  const pr = parsePRIdentifier(input.pr);
  const octokit = client.getOctokit();
  
  // Fetch PR to get head SHA
  const pullRequest = await octokit.pulls.get({
    owner: pr.owner,
    repo: pr.repo,
    pull_number: pr.number
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
    per_page: githubPagination.per_page
  });
  
  // Check if there are more results by looking at response headers
  const hasMore = checkRunsResponse.headers.link?.includes('rel="next"') ?? false;
  
  // Create next cursor if there are more results
  const nextCursor = createNextCursor(input.cursor, githubPagination.per_page, hasMore);
  
  const checkRuns = checkRunsResponse.data;
  
  // Determine status
  const runs = checkRuns.check_runs;
  
  if (runs.length === 0) {
    return {
      pr: formatPRIdentifier(pr),
      status: 'unknown',
      failures: [],
      nextCursor,
      instructions: {
        summary: 'No CI checks configured for this PR',
        commands: []
      }
    };
  }
  
  const pending = runs.filter(r => r.status !== 'completed');
  const failed = runs.filter(r => 
    r.status === 'completed' && r.conclusion === 'failure'
  );
  
  // If waiting and still pending
  if (input.wait && pending.length > 0) {
    return {
      pr: formatPRIdentifier(pr),
      status: 'running',
      failures: [],
      nextCursor,
      instructions: {
        summary: `CI still running (${pending.length} checks pending)`,
        commands: []
      },
      poll_info: {
        message: 'CI is still running. Check back in 30 seconds.',
        retry_after_seconds: 30
      }
    };
  }
  
  // Extract failures from failed checks
  const failures: FailedTest[] = [];
  
  for (const run of failed) {
    // Basic failure extraction (enhanced in later phases)
    failures.push({
      check_name: run.name,
      test_name: run.output?.title || 'Unknown test',
      error_message: run.output?.summary || 'No details available',
      log_url: run.html_url || '',
      confidence: 'medium'
    });
    
    // Bail on first if requested
    if (input.bail_on_first && input.wait && failures.length > 0) {
      break;
    }
  }
  
  // Determine overall status
  let status: GetFailingTestsOutput['status'];
  if (failed.length > 0) {
    status = 'failed';
  } else if (pending.length > 0) {
    status = 'running';
  } else if (runs.every(r => r.status === 'completed' && r.conclusion === 'success')) {
    status = 'passed';
  } else {
    status = 'unknown';
  }
  
  return {
    pr: formatPRIdentifier(pr),
    status,
    failures,
    nextCursor,
    instructions: {
      summary: failures.length > 0 
        ? `${failures.length} test${failures.length === 1 ? '' : 's'} failed`
        : 'All tests passed',
      commands: failures.length > 0
        ? ['Review the failures above and fix the failing tests']
        : []
    }
  };
}

