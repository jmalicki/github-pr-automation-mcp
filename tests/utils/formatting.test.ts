import { describe, it, expect } from 'vitest';
import { formatDuration, formatTimestamp, truncateText, formatBytes } from '../../src/utils/formatting.js';

describe('formatDuration', () => {
  // Test: Validates duration formatting for seconds
  // Requirement: Output Formatting - Human-readable durations
  it('should format seconds correctly', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(59)).toBe('59s');
  });
  
  // Test: Validates duration formatting for minutes
  // Requirement: Output Formatting - Human-readable durations
  it('should format minutes correctly', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(120)).toBe('2m');
  });
  
  // Test: Validates duration formatting for hours
  // Requirement: Output Formatting - Human-readable durations
  it('should format hours correctly', () => {
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(3660)).toBe('1h 1m');
    expect(formatDuration(7200)).toBe('2h');
  });
});

describe('formatTimestamp', () => {
  // Test: Validates ISO 8601 timestamp formatting
  // Requirement: API Design - Timestamp format
  it('should format date as ISO 8601', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const result = formatTimestamp(date);
    
    expect(result).toBe('2024-01-15T10:30:00.000Z');
  });
});

describe('truncateText', () => {
  // Test: Validates text truncation with ellipsis
  // Requirement: Output Formatting - Text truncation
  it('should truncate long text with ellipsis', () => {
    const text = 'This is a very long text that needs to be truncated';
    const result = truncateText(text, 20);
    
    expect(result).toBe('This is a very lo...');
    expect(result.length).toBe(20);
  });
  
  // Test: Validates handling of short text
  // Requirement: Output Formatting - Text truncation
  it('should not truncate short text', () => {
    const text = 'Short text';
    const result = truncateText(text, 20);
    
    expect(result).toBe('Short text');
  });
});

describe('formatBytes', () => {
  // Test: Validates byte size formatting
  // Requirement: Output Formatting - File sizes
  it('should format bytes correctly', () => {
    expect(formatBytes(500)).toBe('500.0 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });
});

