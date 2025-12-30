import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { generateAccessToken } from "@/lib/auth";
import { verifyOTP } from "@/lib/otp";
import { getPendingRegistration, deletePendingRegistration } from "@/lib/pending-registrations";
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
import { 
  verifyOtpSchema, 
  validateWithSchema, 
  validationErrorResponse 
} from "@/lib/validations";

/**
 * POST /api/auth/verify-otp
 * Verify OTP and complete registration
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
    const validation = validateWithSchema(verifyOtpSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }
    
    const { email, otp } = validation.data;

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

    // Create user in database with email_verified = TRUE (OTP verified email)
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, is_verified, email_verified)
       VALUES ($1, $2, $3, TRUE, TRUE) RETURNING id, username, email, is_host, email_verified`,
      [pendingData.username, pendingData.email, pendingData.hashedPassword]
    );

    // Clean up pending registration
    deletePendingRegistration(email);

    const user = result.rows[0];
    const token = generateAccessToken({
      id: user.id,
      email: user.email,
      username: user.username,
      is_host: user.is_host || false,
      email_verified: user.email_verified,
    });

    return successResponse({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_host: user.is_host,
        email_verified: user.email_verified,
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
