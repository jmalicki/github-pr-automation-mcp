import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import type { Comment } from '../schema.js';
import { generateActionCommands } from '../command-generator.js';
import { calculateStatusIndicators } from './status-indicators.js';

// Safe synthetic IDs for generated "review" comments (negative, monotonic across module)
let __tempReviewCommentId = -1;

// Type aliases for better readability
type ReviewList = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'];
type Review = ReviewList[number];

/**
 * Parse review bodies for actionable comments from AI review tools
 * Extracts structured actionable feedback from review bodies (e.g., CodeRabbit AI)
 * @param reviews - Array of GitHub reviews
 * @param pr - Pull request information
 * @param coderabbitOptions - CodeRabbit-specific options
 * @param includeStatusIndicators - Whether to include status indicators
 * @returns Array of parsed actionable comments
 */
export function parseReviewBodiesForActionableComments(
  reviews: ReviewList,
  pr: { owner: string; repo: string; number: number },
  coderabbitOptions?: {
    include_nits?: boolean;
    include_duplicates?: boolean;
    include_additional?: boolean;
    suggestion_types?: string[];
    prioritize_actionable?: boolean;
    group_by_type?: boolean;
    extract_agent_prompts?: boolean;
  },
  includeStatusIndicators?: boolean
): Comment[] {
  const actionableComments: Comment[] = [];
  
  for (const review of reviews) {
    if (!review.body || review.state === 'PENDING') {
      continue;
    }
    
    const body = review.body;
    const author = review.user?.login || 'unknown';
    const authorAssociation = review.author_association || 'NONE';
    const isBot = review.user?.type === 'Bot';
    
    // Parse CodeRabbit AI review body for actionable comments
    const codeRabbitComments = parseCodeRabbitReviewBody(body, review, pr, author, authorAssociation, isBot, coderabbitOptions, includeStatusIndicators);
    actionableComments.push(...codeRabbitComments);
    
    // Add support for other AI review tools here in the future
    // e.g., GitHub Copilot, SonarQube, etc.
  }
  return actionableComments;
}

/**
 * Parse CodeRabbit AI review body for actionable comments
 * Extracts nitpick comments, actionable suggestions, and other structured feedback
 */
function parseCodeRabbitReviewBody(
  body: string,
  review: Review,
  pr: { owner: string; repo: string; number: number },
  author: string,
  authorAssociation: string,
  isBot: boolean,
  coderabbitOptions?: {
    include_nits?: boolean;
    include_duplicates?: boolean;
    include_additional?: boolean;
    suggestion_types?: string[];
    prioritize_actionable?: boolean;
    group_by_type?: boolean;
    extract_agent_prompts?: boolean;
  },
  includeStatusIndicators?: boolean
): Comment[] {
  const comments: Comment[] = [];
  
  // Parse structured CodeRabbit sections
  const sections = parseCodeRabbitSections(body);
  
  for (const section of sections) {
    // Apply filtering based on coderabbit_options
    if (coderabbitOptions) {
      if (coderabbitOptions.suggestion_types && !coderabbitOptions.suggestion_types.includes(section.type)) {
        continue;
      }
      
      switch (section.type) {
        case 'nit':
          if (coderabbitOptions.include_nits === false) continue;
          break;
        case 'duplicate':
          if (coderabbitOptions.include_duplicates === false) continue;
          break;
        case 'additional':
          if (coderabbitOptions.include_additional === false) continue;
          break;
        case 'actionable':
          // Always include actionable items
          break;
      }
    }
    
    // Parse individual items in this section
    for (const item of section.items) {
      const comment = createCodeRabbitComment(
        item,
        section.type,
        review,
        pr,
        author,
        authorAssociation,
        isBot,
        coderabbitOptions,
        includeStatusIndicators
      );
      comments.push(comment);
    }
  }
  
  // Apply final filtering based on coderabbit_options
  if (coderabbitOptions) {
    return applyCodeRabbitFiltering(comments, coderabbitOptions);
  }
  
  return comments;
}

