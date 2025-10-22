import { describe, it, expect } from 'vitest';
import { handleGitHubError } from '../../src/github/errors.js';

describe('handleGitHubError', () => {
  it('should handle 404 Not Found', () => {
    const error = { status: 404, message: 'Not Found' };
    const result = handleGitHubError(error, 'PR #123');
    
    expect(result.error).toBe('Resource not found: PR #123');
    expect(result.category).toBe('user');
    expect(result.suggestion).toBe('Verify the PR number and repository name are correct');
  });

  it('should handle 401 Unauthorized', () => {
    const error = { status: 401, message: 'Unauthorized' };
    const result = handleGitHubError(error, 'API call');
    
    expect(result.error).toBe('Authentication failed');
    expect(result.category).toBe('authentication');
    expect(result.suggestion).toBe('Check that GITHUB_TOKEN is set and valid');
  });

  it('should handle 403 Forbidden with rate limit', () => {
    const error = { 
      status: 403, 
      message: 'API rate limit exceeded',
      response: {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1640995200'
        }
      }
    };
    const result = handleGitHubError(error, 'API call');
    
    expect(result.error).toBe('Rate limit exceeded');
    expect(result.category).toBe('rate_limit');
    expect(result.suggestion).toBe('Wait for rate limit to reset');
  });

  it('should handle 403 Forbidden with permissions', () => {
    const error = { 
      status: 403, 
      message: 'Forbidden',
      response: {
        headers: {}
      }
    };
    const result = handleGitHubError(error, 'API call');
    
    expect(result.error).toBe('Forbidden: insufficient permissions');
    expect(result.category).toBe('authorization');
    expect(result.suggestion).toBe('Ensure the token has required repository permissions');
  });

  it('should handle 429 Too Many Requests with Retry-After', () => {
    const error = { 
      status: 429, 
      message: 'Too Many Requests',
      response: {
        headers: {
          'retry-after': '60'
        }
      }
    };
    const result = handleGitHubError(error, 'API call');
    
    expect(result.error).toBe('Too many requests');
    expect(result.category).toBe('rate_limit');
    expect(result.suggestion).toBe('Reduce request rate or add backoff');
  });

  it('should handle 422 Unprocessable Entity', () => {
    const error = { 
      status: 422, 
      message: 'Validation Failed',
      response: {
        data: {
          errors: [{ message: 'Invalid field' }]
        }
      }
    };
    const result = handleGitHubError(error, 'API call');
    
    expect(result.error).toBe('Invalid request: Validation Failed');
    expect(result.category).toBe('user');
    expect(result.suggestion).toBeUndefined();
  });

  it('should handle 500 Internal Server Error', () => {
    const error = { status: 500, message: 'Internal Server Error' };
    const result = handleGitHubError(error, 'API call');
    
    expect(result.error).toBe('Unexpected error: Internal Server Error');
    expect(result.category).toBe('unknown');
    expect(result.suggestion).toBeUndefined();
  });

  it('should handle unknown error', () => {
    const error = { message: 'Unknown error' };
    const result = handleGitHubError(error, 'API call');
    
    expect(result.error).toBe('Unexpected error: Unknown error');
    expect(result.category).toBe('unknown');
    expect(result.suggestion).toBeUndefined();
  });

  it('should handle error without message', () => {
    const error = {};
    const result = handleGitHubError(error, 'API call');
    
    expect(result.error).toBe('Unexpected error: Unknown error');
    expect(result.category).toBe('unknown');
  });

  it('should handle network error', () => {
    const error = { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND api.github.com' };
    const result = handleGitHubError(error, 'API call');
    
    expect(result.error).toBe('Network error');
    expect(result.category).toBe('network');
    expect(result.suggestion).toBe('Check your internet connection');
  });
});
