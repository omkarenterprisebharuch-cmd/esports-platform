/**
 * Centralized Error Codes System
 * 
 * Error Code Format: CATEGORY_NUMBER
 * - AUTH: Authentication/Authorization errors (1xxx)
 * - USER: User-related errors (2xxx)
 * - TOURNAMENT: Tournament-related errors (3xxx)
 * - REGISTRATION: Registration-related errors (4xxx)
 * - TEAM: Team-related errors (5xxx)
 * - PAYMENT: Payment/Wallet errors (6xxx)
 * - VALIDATION: Input validation errors (7xxx)
 * - DATABASE: Database errors (8xxx)
 * - SERVER: Server/System errors (9xxx)
 * 
 * See ERROR_CODES.txt for full documentation
 */

export interface ErrorCodeInfo {
  code: string;
  httpStatus: number;
  userMessage: string;      // Safe message to show to users
  internalMessage: string;  // Detailed message for debugging (logged only)
  category: string;
}

// ============ ERROR CODES REGISTRY ============

export const ERROR_CODES: Record<string, ErrorCodeInfo> = {
  // ============ AUTHENTICATION ERRORS (1xxx) ============
  AUTH_1001: {
    code: "AUTH_1001",
    httpStatus: 401,
    userMessage: "Please log in to continue",
    internalMessage: "No authentication token provided",
    category: "Authentication",
  },
  AUTH_1002: {
    code: "AUTH_1002",
    httpStatus: 401,
    userMessage: "Your session has expired. Please log in again",
    internalMessage: "JWT token expired",
    category: "Authentication",
  },
  AUTH_1003: {
    code: "AUTH_1003",
    httpStatus: 401,
    userMessage: "Invalid credentials. Please try again",
    internalMessage: "Invalid email or password",
    category: "Authentication",
  },
  AUTH_1004: {
    code: "AUTH_1004",
    httpStatus: 401,
    userMessage: "Session invalid. Please log in again",
    internalMessage: "JWT token malformed or tampered",
    category: "Authentication",
  },
  AUTH_1005: {
    code: "AUTH_1005",
    httpStatus: 403,
    userMessage: "Please verify your email to continue",
    internalMessage: "Email not verified",
    category: "Authentication",
  },
  AUTH_1006: {
    code: "AUTH_1006",
    httpStatus: 401,
    userMessage: "Refresh token invalid or expired",
    internalMessage: "Refresh token validation failed",
    category: "Authentication",
  },
  AUTH_1007: {
    code: "AUTH_1007",
    httpStatus: 400,
    userMessage: "Invalid or expired OTP",
    internalMessage: "OTP verification failed",
    category: "Authentication",
  },
  AUTH_1008: {
    code: "AUTH_1008",
    httpStatus: 400,
    userMessage: "Password reset link has expired",
    internalMessage: "Password reset token expired",
    category: "Authentication",
  },
  AUTH_1009: {
    code: "AUTH_1009",
    httpStatus: 429,
    userMessage: "Too many login attempts. Please try again later",
    internalMessage: "Login rate limit exceeded",
    category: "Authentication",
  },
  AUTH_1010: {
    code: "AUTH_1010",
    httpStatus: 403,
    userMessage: "Your account has been suspended",
    internalMessage: "User account is deactivated",
    category: "Authentication",
  },

  // ============ AUTHORIZATION ERRORS (12xx) ============
  AUTH_1201: {
    code: "AUTH_1201",
    httpStatus: 403,
    userMessage: "You don't have permission to perform this action",
    internalMessage: "Insufficient permissions for this operation",
    category: "Authorization",
  },
  AUTH_1202: {
    code: "AUTH_1202",
    httpStatus: 403,
    userMessage: "Only tournament hosts can perform this action",
    internalMessage: "User is not a host",
    category: "Authorization",
  },
  AUTH_1203: {
    code: "AUTH_1203",
    httpStatus: 403,
    userMessage: "Only admins can perform this action",
    internalMessage: "User is not an admin",
    category: "Authorization",
  },
  AUTH_1204: {
    code: "AUTH_1204",
    httpStatus: 403,
    userMessage: "You can only modify your own resources",
    internalMessage: "User attempting to modify another user's resource",
    category: "Authorization",
  },
  AUTH_1205: {
    code: "AUTH_1205",
    httpStatus: 403,
    userMessage: "Invalid CSRF token",
    internalMessage: "CSRF token validation failed",
    category: "Authorization",
  },

  // ============ USER ERRORS (2xxx) ============
  USER_2001: {
    code: "USER_2001",
    httpStatus: 404,
    userMessage: "User not found",
    internalMessage: "User ID does not exist in database",
    category: "User",
  },
  USER_2002: {
    code: "USER_2002",
    httpStatus: 409,
    userMessage: "This email is already registered",
    internalMessage: "Duplicate email constraint violation",
    category: "User",
  },
  USER_2003: {
    code: "USER_2003",
    httpStatus: 409,
    userMessage: "This username is already taken",
    internalMessage: "Duplicate username constraint violation",
    category: "User",
  },
  USER_2004: {
    code: "USER_2004",
    httpStatus: 400,
    userMessage: "Current password is incorrect",
    internalMessage: "Password change - current password mismatch",
    category: "User",
  },
  USER_2005: {
    code: "USER_2005",
    httpStatus: 400,
    userMessage: "Profile update failed. Please try again",
    internalMessage: "Error updating user profile",
    category: "User",
  },
  USER_2006: {
    code: "USER_2006",
    httpStatus: 400,
    userMessage: "Failed to upload profile picture",
    internalMessage: "Cloudinary upload failed",
    category: "User",
  },

  // ============ TOURNAMENT ERRORS (3xxx) ============
  TOUR_3001: {
    code: "TOUR_3001",
    httpStatus: 404,
    userMessage: "Tournament not found",
    internalMessage: "Tournament ID does not exist",
    category: "Tournament",
  },
  TOUR_3002: {
    code: "TOUR_3002",
    httpStatus: 400,
    userMessage: "Tournament registration has not started yet",
    internalMessage: "Registration start date in future",
    category: "Tournament",
  },
  TOUR_3003: {
    code: "TOUR_3003",
    httpStatus: 400,
    userMessage: "Tournament registration has closed",
    internalMessage: "Registration end date passed",
    category: "Tournament",
  },
  TOUR_3004: {
    code: "TOUR_3004",
    httpStatus: 400,
    userMessage: "Tournament is full",
    internalMessage: "Max teams reached for tournament",
    category: "Tournament",
  },
  TOUR_3005: {
    code: "TOUR_3005",
    httpStatus: 400,
    userMessage: "Tournament has already started",
    internalMessage: "Cannot modify - tournament in progress",
    category: "Tournament",
  },
  TOUR_3006: {
    code: "TOUR_3006",
    httpStatus: 400,
    userMessage: "Tournament has ended",
    internalMessage: "Tournament end date passed",
    category: "Tournament",
  },
  TOUR_3007: {
    code: "TOUR_3007",
    httpStatus: 400,
    userMessage: "Cannot delete tournament with registrations",
    internalMessage: "Tournament has active registrations",
    category: "Tournament",
  },
  TOUR_3008: {
    code: "TOUR_3008",
    httpStatus: 400,
    userMessage: "Invalid tournament dates",
    internalMessage: "Start date must be before end date",
    category: "Tournament",
  },
  TOUR_3009: {
    code: "TOUR_3009",
    httpStatus: 403,
    userMessage: "You are not the host of this tournament",
    internalMessage: "User is not the tournament host",
    category: "Tournament",
  },
  TOUR_3010: {
    code: "TOUR_3010",
    httpStatus: 400,
    userMessage: "Tournament name already exists",
    internalMessage: "Duplicate tournament name",
    category: "Tournament",
  },

  // ============ REGISTRATION ERRORS (4xxx) ============
  REG_4001: {
    code: "REG_4001",
    httpStatus: 400,
    userMessage: "You are already registered for this tournament",
    internalMessage: "Duplicate registration attempt",
    category: "Registration",
  },
  REG_4002: {
    code: "REG_4002",
    httpStatus: 404,
    userMessage: "Registration not found",
    internalMessage: "Registration ID does not exist",
    category: "Registration",
  },
  REG_4003: {
    code: "REG_4003",
    httpStatus: 400,
    userMessage: "Cannot cancel registration after tournament starts",
    internalMessage: "Registration cancellation deadline passed",
    category: "Registration",
  },
  REG_4004: {
    code: "REG_4004",
    httpStatus: 400,
    userMessage: "Your team is already registered for this tournament",
    internalMessage: "Team already registered",
    category: "Registration",
  },
  REG_4005: {
    code: "REG_4005",
    httpStatus: 400,
    userMessage: "Team does not have enough members for this tournament",
    internalMessage: "Team size below tournament minimum",
    category: "Registration",
  },
  REG_4006: {
    code: "REG_4006",
    httpStatus: 403,
    userMessage: "Only team captain can register the team",
    internalMessage: "Non-captain attempting team registration",
    category: "Registration",
  },
  REG_4007: {
    code: "REG_4007",
    httpStatus: 400,
    userMessage: "Registration fee payment required",
    internalMessage: "Entry fee not paid",
    category: "Registration",
  },
  REG_4008: {
    code: "REG_4008",
    httpStatus: 400,
    userMessage: "Insufficient wallet balance",
    internalMessage: "Wallet balance less than entry fee",
    category: "Registration",
  },
  REG_4009: {
    code: "REG_4009",
    httpStatus: 400,
    userMessage: "You're on the waitlist for this tournament",
    internalMessage: "User is in waitlist, not registered",
    category: "Registration",
  },
  REG_4010: {
    code: "REG_4010",
    httpStatus: 400,
    userMessage: "Check-in window is not open yet",
    internalMessage: "Check-in attempted before window opens",
    category: "Registration",
  },
  REG_4011: {
    code: "REG_4011",
    httpStatus: 400,
    userMessage: "Check-in window has closed",
    internalMessage: "Check-in attempted after window closes",
    category: "Registration",
  },
  REG_4012: {
    code: "REG_4012",
    httpStatus: 400,
    userMessage: "You have already checked in",
    internalMessage: "Duplicate check-in attempt",
    category: "Registration",
  },

  // ============ TEAM ERRORS (5xxx) ============
  TEAM_5001: {
    code: "TEAM_5001",
    httpStatus: 404,
    userMessage: "Team not found",
    internalMessage: "Team ID does not exist",
    category: "Team",
  },
  TEAM_5002: {
    code: "TEAM_5002",
    httpStatus: 409,
    userMessage: "Team name already exists",
    internalMessage: "Duplicate team name constraint violation",
    category: "Team",
  },
  TEAM_5003: {
    code: "TEAM_5003",
    httpStatus: 400,
    userMessage: "Team is full",
    internalMessage: "Max team members reached",
    category: "Team",
  },
  TEAM_5004: {
    code: "TEAM_5004",
    httpStatus: 400,
    userMessage: "Invalid team invite code",
    internalMessage: "Invite code does not match any team",
    category: "Team",
  },
  TEAM_5005: {
    code: "TEAM_5005",
    httpStatus: 400,
    userMessage: "You are already a member of this team",
    internalMessage: "User already in team",
    category: "Team",
  },
  TEAM_5006: {
    code: "TEAM_5006",
    httpStatus: 403,
    userMessage: "Only team captain can perform this action",
    internalMessage: "Non-captain action attempt",
    category: "Team",
  },
  TEAM_5007: {
    code: "TEAM_5007",
    httpStatus: 400,
    userMessage: "Captain cannot leave the team. Transfer ownership first",
    internalMessage: "Captain leave without ownership transfer",
    category: "Team",
  },
  TEAM_5008: {
    code: "TEAM_5008",
    httpStatus: 400,
    userMessage: "Cannot delete team with active registrations",
    internalMessage: "Team has tournament registrations",
    category: "Team",
  },
  TEAM_5009: {
    code: "TEAM_5009",
    httpStatus: 404,
    userMessage: "Team member not found",
    internalMessage: "User is not a member of this team",
    category: "Team",
  },

  // ============ PAYMENT/WALLET ERRORS (6xxx) ============
  PAY_6001: {
    code: "PAY_6001",
    httpStatus: 400,
    userMessage: "Insufficient balance",
    internalMessage: "Wallet balance insufficient for transaction",
    category: "Payment",
  },
  PAY_6002: {
    code: "PAY_6002",
    httpStatus: 400,
    userMessage: "Invalid transaction amount",
    internalMessage: "Transaction amount is zero or negative",
    category: "Payment",
  },
  PAY_6003: {
    code: "PAY_6003",
    httpStatus: 400,
    userMessage: "Payment processing failed",
    internalMessage: "Payment gateway error",
    category: "Payment",
  },
  PAY_6004: {
    code: "PAY_6004",
    httpStatus: 400,
    userMessage: "Refund failed. Please contact support",
    internalMessage: "Refund transaction failed",
    category: "Payment",
  },

  // ============ VALIDATION ERRORS (7xxx) ============
  VAL_7001: {
    code: "VAL_7001",
    httpStatus: 400,
    userMessage: "Please fill in all required fields",
    internalMessage: "Required field missing",
    category: "Validation",
  },
  VAL_7002: {
    code: "VAL_7002",
    httpStatus: 400,
    userMessage: "Invalid email format",
    internalMessage: "Email validation failed",
    category: "Validation",
  },
  VAL_7003: {
    code: "VAL_7003",
    httpStatus: 400,
    userMessage: "Password must be at least 8 characters",
    internalMessage: "Password too short",
    category: "Validation",
  },
  VAL_7004: {
    code: "VAL_7004",
    httpStatus: 400,
    userMessage: "Invalid date format",
    internalMessage: "Date parsing failed",
    category: "Validation",
  },
  VAL_7005: {
    code: "VAL_7005",
    httpStatus: 400,
    userMessage: "File size too large",
    internalMessage: "Upload exceeds max file size",
    category: "Validation",
  },
  VAL_7006: {
    code: "VAL_7006",
    httpStatus: 400,
    userMessage: "Invalid file type",
    internalMessage: "File type not allowed",
    category: "Validation",
  },
  VAL_7007: {
    code: "VAL_7007",
    httpStatus: 400,
    userMessage: "Username must be 3-20 characters",
    internalMessage: "Username length validation failed",
    category: "Validation",
  },
  VAL_7008: {
    code: "VAL_7008",
    httpStatus: 400,
    userMessage: "Input contains invalid characters",
    internalMessage: "Sanitization/XSS protection triggered",
    category: "Validation",
  },
  VAL_7009: {
    code: "VAL_7009",
    httpStatus: 413,
    userMessage: "Request too large",
    internalMessage: "Request body exceeds limit",
    category: "Validation",
  },

  // ============ DATABASE ERRORS (8xxx) ============
  DB_8001: {
    code: "DB_8001",
    httpStatus: 500,
    userMessage: "Unable to save data. Please try again",
    internalMessage: "Database insert failed",
    category: "Database",
  },
  DB_8002: {
    code: "DB_8002",
    httpStatus: 500,
    userMessage: "Unable to update data. Please try again",
    internalMessage: "Database update failed",
    category: "Database",
  },
  DB_8003: {
    code: "DB_8003",
    httpStatus: 500,
    userMessage: "Unable to delete data. Please try again",
    internalMessage: "Database delete failed",
    category: "Database",
  },
  DB_8004: {
    code: "DB_8004",
    httpStatus: 500,
    userMessage: "Service temporarily unavailable",
    internalMessage: "Database connection failed",
    category: "Database",
  },
  DB_8005: {
    code: "DB_8005",
    httpStatus: 500,
    userMessage: "Operation timed out. Please try again",
    internalMessage: "Database query timeout",
    category: "Database",
  },
  DB_8006: {
    code: "DB_8006",
    httpStatus: 409,
    userMessage: "Data conflict. Please refresh and try again",
    internalMessage: "Unique constraint violation",
    category: "Database",
  },

  // ============ SERVER ERRORS (9xxx) ============
  SRV_9001: {
    code: "SRV_9001",
    httpStatus: 500,
    userMessage: "Something went wrong. Please try again later",
    internalMessage: "Unhandled server error",
    category: "Server",
  },
  SRV_9002: {
    code: "SRV_9002",
    httpStatus: 503,
    userMessage: "Service temporarily unavailable",
    internalMessage: "Service dependency down",
    category: "Server",
  },
  SRV_9003: {
    code: "SRV_9003",
    httpStatus: 429,
    userMessage: "Too many requests. Please slow down",
    internalMessage: "Rate limit exceeded",
    category: "Server",
  },
  SRV_9004: {
    code: "SRV_9004",
    httpStatus: 500,
    userMessage: "Email delivery failed. Please try again",
    internalMessage: "SMTP/Email service error",
    category: "Server",
  },
  SRV_9005: {
    code: "SRV_9005",
    httpStatus: 500,
    userMessage: "File upload failed. Please try again",
    internalMessage: "Cloudinary/Storage service error",
    category: "Server",
  },
  SRV_9006: {
    code: "SRV_9006",
    httpStatus: 500,
    userMessage: "Notification delivery failed",
    internalMessage: "Push notification service error",
    category: "Server",
  },

  // ============ CHAT ERRORS (10xx) ============
  CHAT_1001: {
    code: "CHAT_1001",
    httpStatus: 400,
    userMessage: "Message cannot be empty",
    internalMessage: "Empty chat message",
    category: "Chat",
  },
  CHAT_1002: {
    code: "CHAT_1002",
    httpStatus: 400,
    userMessage: "Message too long",
    internalMessage: "Chat message exceeds max length",
    category: "Chat",
  },
  CHAT_1003: {
    code: "CHAT_1003",
    httpStatus: 403,
    userMessage: "You must be registered to chat in this tournament",
    internalMessage: "User not registered for tournament chat",
    category: "Chat",
  },
  CHAT_1004: {
    code: "CHAT_1004",
    httpStatus: 429,
    userMessage: "You're sending messages too fast",
    internalMessage: "Chat rate limit exceeded",
    category: "Chat",
  },
};

