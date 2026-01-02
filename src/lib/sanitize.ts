/**
 * XSS Protection and Content Sanitization Utilities
 * 
 * Provides secure sanitization for user-generated content to prevent XSS attacks.
 * Uses a lightweight, server-safe implementation without JSDOM dependencies.
 */

// ============ HTML Entity Encoding/Decoding ============

const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

const reverseHtmlEntities: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&#x2F;": "/",
  "&#x60;": "`",
  "&#x3D;": "=",
  "&nbsp;": " ",
};

// ============ Text Sanitization (for plain text fields) ============

/**
 * Escape HTML special characters in plain text
 * Use this for text that should NOT contain any HTML
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== "string") return "";
  
  return text.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Decode HTML entities back to characters
 */
export function decodeHtmlEntities(text: string): string {
  if (!text || typeof text !== "string") return "";
  
  return text.replace(
    /&(amp|lt|gt|quot|#x27|#39|#x2F|#x60|#x3D|nbsp);/gi,
    (match) => reverseHtmlEntities[match.toLowerCase()] || match
  );
}

/**
 * Remove HTML tags completely from text
 * Use for fields that should be plain text only
 */
export function stripHtml(text: string): string {
  if (!text || typeof text !== "string") return "";
  
  // Remove all HTML tags
  let result = text.replace(/<[^>]*>/g, "");
  
  // Decode common HTML entities
  result = decodeHtmlEntities(result);
  
  // Remove any script/style content that might have been left
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  
  return result.trim();
}

/**
 * Sanitize plain text input (usernames, team names, etc.)
 * - Removes HTML tags
 * - Trims whitespace
 * - Limits length
 */
export function sanitizeText(text: string, maxLength = 500): string {
  if (!text || typeof text !== "string") return "";
  
  return stripHtml(text).substring(0, maxLength).trim();
}

// ============ Rich Text Sanitization (for descriptions, messages) ============

// Tags allowed in rich text content
const ALLOWED_TAGS = new Set([
  "p", "br", "b", "i", "u", "strong", "em",
  "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "a", "blockquote", "code", "pre",
]);

// Attributes allowed for specific tags
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
};

// Dangerous event handlers to remove
const DANGEROUS_ATTRS = [
  "onclick", "onerror", "onload", "onmouseover", "onfocus", "onblur",
  "onmouseout", "onmouseenter", "onmouseleave", "onkeydown", "onkeyup",
  "onkeypress", "onsubmit", "onchange", "oninput", "ondblclick",
];

/**
 * Sanitize HTML content allowing basic formatting
 * Use for rich text fields like tournament descriptions
 */
export function sanitizeRichText(html: string): string {
  if (!html || typeof html !== "string") return "";
  
  // Remove script and style tags completely (including content)
  let result = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  
  // Remove dangerous tags
  const dangerousTags = ["iframe", "object", "embed", "form", "input", "button", "textarea", "select"];
  for (const tag of dangerousTags) {
    const regex = new RegExp(`<${tag}\\b[^>]*>.*?<\\/${tag}>|<${tag}\\b[^>]*\\/?>`, "gi");
    result = result.replace(regex, "");
  }
  
  // Remove event handlers from all tags
  for (const attr of DANGEROUS_ATTRS) {
    const regex = new RegExp(`\\s*${attr}\\s*=\\s*["'][^"']*["']`, "gi");
    result = result.replace(regex, "");
    // Also handle unquoted values
    const unquotedRegex = new RegExp(`\\s*${attr}\\s*=\\s*[^\\s>]+`, "gi");
    result = result.replace(unquotedRegex, "");
  }
  
  // Remove javascript: and data: URLs from href attributes
  result = result.replace(/href\s*=\s*["']?\s*(javascript|data|vbscript):[^"'>\s]*/gi, 'href="#"');
  
  // Process tags - keep allowed ones, strip others but keep content
  result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tagName) => {
    const lowerTag = tagName.toLowerCase();
    
    if (ALLOWED_TAGS.has(lowerTag)) {
      // For opening tags, filter attributes
      if (!match.startsWith("</")) {
        // Extract tag and its attributes
        const tagMatch = match.match(/<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^>]*)?)\/?>/);
        if (tagMatch) {
          const [, tag, attrsString] = tagMatch;
          const allowedAttrs = ALLOWED_ATTRS[lowerTag];
          
          if (allowedAttrs && attrsString) {
            // Filter to only allowed attributes
            const attrs: string[] = [];
            const attrRegex = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
            let attrMatch;
            
            while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
              const [, attrName, val1, val2, val3] = attrMatch;
              const attrValue = val1 || val2 || val3 || "";
              
              if (allowedAttrs.has(attrName.toLowerCase())) {
                // Sanitize the attribute value
                const sanitizedValue = attrValue
                  .replace(/javascript:/gi, "")
                  .replace(/data:/gi, "")
                  .replace(/vbscript:/gi, "");
                attrs.push(`${attrName}="${escapeHtml(sanitizedValue)}"`);
              }
            }
            
            // Add rel="noopener noreferrer" to links for security
            if (lowerTag === "a" && !attrs.some(a => a.startsWith("rel="))) {
              attrs.push('rel="noopener noreferrer"');
            }
            
            return attrs.length > 0 ? `<${tag} ${attrs.join(" ")}>` : `<${tag}>`;
          }
          
          return `<${tag}>`;
        }
      }
      return match;
    }
    
    // Strip disallowed tags but keep content
    return "";
  });
  
  return result.trim();
}

