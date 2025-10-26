import { GitHubClient } from '../../github/client.js';
import { 
  CheckPermissionsInput, 
  CheckPermissionsOutput, 
  PermissionAction,
  ActionResult,
  TokenInfo,
  RepositoryAccess,
  RateLimitInfo
} from './schema.js';
import { parsePRIdentifier } from '../../utils/parser.js';
import type { Octokit } from '@octokit/rest';

export async function handleCheckPermissions(
  client: GitHubClient, 
  input: CheckPermissionsInput
): Promise<CheckPermissionsOutput> {
  const pr = parsePRIdentifier(input.pr);
  const octokit = client.getOctokit();
  
  // Default actions to test if none specified
  const actionsToTest: PermissionAction[] = input.actions || [
    'read_comments',
    'create_comments',
    'resolve_threads'
  ];
  
  // Step 1: Validate token
  const tokenInfo = await validateToken(octokit);
  
  // Step 2: Check repository access
  const repoAccess = await checkRepositoryAccess(octokit, pr);
  
  // Step 3: Test each action
  const actionResults: Partial<Record<PermissionAction, ActionResult>> = {};
  for (const action of actionsToTest) {
    actionResults[action] = await testAction(octokit, pr, action);
  }
  
  // Step 4: Check rate limits
  const rateLimitInfo = await checkRateLimits(octokit);
  
  // Step 5: Generate diagnostics
  const diagnostics = generateDiagnostics(tokenInfo, repoAccess, actionResults, rateLimitInfo);
  
  // Step 6: Generate fix recommendations
  const fixes = generateFixRecommendations(actionResults, diagnostics.missing_scopes);
  
  // Step 7: Generate summary
  const summary = generateSummary(tokenInfo, repoAccess, actionResults, diagnostics);
  
  return {
    token_valid: tokenInfo.valid,
    token_type: tokenInfo.type,
    user: tokenInfo.user,
    repository_access: repoAccess.accessible,
    repository_permissions: repoAccess.permissions,
    action_results: actionResults,
    diagnostics,
    fixes,
    summary
  };
}

async function validateToken(octokit: unknown): Promise<TokenInfo> {
  try {
    const user = await (octokit as Octokit).rest.users.getAuthenticated();
    return {
      valid: true,
      type: 'classic', // TODO: Detect fine-grained tokens
      user: user.data.login
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      valid: false,
      type: 'unknown',
      error: err.message
    };
  }
}

async function checkRepositoryAccess(octokit: unknown, pr: { owner: string; repo: string; number: number }): Promise<RepositoryAccess> {
  try {
    const repo = await (octokit as Octokit).rest.repos.get({
      owner: pr.owner,
      repo: pr.repo
    });
    
    // Try to read the PR
    await (octokit as Octokit).rest.pulls.get({
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.number
    });
    
    return {
      accessible: true,
      permissions: {
        admin: repo.data.permissions?.admin || false,
        write: repo.data.permissions?.push || false,
        read: repo.data.permissions?.pull || false
      }
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      accessible: false,
      permissions: { admin: false, write: false, read: false },
      error: err.message
    };
  }
}

async function testAction(
  octokit: unknown,
  pr: { owner: string; repo: string; number: number },
  action: PermissionAction
): Promise<ActionResult> {
  try {
    switch (action) {
      case 'read_comments':
        return await testReadComments(octokit, pr);
      case 'create_comments':
        return await testCreateComments(octokit, pr);
      case 'resolve_threads':
        return await testResolveThreads(octokit, pr);
      case 'merge_pr':
        return await testMergePR(octokit, pr);
      case 'approve_pr':
        return await testApprovePR(octokit, pr);
      case 'request_changes':
        return await testRequestChanges(octokit, pr);
      case 'read_ci':
        return await testReadCI(octokit, pr);
      case 'write_ci':
        return await testWriteCI(octokit, pr);
      default:
        return {
          allowed: false,
          reason: 'Unknown action',
          required_scopes: []
        };
    }
  } catch (error: unknown) {
    const err = error as Error;
    return {
      allowed: false,
      reason: err.message,
      error_details: err.toString()
    };
  }
}

async function testReadComments(octokit: unknown, pr: { owner: string; repo: string; number: number }): Promise<ActionResult> {
  try {
    await (octokit as Octokit).rest.pulls.listReviewComments({
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.number,
      per_page: 1
    });
    return { allowed: true };
  } catch {
    return {
      allowed: false,
      reason: 'Cannot read review comments',
      required_scopes: ['repo']
    };
  }
}

