import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromHeader } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tournaments/[id]/registrations
 * Get all registrations for a tournament (Host/Admin only)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization");
    const user = getUserFromHeader(authHeader);

    if (!user) {
      return unauthorizedResponse();
    }

    // Check if tournament exists
    const tournamentResult = await pool.query(
      `SELECT t.*, 
        CASE
          WHEN t.tournament_end_date <= NOW() THEN 'completed'
          WHEN t.tournament_start_date <= NOW() THEN 'ongoing'
          WHEN t.registration_end_date <= NOW() THEN 'upcoming'
          WHEN t.registration_start_date <= NOW() THEN 'registration_open'
          ELSE 'upcoming'
        END as computed_status
      FROM tournaments t WHERE t.id = $1`,
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return notFoundResponse("Tournament not found");
    }

    const tournament = tournamentResult.rows[0];

    // Check permissions - must be host or admin
    const userResult = await pool.query(
      "SELECT is_host, username FROM users WHERE id = $1",
      [user.id]
    );
    const dbUser = userResult.rows[0];

    const isHost = tournament.host_id === user.id;
    const isAdmin = dbUser?.username === "admin";

    if (!isHost && !isAdmin) {
      return errorResponse("Only tournament host or admin can view registrations", 403);
    }

    // Get all registrations with team/user details
    const registrationsResult = await pool.query(
      `SELECT 
        tr.id as registration_id,
        tr.slot_number,
        tr.registration_type,
        tr.status,
        tr.team_id,
        tr.user_id,
        tr.registered_at,
        t.team_name,
        u.username,
        u.profile_picture_url as avatar_url
      FROM tournament_registrations tr
      LEFT JOIN teams t ON tr.team_id = t.id
      LEFT JOIN users u ON tr.user_id = u.id
      WHERE tr.tournament_id = $1 AND tr.status != 'cancelled'
      ORDER BY tr.slot_number ASC`,
      [id]
    );

    return successResponse({
      tournament: {
        id: tournament.id,
        tournament_name: tournament.tournament_name,
        tournament_type: tournament.tournament_type,
        status: tournament.computed_status,
        current_teams: tournament.current_teams,
        max_teams: tournament.max_teams,
      },
      registrations: registrationsResult.rows,
    });
  } catch (error) {
    console.error("Get tournament registrations error:", error);
    return serverErrorResponse(error);
  }
}
