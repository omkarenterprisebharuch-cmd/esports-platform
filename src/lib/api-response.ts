import { NextResponse } from "next/server";
import { ZodError } from "zod";

// ============ Type Definitions ============

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
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
 * Error response helper
 */
export function errorResponse(
  message: string,
  status: number = 400,
  error?: string
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      message,
      error,
    },
    { status }
  );
}

/**
 * Unauthorized response (401)
 */
export function unauthorizedResponse(
  message: string = "Unauthorized"
): NextResponse<ApiResponse> {
  return errorResponse(message, 401);
}

/**
 * Forbidden response (403) - Authenticated but not authorized
 */
export function forbiddenResponse(
  message: string = "Forbidden"
): NextResponse<ApiResponse> {
  return errorResponse(message, 403);
}

/**
 * Email verification required response (403)
 * Used when user is authenticated but hasn't verified their email
 */
export function emailVerificationRequiredResponse(
  message: string = "Please verify your email address to perform this action"
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      message,
      error: "EMAIL_VERIFICATION_REQUIRED",
    },
    { status: 403 }
  );
}

/**
 * Not found response
 */
export function notFoundResponse(
  message: string = "Not found"
): NextResponse<ApiResponse> {
  return errorResponse(message, 404);
}

/**
 * Server error response
 */
export function serverErrorResponse(
  error: unknown
): NextResponse<ApiResponse> {
  console.error("Server error:", error);
  const message = error instanceof Error ? error.message : "Internal server error";
  return errorResponse(message, 500);
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
 * Create a typed API error
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
 * Converts various error types to consistent API responses
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  // Log all errors for debugging
  console.error("[API Error]:", error);

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const errors = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return NextResponse.json(
      {
        success: false as const,
        message: errors[0]?.message || "Validation failed",
        errors,
      },
      { status: 400 }
    );
  }

  // Handle typed API errors
  if (error instanceof Error && "type" in error && "statusCode" in error) {
    const apiError = error as ApiError;
    return NextResponse.json(
      {
        success: false as const,
        message: apiError.message,
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
      return NextResponse.json(
        {
          success: false as const,
          message: `A record with this ${field} already exists`,
          error: "CONFLICT",
        },
        { status: 409 }
      );
    }
    
    // Foreign key violation
    if (pgError.code === "23503") {
      return NextResponse.json(
        {
          success: false as const,
          message: "Referenced record does not exist",
          error: "NOT_FOUND",
        },
        { status: 400 }
      );
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    // Don't expose internal error messages in production
    const message = process.env.NODE_ENV === "production" 
      ? "An unexpected error occurred" 
      : error.message;
    
    return NextResponse.json(
      {
        success: false as const,
        message,
        error: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }

  // Handle unknown errors
  return NextResponse.json(
    {
      success: false as const,
      message: "An unexpected error occurred",
      error: "SERVER_ERROR",
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