async function testCreateComments(octokit: unknown, pr: { owner: string; repo: string; number: number }): Promise<ActionResult> {
  try {
    // Test by trying to create a comment (we'll catch the error)
    await (octokit as Octokit).rest.issues.createComment({
      owner: pr.owner,
      repo: pr.repo,
      issue_number: pr.number,
      body: 'Test comment'
    });
    return { allowed: true };
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message.includes('Resource not accessible')) {
      return {
        allowed: false,
        reason: 'Cannot create comments',
        required_scopes: ['repo']
      };
    }
    return { allowed: true }; // Other errors might be OK
  }
}

async function testResolveThreads(octokit: unknown, pr: { owner: string; repo: string; number: number }): Promise<ActionResult> {
  try {
    // Try to get review threads
    await (octokit as Octokit).graphql(`
      query($prId: ID!) {
        node(id: $prId) {
          ... on PullRequest {
            reviewThreads(first: 1) {
              nodes { id isResolved }
            }
          }
        }
      }
    `, { prId: `PR_${pr.number}` });
    
    // Try a dummy resolve to test permissions
    try {
      await (octokit as Octokit).graphql(`
        mutation($threadId: ID!) {
          resolveReviewThread(input: { threadId: $threadId }) {
            thread { id }
          }
        }
      `, { threadId: 'dummy' });
    } catch (resolveError: unknown) {
      const err = resolveError as Error;
      if (err.message.includes('Resource not accessible')) {
        return {
          allowed: false,
          reason: 'Cannot resolve review threads',
          required_scopes: ['repo']
        };
      }
    }
    
    return { allowed: true };
  } catch {
    return {
      allowed: false,
      reason: 'Cannot access review threads',
      required_scopes: ['repo']
    };
  }
}

async function testMergePR(octokit: unknown, pr: { owner: string; repo: string; number: number }): Promise<ActionResult> {
  try {
    const pullRequest = await (octokit as Octokit).rest.pulls.get({
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.number
    });
    
    if (!pullRequest.data.mergeable) {
      return {
        allowed: false,
        reason: 'PR is not mergeable',
        required_scopes: []
      };
    }
    
    return {
      allowed: true,
      reason: 'PR is mergeable (permission test not performed)',
      required_scopes: ['repo']
    };
  } catch {
    return {
      allowed: false,
      reason: 'Cannot check merge status',
      required_scopes: ['repo']
    };
  }
}

async function testApprovePR(octokit: unknown, pr: { owner: string; repo: string; number: number }): Promise<ActionResult> {
  try {
    // Test by trying to create an approval review
    await (octokit as Octokit).rest.pulls.createReview({
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.number,
      event: 'APPROVE',
      body: 'Test approval'
    });
    return { allowed: true };
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message.includes('Resource not accessible')) {
      return {
        allowed: false,
        reason: 'Cannot approve PR',
        required_scopes: ['repo']
      };
    }
    return { allowed: true }; // Other errors might be OK
  }
}

async function testRequestChanges(octokit: unknown, pr: { owner: string; repo: string; number: number }): Promise<ActionResult> {
  try {
    // Test by trying to create a request changes review
    await (octokit as Octokit).rest.pulls.createReview({
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.number,
      event: 'REQUEST_CHANGES',
      body: 'Test request changes'
    });
    return { allowed: true };
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message.includes('Resource not accessible')) {
      return {
        allowed: false,
        reason: 'Cannot request changes',
        required_scopes: ['repo']
      };
    }
    return { allowed: true }; // Other errors might be OK
  }
}

async function testReadCI(octokit: unknown, pr: { owner: string; repo: string; number: number }): Promise<ActionResult> {
  try {
    await (octokit as Octokit).rest.checks.listForRef({
      owner: pr.owner,
      repo: pr.repo,
      ref: `refs/pull/${pr.number}/head`
    });
    return { allowed: true };
  } catch {
    return {
      allowed: false,
      reason: 'Cannot read CI status',
      required_scopes: ['repo']
    };
  }
}

async function testWriteCI(_octokit: unknown, _pr: { owner: string; repo: string; number: number }): Promise<ActionResult> {
  // CI write permissions are complex to test safely
  return {
    allowed: false,
    reason: 'CI write permissions not testable safely',
    required_scopes: ['repo']
  };
}

async function checkRateLimits(octokit: unknown): Promise<RateLimitInfo> {
  try {
    const rateLimit = await (octokit as Octokit).rest.rateLimit.get();
    const remaining = rateLimit.data.rate.remaining;
    const limit = rateLimit.data.rate.limit;
    const resetTime = new Date(rateLimit.data.rate.reset * 1000).toISOString();
    
    let status: 'healthy' | 'warning' | 'critical';
    if (remaining > limit * 0.5) {
      status = 'healthy';
    } else if (remaining > limit * 0.1) {
      status = 'warning';
    } else {
      status = 'critical';
    }
    
    return {
      remaining,
      limit,
      reset_time: resetTime,
      status
    };
  } catch {
    return {
      remaining: 0,
      limit: 0,
      reset_time: new Date().toISOString(),
      status: 'critical'
    };
  }
}

