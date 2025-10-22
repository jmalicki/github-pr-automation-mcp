import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAnalyzePRImpact } from '../../src/tools/analyze-pr-impact/handler.js';
import { GitHubClient } from '../../src/github/client.js';

describe('handleAnalyzePRImpact', () => {
  let mockClient: GitHubClient;
  let mockOctokit: any;

  beforeEach(() => {
    mockOctokit = {
      pulls: {
        get: vi.fn(),
        listFiles: vi.fn()
      }
    };

    mockClient = {
      getOctokit: () => mockOctokit
    } as any;
  });

  it('should analyze PR impact with server-side pagination', async () => {
    // Mock PR data
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        changed_files: 5,
        additions: 100,
        deletions: 50,
        commits: 3
      }
    });

    // Mock files response
    mockOctokit.pulls.listFiles.mockResolvedValue({
      data: [
        { filename: 'src/file1.ts', status: 'modified' },
        { filename: 'src/file2.ts', status: 'added' },
        { filename: 'tests/test1.test.ts', status: 'added' },
        { filename: 'docs/README.md', status: 'modified' }
      ],
      headers: { link: '' } // No next page
    });

    const result = await handleAnalyzePRImpact(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.pr).toBe('owner/repo#123');
    expect(result.changes.files_changed).toBe(5);
    expect(result.changes.additions).toBe(100);
    expect(result.changes.deletions).toBe(50);
    expect(result.changes.commits).toBe(3);
    expect(result.impact_areas).toHaveLength(2);
    expect(result.impact_areas[0].category).toBe('tests');
    expect(result.impact_areas[1].category).toBe('code');
    expect(result.overall_risk).toBe('low');
    expect(result.nextCursor).toBeUndefined();
  });

  it('should handle pagination with next cursor', async () => {
    // Mock PR data
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        changed_files: 25,
        additions: 100,
        deletions: 50,
        commits: 3
      }
    });

    // Mock files response with next page
    mockOctokit.pulls.listFiles.mockResolvedValue({
      data: [
        { filename: 'src/file1.ts', status: 'modified' },
        { filename: 'src/file2.ts', status: 'added' }
      ],
      headers: { link: '<https://api.github.com/repos/owner/repo/pulls/123/files?page=2>; rel="next"' }
    });

    const result = await handleAnalyzePRImpact(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.changes.files_changed).toBe(25);
    expect(result.nextCursor).toBeDefined();
  });

  it('should handle cursor-based pagination', async () => {
    // Mock PR data
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        changed_files: 25,
        additions: 100,
        deletions: 50,
        commits: 3
      }
    });

    // Mock files response for second page
    mockOctokit.pulls.listFiles.mockResolvedValue({
      data: [
        { filename: 'src/file3.ts', status: 'modified' },
        { filename: 'src/file4.ts', status: 'deleted' }
      ],
      headers: { link: '' } // No next page
    });

    const cursor = Buffer.from(JSON.stringify({ offset: 20, pageSize: 20 })).toString('base64');
    const result = await handleAnalyzePRImpact(mockClient, {
      pr: 'owner/repo#123',
      cursor
    });

    expect(result.impact_areas).toHaveLength(1);
    expect(result.impact_areas[0].category).toBe('code');
    expect(result.nextCursor).toBeUndefined();
    
    // Verify the correct page was requested
    expect(mockOctokit.pulls.listFiles).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      pull_number: 123,
      page: 2,
      per_page: 20
    });
  });

  it('should categorize files correctly', async () => {
    // Mock PR data
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        changed_files: 10,
        additions: 100,
        deletions: 50,
        commits: 3
      }
    });

    // Mock files response with mixed types
    mockOctokit.pulls.listFiles.mockResolvedValue({
      data: [
        { filename: 'src/core.ts', status: 'modified' },
        { filename: 'src/utils.ts', status: 'added' },
        { filename: 'tests/core.test.ts', status: 'added' },
        { filename: 'tests/utils.test.ts', status: 'modified' },
        { filename: 'docs/API.md', status: 'modified' },
        { filename: 'README.md', status: 'modified' }
      ],
      headers: { link: '' }
    });

    const result = await handleAnalyzePRImpact(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.impact_areas).toHaveLength(2);
    
    const testArea = result.impact_areas.find(area => area.category === 'tests');
    const codeArea = result.impact_areas.find(area => area.category === 'code');
    
    expect(testArea).toBeDefined();
    expect(testArea!.files).toHaveLength(2);
    expect(testArea!.files).toContain('tests/core.test.ts');
    expect(testArea!.files).toContain('tests/utils.test.ts');
    expect(testArea!.risk_level).toBe('low');
    
    expect(codeArea).toBeDefined();
    expect(codeArea!.files).toHaveLength(3);
    expect(codeArea!.files).toContain('src/core.ts');
    expect(codeArea!.files).toContain('src/utils.ts');
    expect(codeArea!.files).toContain('README.md');
    expect(codeArea!.risk_level).toBe('medium');
  });

  it('should assess risk levels correctly', async () => {
    // Test low risk
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        changed_files: 5,
        additions: 50,
        deletions: 25,
        commits: 1
      }
    });

    mockOctokit.pulls.listFiles.mockResolvedValue({
      data: [
        { filename: 'src/file1.ts', status: 'modified' }
      ],
      headers: { link: '' }
    });

    const lowRiskResult = await handleAnalyzePRImpact(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(lowRiskResult.overall_risk).toBe('low');

    // Test medium risk
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        changed_files: 15,
        additions: 200,
        deletions: 100,
        commits: 2
      }
    });

    const mediumRiskResult = await handleAnalyzePRImpact(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(mediumRiskResult.overall_risk).toBe('medium');

    // Test high risk
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        changed_files: 25,
        additions: 600,
        deletions: 300,
        commits: 5
      }
    });

    const highRiskResult = await handleAnalyzePRImpact(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(highRiskResult.overall_risk).toBe('high');

    // Test critical risk
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        changed_files: 60,
        additions: 1200,
        deletions: 600,
        commits: 10
      }
    });

    const criticalRiskResult = await handleAnalyzePRImpact(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(criticalRiskResult.overall_risk).toBe('critical');
  });

  it('should handle depth parameter', async () => {
    // Mock PR data
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        changed_files: 5,
        additions: 100,
        deletions: 50,
        commits: 3
      }
    });

    // Mock files response
    mockOctokit.pulls.listFiles.mockResolvedValue({
      data: [
        { filename: 'src/file1.ts', status: 'modified' }
      ],
      headers: { link: '' }
    });

    const result = await handleAnalyzePRImpact(mockClient, {
      pr: 'owner/repo#123',
      depth: 'detailed'
    });

    expect(result.pr).toBe('owner/repo#123');
    expect(result.changes.files_changed).toBe(5);
  });

  it('should handle empty files list', async () => {
    // Mock PR data
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        changed_files: 0,
        additions: 0,
        deletions: 0,
        commits: 0
      }
    });

    // Mock empty files response
    mockOctokit.pulls.listFiles.mockResolvedValue({
      data: [],
      headers: { link: '' }
    });

    const result = await handleAnalyzePRImpact(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.impact_areas).toHaveLength(0);
    expect(result.overall_risk).toBe('low');
    expect(result.nextCursor).toBeUndefined();
  });

  it('should handle large PRs with multiple pages', async () => {
    // Mock PR data for large PR
    mockOctokit.pulls.get.mockResolvedValue({
      data: {
        changed_files: 100,
        additions: 2000,
        deletions: 1000,
        commits: 20
      }
    });

    // Mock files response with next page
    mockOctokit.pulls.listFiles.mockResolvedValue({
      data: Array.from({ length: 20 }, (_, i) => ({
        filename: `src/file${i}.ts`,
        status: 'modified'
      })),
      headers: { link: '<https://api.github.com/repos/owner/repo/pulls/123/files?page=2>; rel="next"' }
    });

    const result = await handleAnalyzePRImpact(mockClient, {
      pr: 'owner/repo#123'
    });

    expect(result.changes.files_changed).toBe(100);
    expect(result.overall_risk).toBe('critical');
    expect(result.nextCursor).toBeDefined();
    expect(result.impact_areas).toHaveLength(1);
    expect(result.impact_areas[0].category).toBe('code');
    expect(result.impact_areas[0].risk_level).toBe('medium');
  });
});
