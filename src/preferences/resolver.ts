/**
 * Resolve parameter value using 3-level precedence:
 * 1. Explicit argument from LLM/agent (highest priority)
 * 2. User preference (if parameter not provided)
 * 3. Tool default (fallback)
 * 
 * User preferences NEVER override explicit arguments - they only override defaults.
 */
export function resolveParameterValue<T>(
  paramName: string,
  explicitValue: T | undefined,
  userPreferences: Record<string, unknown>,
  toolDefault: T
): T {
  // 1. Explicit argument from LLM/agent ALWAYS wins
  if (explicitValue !== undefined) {
    return explicitValue;
  }
  
  // 2. No explicit argument? Check user preference
  // This is where preference overrides the tool default
  if (paramName in userPreferences) {
    return userPreferences[paramName] as T;
  }
  
  // 3. No explicit arg, no preference? Use tool default
  return toolDefault;
}

