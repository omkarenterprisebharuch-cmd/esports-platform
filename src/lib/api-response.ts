import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { 
  ERROR_CODES, 
  getErrorInfo, 
  logError, 
  getErrorCodeFromError,
  type ErrorCodeInfo 
} from "./error-codes";

// ============ Type Definitions ============

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errorCode?: string;  // New: Display error code to users
  errors?: { field: string; message: string }[];
}

export interface ApiSuccessResponse<T> extends ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse extends ApiResponse<never> {
  success: false;
  message: string;
}

interface CacheOptions {
  /** Cache duration in seconds for browser/CDN caching */
  maxAge?: number;
  /** Stale-while-revalidate duration in seconds */
  staleWhileRevalidate?: number;
  /** Whether the response is private (user-specific) */
  isPrivate?: boolean;
}

/**
 * Success response helper with optional caching headers
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200,
  cacheOptions?: CacheOptions
): NextResponse<ApiResponse<T>> {
  const response = NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status }
  );

  // Add cache headers if specified
  if (cacheOptions) {
    const { maxAge = 0, staleWhileRevalidate = 0, isPrivate = true } = cacheOptions;
    const cacheControl = isPrivate
      ? `private, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
      : `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
    response.headers.set("Cache-Control", cacheControl);
  }

  return response;
}

/**
 * Error response helper with error code support
 */
export function errorResponse(
  messageOrCode: string,
  status: number = 400,
  error?: string
): NextResponse<ApiResponse> {
  // Check if it's an error code
  const errorInfo = ERROR_CODES[messageOrCode];
  
  if (errorInfo) {
    // Log internally with full details
    logError(messageOrCode);
    
    return NextResponse.json(
      {
        success: false,
        message: errorInfo.userMessage,
        errorCode: errorInfo.code,
        error: errorInfo.category.toUpperCase() + "_ERROR",
      },
      { status: errorInfo.httpStatus }
    );
  }
  
  // Legacy: plain message string
  return NextResponse.json(
    {
      success: false,
      message: messageOrCode,
      error,
    },
    { status }
  );
}

/**
 * Unauthorized response (401) - with error code support
 */
export function unauthorizedResponse(
  codeOrMessage: string = "AUTH_1001"
): NextResponse<ApiResponse> {
  // If it's an error code, use the error codes system
  if (ERROR_CODES[codeOrMessage]) {
    return errorResponse(codeOrMessage);
  }
  // Legacy: plain message
  return errorResponse(codeOrMessage, 401);
}

/**
 * Forbidden response (403) - with error code support
 */
export function forbiddenResponse(
  codeOrMessage: string = "AUTH_1201"
): NextResponse<ApiResponse> {
  if (ERROR_CODES[codeOrMessage]) {
    return errorResponse(codeOrMessage);
  }
  return errorResponse(codeOrMessage, 403);
}

/**
 * Email verification required response (403)
 * Used when user is authenticated but hasn't verified their email
 */
export function emailVerificationRequiredResponse(
  message: string = "Please verify your email address to perform this action"
): NextResponse<ApiResponse> {
  return errorResponse("AUTH_1005");
}

/**
 * Not found response - with error code support
 */
export function notFoundResponse(
  codeOrMessage: string = "Not found"
): NextResponse<ApiResponse> {
  if (ERROR_CODES[codeOrMessage]) {
    return errorResponse(codeOrMessage);
  }
  return errorResponse(codeOrMessage, 404);
}

/**
 * Server error response - with error code support
 */
export function serverErrorResponse(
  error: unknown
): NextResponse<ApiResponse> {
  const errorCode = getErrorCodeFromError(error);
  logError(errorCode, error);
  return errorResponse(errorCode);
}

// ============ Centralized Error Handler ============

export type ApiErrorType = 
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "SERVER_ERROR";

interface ApiError extends Error {
  type: ApiErrorType;
  statusCode: number;
  details?: Record<string, unknown>;
}

/**
 * Create a typed API error with error code
 */
export function createCodedError(
  errorCode: string,
  context?: Record<string, unknown>
): Error & { errorCode: string } {
  const errorInfo = getErrorInfo(errorCode);
  const error = new Error(errorInfo.internalMessage) as Error & { errorCode: string };
  error.errorCode = errorCode;
  
  // Log immediately when error is created
  logError(errorCode, undefined, context);
  
  return error;
}

/**
 * Create a typed API error (legacy support)
 */
