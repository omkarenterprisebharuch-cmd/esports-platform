import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";

/**
 * GET /api/tournaments/recommendations
 * Get personalized tournament recommendations based on user's registration history
 * 
 * Algorithm:
 * 1. Analyze user's past registrations to find preferred games
 * 2. Find tournaments matching those games that the user hasn't registered for
 * 3. Prioritize by: open registration > upcoming > game preference weight
 * 4. Return top recommendations
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "6");

    // Step 1: Get user's game preferences from registration history
    const preferencesResult = await pool.query(
      `SELECT 
        t.game_type,
        COUNT(*) as registration_count,
        MAX(tr.registered_at) as last_registered
      FROM tournament_registrations tr
      JOIN tournaments t ON tr.tournament_id = t.id
      WHERE tr.user_id = $1
      GROUP BY t.game_type
      ORDER BY registration_count DESC, last_registered DESC`,
      [user.id]
    );

    const gamePreferences = preferencesResult.rows;
    
    // If user has no registration history, return popular tournaments
    if (gamePreferences.length === 0) {
      const popularResult = await pool.query(
        `SELECT 
          t.*,
          u.username as host_name,
          (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id) as registration_count,
          CASE
            WHEN t.tournament_end_date <= NOW() THEN 'completed'
            WHEN t.tournament_start_date <= NOW() THEN 'ongoing'
            WHEN t.registration_end_date <= NOW() THEN 'upcoming'
            WHEN t.registration_start_date <= NOW() THEN 'registration_open'
            ELSE 'upcoming'
          END as computed_status
        FROM tournaments t
        JOIN users u ON t.host_id = u.id
        WHERE t.registration_end_date > NOW()
          AND (t.is_template = FALSE OR t.is_template IS NULL)
          AND t.id NOT IN (
            SELECT tournament_id FROM tournament_registrations WHERE user_id = $1
          )
        ORDER BY registration_count DESC, t.prize_pool DESC
        LIMIT $2`,
        [user.id, limit]
      );

      const tournaments = popularResult.rows.map((t) => ({
        ...t,
        status: t.computed_status,
        recommendation_reason: "Popular tournament",
      }));

      return successResponse({
        recommendations: tournaments,
        preferences: [],
        has_history: false,
      });
    }

    // Step 2: Build preference weights
    const preferredGames = gamePreferences.map((p) => p.game_type);
    const totalRegistrations = gamePreferences.reduce(
      (sum, p) => sum + parseInt(p.registration_count),
      0
    );

    // Create a weighted list for SQL ordering
    const gameWeights = gamePreferences.map((p, index) => ({
      game: p.game_type,
      weight: Math.round((parseInt(p.registration_count) / totalRegistrations) * 100),
      rank: index + 1,
    }));

    // Step 3: Get recommended tournaments
    // Prioritize: registration open > upcoming > matches preferred games > higher prize
    const recommendationsResult = await pool.query(
      `SELECT 
        t.*,
        u.username as host_name,
        (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id) as registration_count,
        CASE
          WHEN t.tournament_end_date <= NOW() THEN 'completed'
          WHEN t.tournament_start_date <= NOW() THEN 'ongoing'
          WHEN t.registration_end_date <= NOW() THEN 'upcoming'
          WHEN t.registration_start_date <= NOW() THEN 'registration_open'
          ELSE 'upcoming'
        END as computed_status,
        CASE
          WHEN t.game_type = $2 THEN 1
          WHEN t.game_type = $3 THEN 2
          WHEN t.game_type = $4 THEN 3
          ELSE 4
        END as game_preference_rank,
        CASE
          WHEN t.registration_start_date <= NOW() AND t.registration_end_date > NOW() THEN 1
          WHEN t.registration_start_date > NOW() THEN 2
          ELSE 3
        END as registration_priority
      FROM tournaments t
      JOIN users u ON t.host_id = u.id
      WHERE t.registration_end_date > NOW()
        AND (t.is_template = FALSE OR t.is_template IS NULL)
        AND t.id NOT IN (
          SELECT tournament_id FROM tournament_registrations WHERE user_id = $1
        )
        AND t.game_type = ANY($5)
      ORDER BY 
        registration_priority ASC,
        game_preference_rank ASC,
        t.prize_pool DESC,
        t.registration_start_date ASC
      LIMIT $6`,
      [
        user.id,
        preferredGames[0] || "",
        preferredGames[1] || "",
        preferredGames[2] || "",
        preferredGames,
        limit,
      ]
    );

    // Step 4: Add recommendation reasons
    const tournaments = recommendationsResult.rows.map((t) => {
      let reason = "";
      const gameWeight = gameWeights.find((g) => g.game === t.game_type);

      if (t.computed_status === "registration_open") {
        reason = `Registration open • You play ${t.game_type.toUpperCase()}`;
      } else if (gameWeight && gameWeight.rank === 1) {
        reason = `Your favorite game • ${gameWeight.weight}% of your tournaments`;
      } else if (gameWeight) {
        reason = `You've played ${t.game_type.toUpperCase()} before`;
      } else {
        reason = "Based on your preferences";
      }

      return {
        ...t,
        status: t.computed_status,
        recommendation_reason: reason,
      };
    });

    // Step 5: If we don't have enough recommendations, fill with popular tournaments
    if (tournaments.length < limit) {
      const remaining = limit - tournaments.length;
      const existingIds = tournaments.map((t) => t.id);

      const fillResult = await pool.query(
        `SELECT 
          t.*,
          u.username as host_name,
          (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id) as registration_count,
          CASE
            WHEN t.tournament_end_date <= NOW() THEN 'completed'
            WHEN t.tournament_start_date <= NOW() THEN 'ongoing'
            WHEN t.registration_end_date <= NOW() THEN 'upcoming'
            WHEN t.registration_start_date <= NOW() THEN 'registration_open'
            ELSE 'upcoming'
          END as computed_status
        FROM tournaments t
        JOIN users u ON t.host_id = u.id
        WHERE t.registration_end_date > NOW()
          AND (t.is_template = FALSE OR t.is_template IS NULL)
          AND t.id NOT IN (
            SELECT tournament_id FROM tournament_registrations WHERE user_id = $1
          )
          AND t.id != ALL($2)
        ORDER BY registration_count DESC, t.prize_pool DESC
        LIMIT $3`,
        [user.id, existingIds.length > 0 ? existingIds : ["00000000-0000-0000-0000-000000000000"], remaining]
      );

      const additionalTournaments = fillResult.rows.map((t) => ({
        ...t,
        status: t.computed_status,
        recommendation_reason: "Popular tournament",
      }));

      tournaments.push(...additionalTournaments);
    }

    return successResponse(
      {
        recommendations: tournaments,
        preferences: gameWeights,
        has_history: true,
      },
      undefined,
      200,
      { maxAge: 60, staleWhileRevalidate: 120, isPrivate: true }
    );
  } catch (error) {
    console.error("Get recommendations error:", error);
    return serverErrorResponse(error);
  }
}
