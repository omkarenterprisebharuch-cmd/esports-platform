import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { verifyOTP } from "@/lib/otp";
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from "@/lib/api-response";

/**
 * POST /api/auth/reset-password
 * Reset password after OTP verification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, newPassword } = body;

    if (!email || !otp || !newPassword) {
      return errorResponse("Email, OTP, and new password are required");
    }

    if (newPassword.length < 6) {
      return errorResponse("Password must be at least 6 characters");
    }

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

    return successResponse(null, "Password reset successful");
  } catch (error) {
    console.error("Reset password error:", error);
    return serverErrorResponse(error);
  }
}
