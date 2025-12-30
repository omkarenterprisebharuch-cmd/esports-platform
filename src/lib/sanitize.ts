/**
 * XSS Protection and Content Sanitization Utilities
 * 
 * Provides secure sanitization for user-generated content to prevent XSS attacks.
 * Uses DOMPurify for comprehensive HTML sanitization.
 */

import DOMPurify from "isomorphic-dompurify";

// ============ Text Sanitization (for plain text fields) ============

/**
 * Escape HTML special characters in plain text
 * Use this for text that should NOT contain any HTML
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== "string") return "";
  
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
    "`": "&#x60;",
    "=": "&#x3D;",
  };

  return text.replace(/[&<>"'`=/]/g, (char) => htmlEscapes[char] || char);
}

/**
 * Remove HTML tags completely from text
 * Use for fields that should be plain text only
 */
export function stripHtml(text: string): string {
  if (!text || typeof text !== "string") return "";
  
  // First, use DOMPurify to decode HTML entities properly
  // Then strip any remaining HTML
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] })
    .replace(/<[^>]*>/g, "")
    .trim();
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

/**
 * Sanitize HTML content allowing basic formatting
 * Use for rich text fields like tournament descriptions
 */
export function sanitizeRichText(html: string): string {
  if (!html || typeof html !== "string") return "";
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "b", "i", "u", "strong", "em",
      "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "a", "blockquote", "code", "pre",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
    // Force all links to be safe
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"], // Add target="_blank" capability
    // Transform hooks for additional security
    FORBID_TAGS: ["script", "style", "iframe", "form", "input", "button"],
    FORBID_ATTR: ["onclick", "onerror", "onload", "onmouseover", "onfocus", "onblur"],
  });
}

/**
 * Sanitize URLs to prevent javascript: and data: attacks
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") return "";
  
  const trimmed = url.trim().toLowerCase();
  
  // Block dangerous protocols
  const dangerousProtocols = [
    "javascript:",
    "data:",
    "vbscript:",
    "file:",
    "blob:",
  ];
  
  for (const protocol of dangerousProtocols) {
    if (trimmed.startsWith(protocol)) {
      return "";
    }
  }
  
  // Allow relative URLs, http, https, mailto
  const allowedProtocols = ["http://", "https://", "mailto:", "/", "#"];
  const hasAllowedProtocol = allowedProtocols.some((p) => 
    trimmed.startsWith(p) || !trimmed.includes(":")
  );
  
  return hasAllowedProtocol ? url.trim() : "";
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

// Export DOMPurify for advanced use cases
export { DOMPurify };
