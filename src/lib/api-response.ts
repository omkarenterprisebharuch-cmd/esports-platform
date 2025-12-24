import { NextResponse } from "next/server";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
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
 * Unauthorized response
 */
export function unauthorizedResponse(
  message: string = "Unauthorized"
): NextResponse<ApiResponse> {
  return errorResponse(message, 401);
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
