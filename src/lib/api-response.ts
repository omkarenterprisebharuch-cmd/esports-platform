import { NextResponse } from "next/server";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/**
 * Success response helper
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status }
  );
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