export function createApiError(
  type: ApiErrorType,
  message: string,
  details?: Record<string, unknown>
): ApiError {
  const statusCodes: Record<ApiErrorType, number> = {
    VALIDATION_ERROR: 400,
    AUTHENTICATION_ERROR: 401,
    AUTHORIZATION_ERROR: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    RATE_LIMIT: 429,
    SERVER_ERROR: 500,
  };

  const error = new Error(message) as ApiError;
  error.type = type;
  error.statusCode = statusCodes[type];
  error.details = details;
  return error;
}

/**
 * Centralized error handler for API routes
 * Converts various error types to consistent API responses with error codes
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const errors = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    
    logError("VAL_7001", error, { validationErrors: errors });
    
    return NextResponse.json(
      {
        success: false as const,
        message: errors[0]?.message || "Validation failed",
        errorCode: "VAL_7001",
        errors,
      },
      { status: 400 }
    );
  }

  // Handle typed API errors (with error codes)
  if (error instanceof Error && "errorCode" in error) {
    const apiError = error as Error & { errorCode: string };
    const errorInfo = getErrorInfo(apiError.errorCode);
    logError(apiError.errorCode, error);
    
    return NextResponse.json(
      {
        success: false as const,
        message: errorInfo.userMessage,
        errorCode: errorInfo.code,
      },
      { status: errorInfo.httpStatus }
    );
  }

  // Handle legacy typed API errors
  if (error instanceof Error && "type" in error && "statusCode" in error) {
    const apiError = error as ApiError;
    const errorCode = getErrorCodeFromError(error);
    logError(errorCode, error);
    
    return NextResponse.json(
      {
        success: false as const,
        message: apiError.message,
        errorCode,
        error: apiError.type,
      },
      { status: apiError.statusCode }
    );
  }

  // Handle PostgreSQL errors
  if (error instanceof Error && "code" in error) {
    const pgError = error as Error & { code: string; constraint?: string };
    
    // Unique constraint violation
    if (pgError.code === "23505") {
      const field = pgError.constraint?.replace(/_key$|_unique$/, "") || "field";
      logError("DB_8006", error, { constraint: pgError.constraint, field });
      
      return NextResponse.json(
        {
          success: false as const,
          message: `A record with this ${field} already exists`,
          errorCode: "DB_8006",
        },
        { status: 409 }
      );
    }
    
    // Foreign key violation
    if (pgError.code === "23503") {
      logError("DB_8001", error, { constraint: pgError.constraint });
      
      return NextResponse.json(
        {
          success: false as const,
          message: "Referenced record does not exist",
          errorCode: "DB_8001",
        },
        { status: 400 }
      );
    }
    
    // Connection error
    if (pgError.code === "08006") {
      logError("DB_8004", error);
      const info = getErrorInfo("DB_8004");
      return NextResponse.json(
        {
          success: false as const,
          message: info.userMessage,
          errorCode: "DB_8004",
        },
        { status: info.httpStatus }
      );
    }
    
    // Query timeout
    if (pgError.code === "57014") {
      logError("DB_8005", error);
      const info = getErrorInfo("DB_8005");
      return NextResponse.json(
        {
          success: false as const,
          message: info.userMessage,
          errorCode: "DB_8005",
        },
        { status: info.httpStatus }
      );
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const errorCode = getErrorCodeFromError(error);
    logError(errorCode, error);
    const errorInfo = getErrorInfo(errorCode);
    
    return NextResponse.json(
      {
        success: false as const,
        message: errorInfo.userMessage,
        errorCode: errorInfo.code,
      },
      { status: errorInfo.httpStatus }
    );
  }

  // Handle unknown errors
  logError("SRV_9001", error);
  const defaultInfo = getErrorInfo("SRV_9001");
  
  return NextResponse.json(
    {
      success: false as const,
      message: defaultInfo.userMessage,
      errorCode: "SRV_9001",
    },
    { status: 500 }
  );
}

/**
 * Wrapper for API route handlers with automatic error handling
 * Usage: export const POST = withErrorHandler(async (request) => { ... });
 */
export function withErrorHandler<T>(
  handler: (request: Request, context?: { params: Record<string, string> }) => Promise<NextResponse<T>>
) {
  return async (
    request: Request,
    context?: { params: Record<string, string> }
  ): Promise<NextResponse<T | ApiErrorResponse>> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleApiError(error) as NextResponse<T | ApiErrorResponse>;
    }
  };
}
