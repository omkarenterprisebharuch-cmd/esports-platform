/**
 * Tournament Waitlist System
 * 
 * Rules:
 * - Waitlist slots = Math.round(max_teams * 0.05), minimum 1
 * - Waitlist only available when tournament start is > 45 minutes away
 * - Auto-promote from waitlist when a regular spot opens
 * - Send notification when promoted
 */

import pool, { withTransaction } from "./db";
import { sendPushNotification, sendEmail, generateTournamentEmail } from "./notifications";

// Minimum time before tournament start for waitlist registration (in minutes)
const WAITLIST_CUTOFF_MINUTES = 45;

/**
 * Calculate waitlist slots for a tournament
 * 5% of max_teams, rounded to nearest integer, minimum 1
 */
export function calculateWaitlistSlots(maxTeams: number): number {
  const slots = Math.round(maxTeams * 0.05);
  return Math.max(slots, 1); // At least 1 waitlist slot
}

/**
 * Check if waitlist registration is available for a tournament
 */
export function isWaitlistAvailable(
  tournamentStartDate: Date | string,
  currentTeams: number,
  maxTeams: number
): { available: boolean; reason?: string } {
  const startTime = new Date(tournamentStartDate).getTime();
  const now = Date.now();
  const minutesUntilStart = (startTime - now) / (1000 * 60);

  // Tournament must be more than 45 minutes away
  if (minutesUntilStart <= WAITLIST_CUTOFF_MINUTES) {
    return {
      available: false,
      reason: `Waitlist closed - tournament starts in less than ${WAITLIST_CUTOFF_MINUTES} minutes`,
    };
  }

  // Tournament must be full
  if (currentTeams < maxTeams) {
    return {
      available: false,
      reason: "Regular slots still available",
    };
  }

  return { available: true };
}

/**
 * Get current waitlist status for a tournament
 */
export async function getWaitlistStatus(tournamentId: string): Promise<{
  maxWaitlistSlots: number;
  currentWaitlistCount: number;
  isWaitlistFull: boolean;
  waitlistEntries: Array<{
    user_id: string;
    username: string;
    position: number;
    registered_at: Date;
  }>;
}> {
  // Get tournament max_teams
  const tournamentResult = await pool.query(
    `SELECT max_teams FROM tournaments WHERE id = $1`,
    [tournamentId]
  );

  if (tournamentResult.rows.length === 0) {
    throw new Error("Tournament not found");
  }

  const maxTeams = tournamentResult.rows[0].max_teams;
  const maxWaitlistSlots = calculateWaitlistSlots(maxTeams);

  // Get current waitlist entries
  const waitlistResult = await pool.query(
    `SELECT 
      tr.user_id,
      u.username,
      tr.waitlist_position as position,
      tr.registered_at
    FROM tournament_registrations tr
    JOIN users u ON tr.user_id = u.id
    WHERE tr.tournament_id = $1 
      AND tr.is_waitlisted = TRUE 
      AND tr.status = 'registered'
    ORDER BY tr.waitlist_position ASC`,
    [tournamentId]
  );

  return {
    maxWaitlistSlots,
    currentWaitlistCount: waitlistResult.rows.length,
    isWaitlistFull: waitlistResult.rows.length >= maxWaitlistSlots,
    waitlistEntries: waitlistResult.rows,
  };
}

/**
 * Add a user to the waitlist
 */
