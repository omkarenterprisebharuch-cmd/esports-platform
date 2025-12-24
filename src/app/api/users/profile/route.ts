import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromHeader } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";

/**
 * GET /api/users/profile
 * Get current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = getUserFromHeader(authHeader);

    if (!user) {
      return unauthorizedResponse();
    }

    const result = await pool.query(
      `SELECT 
        id, 
        username, 
        email, 
        full_name,
        phone_number,
        in_game_ids,
        is_host, 
        is_verified,
        profile_picture_url, 
        wallet_balance,
        created_at
      FROM users WHERE id = $1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return unauthorizedResponse("User not found");
    }

    const userData = result.rows[0];
    return successResponse({ 
      user: {
        ...userData,
        avatar_url: userData.profile_picture_url,
      }
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = getUserFromHeader(authHeader);

    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { username, phone_number, in_game_ids, avatar_url, full_name } = body;

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (username !== undefined) {
      // Check if username is taken
      const existing = await pool.query(
        "SELECT id FROM users WHERE username = $1 AND id != $2",
        [username, user.id]
      );
      if (existing.rows.length > 0) {
        return errorResponse("Username is already taken");
      }
      updates.push(`username = $${paramIndex}`);
      values.push(username);
      paramIndex++;
    }

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramIndex}`);
      values.push(full_name);
      paramIndex++;
    }

    if (phone_number !== undefined) {
      updates.push(`phone_number = $${paramIndex}`);
      values.push(phone_number);
      paramIndex++;
    }

    if (in_game_ids !== undefined) {
      updates.push(`in_game_ids = $${paramIndex}`);
      values.push(JSON.stringify(in_game_ids));
      paramIndex++;
    }

    if (avatar_url !== undefined) {
      updates.push(`profile_picture_url = $${paramIndex}`);
      values.push(avatar_url);
      paramIndex++;
    }

    if (updates.length === 0) {
      return errorResponse("No fields to update");
    }

    updates.push(`updated_at = NOW()`);
    values.push(user.id);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex} 
       RETURNING id, username, email, full_name, phone_number, in_game_ids, is_host, profile_picture_url as avatar_url`,
      values
    );

    return successResponse(
      { user: result.rows[0] },
      "Profile updated successfully"
    );
  } catch (error) {
    console.error("Update profile error:", error);
    return serverErrorResponse(error);
  }
}
