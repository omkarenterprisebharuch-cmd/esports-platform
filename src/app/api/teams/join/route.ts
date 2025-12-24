import { NextRequest } from "next/server";
import pool, { withTransaction } from "@/lib/db";
import { getUserFromHeader } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";

/**
 * POST /api/teams/join
 * Join a team using invite code
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = getUserFromHeader(authHeader);

    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { invite_code, game_uid, game_name } = body;

    if (!invite_code || !game_uid || !game_name) {
      return errorResponse(
        "Invite code, game UID, and game name are required"
      );
    }

    const result = await withTransaction(async (client) => {
      // Find team by invite code
      const teamResult = await client.query(
        "SELECT * FROM teams WHERE team_code = $1 AND is_active = TRUE",
        [invite_code]
      );

      if (teamResult.rows.length === 0) {
        throw new Error("Invalid invite code or team not found");
      }

      const team = teamResult.rows[0];

      // Check if team is full
      if (team.total_members >= team.max_members) {
        throw new Error("Team is full (max 6 members)");
      }

      // Check if user is already a member
      const existingMember = await client.query(
        "SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2 AND left_at IS NULL",
        [team.id, user.id]
      );

      if (existingMember.rows.length > 0) {
        throw new Error("You are already a member of this team");
      }

      // Add user to team
      await client.query(
        `INSERT INTO team_members (team_id, user_id, role, game_uid, game_name)
         VALUES ($1, $2, 'member', $3, $4)`,
        [team.id, user.id, game_uid, game_name]
      );

      // Update team member count
      await client.query(
        "UPDATE teams SET total_members = total_members + 1 WHERE id = $1",
        [team.id]
      );

      return team;
    });

    return successResponse(
      {
        team: {
          id: result.id,
          team_name: result.team_name,
          team_code: result.team_code,
        },
      },
      "Successfully joined the team"
    );
  } catch (error) {
    console.error("Join team error:", error);
    if (error instanceof Error) {
      return errorResponse(error.message);
    }
    return serverErrorResponse(error);
  }
}
