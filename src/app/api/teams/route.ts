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
 * Generate a unique 5-digit team invite code
 */
function generateTeamCode(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

/**
 * GET /api/teams
 * Get all teams (admin) or user's teams
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = getUserFromHeader(authHeader);

    if (!user) {
      return unauthorizedResponse();
    }

    const result = await pool.query(
      `SELECT 
        t.id,
        t.team_name,
        t.team_code,
        t.total_members,
        t.max_members,
        t.created_at,
        tm.role,
        tm.game_uid,
        tm.game_name,
        u.username as captain_name,
        CASE WHEN t.captain_id = $1 THEN true ELSE false END as is_captain
      FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      JOIN users u ON t.captain_id = u.id
      WHERE tm.user_id = $1 AND tm.left_at IS NULL AND t.is_active = TRUE
      ORDER BY t.created_at DESC`,
      [user.id]
    );

    return successResponse({ teams: result.rows });
  } catch (error) {
    console.error("Get teams error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/teams
 * Create a new team
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const user = getUserFromHeader(authHeader);

    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { team_name, game_uid, game_name } = body;

    if (!team_name || !game_uid || !game_name) {
      return errorResponse(
        "Team name, game UID, and game name are required"
      );
    }

    const result = await withTransaction(async (client) => {
      // Generate unique team code
      let teamCode: string;
      let isUnique = false;

      while (!isUnique) {
        teamCode = generateTeamCode();
        const existing = await client.query(
          "SELECT id FROM teams WHERE team_code = $1",
          [teamCode]
        );
        if (existing.rows.length === 0) {
          isUnique = true;
        }
      }

      // Create team
      const teamResult = await client.query(
        `INSERT INTO teams (team_name, team_code, captain_id, total_members, max_members)
         VALUES ($1, $2, $3, 1, 6)
         RETURNING id, team_name, team_code, captain_id, total_members, max_members, created_at`,
        [team_name, teamCode!, user.id]
      );

      const team = teamResult.rows[0];

      // Add captain as team member
      await client.query(
        `INSERT INTO team_members (team_id, user_id, role, game_uid, game_name)
         VALUES ($1, $2, 'captain', $3, $4)`,
        [team.id, user.id, game_uid, game_name]
      );

      return team;
    });

    return successResponse(
      {
        team: {
          ...result,
          invite_code: result.team_code,
        },
      },
      "Team created successfully",
      201
    );
  } catch (error) {
    console.error("Create team error:", error);
    return serverErrorResponse(error);
  }
}
