/**
 * Categorization hints for AI agents to prioritize review comments
 * 
 * IMPORTANT: These are HINTS only. The AI agent makes final decisions on:
 * - What response to write
 * - Whether to fix the issue
 * - When to resolve the comment
 */

const SECURITY_KEYWORDS = [
  'sql', 'injection', 'xss', 'csrf', 'auth', 'authentication', 'authorization',
  'password', 'secret', 'token', 'crypto', 'encrypt', 'decrypt', 'vulnerability',
  'security', 'exploit', 'attack', 'sanitize', 'escape', 'validate input'
];

const BLOCKING_KEYWORDS = [
  'must', 'required', 'critical', 'blocking', 'breaking', 'breaking change',
  'blocker', 'urgent', 'important', 'essential', 'necessary', 'needs to',
  'has to', 'should not', 'cannot', 'will not work', 'will break'
];

const QUESTION_INDICATORS = [
  'why', 'how', 'what', 'when', 'where', 'which', 'could you', 'can you',
  'would you', 'should we', 'do we', 'is this', 'are we', 'does this'
];

/**
 * Generate categorization hints for a comment
 */
export function generateHints(
  body: string,
  authorAssociation: string,
  isBot: boolean
): {
  has_security_keywords: boolean;
  has_blocking_keywords: boolean;
  is_question: boolean;
  severity_estimate: 'low' | 'medium' | 'high' | 'unknown';
} {
  const lowerBody = body.toLowerCase();
  
  // Check for keyword matches
  const has_security_keywords = SECURITY_KEYWORDS.some(kw => lowerBody.includes(kw));
  const has_blocking_keywords = BLOCKING_KEYWORDS.some(kw => lowerBody.includes(kw));
  const is_question = 
    lowerBody.includes('?') ||
    QUESTION_INDICATORS.some(kw => lowerBody.includes(kw));
  
  // Estimate severity based on multiple factors
  let severity_estimate: 'low' | 'medium' | 'high' | 'unknown' = 'unknown';
  
  if (has_security_keywords) {
    severity_estimate = 'high'; // Security issues are always high priority
  } else if (has_blocking_keywords) {
    severity_estimate = 'high'; // Blocking issues are high priority
  } else if (authorAssociation === 'OWNER' || authorAssociation === 'MEMBER') {
    // Comments from maintainers are medium unless categorized above
    severity_estimate = 'medium';
  } else if (isBot) {
    // Bot comments are usually low priority (linting, nits)
    severity_estimate = 'low';
  } else if (is_question) {
    // Questions are medium priority (need response but not urgent)
    severity_estimate = 'medium';
  } else {
    // General suggestions/nits
    severity_estimate = 'low';
  }
  
  return {
    has_security_keywords,
    has_blocking_keywords,
    is_question,
    severity_estimate
  };
}

