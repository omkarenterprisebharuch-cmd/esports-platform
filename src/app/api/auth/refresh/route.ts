import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  hashToken,
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  generateCsrfToken,
  AUTH_COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
  CSRF_COOKIE_OPTIONS,
} from "@/lib/auth";
import { errorResponse, serverErrorResponse } from "@/lib/api-response";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// Rate limit for refresh: 30 attempts per minute
const refreshRateLimit = { maxRequests: 30, windowSeconds: 60, prefix: "refresh" };

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 * - Validates refresh token from httpOnly cookie
 * - Rotates refresh token (revokes old, issues new)
 * - Returns new access token and refresh token
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(clientIp, refreshRateLimit);
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    // Get refresh token from cookie
    const refreshToken = request.cookies.get(REFRESH_COOKIE_OPTIONS.name)?.value;
    if (!refreshToken) {
      return errorResponse("No refresh token provided", 401);
    }

    // Hash the token to look up in database
    const tokenHash = hashToken(refreshToken);

    // Find the refresh token in database (including user role and email_verified)
    const tokenResult = await pool.query(
      `SELECT rt.*, u.id as user_id, u.email, u.username, u.is_host, 
              COALESCE(u.role, 'player') as role,
              COALESCE(u.email_verified, FALSE) as email_verified
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token_hash = $1 
         AND rt.revoked = FALSE 
         AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      // Token not found, revoked, or expired
      // Clear the invalid cookie
      const response = errorResponse("Invalid or expired refresh token", 401);
      response.cookies.set(REFRESH_COOKIE_OPTIONS.name, "", {
        ...REFRESH_COOKIE_OPTIONS,
        maxAge: 0,
      });
      response.cookies.set(AUTH_COOKIE_OPTIONS.name, "", {
        ...AUTH_COOKIE_OPTIONS,
        maxAge: 0,
      });
      return response;
    }

    const tokenRecord = tokenResult.rows[0];
    const user = {
      id: tokenRecord.user_id,
      email: tokenRecord.email,
      username: tokenRecord.username,
      is_host: tokenRecord.is_host,
      role: tokenRecord.role,
      email_verified: tokenRecord.email_verified,
    };

    // TOKEN ROTATION: Revoke the old refresh token
    await pool.query(
      `UPDATE refresh_tokens 
       SET revoked = TRUE, revoked_at = NOW() 
       WHERE token_hash = $1`,
      [tokenHash]
    );

    // Generate new access token (with role and email_verified)
    const newAccessToken = generateAccessToken(user);

    // Generate new refresh token (rotation)
    const { token: newRefreshToken, hash: newRefreshTokenHash } = generateRefreshToken();
    const newRefreshTokenExpiry = getRefreshTokenExpiry();

    // Get device info
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Store new refresh token hash in database
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, newRefreshTokenHash, newRefreshTokenExpiry, userAgent, clientIp]
    );

    // Generate new CSRF token
    const csrfToken = generateCsrfToken(user.id);

    // Create response
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          is_host: user.is_host,
        },
        csrfToken,
      },
    });

    // Set new access token cookie
    response.cookies.set(AUTH_COOKIE_OPTIONS.name, newAccessToken, {
      httpOnly: AUTH_COOKIE_OPTIONS.httpOnly,
      secure: AUTH_COOKIE_OPTIONS.secure,
      sameSite: AUTH_COOKIE_OPTIONS.sameSite,
      path: AUTH_COOKIE_OPTIONS.path,
      maxAge: AUTH_COOKIE_OPTIONS.maxAge,
    });

    // Set new refresh token cookie
    response.cookies.set(REFRESH_COOKIE_OPTIONS.name, newRefreshToken, {
      httpOnly: REFRESH_COOKIE_OPTIONS.httpOnly,
      secure: REFRESH_COOKIE_OPTIONS.secure,
      sameSite: REFRESH_COOKIE_OPTIONS.sameSite,
      path: REFRESH_COOKIE_OPTIONS.path,
      maxAge: REFRESH_COOKIE_OPTIONS.maxAge,
    });

    // Set new CSRF token cookie
    response.cookies.set(CSRF_COOKIE_OPTIONS.name, csrfToken, {
      httpOnly: CSRF_COOKIE_OPTIONS.httpOnly,
      secure: CSRF_COOKIE_OPTIONS.secure,
      sameSite: CSRF_COOKIE_OPTIONS.sameSite,
      path: CSRF_COOKIE_OPTIONS.path,
      maxAge: CSRF_COOKIE_OPTIONS.maxAge,
    });

    return response;
  } catch (error) {
    console.error("Token refresh error:", error);
    return serverErrorResponse(error);
  }
}
