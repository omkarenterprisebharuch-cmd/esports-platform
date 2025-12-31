import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { invalidateTournamentCaches } from "@/lib/redis";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tournaments/[id]
 * Get tournament by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = getUserFromRequest(request);

    const result = await pool.query(
      `SELECT 
        t.*,
        u.username as host_name,
        CASE
          WHEN t.tournament_end_date <= NOW() THEN 'completed'
          WHEN t.tournament_start_date <= NOW() THEN 'ongoing'
          WHEN t.registration_end_date <= NOW() THEN 'upcoming'
          WHEN t.registration_start_date <= NOW() THEN 'registration_open'
          ELSE 'upcoming'
        END as computed_status,
        CASE
          WHEN t.registration_start_date > NOW() THEN 
            EXTRACT(EPOCH FROM (t.registration_start_date - NOW()))
          WHEN t.registration_end_date > NOW() THEN 
            EXTRACT(EPOCH FROM (t.registration_end_date - NOW()))
          WHEN t.tournament_start_date > NOW() THEN 
            EXTRACT(EPOCH FROM (t.tournament_start_date - NOW()))
          WHEN t.tournament_end_date > NOW() THEN 
            EXTRACT(EPOCH FROM (t.tournament_end_date - NOW()))
          ELSE 0
        END as seconds_to_next_status
      FROM tournaments t
      JOIN users u ON t.host_id = u.id
      WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return notFoundResponse("Tournament not found");
    }

    const tournament = {
      ...result.rows[0],
      status: result.rows[0].computed_status,
    };

    // Check if current user is registered for this tournament
    let isRegistered = false;
    if (user) {
      const regCheck = await pool.query(
        `SELECT 1 FROM tournament_registrations WHERE tournament_id = $1 AND user_id = $2 LIMIT 1`,
        [id, user.id]
      );
      isRegistered = regCheck.rows.length > 0;
    }

    return successResponse({ tournament, isRegistered });
  } catch (error) {
    console.error("Get tournament error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * PUT /api/tournaments/[id]
 * Update tournament (Host/Admin only)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    // Check if user owns this tournament or is admin
    const tournamentResult = await pool.query(
      "SELECT * FROM tournaments WHERE id = $1",
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return notFoundResponse("Tournament not found");
    }

    const tournament = tournamentResult.rows[0];

    // Check permissions (host can edit their own, or user named "admin")
    const userResult = await pool.query(
      "SELECT is_host, username FROM users WHERE id = $1",
      [user.id]
    );
    const dbUser = userResult.rows[0];

    if (
      tournament.host_id !== user.id &&
      dbUser?.username !== "admin"
    ) {
      return errorResponse("Not authorized to update this tournament", 403);
    }

    // Check if tournament has already started (no edits allowed after start)
    const tournamentStartDate = new Date(tournament.tournament_start_date);
    if (new Date() >= tournamentStartDate) {
      return errorResponse("Cannot edit tournament after it has started", 400);
    }

    // Check if tournament has registrations (limit editable fields)
    const registrationsResult = await pool.query(
      "SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id = $1 AND status != 'cancelled'",
      [id]
    );
    const hasRegistrations = parseInt(registrationsResult.rows[0].count) > 0;

    const body = await request.json();

    // Build update query based on what fields are allowed
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Note: prize_pool and entry_fee are NEVER allowed to be changed after creation
    const allowedFields = hasRegistrations
      ? [
          "description",
          "match_rules",
          "map_name",
          "tournament_banner_url",
          "room_id",
          "room_password",
        ]
      : [
          "tournament_name",
          "description",
          "game_type",
          "tournament_type",
          "max_teams",
          "match_rules",
          "map_name",
          "registration_start_date",
          "registration_end_date",
          "tournament_start_date",
          "tournament_end_date",
          "tournament_banner_url",
          "room_id",
          "room_password",
          "schedule_type",
          "publish_time",
        ];

    let hasRoomCredentialUpdate = false;
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        // Convert empty strings to null for TIME/DATE fields to avoid DB errors
        let value = body[field];
        if ((field === "publish_time") && value === "") {
          value = null;
        }
        values.push(value);
        paramIndex++;

        // Track room credentials update (only add once)
        if (field === "room_id" || field === "room_password") {
          hasRoomCredentialUpdate = true;
        }
      }
    }

    // Add room_credentials_updated_at only once if any room field was updated
    if (hasRoomCredentialUpdate) {
      updates.push(`room_credentials_updated_at = NOW()`);
    }

    if (updates.length === 0) {
      return errorResponse("No valid fields to update");
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const updateResult = await pool.query(
      `UPDATE tournaments SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    // Invalidate tournament caches
    invalidateTournamentCaches(id).catch(() => {});

    // On-demand ISR revalidation for public tournament pages
    try {
      revalidatePath(`/t/${id}`);
      revalidatePath("/leaderboard");
    } catch {
      // Revalidation is best-effort, don't fail the request
    }

    return successResponse(
      { tournament: updateResult.rows[0] },
      "Tournament updated successfully"
    );
  } catch (error) {
    console.error("Update tournament error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * DELETE /api/tournaments/[id]
 * Delete tournament (Host who owns it or Admin)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    // Check if tournament exists and get owner info
    const tournamentResult = await pool.query(
      "SELECT id, host_id, is_template FROM tournaments WHERE id = $1",
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return notFoundResponse("Tournament not found");
    }

    const tournament = tournamentResult.rows[0];

    // Check if user is admin or the host who owns this tournament
    const userResult = await pool.query(
      "SELECT is_host, username FROM users WHERE id = $1",
      [user.id]
    );
    const dbUser = userResult.rows[0];

    // Admin check: only username "admin" is considered admin
    const isAdmin = dbUser?.username?.toLowerCase() === "admin";
    
    // Owner check: compare as strings to handle UUID/number type mismatches
    const isOwner = String(tournament.host_id) === String(user.id);
    
    // Host check: user has host privileges
    const isHost = dbUser?.is_host === true;

    console.log("Delete check:", { 
      tournamentHostId: tournament.host_id, 
      userId: user.id, 
      isOwner, 
      isAdmin,
      isHost,
      username: dbUser?.username 
    });

    // Allow delete if: admin, OR owner, OR host who owns this tournament
    if (!isAdmin && !isOwner) {
      return errorResponse("You can only delete your own tournaments", 403);
    }

    // Delete tournament (cascades to registrations, matches, etc.)
    await pool.query("DELETE FROM tournaments WHERE id = $1", [id]);

    // Invalidate tournament caches
    invalidateTournamentCaches(id).catch(() => {});

    // On-demand ISR revalidation - remove stale tournament page
    try {
      revalidatePath(`/t/${id}`);
      revalidatePath("/leaderboard");
      revalidatePath("/dashboard");
    } catch {
      // Revalidation is best-effort, don't fail the request
    }

    const message = tournament.is_template 
      ? "Scheduled template deleted successfully" 
      : "Tournament deleted successfully";

    return successResponse(null, message);
  } catch (error) {
    console.error("Delete tournament error:", error);
    return serverErrorResponse(error);
  }
}