/**
 * Sanitize URLs to prevent javascript: and data: attacks
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") return "";
  
  const trimmed = url.trim();
  const lowerTrimmed = trimmed.toLowerCase();
  
  // Block dangerous protocols
  const dangerousProtocols = [
    "javascript:",
    "data:",
    "vbscript:",
    "file:",
    "blob:",
  ];
  
  for (const protocol of dangerousProtocols) {
    if (lowerTrimmed.startsWith(protocol)) {
      return "";
    }
  }
  
  // Allow relative URLs, http, https, mailto
  const allowedProtocols = ["http://", "https://", "mailto:", "/", "#"];
  const hasAllowedProtocol = allowedProtocols.some((p) => 
    lowerTrimmed.startsWith(p) || !lowerTrimmed.includes(":")
  );
  
  return hasAllowedProtocol ? trimmed : "";
}

// ============ Specific Field Sanitizers ============

/**
 * Sanitize username
 * - Only alphanumeric, underscore, hyphen
 * - Max 50 characters
 */
export function sanitizeUsername(username: string): string {
  if (!username || typeof username !== "string") return "";
  
  return username
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .substring(0, 50)
    .trim();
}

/**
 * Sanitize team name
 * - Strips HTML
 * - Max 50 characters
 */
export function sanitizeTeamName(name: string): string {
  return sanitizeText(name, 50);
}

/**
 * Sanitize tournament name
 * - Strips HTML
 * - Max 100 characters
 */
export function sanitizeTournamentName(name: string): string {
  return sanitizeText(name, 100);
}

/**
 * Sanitize chat message
 * - Strips HTML (chat is plain text)
 * - Max 1000 characters
 * - Preserves emojis
 */
export function sanitizeChatMessage(message: string): string {
  if (!message || typeof message !== "string") return "";
  
  return stripHtml(message)
    .substring(0, 1000)
    .trim();
}

/**
 * Sanitize description/bio (allows basic formatting)
 * - Allows limited HTML tags
 * - Max 5000 characters
 */
export function sanitizeDescription(description: string): string {
  if (!description || typeof description !== "string") return "";
  
  return sanitizeRichText(description).substring(0, 5000);
}

/**
 * Sanitize game UID (alphanumeric + some special chars)
 */
export function sanitizeGameUid(uid: string): string {
  if (!uid || typeof uid !== "string") return "";
  
  return uid
    .replace(/[^a-zA-Z0-9#_-]/g, "")
    .substring(0, 50)
    .trim();
}

// ============ Object Sanitizers ============

/**
 * Sanitize a plain object by applying text sanitization to all string values
 * Useful for sanitizing request bodies
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: {
    maxStringLength?: number;
    excludeKeys?: string[];
    richTextKeys?: string[];
  } = {}
): T {
  const {
    maxStringLength = 5000,
    excludeKeys = ["password", "password_hash", "token"],
    richTextKeys = ["description", "bio", "about", "match_rules"],
  } = options;

  const sanitized = { ...obj };

  for (const [key, value] of Object.entries(sanitized)) {
    // Skip excluded keys (passwords, tokens, etc.)
    if (excludeKeys.includes(key)) continue;

    if (typeof value === "string") {
      if (richTextKeys.includes(key)) {
        (sanitized as Record<string, unknown>)[key] = sanitizeDescription(value);
      } else {
        (sanitized as Record<string, unknown>)[key] = sanitizeText(value, maxStringLength);
      }
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = sanitizeObject(
        value as Record<string, unknown>,
        options
      );
    }
  }

  return sanitized;
}

// ============ React Component Helpers ============

/**
 * Create sanitized HTML props for dangerouslySetInnerHTML
 * Only use when you explicitly need to render HTML content
 */
export function createSanitizedHtml(html: string): { __html: string } {
  return { __html: sanitizeRichText(html) };
}
