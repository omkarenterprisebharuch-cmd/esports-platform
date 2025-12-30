import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import {
  getWaitlistStatus,
  getUserWaitlistPosition,
  calculateWaitlistSlots,
  isWaitlistAvailable,
} from "@/lib/waitlist";
import pool from "@/lib/db";

/**
 * GET /api/tournaments/[id]/waitlist
 * Get waitlist status for a tournament
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;

    // Get tournament details
    const tournamentResult = await pool.query(
      `SELECT id, tournament_name, max_teams, current_teams, tournament_start_date
       FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return errorResponse("Tournament not found", 404);
    }

    const tournament = tournamentResult.rows[0];
    const maxWaitlistSlots = calculateWaitlistSlots(tournament.max_teams);

    // Check if waitlist is available
    const waitlistAvailability = isWaitlistAvailable(
      tournament.tournament_start_date,
      tournament.current_teams,
      tournament.max_teams
    );

    // Get waitlist entries
    const waitlistStatus = await getWaitlistStatus(tournamentId);

    // Check if current user is on waitlist
    const user = getUserFromRequest(request);
    let userWaitlistStatus = null;
    if (user) {
      userWaitlistStatus = await getUserWaitlistPosition(tournamentId, user.id);
    }

    return successResponse({
      tournament_id: tournamentId,
      tournament_name: tournament.tournament_name,
      max_teams: tournament.max_teams,
      current_teams: tournament.current_teams,
      is_full: tournament.current_teams >= tournament.max_teams,
      waitlist: {
        is_available: waitlistAvailability.available,
        unavailable_reason: waitlistAvailability.reason,
        max_slots: maxWaitlistSlots,
        current_count: waitlistStatus.currentWaitlistCount,
        remaining_slots: maxWaitlistSlots - waitlistStatus.currentWaitlistCount,
        is_waitlist_full: waitlistStatus.isWaitlistFull,
        entries: waitlistStatus.waitlistEntries.map((e, i) => ({
          position: i + 1,
          username: e.username,
          registered_at: e.registered_at,
        })),
      },
      user_status: userWaitlistStatus,
    });
  } catch (error) {
    console.error("Get waitlist status error:", error);
    return serverErrorResponse(error);
  }
}
