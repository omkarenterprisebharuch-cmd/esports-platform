import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { decryptUserPII } from "@/lib/encryption";

/**
 * GET /api/auth/me
 * Get current user info including role
 */
export async function GET(request: NextRequest) {
  try {
    const tokenUser = getUserFromRequest(request);

    if (!tokenUser) {
      return unauthorizedResponse();
    }

    const result = await pool.query(
      `SELECT id, username, email, full_name, phone_number, is_host, is_verified, 
              profile_picture_url, in_game_ids, wallet_balance, 
              COALESCE(role, 'player') as role,
              COALESCE(email_verified, FALSE) as email_verified
       FROM users WHERE id = $1`,
      [tokenUser.id]
    );

    if (result.rows.length === 0) {
      return unauthorizedResponse("User not found");
    }

    // Decrypt PII fields (phone_number, in_game_ids)
    const user = decryptUserPII(result.rows[0]);
    
    return successResponse({
      ...user,
      avatar_url: user.profile_picture_url, // alias for frontend compatibility
      is_admin: user.role === "owner", // is_admin = true if owner role
    });
  } catch (error) {
    console.error("Get me error:", error);
    return serverErrorResponse(error);
  }
}
