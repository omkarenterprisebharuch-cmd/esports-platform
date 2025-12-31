import { NextRequest } from "next/server";
import pool, { withTransaction } from "@/lib/db";
import { getUserFromRequest, requireEmailVerified } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  emailVerificationRequiredResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { z } from "zod";
import { validateWithSchema, validationErrorResponse, uuidSchema } from "@/lib/validations";
import {
  calculateWaitlistSlots,
  isWaitlistAvailable,
  addToWaitlist,
  getWaitlistStatus,
} from "@/lib/waitlist";
import { isGameIdBanned, getBanMessage, checkMultipleGameIds } from "@/lib/ban-check";
import { invalidateDbCache } from "@/lib/db-cache";

// Schema for tournament registration
const registerTournamentSchema = z.object({
  tournament_id: uuidSchema,
  team_id: uuidSchema.optional().nullable(),
  selected_players: z.array(uuidSchema).optional().nullable(),
  backup_players: z.array(uuidSchema).optional().nullable(),
  join_waitlist: z.boolean().optional().default(false), // New: explicitly request waitlist
});

/**
 * POST /api/registrations/register
 * Register for a tournament
 * Requires email verification
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and email verification
    const { user, verified, error } = requireEmailVerified(request);

    if (!user) {
      return unauthorizedResponse();
    }

    if (!verified) {
      return emailVerificationRequiredResponse(
        "Please verify your email address before registering for tournaments"
      );
    }

    const body = await request.json();
    
    // Validate input with Zod
    const validation = validateWithSchema(registerTournamentSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }
    
    const { tournament_id, team_id, selected_players, backup_players, join_waitlist } = validation.data;

    const result = await withTransaction(async (client) => {
      // Get tournament details
      const tournamentResult = await client.query(
        `SELECT * FROM tournaments WHERE id = $1`,
        [tournament_id]
      );

      if (tournamentResult.rows.length === 0) {
        throw new Error("Tournament not found");
      }

      const tournament = tournamentResult.rows[0];

      // Check tournament status
      if (
        tournament.status !== "registration_open" &&
        tournament.status !== "upcoming"
      ) {
        throw new Error("Registration is not open for this tournament");
      }

      // Check if slots are available OR if waitlist should be used
      const isFull = tournament.current_teams >= tournament.max_teams;
      
      if (isFull) {
        // Tournament is full - check if waitlist is available
        const waitlistCheck = isWaitlistAvailable(
          tournament.tournament_start_date,
          tournament.current_teams,
          tournament.max_teams
        );

        if (!waitlistCheck.available) {
          throw new Error("Tournament is full");
        }

        // Check if user explicitly requested waitlist or we should offer it
        if (!join_waitlist) {
          // Return info about waitlist availability
          const waitlistStatus = await getWaitlistStatus(tournament_id);
          throw new Error(
            `WAITLIST_AVAILABLE:${waitlistStatus.maxWaitlistSlots}:${waitlistStatus.currentWaitlistCount}`
          );
        }

        // User wants to join waitlist
        const waitlistStatus = await getWaitlistStatus(tournament_id);
        if (waitlistStatus.isWaitlistFull) {
          throw new Error("Tournament and waitlist are both full");
        }
      }

      // Get user profile
      const userResult = await client.query(
        `SELECT id, username, in_game_ids FROM users WHERE id = $1`,
        [user.id]
      );
      const dbUser = userResult.rows[0];

      // Validate game UID
      const gameType = tournament.game_type;
      const userGameId = dbUser.in_game_ids?.[gameType];

      if (!userGameId) {
        throw new Error(
          `Please add your ${gameType.toUpperCase()} game ID in your profile before registering`
        );
      }

      // Check if user's game ID is banned
      const banStatus = await isGameIdBanned(userGameId, gameType);
      if (banStatus.banned) {
        throw new Error(getBanMessage(banStatus));
      }

      const tournamentType = tournament.tournament_type;

      if (tournamentType === "solo") {
        // SOLO REGISTRATION
        const existingReg = await client.query(
          `SELECT id, is_waitlisted FROM tournament_registrations 
           WHERE tournament_id = $1 AND user_id = $2 AND status != 'cancelled'`,
          [tournament_id, user.id]
        );

        if (existingReg.rows.length > 0) {
          if (existingReg.rows[0].is_waitlisted) {
            throw new Error("Already on waitlist");
          }
          throw new Error("Registered");
        }

        // Handle waitlist registration
        if (isFull && join_waitlist) {
          // Get next waitlist position
          const positionResult = await client.query(
            `SELECT COALESCE(MAX(waitlist_position), 0) + 1 as next_position 
             FROM tournament_registrations 
             WHERE tournament_id = $1 AND is_waitlisted = TRUE`,
            [tournament_id]
          );
          const waitlistPosition = positionResult.rows[0].next_position;

          // Create waitlist registration
          const regResult = await client.query(
            `INSERT INTO tournament_registrations 
             (tournament_id, user_id, registration_type, status, is_waitlisted, waitlist_position)
             VALUES ($1, $2, 'solo', 'registered', TRUE, $3)
             RETURNING *`,
            [tournament_id, user.id, waitlistPosition]
          );

          return {
            registration: regResult.rows[0],
            waitlist_position: waitlistPosition,
            is_waitlisted: true,
          };
        }

        // Regular registration
        // Get next slot number
        const slotResult = await client.query(
          `SELECT COALESCE(MAX(slot_number), 0) + 1 as next_slot 
           FROM tournament_registrations WHERE tournament_id = $1 AND is_waitlisted = FALSE`,
          [tournament_id]
        );
        const slotNumber = slotResult.rows[0].next_slot;

        // Create solo registration
        const regResult = await client.query(
          `INSERT INTO tournament_registrations 
           (tournament_id, user_id, registration_type, slot_number, status, is_waitlisted)
           VALUES ($1, $2, 'solo', $3, 'registered', FALSE)
           RETURNING *`,
          [tournament_id, user.id, slotNumber]
        );

        // Update tournament team count
        await client.query(
          `UPDATE tournaments SET current_teams = current_teams + 1 WHERE id = $1`,
          [tournament_id]
        );

        return {
          registration: regResult.rows[0],
          slot_number: slotNumber,
          is_waitlisted: false,
        };
      } else {
        // DUO/SQUAD REGISTRATION
        if (!team_id) {
          throw new Error(
            `Team ID is required for ${tournamentType} tournaments`
          );
        }

        // Check if user is team member
        const memberCheck = await client.query(
          `SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2 AND left_at IS NULL`,
          [team_id, user.id]
        );

        if (memberCheck.rows.length === 0) {
          throw new Error("You are not a member of this team");
        }

        // Get all selected players' game IDs and check for bans
        const playerIds = selected_players || [user.id];
        const playersResult = await client.query(
          `SELECT u.id, u.username, u.in_game_ids 
           FROM users u 
           WHERE u.id = ANY($1::int[])`,
          [playerIds]
        );

        // Check each player's game ID for bans
        const gameIdsToCheck = playersResult.rows
          .filter(p => p.in_game_ids?.[gameType])
          .map(p => ({
            gameId: p.in_game_ids[gameType],
            gameType: gameType,
            username: p.username,
          }));

        if (gameIdsToCheck.length > 0) {
          const banResults = await checkMultipleGameIds(
            gameIdsToCheck.map(g => ({ gameId: g.gameId, gameType: g.gameType }))
          );

          for (const { gameId, gameType: gType, username } of gameIdsToCheck) {
            const banStatus = banResults.get(`${gameId}:${gType}`);
            if (banStatus?.banned) {
              throw new Error(
                `Player "${username}" cannot participate: ${getBanMessage(banStatus)}`
              );
            }
          }
        }

        // Check if team already registered or on waitlist
        const existingTeamReg = await client.query(
          `SELECT id, is_waitlisted FROM tournament_registrations 
           WHERE tournament_id = $1 AND team_id = $2 AND status != 'cancelled'`,
          [tournament_id, team_id]
        );

        if (existingTeamReg.rows.length > 0) {
          if (existingTeamReg.rows[0].is_waitlisted) {
            throw new Error("This team is already on the waitlist");
          }
          throw new Error("This team is already registered for this tournament");
        }

        // Handle waitlist registration
        if (isFull && join_waitlist) {
          // Get next waitlist position
          const positionResult = await client.query(
            `SELECT COALESCE(MAX(waitlist_position), 0) + 1 as next_position 
             FROM tournament_registrations 
             WHERE tournament_id = $1 AND is_waitlisted = TRUE`,
            [tournament_id]
          );
          const waitlistPosition = positionResult.rows[0].next_position;

          // Create waitlist registration
          const regResult = await client.query(
            `INSERT INTO tournament_registrations 
             (tournament_id, team_id, user_id, registration_type, status, is_waitlisted, waitlist_position, selected_players, backup_players)
             VALUES ($1, $2, $3, $4, 'registered', TRUE, $5, $6, $7)
             RETURNING *`,
            [
              tournament_id,
              team_id,
              user.id,
              tournamentType,
              waitlistPosition,
              JSON.stringify(selected_players || [user.id]),
              JSON.stringify(backup_players || []),
            ]
          );

          return {
            registration: regResult.rows[0],
            waitlist_position: waitlistPosition,
            is_waitlisted: true,
          };
        }

        // Regular registration - get next slot number
        const slotResult = await client.query(
          `SELECT COALESCE(MAX(slot_number), 0) + 1 as next_slot 
           FROM tournament_registrations WHERE tournament_id = $1 AND is_waitlisted = FALSE`,
          [tournament_id]
        );
        const slotNumber = slotResult.rows[0].next_slot;

        // Create team registration
        const regResult = await client.query(
          `INSERT INTO tournament_registrations 
           (tournament_id, team_id, user_id, registration_type, slot_number, selected_players, backup_players, status, is_waitlisted)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'registered', FALSE)
           RETURNING *`,
          [
            tournament_id,
            team_id,
            user.id,
            tournamentType,
            slotNumber,
            JSON.stringify(selected_players || [user.id]),
            JSON.stringify(backup_players || []),
          ]
        );

        // Update tournament team count
        await client.query(
          `UPDATE tournaments SET current_teams = current_teams + 1 WHERE id = $1`,
          [tournament_id]
        );

        return {
          registration: regResult.rows[0],
          slot_number: slotNumber,
          is_waitlisted: false,
        };
      }
    });

    // Customize success message based on waitlist status
    const message = result.is_waitlisted
      ? `Added to waitlist at position ${result.waitlist_position}`
      : "Successfully registered for the tournament";

    // Invalidate registration-related caches
    await invalidateDbCache.registration(user.id, tournament_id);

    return successResponse(result, message, 201);
  } catch (error) {
    console.error("Registration error:", error);
    if (error instanceof Error) {
      // Handle waitlist available error specially
      if (error.message.startsWith("WAITLIST_AVAILABLE:")) {
        const parts = error.message.split(":");
        const maxSlots = parseInt(parts[1]);
        const currentCount = parseInt(parts[2]);
        // Return custom response with waitlist info
        return new Response(
          JSON.stringify({
            success: false,
            message: "Tournament is full",
            error: "WAITLIST_AVAILABLE",
            data: {
              waitlist_available: true,
              waitlist_slots_total: maxSlots,
              waitlist_slots_taken: currentCount,
              waitlist_slots_remaining: maxSlots - currentCount,
            },
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      return errorResponse(error.message);
    }
    return serverErrorResponse(error);
  }
}
