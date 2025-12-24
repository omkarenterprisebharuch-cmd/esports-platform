/**
 * Chat Utilities for Tournament Chat Feature
 * - Rate limiting
 * - Profanity filtering
 * - Message validation
 */

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_MESSAGES = 20; // Max 20 messages per minute per user

// In-memory rate limit tracking (per server instance)
// Key: `${tournamentId}:${userId}` -> array of timestamps
const rateLimitMap = new Map<string, number[]>();

/**
 * Check if a user is rate limited
 * Returns true if user should be blocked, false if allowed
 */
export function isRateLimited(
  tournamentId: number | string,
  userId: number | string
): boolean {
  const key = `${tournamentId}:${userId}`;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  // Get existing timestamps
  const timestamps = rateLimitMap.get(key) || [];

  // Filter out old timestamps
  const recentTimestamps = timestamps.filter((ts) => ts > windowStart);

  // Check if over limit
  if (recentTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
    return true; // User is rate limited
  }

  // Add new timestamp and update map
  recentTimestamps.push(now);
  rateLimitMap.set(key, recentTimestamps);

  return false; // User is allowed
}

/**
 * Get remaining messages allowed in current window
 */
export function getRateLimitRemaining(
  tournamentId: number | string,
  userId: number | string
): number {
  const key = `${tournamentId}:${userId}`;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  const timestamps = rateLimitMap.get(key) || [];
  const recentTimestamps = timestamps.filter((ts) => ts > windowStart);

  return Math.max(0, RATE_LIMIT_MAX_MESSAGES - recentTimestamps.length);
}

/**
 * Clear rate limit data for a tournament (called when tournament ends)
 */
export function clearTournamentRateLimits(tournamentId: number | string): void {
  const prefix = `${tournamentId}:`;
  for (const key of rateLimitMap.keys()) {
    if (key.startsWith(prefix)) {
      rateLimitMap.delete(key);
    }
  }
}

// Basic profanity word list (extend as needed)
// This is a minimal list - consider using a library like 'bad-words' for production
const PROFANITY_LIST = [
  "fuck",
  "shit",
  "ass",
  "bitch",
  "dick",
  "pussy",
  "cock",
  "cunt",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "whore",
  "slut",
  "bastard",
  "damn",
  "piss",
  "asshole",
  "motherfucker",
  "bullshit",
];

// Create regex pattern for profanity detection
// Matches whole words and common leetspeak variations
const profanityPatterns = PROFANITY_LIST.map((word) => {
  // Create pattern that matches word with common substitutions
  const pattern = word
    .replace(/a/gi, "[a@4]")
    .replace(/e/gi, "[e3]")
    .replace(/i/gi, "[i1!]")
    .replace(/o/gi, "[o0]")
    .replace(/s/gi, "[s$5]")
    .replace(/t/gi, "[t7]");
  return new RegExp(`\\b${pattern}\\b`, "gi");
});

/**
 * Check if message contains profanity
 * Returns true if profanity detected
 */
export function containsProfanity(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  for (const pattern of profanityPatterns) {
    if (pattern.test(lowerMessage)) {
      return true;
    }
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
  }

  return false;
}

/**
 * Filter profanity from message (replaces with asterisks)
 */
export function filterProfanity(message: string): string {
  let filtered = message;

  for (const pattern of profanityPatterns) {
    filtered = filtered.replace(pattern, (match) => "*".repeat(match.length));
    pattern.lastIndex = 0;
  }

  return filtered;
}

/**
 * Validate chat message
 * Returns { valid: boolean, error?: string, sanitized?: string }
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

export function validateMessage(message: string): ValidationResult {
  // Check if empty
  if (!message || typeof message !== "string") {
    return { valid: false, error: "Message is required" };
  }

  // Trim and check length
  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Message cannot be empty" };
  }

  if (trimmed.length > 500) {
    return { valid: false, error: "Message cannot exceed 500 characters" };
  }

  // Check for spam patterns (repeated characters)
  if (/(.)\1{9,}/.test(trimmed)) {
    return { valid: false, error: "Message contains too many repeated characters" };
  }

  // Check for excessive caps (more than 80% uppercase, min 10 chars)
  if (trimmed.length >= 10) {
    const upperCount = (trimmed.match(/[A-Z]/g) || []).length;
    const letterCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
    if (letterCount > 0 && upperCount / letterCount > 0.8) {
      return { valid: false, error: "Please don't shout! Reduce caps." };
    }
  }

  // Filter profanity (replace, don't block)
  const sanitized = filterProfanity(trimmed);

  return { valid: true, sanitized };
}

/**
 * Chat message type for database
 */
export interface ChatMessageDB {
  id: number;
  tournament_id: number;
  user_id: number;
  username: string;
  message: string;
  created_at: Date;
}

/**
 * Chat message type for socket/client
 */
export interface ChatMessageSocket {
  id: string;
  tournamentId: number | string;
  userId: number | string;
  username: string;
  message: string;
  timestamp: Date;
}

/**
 * Convert database message to socket format
 */
export function dbMessageToSocket(msg: ChatMessageDB): ChatMessageSocket {
  return {
    id: String(msg.id),
    tournamentId: msg.tournament_id,
    userId: msg.user_id,
    username: msg.username,
    message: msg.message,
    timestamp: msg.created_at,
  };
}
