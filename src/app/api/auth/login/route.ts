import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { verifyPassword, generateToken } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from "@/lib/api-response";

/**
 * POST /api/auth/login
 * User login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse("Email and password are required");
    }

    // Find user by email
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return errorResponse("Invalid credentials", 401);
    }

    const user = result.rows[0];

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return errorResponse("Invalid credentials", 401);
    }

    // Generate token
    const token = generateToken(user);

    return successResponse({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_host: user.is_host,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return serverErrorResponse(error);
  }
}
