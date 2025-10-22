import { describe, it, expect } from 'vitest';
import { resolveParameterValue } from '../../src/preferences/resolver.js';

describe('resolveParameterValue', () => {
  // Test: Validates that explicit arguments always win
  // Requirement: User Preferences - Precedence (explicit > preference > default)
  it('should use explicit value when provided', () => {
    const result = resolveParameterValue(
      'bail_on_first',
      true,                          // Explicit value
      { bail_on_first: false },     // User preference
      false                          // Tool default
    );
    
    expect(result).toBe(true);
  });
  
  // Test: Validates that preferences override defaults when no explicit value
  // Requirement: User Preferences - Preference overrides default
  it('should use preference when no explicit value', () => {
    const result = resolveParameterValue(
      'bail_on_first',
      undefined,                     // No explicit value
      { bail_on_first: false },     // User preference
      true                           // Tool default
    );
    
    expect(result).toBe(false);
  });
  
  // Test: Validates that defaults are used when no explicit value or preference
  // Requirement: User Preferences - Default fallback
  it('should use default when no explicit value or preference', () => {
    const result = resolveParameterValue(
      'bail_on_first',
      undefined,                     // No explicit value
      {},                            // No preference
      true                           // Tool default
    );
    
    expect(result).toBe(true);
  });
  
  // Test: Validates that explicit false is different from undefined
  // Requirement: User Preferences - Explicit vs omitted
  it('should treat explicit false as explicit value', () => {
    const result = resolveParameterValue(
      'bail_on_first',
      false,                         // Explicit false
      { bail_on_first: true },      // User preference
      true                           // Tool default
    );
    
    expect(result).toBe(false);
  });
});

