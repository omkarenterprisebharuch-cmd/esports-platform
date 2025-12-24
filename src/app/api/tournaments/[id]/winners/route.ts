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
 * GET /api/tournaments/[id]/winners
 * Get tournament winners (simple - just names)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const result = await pool.query(
      `SELECT 
        id, tournament_name, winner_1, winner_2, winner_3,
        CASE
          WHEN tournament_end_date <= NOW() THEN 'completed'
          WHEN tournament_start_date <= NOW() THEN 'ongoing'
          ELSE 'upcoming'
        END as status
      FROM tournaments 
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return notFoundResponse("Tournament not found");
    }

    const tournament = result.rows[0];

    return successResponse({
      winners: {
        first: tournament.winner_1 || null,
        second: tournament.winner_2 || null,
        third: tournament.winner_3 || null,
      },
      status: tournament.status,
    });
  } catch (error) {
    console.error("Get winners error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/tournaments/[id]/winners
 * Update tournament winners (Host/Admin only)
 * Body: { winner_1: string, winner_2?: string, winner_3?: string }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization");
    const user = getUserFromHeader(authHeader);

    if (!user) {
      return unauthorizedResponse();
    }

    // Check if tournament exists
    const tournamentResult = await pool.query(
      `SELECT host_id, tournament_start_date FROM tournaments WHERE id = $1`,
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return notFoundResponse("Tournament not found");
    }

    const tournament = tournamentResult.rows[0];

    // Check permissions - must be host or admin
    const userResult = await pool.query(
      "SELECT username FROM users WHERE id = $1",
      [user.id]
    );
    const dbUser = userResult.rows[0];

    const isHost = tournament.host_id === user.id;
    const isAdmin = dbUser?.username === "admin";

    if (!isHost && !isAdmin) {
      return errorResponse("Only tournament host or admin can update winners", 403);
    }

    // Check if tournament has started
    const tournamentStart = new Date(tournament.tournament_start_date);
    if (new Date() < tournamentStart) {
      return errorResponse("Cannot update winners before tournament starts", 400);
    }

    const body = await request.json();
    const { winner_1, winner_2, winner_3 } = body;

    if (!winner_1) {
      return errorResponse("At least 1st place winner is required");
    }

    // Update winners in tournaments table
    await pool.query(
      `UPDATE tournaments 
       SET winner_1 = $1, winner_2 = $2, winner_3 = $3, updated_at = NOW()
       WHERE id = $4`,
      [winner_1, winner_2 || null, winner_3 || null, id]
    );

    return successResponse(
      {
        winners: {
          first: winner_1,
          second: winner_2 || null,
          third: winner_3 || null,
        },
      },
      "Winners updated successfully"
    );
  } catch (error) {
    console.error("Update winners error:", error);
    return serverErrorResponse(error);
  }
}
