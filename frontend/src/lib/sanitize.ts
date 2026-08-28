/**
 * Utility functions for sanitizing and formatting discussion note inputs.
 */

// Basic SQL injection patterns to neutralize
const SQL_PATTERNS = [
  /;\s*DROP\s+TABLE/gi,
  /;\s*DELETE\s+FROM/gi,
  /;\s*UPDATE\s+/gi,
  /UNION\s+SELECT/gi,
  /--$/g,
  /'\s+OR\s+1\s*=\s*1/gi,
  /"\s+OR\s+1\s*=\s*1/gi,
];

// Dangerous HTML patterns
const HTML_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /on\w+="[^"]*"/gi,
  /on\w+='[^']*'/gi,
  /on\w+=\w+/gi,
  /javascript:/gi,
];

/**
 * Strips dangerous HTML tags/attributes and neutralizes basic SQL injection patterns.
 * Also entity-encodes specific characters.
 */
export function sanitizeInput(raw: string): string {
  if (!raw) return '';

  let sanitized = raw;

  // 1. Remove dangerous HTML patterns
  for (const pattern of HTML_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // 2. Neutralize SQL patterns
  for (const pattern of SQL_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  // 3. Basic HTML entity encoding for extra safety (only necessary if directly rendering, 
  // but we will parse formatting later)
  sanitized = sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return sanitized;
}

/**
 * Counts words accurately (splits on whitespace, filters empty tokens).
 */
export function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Validates and sanitizes note content.
 */
export function validateNoteContent(text: string, maxWords: number = 500): { 
  isValid: boolean; 
  sanitized: string; 
  wordCount: number; 
  errors: string[] 
} {
  const sanitized = sanitizeInput(text);
  const wordCount = countWords(sanitized);
  const errors: string[] = [];

  if (wordCount === 0) {
    errors.push('Note cannot be empty.');
  }

  if (wordCount > maxWords) {
    errors.push(`Note exceeds the maximum limit of ${maxWords} words.`);
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    wordCount,
    errors
  };
}

/**
 * Converts safe plain-text formatting to sanitized HTML for display.
 * Handles bullet points, numbered lists, and line breaks.
 */
export function renderSafeHtml(text: string): string {
  if (!text) return '';

  // 1. Ensure basic escaping is done (handled by sanitizeInput if it was run, but double-check)
  let safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Split into lines
  const lines = safeText.split('\n');
  let inList = false;
  let inOrderedList = false;
  let htmlResult = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check for bullet list item: "- " or "* "
    const isBullet = /^[-*]\s+(.*)$/.exec(trimmedLine);
    
    // Check for numbered list item: "1. "
    const isNumbered = /^\d+\.\s+(.*)$/.exec(trimmedLine);

    // Calculate indentation level (simple approach based on leading spaces)
    const leadingSpacesMatch = line.match(/^(\s+)/);
    const leadingSpaces = leadingSpacesMatch ? leadingSpacesMatch[1].length : 0;
    
    // Determine margin based on indentation (4 spaces = 1rem left margin)
    const marginLeft = leadingSpaces > 0 ? `margin-left: ${(Math.floor(leadingSpaces / 2) * 0.5)}rem;` : '';
    const styleAttr = marginLeft ? ` style="${marginLeft}"` : '';

    if (isBullet) {
      if (!inList) {
        htmlResult += '<ul class="list-disc ml-4 mb-2">\n';
        inList = true;
        inOrderedList = false; // Just in case
      }
      htmlResult += `  <li${styleAttr}>${isBullet[1]}</li>\n`;
    } else if (isNumbered) {
       if (!inOrderedList) {
        htmlResult += '<ol class="list-decimal ml-4 mb-2">\n';
        inOrderedList = true;
        inList = false; // Just in case
      }
      htmlResult += `  <li${styleAttr}>${isNumbered[1]}</li>\n`;
    } else {
      // Close any open lists
      if (inList) {
        htmlResult += '</ul>\n';
        inList = false;
      }
      if (inOrderedList) {
        htmlResult += '</ol>\n';
        inOrderedList = false;
      }

      if (trimmedLine === '') {
        // Empty line -> break
        htmlResult += '<br />\n';
      } else {
        // Normal text line
        htmlResult += `<p${styleAttr} class="mb-1">${trimmedLine}</p>\n`;
      }
    }
  }

  // Close trailing lists
  if (inList) {
    htmlResult += '</ul>\n';
  }
  if (inOrderedList) {
    htmlResult += '</ol>\n';
  }

  return htmlResult;
}
