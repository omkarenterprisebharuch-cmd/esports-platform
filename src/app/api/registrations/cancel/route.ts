import { NextRequest } from "next/server";
import pool, { withTransaction } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { z } from "zod";
import { validateWithSchema, validationErrorResponse, uuidSchema } from "@/lib/validations";
import { promoteFromWaitlist, cancelWaitlistRegistration } from "@/lib/waitlist";

const cancelRegistrationSchema = z.object({
  registration_id: uuidSchema,
});

/**
 * POST /api/registrations/cancel
 * Cancel a tournament registration
 * If the cancelled registration was a regular slot, promotes next person from waitlist
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    
    const validation = validateWithSchema(cancelRegistrationSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }
    
    const { registration_id } = validation.data;

    const result = await withTransaction(async (client) => {
      // Get registration details
      const regResult = await client.query(
        `SELECT tr.*, t.tournament_name, t.tournament_start_date, t.current_teams, t.max_teams
         FROM tournament_registrations tr
         JOIN tournaments t ON tr.tournament_id = t.id
         WHERE tr.id = $1`,
        [registration_id]
      );

      if (regResult.rows.length === 0) {
        throw new Error("Registration not found");
      }

      const registration = regResult.rows[0];

      // Check if user owns this registration
      if (registration.user_id !== user.id) {
        throw new Error("You can only cancel your own registrations");
      }

      // Check if already cancelled
      if (registration.status === "cancelled") {
        throw new Error("Registration is already cancelled");
      }

      // Check if tournament has already started
      const now = new Date();
      const startDate = new Date(registration.tournament_start_date);
      if (now >= startDate) {
        throw new Error("Cannot cancel registration after tournament has started");
      }

      const wasWaitlisted = registration.is_waitlisted;
      const tournamentId = registration.tournament_id;

      // Cancel the registration
      await client.query(
        `UPDATE tournament_registrations SET status = 'cancelled' WHERE id = $1`,
        [registration_id]
      );

      // If was a regular registration (not waitlisted), decrement team count
      if (!wasWaitlisted) {
        await client.query(
          `UPDATE tournaments SET current_teams = current_teams - 1 WHERE id = $1`,
          [tournamentId]
        );
      } else {
        // If was waitlisted, reorder waitlist positions
        await client.query(
          `UPDATE tournament_registrations 
           SET waitlist_position = waitlist_position - 1
           WHERE tournament_id = $1 
             AND is_waitlisted = TRUE 
             AND status = 'registered'
             AND waitlist_position > $2`,
          [tournamentId, registration.waitlist_position]
        );
      }

      return {
        cancelled: true,
        was_waitlisted: wasWaitlisted,
        tournament_id: tournamentId,
        tournament_name: registration.tournament_name,
      };
    });

    // If a regular slot was freed, try to promote from waitlist
    let promotionResult = null;
    if (!result.was_waitlisted) {
      promotionResult = await promoteFromWaitlist(result.tournament_id);
    }

    return successResponse(
      {
        ...result,
        waitlist_promotion: promotionResult,
      },
      "Registration cancelled successfully"
    );
  } catch (error) {
    console.error("Cancel registration error:", error);
    if (error instanceof Error) {
      return errorResponse(error.message);
    }
    return serverErrorResponse(error);
  }
}
