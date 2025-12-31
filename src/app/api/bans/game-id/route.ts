/**
 * Game ID Bans API - Manage Banned Game IDs
 * 
 * GET - List banned game IDs (admin) or check if a specific ID is banned
 * POST - Ban a game ID (admin only)
 */

import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { sanitizeText } from "@/lib/sanitize";
import { z } from "zod";
import { isGameIdBanned } from "@/lib/ban-check";

// Serverless configuration - ban management is infrequent
export const maxDuration = 15;
export const dynamic = "force-dynamic";

// Validation schema for banning a game ID
const banGameIdSchema = z.object({
  game_id: z.string().min(1).max(100),
  game_type: z.enum(["freefire", "pubg", "valorant", "codm", "bgmi"]),
  reason: z.string().min(5).max(500),
  is_permanent: z.boolean().default(true),
  ban_duration_days: z.number().min(1).max(365).optional(), // For temp bans
  original_user_id: z.string().uuid().optional(),
  report_id: z.number().optional(),
});

/**
 * GET /api/bans/game-id - List banned game IDs or check specific ID
 * 
 * Query params:
 * - check=true&game_id=xxx&game_type=xxx - Check if specific ID is banned
 * - Otherwise lists all bans (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isCheck = searchParams.get("check") === "true";

    // Public check for specific game ID
    if (isCheck) {
      const gameId = searchParams.get("game_id");
      const gameType = searchParams.get("game_type");

      if (!gameId || !gameType) {
        return errorResponse("game_id and game_type are required", 400);
      }

      const banStatus = await isGameIdBanned(gameId, gameType);
      return successResponse(banStatus);
    }

    // Admin: List all bans
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (user.role !== "owner" && user.role !== "organizer") {
      return errorResponse("Admin access required", 403);
    }

    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = (page - 1) * limit;
    const gameType = searchParams.get("game_type");
    const activeOnly = searchParams.get("active") !== "false";

    // Build query
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (activeOnly) {
      conditions.push("b.is_active = TRUE");
    }

    if (gameType) {
      conditions.push(`b.game_type = $${paramIndex}`);
      params.push(gameType);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM banned_game_ids b ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get bans with related data
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT 
        b.*,
        banner.username as banned_by_username,
        owner.username as original_user_username,
        pr.id as report_id,
        pr.category_id
      FROM banned_game_ids b
      LEFT JOIN users banner ON b.banned_by = banner.id
      LEFT JOIN users owner ON b.original_user_id = owner.id
      LEFT JOIN player_reports pr ON b.report_id = pr.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return successResponse({
      bans: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List bans error:", error);
    return errorResponse("Failed to fetch bans", 500);
  }
}

/**
 * POST /api/bans/game-id - Ban a game ID (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (user.role !== "owner" && user.role !== "organizer") {
      return errorResponse("Admin access required", 403);
    }

    const body = await request.json();
    const validation = banGameIdSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(validation.error.errors[0]?.message || "Invalid input", 400);
    }

    const data = validation.data;

    // Check if already banned
    const existingResult = await pool.query(
      "SELECT id, is_active FROM banned_game_ids WHERE game_id = $1 AND game_type = $2",
      [data.game_id, data.game_type]
    );

    if (existingResult.rows.length > 0 && existingResult.rows[0].is_active) {
      return errorResponse("This game ID is already banned", 409);
    }

    // Calculate expiry for temp bans
    let banExpiresAt = null;
    if (!data.is_permanent && data.ban_duration_days) {
      banExpiresAt = new Date();
      banExpiresAt.setDate(banExpiresAt.getDate() + data.ban_duration_days);
    }

    // Create or update ban
    const result = await pool.query(
      `INSERT INTO banned_game_ids (
        game_id, game_type, reason, banned_by, report_id, 
        original_user_id, is_permanent, ban_expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (game_id, game_type) DO UPDATE SET
        is_active = TRUE,
        reason = EXCLUDED.reason,
        banned_by = EXCLUDED.banned_by,
        is_permanent = EXCLUDED.is_permanent,
        ban_expires_at = EXCLUDED.ban_expires_at,
        updated_at = NOW()
      RETURNING *`,
      [
        data.game_id,
        data.game_type,
        sanitizeText(data.reason),
        user.id,
        data.report_id || null,
        data.original_user_id || null,
        data.is_permanent,
        banExpiresAt,
      ]
    );

    return successResponse(
      { ban: result.rows[0] },
      "Game ID banned successfully",
      201
    );
  } catch (error) {
    console.error("Ban game ID error:", error);
    return errorResponse("Failed to ban game ID", 500);
  }
}