/**
 * Parse CodeRabbit structured sections from review body
 */
function parseCodeRabbitSections(body: string): Array<{
  type: 'nit' | 'duplicate' | 'additional' | 'actionable';
  title: string;
  count: number;
  content: string;
  items: Array<{
    file_path: string;
    line_range: string;
    title: string;
    description: string;
    code_suggestion?: {
      old_code: string;
      new_code: string;
      language: string;
    };
    severity: 'low' | 'medium' | 'high';
  }>;
}> {
  const sections: Array<{
    type: 'nit' | 'duplicate' | 'additional' | 'actionable';
    title: string;
    count: number;
    content: string;
    items: Array<{
      file_path: string;
      line_range: string;
      title: string;
      description: string;
      code_suggestion?: {
        old_code: string;
        new_code: string;
        language: string;
      };
      severity: 'low' | 'medium' | 'high';
    }>;
  }> = [];
  
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
  const lines = body.split('\n');
  let currentSection: any = null;
  let currentItem: any = null;
  let currentFile = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect section headers - handle multi-line format
    if (line.includes('<details>') && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const sectionMatch = nextLine.match(/<summary>\s*(🧹|♻️|♻|📜)\s*([^<]+)\s*\((\d+)\)\s*<\/summary>/u);
      if (sectionMatch) {
        const emoji = sectionMatch[1];
        const title = sectionMatch[2].trim();
        const count = parseInt(sectionMatch[3]);
        
        let type: 'nit' | 'duplicate' | 'additional' | 'actionable';
        if (emoji.includes('🧹')) type = 'nit';
        else if (emoji.includes('♻')) type = 'duplicate';
        else if (emoji.includes('📜')) type = 'additional';
        else type = 'actionable';
        
        currentSection = {
          type,
          title,
          count,
          content: '',
          items: []
        };
        sections.push(currentSection);
        i++; // Skip the summary line
        continue;
      }
      
      // Handle actionable comments without emoji
      const actionableMatch = nextLine.match(/<summary>\s*([^<]+)\s*:\s*(\d+)\s*<\/summary>/u);
      if (actionableMatch && nextLine.toLowerCase().includes('actionable')) {
        const title = actionableMatch[1].trim();
        const count = parseInt(actionableMatch[2]);
        
        currentSection = {
          type: 'actionable',
          title,
          count,
          content: '',
          items: []
        };
        sections.push(currentSection);
        i++; // Skip the summary line
        continue;
      }
    }
    
    // Detect file context within sections
    const fileMatch = line.match(/<summary>\s*`?([^<`]+?)`?\s*\((\d+)\)\s*<\/summary>/i);
    if (fileMatch && currentSection) {
      currentFile = fileMatch[1];
      continue;
    }
    
    // Detect line range and suggestion
    const lineRangeMatch = line.match(/^(?:`|\\`)?(\d+(?:-\d+)?)(?:`|\\`)?:\s*\*\*(.*?)\*\*/);
    if (lineRangeMatch && currentSection) {
      const lineRange = lineRangeMatch[1];
      const title = lineRangeMatch[2];
      
      // Extract description and code suggestion
      let description = title;
      let codeSuggestion: any = null;
      let inCodeBlock = false;
      let codeBlockContent = '';
      
      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        const nextLine = lines[j];
        
        if (nextLine.startsWith('```diff') || nextLine.startsWith('\\`\\`\\`diff')) {
          inCodeBlock = true;
          codeBlockContent = nextLine + '\n';
          description += '\n' + nextLine; // Include code block in description
        } else if (inCodeBlock) {
          codeBlockContent += nextLine + '\n';
          description += '\n' + nextLine; // Include code block in description
          if (nextLine.startsWith('```') || nextLine.startsWith('\\`\\`\\`')) {
            inCodeBlock = false;
            // Parse code suggestion
            const diffMatch = codeBlockContent.match(/```diff\n([\s\S]*?)\n```/) || codeBlockContent.match(/\\`\\`\\`diff\n([\s\S]*?)\n\\`\\`\\`/);
            if (diffMatch) {
              const diffContent = diffMatch[1];
              const oldLines = diffContent
                .split('\n')
                .filter(l => l.startsWith('-') && !l.startsWith('---'))
                .map(l => l.substring(1));
              const newLines = diffContent
                .split('\n')
                .filter(l => l.startsWith('+') && !l.startsWith('+++'))
                .map(l => l.substring(1));
              codeSuggestion = {
                old_code: oldLines.join('\n'),
                new_code: newLines.join('\n'),
                language: 'typescript'
              };
            }
            break;
          }
        } else if (nextLine.trim() && !nextLine.startsWith('---') && !nextLine.startsWith('</blockquote>') && !nextLine.startsWith('<summary>')) {
          description += '\n' + nextLine;
        } else if (nextLine.startsWith('---') || nextLine.startsWith('</blockquote>')) {
          break;
        }
      }
      
      currentItem = {
        file_path: currentFile || 'unknown-file',
        line_range: lineRange,
        title,
        description,
        code_suggestion: codeSuggestion,
        severity: currentSection.type === 'nit' ? 'low' : currentSection.type === 'actionable' ? 'high' : 'medium'
      };
      
      if (currentSection) {
        currentSection.items.push(currentItem);
      }
    }
  }
  
  return sections;
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
}

/**
 * Create a CodeRabbit comment with enhanced metadata
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
function createCodeRabbitComment(
  item: any,
  suggestionType: string,
  review: any,
  pr: { owner: string; repo: string; number: number },
  author: string,
  authorAssociation: string,
  isBot: boolean,
  coderabbitOptions?: any,
  includeStatusIndicators?: boolean
): Comment {
  // Defensive parsing for line ranges; avoid NaN and validate bounds
  const [startStr, endStr] = String(item.line_range || '').split('-');
  const parsedStart = Number.parseInt(startStr, 10);
  const parsedEnd = endStr ? Number.parseInt(endStr, 10) : parsedStart;
  const s = Number.isFinite(parsedStart) && parsedStart > 0 ? parsedStart : undefined;
  const e = Number.isFinite(parsedEnd) && parsedEnd > 0 ? parsedEnd : s;
  const lineStart = s && e && e >= s ? s : undefined;
  const lineEnd = s && e && e >= s ? e : undefined;
  
  // Generate agent prompt if requested
  let agentPrompt: string | undefined;
  if (coderabbitOptions?.extract_agent_prompts !== false) {
    agentPrompt = generateAgentPrompt(item, suggestionType);
  }
  
  const comment: Comment = {
    id: __tempReviewCommentId--,
    type: 'review',
    author,
    author_association: authorAssociation,
    is_bot: isBot,
    created_at: review.submitted_at || review.created_at,
    updated_at: review.submitted_at || review.created_at,
    file_path: item.file_path,
    line_number: lineStart,
    body: item.description,
    html_url: review.html_url,
    action_commands: generateActionCommands(
      pr,
      review.id,
      'review',
      item.description,
      item.file_path
    ),
    coderabbit_metadata: {
      suggestion_type: suggestionType as 'nit' | 'duplicate' | 'additional' | 'actionable',
      severity: item.severity,
      category: inferCategory(item.description),
      file_context: {
        path: item.file_path,
        line_start: lineStart,
        line_end: lineEnd
      },
      code_suggestion: item.code_suggestion,
      agent_prompt: agentPrompt,
      implementation_guidance: {
        priority: item.severity,
        effort_estimate: suggestionType === 'nit' ? 'Quick fix (1-2 minutes)' : 'Medium effort (2-5 minutes)',
        rationale: item.description
      }
    }
  };
  
  // Add status indicators if enabled
  if (includeStatusIndicators !== false) {
    comment.status_indicators = calculateStatusIndicators(comment);
  }
  
  return comment;
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
}

/**
 * Generate agent-friendly prompt from CodeRabbit suggestion
 */
function generateAgentPrompt(item: { file_path: string; line_range: string; code_suggestion?: { old_code: string; new_code: string }; description: string }, suggestionType: string): string {
  const basePrompt = `CodeRabbit ${suggestionType} suggestion for ${item.file_path}:${item.line_range}`;
  
  if (item.code_suggestion) {
    return `${basePrompt}
    
