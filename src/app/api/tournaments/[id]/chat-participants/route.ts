import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromHeader } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  serverErrorResponse,
} from "@/lib/api-response";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tournaments/[id]/chat-participants
 * Get list of user IDs registered for this tournament (for chat authorization)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = getUserFromHeader(authHeader);

    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await context.params;
    const tournamentId = id;

    // Get tournament details
    const tournamentResult = await pool.query(
      `SELECT id, tournament_name, registration_start_date, tournament_end_date 
       FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return notFoundResponse("Tournament not found");
    }

    const tournament = tournamentResult.rows[0];

    // Check if user is registered for this tournament (either directly or as team member)
    const userRegistrationResult = await pool.query(
      `SELECT tr.id FROM tournament_registrations tr
       WHERE tr.tournament_id = $1 AND tr.status != 'cancelled'
       AND (
         tr.user_id = $2
         OR EXISTS (
           SELECT 1 FROM team_members tm 
           WHERE tm.team_id = tr.team_id 
           AND tm.user_id = $2 
           AND tm.left_at IS NULL
         )
       )`,
      [tournamentId, user.id]
    );

    if (userRegistrationResult.rows.length === 0) {
      return unauthorizedResponse("You must be registered for this tournament to access the chat");
    }

    // Get all registered user IDs for this tournament (direct registrations)
    const registrationsResult = await pool.query(
      `SELECT DISTINCT user_id FROM tournament_registrations 
       WHERE tournament_id = $1 AND status != 'cancelled'`,
      [tournamentId]
    );

    // Also get team member user IDs for team registrations (for squad/duo)
    const teamMembersResult = await pool.query(
      `SELECT DISTINCT tm.user_id 
       FROM tournament_registrations tr
       JOIN team_members tm ON tr.team_id = tm.team_id
       WHERE tr.tournament_id = $1 AND tr.status != 'cancelled' AND tm.left_at IS NULL`,
      [tournamentId]
    );

    // Also get selected players from tournament registrations (for players selected during registration)
    const selectedPlayersResult = await pool.query(
      `SELECT selected_players FROM tournament_registrations
       WHERE tournament_id = $1 AND status != 'cancelled' AND selected_players IS NOT NULL`,
      [tournamentId]
    );

    // Combine all user IDs from all sources
    const userIds = new Set<string>();
    registrationsResult.rows.forEach((row) => userIds.add(String(row.user_id)));
    teamMembersResult.rows.forEach((row) => userIds.add(String(row.user_id)));
    
    // Add selected players from JSON arrays
    selectedPlayersResult.rows.forEach((row) => {
      if (Array.isArray(row.selected_players)) {
        row.selected_players.forEach((playerId: number | string) => userIds.add(String(playerId)));
      }
    });

    return successResponse({
      tournamentId,
      tournamentName: tournament.tournament_name,
      registrationStartDate: tournament.registration_start_date,
      tournamentEndDate: tournament.tournament_end_date,
      registeredUserIds: Array.from(userIds),
    });
  } catch (error) {
    console.error("Error fetching chat participants:", error);
    return serverErrorResponse("Failed to fetch chat participants");
  }
}
