import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { generateOTP, storeOTP } from "@/lib/otp";
import { sendOTPEmail } from "@/lib/email";
import { storePendingRegistration } from "@/lib/pending-registrations";
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from "@/lib/api-response";

/**
 * POST /api/auth/send-otp
 * Send OTP for email verification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, password } = body;

    // Validate input
    if (!username || !email || !password) {
      return errorResponse("Username, email, and password are required");
    }

    // Check if email already exists
    const existingEmail = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    if (existingEmail.rows.length > 0) {
      return errorResponse("User with this email already exists");
    }

    // Check if username already exists
    const existingUsername = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );
    if (existingUsername.rows.length > 0) {
      return errorResponse("Username is already taken");
    }

    // Generate and store OTP
    const otp = generateOTP();
    storeOTP(email, otp);

    // Store pending registration data temporarily
    const hashedPassword = await hashPassword(password);
    storePendingRegistration(email, {
      username,
      email,
      hashedPassword,
    });

    // Send OTP email
    await sendOTPEmail(email, otp, username);

    console.log(`OTP sent to ${email}: ${otp}`);
    return successResponse(null, "OTP sent successfully to your email");
  } catch (error) {
    console.error("Send OTP error:", error);
    return serverErrorResponse(error);
  }
}
