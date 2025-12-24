import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { generateToken } from "@/lib/auth";
import { verifyOTP } from "@/lib/otp";
import { getPendingRegistration, deletePendingRegistration } from "@/lib/pending-registrations";
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from "@/lib/api-response";

/**
 * POST /api/auth/verify-otp
 * Verify OTP and complete registration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return errorResponse("Email and OTP are required");
    }

    // Verify OTP
    const verification = verifyOTP(email, otp);
    if (!verification.valid) {
      return errorResponse(verification.message);
    }

    // Get pending registration data
    const pendingData = getPendingRegistration(email);
    if (!pendingData) {
      return errorResponse(
        "Registration session expired. Please start again."
      );
    }

    // Create user in database
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, is_verified)
       VALUES ($1, $2, $3, TRUE) RETURNING id, username, email, is_host`,
      [pendingData.username, pendingData.email, pendingData.hashedPassword]
    );

    // Clean up pending registration
    deletePendingRegistration(email);

    const user = result.rows[0];
    const token = generateToken(user);

    return successResponse({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_host: user.is_host,
      },
    }, "Registration successful");
  } catch (error) {
    console.error("Verify OTP error:", error);

    if ((error as { code?: string }).code === "23505") {
      return errorResponse(
        "User with this email or username already exists"
      );
    }
    return serverErrorResponse(error);
  }
}
