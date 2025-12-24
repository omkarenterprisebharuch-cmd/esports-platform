import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getUserFromHeader } from "@/lib/auth";
import { ChatMessageDB, dbMessageToSocket } from "@/lib/chat-utils";

interface Tournament {
  id: number;
  tournament_end_date: Date;
  status: string;
}

interface Registration {
  user_id: number;
}

/**
 * GET /api/tournaments/[id]/chat
 * Fetch chat history for a tournament (last 100 messages)
 * Only accessible by registered participants
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournamentId = parseInt(id, 10);

    if (isNaN(tournamentId)) {
      return errorResponse("Invalid tournament ID", 400);
    }

    // Verify authentication
    const authHeader = request.headers.get("authorization");
    const user = getUserFromHeader(authHeader);
    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    // Check if tournament exists and is still active
    const tournament = await queryOne<Tournament>(
      `SELECT id, tournament_end_date, status
       FROM tournaments
       WHERE id = $1`,
      [tournamentId]
    );

    if (!tournament) {
      return errorResponse("Tournament not found", 404);
    }

    // Check if tournament has ended (add 7 days buffer for chat history)
    const endDate = new Date(tournament.tournament_end_date);
    const chatExpiryDate = new Date(endDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    if (new Date() > chatExpiryDate) {
      return errorResponse("Chat history has expired", 410);
    }

    // Check if user is registered for this tournament
    const registration = await queryOne<Registration>(
      `SELECT user_id FROM tournament_registrations
       WHERE tournament_id = $1 AND user_id = $2 AND status != 'cancelled'`,
      [tournamentId, user.id]
    );

    if (!registration) {
      return errorResponse("You must be registered to access tournament chat", 403);
    }

    // Fetch last 100 messages
    const messages = await query<ChatMessageDB>(
      `SELECT id, tournament_id, user_id, username, message, created_at
       FROM chat_messages
       WHERE tournament_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [tournamentId]
    );

    // Convert to socket format and reverse for chronological order
    const formattedMessages = messages
      .map(dbMessageToSocket)
      .reverse();

    return successResponse({
      messages: formattedMessages,
      tournamentId,
      messageCount: formattedMessages.length,
    });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return errorResponse("Failed to fetch chat messages", 500);
  }
}
