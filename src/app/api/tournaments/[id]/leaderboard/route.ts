import { NextRequest } from "next/server";
import { PoolClient } from "pg";
import pool, { withTransaction } from "@/lib/db";
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
 * GET /api/tournaments/[id]/leaderboard
 * Get tournament leaderboard/results
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if tournament exists
    const tournamentResult = await pool.query(
      `SELECT 
        t.id, t.tournament_name, t.tournament_type, t.prize_pool, t.status,
        CASE
          WHEN t.tournament_end_date <= NOW() THEN 'completed'
          WHEN t.tournament_start_date <= NOW() THEN 'ongoing'
          WHEN t.registration_end_date <= NOW() THEN 'upcoming'
          WHEN t.registration_start_date <= NOW() THEN 'registration_open'
          ELSE 'upcoming'
        END as computed_status
      FROM tournaments t 
      WHERE t.id = $1`,
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return notFoundResponse("Tournament not found");
    }

    const tournament = tournamentResult.rows[0];

    // Get leaderboard entries
    const leaderboardResult = await pool.query(
      `SELECT 
        l.id,
        l.tournament_id,
        l.team_id,
        l.user_id,
        l."position" as rank,
        l.kills,
        l.points,
        l.prize_amount,
        l.updated_at,
        t.team_name,
        u.username,
        u.profile_picture_url as avatar_url
      FROM tournament_leaderboard l
      LEFT JOIN teams t ON l.team_id = t.id
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.tournament_id = $1
      ORDER BY l."position" ASC`,
      [id]
    );

    return successResponse({
      tournament: {
        id: tournament.id,
        tournament_name: tournament.tournament_name,
        tournament_type: tournament.tournament_type,
        prize_pool: tournament.prize_pool,
        status: tournament.computed_status,
      },
      leaderboard: leaderboardResult.rows,
    });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/tournaments/[id]/leaderboard
 * Update tournament leaderboard (Host/Admin only)
 * Body: { results: [{ team_id?: number, user_id?: number, rank: number, kills?: number, points?: number, prize_amount?: number }] }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization");
    const user = getUserFromHeader(authHeader);

    if (!user) {
      return unauthorizedResponse();
    }

    // Check if tournament exists and get details
    const tournamentResult = await pool.query(
      `SELECT 
        t.*,
        CASE
          WHEN t.tournament_end_date <= NOW() THEN 'completed'
          WHEN t.tournament_start_date <= NOW() THEN 'ongoing'
          ELSE 'upcoming'
        END as computed_status
      FROM tournaments t 
      WHERE t.id = $1`,
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
      return errorResponse("Only tournament host or admin can update results", 403);
    }

    // Check if tournament has started (can only update results after start)
    const tournamentStart = new Date(tournament.tournament_start_date);
    if (new Date() < tournamentStart) {
      return errorResponse("Cannot update results before tournament starts", 400);
    }

    const body = await request.json();
    const { results } = body;

    if (!results || !Array.isArray(results) || results.length === 0) {
      return errorResponse("Results array is required");
    }

    // Validate results - max 3 ranks for winners
    const validRanks = results.filter((r: { rank: number }) => r.rank >= 1 && r.rank <= 3);
    if (validRanks.length !== results.length) {
      return errorResponse("Ranks must be between 1 and 3 for winners");
    }

    // Check for duplicate ranks
    const ranks = results.map((r: { rank: number }) => r.rank);
    if (new Set(ranks).size !== ranks.length) {
      return errorResponse("Duplicate ranks are not allowed");
    }

    await withTransaction(async (client: PoolClient) => {
      // Delete existing leaderboard entries for this tournament
      await client.query(
        "DELETE FROM tournament_leaderboard WHERE tournament_id = $1",
        [id]
      );

      // Insert new leaderboard entries
      for (const result of results) {
        const { team_id, user_id, rank, kills, points, prize_amount } = result;

        // Validate that the team/user is actually registered
        if (tournament.tournament_type === "solo") {
          if (!user_id) {
            throw new Error(`User ID is required for solo tournament results (rank ${rank})`);
          }
          const regCheck = await client.query(
            `SELECT id FROM tournament_registrations 
             WHERE tournament_id = $1 AND user_id = $2 AND status != 'cancelled'`,
            [id, user_id]
          );
          if (regCheck.rows.length === 0) {
            throw new Error(`User with ID ${user_id} is not registered for this tournament`);
          }
        } else {
          if (!team_id) {
            throw new Error(`Team ID is required for ${tournament.tournament_type} tournament results (rank ${rank})`);
          }
          const regCheck = await client.query(
            `SELECT id FROM tournament_registrations 
             WHERE tournament_id = $1 AND team_id = $2 AND status != 'cancelled'`,
            [id, team_id]
          );
          if (regCheck.rows.length === 0) {
            throw new Error(`Team with ID ${team_id} is not registered for this tournament`);
          }
        }

        await client.query(
          `INSERT INTO tournament_leaderboard 
           (tournament_id, team_id, user_id, "position", kills, points, prize_amount, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, team_id || null, user_id || null, rank, kills || 0, points || 0, prize_amount || 0, user.id]
        );
      }
    });

    // Fetch updated leaderboard
    const leaderboardResult = await pool.query(
      `SELECT 
        l.id,
        l.tournament_id,
        l.team_id,
        l.user_id,
        l."position" as rank,
        l.kills,
        l.points,
        l.prize_amount,
        l.updated_at,
        t.team_name,
        u.username,
        u.profile_picture_url as avatar_url
      FROM tournament_leaderboard l
      LEFT JOIN teams t ON l.team_id = t.id
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.tournament_id = $1
      ORDER BY l."position" ASC`,
      [id]
    );

    return successResponse(
      { leaderboard: leaderboardResult.rows },
      "Leaderboard updated successfully"
    );
  } catch (error) {
    console.error("Update leaderboard error:", error);
    if (error instanceof Error) {
      return errorResponse(error.message, 400);
    }
    return serverErrorResponse(error);
  }
}
