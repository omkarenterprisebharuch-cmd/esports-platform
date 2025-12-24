import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { generateOTP, storeOTP } from "@/lib/otp";
import { sendPasswordResetOTPEmail } from "@/lib/email";
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from "@/lib/api-response";

/**
 * POST /api/auth/forgot-password
 * Send OTP for password reset
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return errorResponse("Email is required");
    }

    // Check if user exists
    const result = await pool.query(
      "SELECT id, username FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      // Don't reveal if user exists or not
      return successResponse(
        null,
        "If an account exists with this email, an OTP will be sent"
      );
    }

    const user = result.rows[0];

    // Generate and store OTP
    const otp = generateOTP();
    storeOTP(email, otp);

    // Send OTP email
    await sendPasswordResetOTPEmail(email, otp, user.username);

    console.log(`Password reset OTP sent to ${email}: ${otp}`);
    return successResponse(
      null,
      "If an account exists with this email, an OTP will be sent"
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return serverErrorResponse(error);
  }
}