export async function addToWaitlist(
  tournamentId: string,
  userId: string,
  teamId?: string,
  registrationType: string = "solo",
  selectedPlayers?: string[],
  backupPlayers?: string[]
): Promise<{
  success: boolean;
  position: number;
  registration?: {
    id: string;
    waitlist_position: number;
  };
  error?: string;
}> {
  return withTransaction(async (client) => {
    // Get tournament details
    const tournamentResult = await client.query(
      `SELECT id, tournament_name, max_teams, current_teams, tournament_start_date 
       FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return { success: false, position: 0, error: "Tournament not found" };
    }

    const tournament = tournamentResult.rows[0];

    // Check if waitlist is available
    const waitlistCheck = isWaitlistAvailable(
      tournament.tournament_start_date,
      tournament.current_teams,
      tournament.max_teams
    );

    if (!waitlistCheck.available) {
      return { success: false, position: 0, error: waitlistCheck.reason };
    }

    // Check waitlist capacity
    const waitlistStatus = await getWaitlistStatus(tournamentId);
    if (waitlistStatus.isWaitlistFull) {
      return { success: false, position: 0, error: "Waitlist is full" };
    }

    // Check if user already registered or on waitlist
    const existingReg = await client.query(
      `SELECT id, is_waitlisted FROM tournament_registrations 
       WHERE tournament_id = $1 AND user_id = $2 AND status != 'cancelled'`,
      [tournamentId, userId]
    );

    if (existingReg.rows.length > 0) {
      if (existingReg.rows[0].is_waitlisted) {
        return { success: false, position: 0, error: "Already on waitlist" };
      }
      return { success: false, position: 0, error: "Already registered" };
    }

    // Get next waitlist position
    const positionResult = await client.query(
      `SELECT COALESCE(MAX(waitlist_position), 0) + 1 as next_position 
       FROM tournament_registrations 
       WHERE tournament_id = $1 AND is_waitlisted = TRUE`,
      [tournamentId]
    );
    const waitlistPosition = positionResult.rows[0].next_position;

    // Create waitlist registration
    const regResult = await client.query(
      `INSERT INTO tournament_registrations 
       (tournament_id, user_id, team_id, registration_type, status, is_waitlisted, waitlist_position, selected_players, backup_players)
       VALUES ($1, $2, $3, $4, 'registered', TRUE, $5, $6, $7)
       RETURNING id, waitlist_position`,
      [
        tournamentId,
        userId,
        teamId || null,
        registrationType,
        waitlistPosition,
        JSON.stringify(selectedPlayers || []),
        JSON.stringify(backupPlayers || []),
      ]
    );

    return {
      success: true,
      position: waitlistPosition,
      registration: regResult.rows[0],
    };
  });
}

/**
 * Promote the next person from waitlist when a spot opens
 * Called when someone cancels their registration
 */
export async function promoteFromWaitlist(
  tournamentId: string
): Promise<{
  promoted: boolean;
  promotedUserId?: string;
  newPosition?: number;
}> {
  return withTransaction(async (client) => {
    // Get tournament details
    const tournamentResult = await client.query(
      `SELECT id, tournament_name, current_teams, max_teams, tournament_start_date
       FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return { promoted: false };
    }

    const tournament = tournamentResult.rows[0];

    // Check if there's a spot available
    if (tournament.current_teams >= tournament.max_teams) {
      return { promoted: false };
    }

    // Check if tournament hasn't started yet and is > 45 min away
    const startTime = new Date(tournament.tournament_start_date).getTime();
    const now = Date.now();
    const minutesUntilStart = (startTime - now) / (1000 * 60);

    if (minutesUntilStart <= 0) {
      return { promoted: false }; // Tournament already started
    }

    // Get first person on waitlist
    const waitlistResult = await client.query(
      `SELECT tr.id, tr.user_id, tr.team_id, u.username, u.email
       FROM tournament_registrations tr
       JOIN users u ON tr.user_id = u.id
       WHERE tr.tournament_id = $1 
         AND tr.is_waitlisted = TRUE 
         AND tr.status = 'registered'
       ORDER BY tr.waitlist_position ASC
       LIMIT 1`,
      [tournamentId]
    );

    if (waitlistResult.rows.length === 0) {
      return { promoted: false }; // No one on waitlist
    }

    const promotedEntry = waitlistResult.rows[0];

    // Get next slot number for promoted registration
    const slotResult = await client.query(
      `SELECT COALESCE(MAX(slot_number), 0) + 1 as next_slot 
       FROM tournament_registrations 
       WHERE tournament_id = $1 AND is_waitlisted = FALSE`,
      [tournamentId]
    );
    const slotNumber = slotResult.rows[0].next_slot;

    // Promote the user
    await client.query(
      `UPDATE tournament_registrations 
       SET is_waitlisted = FALSE, 
           waitlist_position = NULL, 
           promoted_at = NOW(),
           promoted_from_waitlist = TRUE,
           slot_number = $3
       WHERE id = $1 AND tournament_id = $2`,
      [promotedEntry.id, tournamentId, slotNumber]
    );

    // Update tournament team count
    await client.query(
      `UPDATE tournaments SET current_teams = current_teams + 1 WHERE id = $1`,
      [tournamentId]
    );

    // Reorder remaining waitlist positions
    await client.query(
      `UPDATE tournament_registrations 
       SET waitlist_position = waitlist_position - 1
       WHERE tournament_id = $1 
         AND is_waitlisted = TRUE 
         AND status = 'registered'`,
      [tournamentId]
    );

    // Send notification to promoted user
    try {
      // Send push notification
      await sendPushNotification(
        promotedEntry.user_id,
        "🎉 You've been promoted from the waitlist!",
        `A spot opened up in ${tournament.tournament_name}. You're now registered!`,
        { tournamentId, type: "waitlist_promotion" }
      );

      // Send email notification
      const emailHtml = generateTournamentEmail(
        promotedEntry.username,
        tournament.tournament_name,
        "You've Been Promoted from the Waitlist! 🎉",
        `Great news! A spot has opened up in ${tournament.tournament_name} and you've been automatically promoted from the waitlist.

You are now officially registered for the tournament with slot number ${slotNumber}.

Make sure to check in before the tournament starts and get ready to compete!`
      );

      await sendEmail(
        promotedEntry.email,
        `🎉 Promoted: You're in for ${tournament.tournament_name}!`,
        emailHtml
      );
    } catch (notificationError) {
      console.error("Failed to send promotion notification:", notificationError);
      // Don't fail the promotion if notification fails
    }

    return {
      promoted: true,
      promotedUserId: promotedEntry.user_id,
      newPosition: slotNumber,
    };
  });
}