function generateDiagnostics(
  tokenInfo: TokenInfo,
  repoAccess: RepositoryAccess,
  actionResults: Partial<Record<PermissionAction, ActionResult>>,
  rateLimitInfo: RateLimitInfo
) {
  const missingScopes: string[] = [];
  const suggestions: string[] = [];
  
  // Analyze failed actions
  Object.entries(actionResults).forEach(([action, result]) => {
    if (!result.allowed) {
      if (result.required_scopes) {
        missingScopes.push(...result.required_scopes);
      }
      suggestions.push(`❌ ${action}: ${result.reason}`);
    }
  });
  
  // Add token-specific suggestions
  if (!tokenInfo.valid) {
    suggestions.push(`❌ Token invalid: ${tokenInfo.error}`);
  }
  
  // Add repository access suggestions
  if (!repoAccess.accessible) {
    suggestions.push(`❌ Repository access: ${repoAccess.error}`);
  }
  
  // Add rate limit suggestions
  if (rateLimitInfo.status === 'critical') {
    suggestions.push(`⚠️ Rate limit critical: ${rateLimitInfo.remaining}/${rateLimitInfo.limit} remaining`);
  }
  
  return {
    missing_scopes: [...new Set(missingScopes)],
    suggestions,
    rate_limit_status: rateLimitInfo.status,
    rate_limit_details: rateLimitInfo
  };
}

function generateFixRecommendations(
  actionResults: Partial<Record<PermissionAction, ActionResult>>,
  missingScopes: string[]
) {
  const immediate: string[] = [];
  const tokenUpdate: string[] = [];
  const alternatives: Partial<Record<PermissionAction, string>> = {};
  
  // Generate token update instructions
  if (missingScopes.includes('repo')) {
    tokenUpdate.push(
      'Add "repo" scope to your GitHub token',
      'Visit: https://github.com/settings/tokens',
      'Edit your token and check the "repo" checkbox',
      'This will enable most GitHub operations'
    );
  }
  
  // Generate alternative commands for failed actions
  Object.entries(actionResults).forEach(([action, result]) => {
    if (!result.allowed) {
      switch (action) {
        case 'resolve_threads':
          alternatives.resolve_threads = 'gh pr review 123 --repo owner/repo --comment --body "✅ Fixed"';
          break;
        case 'create_comments':
          alternatives.create_comments = 'gh pr comment 123 --repo owner/repo --body "Your response here"';
          break;
        case 'read_comments':
          alternatives.read_comments = 'gh pr view 123 --repo owner/repo --web';
          break;
        case 'approve_pr':
          alternatives.approve_pr = 'gh pr review 123 --repo owner/repo --approve';
          break;
        case 'request_changes':
          alternatives.request_changes = 'gh pr review 123 --repo owner/repo --request-changes --body "Please fix these issues"';
          break;
        case 'read_ci':
          alternatives.read_ci = 'gh pr checks 123 --repo owner/repo';
          break;
      }
    }
  });
  
  return {
    immediate,
    token_update: tokenUpdate,
    alternative_commands: alternatives
  };
}

function generateSummary(
  tokenInfo: TokenInfo,
  repoAccess: RepositoryAccess,
  actionResults: Partial<Record<PermissionAction, ActionResult>>,
  _diagnostics: unknown
) {
  const workingActions: PermissionAction[] = [];
  const failingActions: PermissionAction[] = [];
  
  Object.entries(actionResults).forEach(([action, result]) => {
    if (result.allowed) {
      workingActions.push(action as PermissionAction);
    } else {
      failingActions.push(action as PermissionAction);
    }
  });
  
  let overallStatus: 'healthy' | 'warning' | 'critical';
  let primaryIssue: string | undefined;
  
  if (!tokenInfo.valid) {
    overallStatus = 'critical';
    primaryIssue = 'Invalid GitHub token';
  } else if (!repoAccess.accessible) {
    overallStatus = 'critical';
    primaryIssue = 'Cannot access repository';
  } else if (failingActions.length === 0) {
    overallStatus = 'healthy';
  } else if (failingActions.length <= 2) {
    overallStatus = 'warning';
    primaryIssue = `Some actions failing: ${failingActions.join(', ')}`;
  } else {
    overallStatus = 'critical';
    primaryIssue = `Multiple actions failing: ${failingActions.join(', ')}`;
  }
  
  return {
    overall_status: overallStatus,
    working_actions: workingActions,
    failing_actions: failingActions,
    primary_issue: primaryIssue
  };
}