// ============ HELPER FUNCTIONS ============

/**
 * Get error info by code
 */
export function getErrorInfo(code: string): ErrorCodeInfo {
  return ERROR_CODES[code] || ERROR_CODES.SRV_9001;
}

/**
 * Create an error response object with error code
 */
export function createErrorResponse(code: string, additionalContext?: string) {
  const errorInfo = getErrorInfo(code);
  
  // Log internal message for debugging
  console.error(`[${errorInfo.code}] ${errorInfo.internalMessage}${additionalContext ? ` - ${additionalContext}` : ""}`);
  
  return {
    success: false,
    message: errorInfo.userMessage,
    errorCode: errorInfo.code,
    httpStatus: errorInfo.httpStatus,
  };
}

/**
 * Log error with full context (for server-side debugging)
 */
export function logError(code: string, error?: unknown, context?: Record<string, unknown>) {
  const errorInfo = getErrorInfo(code);
  const timestamp = new Date().toISOString();
  
  console.error(`
================================================================================
[ERROR] ${timestamp}
--------------------------------------------------------------------------------
Code: ${errorInfo.code}
Category: ${errorInfo.category}
HTTP Status: ${errorInfo.httpStatus}
Internal Message: ${errorInfo.internalMessage}
User Message: ${errorInfo.userMessage}
${context ? `Context: ${JSON.stringify(context, null, 2)}` : ""}
${error instanceof Error ? `Stack: ${error.stack}` : error ? `Raw Error: ${JSON.stringify(error)}` : ""}
================================================================================
`);
}

/**
 * Map common error patterns to error codes
 */
export function getErrorCodeFromError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // JWT errors
    if (message.includes("jwt") && message.includes("expired")) return "AUTH_1002";
    if (message.includes("jwt") || message.includes("token")) return "AUTH_1004";
    
    // Database errors
    if ("code" in error) {
      const pgError = error as Error & { code: string };
      if (pgError.code === "23505") return "DB_8006"; // Unique violation
      if (pgError.code === "23503") return "DB_8001"; // Foreign key
      if (pgError.code === "08006") return "DB_8004"; // Connection error
      if (pgError.code === "57014") return "DB_8005"; // Query timeout
    }
  }
  
  return "SRV_9001"; // Default server error
}