Current code:
\`\`\`typescript
${item.code_suggestion.old_code}
\`\`\`

Suggested change:
\`\`\`typescript
${item.code_suggestion.new_code}
\`\`\`

Context: ${item.description}
Priority: ${suggestionType === 'nit' ? 'Low' : 'Medium'}
Effort: Quick fix (1-2 minutes)`;
  }
  
  return `${basePrompt}
  
Description: ${item.description}
Priority: ${suggestionType === 'nit' ? 'Low' : 'Medium'}`;
}

/**
 * Infer category from suggestion description
 */
function inferCategory(description: string): string {
  const lowerDesc = description.toLowerCase();
  if (lowerDesc.includes('security') || lowerDesc.includes('vulnerability')) return 'security';
  if (lowerDesc.includes('performance') || lowerDesc.includes('slow') || lowerDesc.includes('optimize')) return 'performance';
  if (lowerDesc.includes('style') || lowerDesc.includes('format') || lowerDesc.includes('lint')) return 'style';
  if (lowerDesc.includes('error') || lowerDesc.includes('exception') || lowerDesc.includes('bug')) return 'bug';
  return 'general';
}

/**
 * Apply CodeRabbit-specific filtering and grouping
 */
function applyCodeRabbitFiltering(
  comments: Comment[],
  options: {
    include_nits?: boolean;
    include_duplicates?: boolean;
    include_additional?: boolean;
    suggestion_types?: string[];
    prioritize_actionable?: boolean;
    group_by_type?: boolean;
    extract_agent_prompts?: boolean;
  }
): Comment[] {
  let filtered = comments;
  
  // Filter CodeRabbit comments based on options
  filtered = filtered.filter(comment => {
    if (!comment.coderabbit_metadata) return true; // Keep non-CodeRabbit comments
    
    const { suggestion_type } = comment.coderabbit_metadata;
    
    // Apply type-based filtering
    if (options.suggestion_types && !options.suggestion_types.includes(suggestion_type)) {
      return false;
    }
    
    // Apply boolean filters
    switch (suggestion_type) {
      case 'nit':
        return options.include_nits !== false;
      case 'duplicate':
        return options.include_duplicates !== false;
      case 'additional':
        return options.include_additional !== false;
      case 'actionable':
        return true; // Always include actionable items
    }
    
    return true;
  });
  
  // Apply prioritization if requested
  if (options.prioritize_actionable) {
    filtered.sort((a, b) => {
      const aIsActionable = a.coderabbit_metadata?.suggestion_type === 'actionable';
      const bIsActionable = b.coderabbit_metadata?.suggestion_type === 'actionable';
      
      if (aIsActionable && !bIsActionable) return -1;
      if (!aIsActionable && bIsActionable) return 1;
      return 0;
    });
  }
  
  // Apply grouping if requested
  if (options.group_by_type) {
    filtered.sort((a, b) => {
      const aType = a.coderabbit_metadata?.suggestion_type || 'other';
      const bType = b.coderabbit_metadata?.suggestion_type || 'other';
      
      // Group by type, with actionable first
      const typeOrder: Record<string, number> = { actionable: 0, nit: 1, duplicate: 2, additional: 3, other: 4 };
      const aOrder = typeOrder[aType] ?? 4;
      const bOrder = typeOrder[bType] ?? 4;
      
      if (aOrder !== bOrder) return aOrder - bOrder;
      
      // Within same type, sort by file path
      const aFile = a.file_path || '';
      const bFile = b.file_path || '';
      return aFile.localeCompare(bFile);
    });
  }
  
  return filtered;
}
