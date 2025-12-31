import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { verifyOTP } from "@/lib/otp";
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { 
  checkRateLimit, 
  getClientIp, 
  loginRateLimit, 
  rateLimitResponse 
} from "@/lib/rate-limit";
import { z } from "zod";
import { 
  emailSchema, 
  otpSchema, 
  passwordSchema,
  validateWithSchema, 
  validationErrorResponse 
} from "@/lib/validations";

// Serverless configuration - password reset is infrequent
export const maxDuration = 10;
export const dynamic = "force-dynamic";

// Schema for reset password (email + otp + newPassword)
const resetPasswordWithOtpSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  newPassword: passwordSchema,
});

/**
 * POST /api/auth/reset-password
 * Reset password after OTP verification
 * Rate limited: 5 attempts per 15 minutes
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting (same as login - prevents brute force)
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(clientIp, loginRateLimit);
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = await request.json();
    
    // Validate input with Zod
    const validation = validateWithSchema(resetPasswordWithOtpSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }
    
    const { email, otp, newPassword } = validation.data;

    // Verify OTP
    const verification = verifyOTP(email, otp);
    if (!verification.valid) {
      return errorResponse(verification.message);
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    const result = await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING id",
      [hashedPassword, email]
    );

    if (result.rows.length === 0) {
      return errorResponse("User not found", 404);
    }

    const userId = result.rows[0].id;

    // Force logout: Revoke all refresh tokens for this user
    // This ensures all active sessions are invalidated on password change
    await pool.query(
      `UPDATE refresh_tokens 
       SET revoked = TRUE, revoked_at = NOW() 
       WHERE user_id = $1 AND revoked = FALSE`,
      [userId]
    );

    return successResponse(null, "Password reset successful. Please login with your new password.");
  } catch (error) {
    console.error("Reset password error:", error);
    return serverErrorResponse(error);
  }
}
