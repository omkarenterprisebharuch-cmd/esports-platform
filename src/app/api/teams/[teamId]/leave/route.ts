import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { verifyToken } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const token = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return unauthorizedResponse("No token provided");
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return unauthorizedResponse("Invalid token");
  }

  const userId = decoded.userId;

  try {
    // Check if user is member of this team
    const memberResult = await pool.query(
      `SELECT tm.*, t.owner_id 
       FROM team_members tm
       JOIN teams t ON tm.team_id = t.id
       WHERE tm.team_id = $1 AND tm.user_id = $2`,
      [teamId, userId]
    );

    if (memberResult.rows.length === 0) {
      return errorResponse("You are not a member of this team", 400);
    }

    const member = memberResult.rows[0];

    // Check if user is the owner
    if (member.owner_id === userId) {
      return errorResponse(
        "Team owner cannot leave. Delete the team instead.",
        400
      );
    }

    // Remove user from team
    await pool.query(
      "DELETE FROM team_members WHERE team_id = $1 AND user_id = $2",
      [teamId, userId]
    );

    // Update member count
    await pool.query(
      `UPDATE teams SET member_count = (
        SELECT COUNT(*) FROM team_members WHERE team_id = $1
      ) WHERE id = $1`,
      [teamId]
    );

    return successResponse({ message: "Left team successfully" });
  } catch (error) {
    console.error("Leave team error:", error);
    return errorResponse("Failed to leave team", 500);
  }
}
