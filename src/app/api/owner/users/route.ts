import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import {
  successResponse,
  forbiddenResponse,
  serverErrorResponse,
  errorResponse,
} from "@/lib/api-response";
import { UserRole } from "@/types";
import { decryptPhoneNumber } from "@/lib/encryption";

/**
 * GET /api/owner/users
 * Get all users with their roles (Owner only)
 * Query params:
 *   - page: page number (default 1)
 *   - limit: items per page (default 20)
 *   - search: search by username or email
 *   - role: filter by role
 */
export async function GET(request: NextRequest) {
  try {
    // Verify owner role
    const user = requireOwner(request);
    if (!user) {
      return forbiddenResponse("Owner access required");
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const search = searchParams.get("search")?.trim() || "";
    const roleFilter = searchParams.get("role") as UserRole | null;
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(username ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (roleFilter && ["player", "organizer", "owner"].includes(roleFilter)) {
      conditions.push(`COALESCE(role, 'player') = $${paramIndex}`);
      params.push(roleFilter);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      params
    );
    const totalUsers = parseInt(countResult.rows[0].count);

    // Get users
    const usersResult = await pool.query(
      `SELECT 
         id, username, email, full_name, phone_number,
         is_host, is_verified, is_active,
         COALESCE(role, 'player') as role,
         profile_picture_url as avatar_url,
         created_at, last_login_at
       FROM users 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    // Decrypt phone numbers for admin view
    const users = usersResult.rows.map(user => ({
      ...user,
      phone_number: decryptPhoneNumber(user.phone_number),
    }));

    return successResponse({
      users,
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * PATCH /api/owner/users
 * Update user role (Owner only)
 * Body: { userId: string, role: "player" | "organizer" | "owner" }
 */
export async function PATCH(request: NextRequest) {
  try {
    // Verify owner role
    const currentUser = requireOwner(request);
    if (!currentUser) {
      return forbiddenResponse("Owner access required");
    }

    const body = await request.json();
    const { userId, role } = body;

    // Validate input
    if (!userId || typeof userId !== "string") {
      return errorResponse("User ID is required", 400);
    }

    if (!role || !["player", "organizer", "owner"].includes(role)) {
      return errorResponse("Valid role is required (player, organizer, owner)", 400);
    }

    // Prevent owner from demoting themselves
    if (userId === currentUser.id && role !== "owner") {
      return errorResponse("You cannot demote yourself from owner role", 400);
    }

    // Update user role
    const result = await pool.query(
      `UPDATE users 
       SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, email, COALESCE(role, 'player') as role, is_host`,
      [role, userId]
    );

    if (result.rows.length === 0) {
      return errorResponse("User not found", 404);
    }

    const updatedUser = result.rows[0];

    return successResponse({
      message: `User ${updatedUser.username} role updated to ${role}`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update user role error:", error);
    return serverErrorResponse(error);
  }
}