/**
 * Cancel a waitlist registration
 */
export async function cancelWaitlistRegistration(
  tournamentId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  return withTransaction(async (client) => {
    // Get the waitlist entry
    const regResult = await client.query(
      `SELECT id, waitlist_position FROM tournament_registrations
       WHERE tournament_id = $1 AND user_id = $2 AND is_waitlisted = TRUE AND status = 'registered'`,
      [tournamentId, userId]
    );

    if (regResult.rows.length === 0) {
      return { success: false, error: "Waitlist registration not found" };
    }

    const registration = regResult.rows[0];

    // Cancel the registration
    await client.query(
      `UPDATE tournament_registrations SET status = 'cancelled' WHERE id = $1`,
      [registration.id]
    );

    // Reorder remaining waitlist positions
    await client.query(
      `UPDATE tournament_registrations 
       SET waitlist_position = waitlist_position - 1
       WHERE tournament_id = $1 
         AND is_waitlisted = TRUE 
         AND status = 'registered'
         AND waitlist_position > $2`,
      [tournamentId, registration.waitlist_position]
    );

    return { success: true };
  });
}

/**
 * Get user's waitlist position for a tournament
 */
export async function getUserWaitlistPosition(
  tournamentId: string,
  userId: string
): Promise<{ isOnWaitlist: boolean; position?: number }> {
  const result = await pool.query(
    `SELECT waitlist_position FROM tournament_registrations
     WHERE tournament_id = $1 AND user_id = $2 AND is_waitlisted = TRUE AND status = 'registered'`,
    [tournamentId, userId]
  );

  if (result.rows.length === 0) {
    return { isOnWaitlist: false };
  }

  return {
    isOnWaitlist: true,
    position: result.rows[0].waitlist_position,
  };
}
