import { NextRequest } from "next/server";
import pool from "@/lib/db";
import {
  successResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { cache, cacheKeys, TTL } from "@/lib/redis";

/**
 * GET /api/hall-of-fame
 * Get hall of fame data: top players, recent winners, game-specific leaderboards
 * 
 * Query params:
 * - game_type: Filter by game type (freefire, pubg, valorant, codm)
 * - period: Time period (all, month, week)
 * - limit: Number of results per section (default 10)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameType = searchParams.get("game_type");
    const period = searchParams.get("period") || "all";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    // Try cache first (15 minute TTL for hall of fame)
    const cacheKey = cacheKeys.hallOfFame(gameType || undefined, period);
    const cached = await cache.get(cacheKey);
    if (cached) {
      return successResponse({
        ...cached,
        cached: true,
      });
    }

    // Build date filter based on period
    let dateFilter = "";
    if (period === "month") {
      dateFilter = "AND t.tournament_end_date >= NOW() - INTERVAL '30 days'";
    } else if (period === "week") {
      dateFilter = "AND t.tournament_end_date >= NOW() - INTERVAL '7 days'";
    }

    // Game type filter
    const gameFilter = gameType ? "AND t.game_type = $1" : "";
    const gameParams = gameType ? [gameType] : [];

    // 1. Get all-time top winners (by total wins)
    const topWinnersQuery = `
      SELECT 
        u.id,
        u.username,
        u.profile_picture_url,
        COUNT(DISTINCT CASE WHEN tl.position = 1 THEN tl.tournament_id END) as first_place_wins,
        COUNT(DISTINCT CASE WHEN tl.position = 2 THEN tl.tournament_id END) as second_place_wins,
        COUNT(DISTINCT CASE WHEN tl.position = 3 THEN tl.tournament_id END) as third_place_wins,
        COUNT(DISTINCT tl.tournament_id) as total_podium_finishes,
        COALESCE(SUM(tl.prize_amount), 0) as total_earnings,
        COALESCE(SUM(tl.kills), 0) as total_kills,
        COALESCE(SUM(tl.points), 0) as total_points
      FROM users u
      INNER JOIN tournament_leaderboard tl ON u.id = tl.user_id
      INNER JOIN tournaments t ON tl.tournament_id = t.id
      WHERE t.status = 'completed' ${gameFilter} ${dateFilter}
      GROUP BY u.id, u.username, u.profile_picture_url
      ORDER BY first_place_wins DESC, second_place_wins DESC, third_place_wins DESC
      LIMIT $${gameParams.length + 1}
    `;

    const topWinners = await pool.query(topWinnersQuery, [...gameParams, limit]);

    // 2. Get top teams (by total wins)
    const topTeamsQuery = `
      SELECT 
        tm.id,
        tm.team_name,
        COUNT(DISTINCT CASE WHEN tl.position = 1 THEN tl.tournament_id END) as first_place_wins,
        COUNT(DISTINCT CASE WHEN tl.position = 2 THEN tl.tournament_id END) as second_place_wins,
        COUNT(DISTINCT CASE WHEN tl.position = 3 THEN tl.tournament_id END) as third_place_wins,
        COUNT(DISTINCT tl.tournament_id) as total_podium_finishes,
        COALESCE(SUM(tl.prize_amount), 0) as total_earnings,
        COALESCE(SUM(tl.kills), 0) as total_kills
      FROM teams tm
      INNER JOIN tournament_leaderboard tl ON tm.id = tl.team_id
      INNER JOIN tournaments t ON tl.tournament_id = t.id
      WHERE t.status = 'completed' ${gameFilter} ${dateFilter}
      GROUP BY tm.id, tm.team_name
      ORDER BY first_place_wins DESC, second_place_wins DESC, third_place_wins DESC
      LIMIT $${gameParams.length + 1}
    `;

    const topTeams = await pool.query(topTeamsQuery, [...gameParams, limit]);

    // 3. Get recent tournament winners (last 10 completed tournaments)
    const recentWinnersQuery = `
      SELECT 
        t.id as tournament_id,
        t.tournament_name,
        t.game_type,
        t.prize_pool,
        t.tournament_end_date,
        t.banner_url,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'position', tl.position,
              'username', u.username,
              'user_id', u.id,
              'avatar_url', u.profile_picture_url,
              'team_name', tm.team_name,
              'team_id', tm.id,
              'prize_amount', tl.prize_amount,
              'kills', tl.kills,
              'points', tl.points
            ) ORDER BY tl.position
          )
          FROM tournament_leaderboard tl
          LEFT JOIN users u ON tl.user_id = u.id
          LEFT JOIN teams tm ON tl.team_id = tm.id
          WHERE tl.tournament_id = t.id AND tl.position <= 3
          ), '[]'
        ) as winners
      FROM tournaments t
      WHERE t.status = 'completed' ${gameFilter} ${dateFilter}
        AND EXISTS (SELECT 1 FROM tournament_leaderboard WHERE tournament_id = t.id)
      ORDER BY t.tournament_end_date DESC
      LIMIT $${gameParams.length + 1}
    `;

    const recentWinners = await pool.query(recentWinnersQuery, [...gameParams, limit]);

    // 4. Get game-specific stats
    const gameStatsQuery = `
      SELECT 
        t.game_type,
        COUNT(DISTINCT t.id) as total_tournaments,
        COUNT(DISTINCT tl.user_id) as unique_winners,
        COALESCE(SUM(t.prize_pool), 0) as total_prize_pool,
        COALESCE(SUM(tl.kills), 0) as total_kills
      FROM tournaments t
      LEFT JOIN tournament_leaderboard tl ON t.id = tl.tournament_id
      WHERE t.status = 'completed' ${dateFilter}
      ${gameType ? `AND t.game_type = $1` : ''}
      GROUP BY t.game_type
      ORDER BY total_tournaments DESC
    `;

    const gameStats = await pool.query(gameStatsQuery, gameParams);

    // 5. Get platform-wide statistics
    const platformStatsQuery = `
      SELECT 
        COUNT(DISTINCT t.id) as total_tournaments_completed,
        COUNT(DISTINCT tl.user_id) as total_unique_winners,
        COALESCE(SUM(t.prize_pool), 0) as total_prize_distributed,
        COALESCE(SUM(tl.kills), 0) as total_kills
      FROM tournaments t
      LEFT JOIN tournament_leaderboard tl ON t.id = tl.tournament_id
      WHERE t.status = 'completed' ${dateFilter}
      ${gameType ? `AND t.game_type = $1` : ''}
    `;

    const platformStats = await pool.query(platformStatsQuery, gameParams);

    // Build the response data
    const responseData = {
      topPlayers: topWinners.rows.map((row, index) => ({
        rank: index + 1,
        id: row.id,
        username: row.username,
        avatarUrl: row.profile_picture_url,
        firstPlaceWins: parseInt(row.first_place_wins) || 0,
        secondPlaceWins: parseInt(row.second_place_wins) || 0,
        thirdPlaceWins: parseInt(row.third_place_wins) || 0,
        totalPodiumFinishes: parseInt(row.total_podium_finishes) || 0,
        totalEarnings: parseFloat(row.total_earnings) || 0,
        totalKills: parseInt(row.total_kills) || 0,
        totalPoints: parseInt(row.total_points) || 0,
      })),
      topTeams: topTeams.rows.map((row, index) => ({
        rank: index + 1,
        id: row.id,
        teamName: row.team_name,
        firstPlaceWins: parseInt(row.first_place_wins) || 0,
        secondPlaceWins: parseInt(row.second_place_wins) || 0,
        thirdPlaceWins: parseInt(row.third_place_wins) || 0,
        totalPodiumFinishes: parseInt(row.total_podium_finishes) || 0,
        totalEarnings: parseFloat(row.total_earnings) || 0,
        totalKills: parseInt(row.total_kills) || 0,
      })),
      recentTournaments: recentWinners.rows.map((row) => ({
        tournamentId: row.tournament_id,
        tournamentName: row.tournament_name,
        gameType: row.game_type,
        prizePool: parseFloat(row.prize_pool) || 0,
        endDate: row.tournament_end_date,
        bannerUrl: row.banner_url,
        winners: row.winners || [],
      })),
      gameStats: gameStats.rows.map((row) => ({
        gameType: row.game_type,
        totalTournaments: parseInt(row.total_tournaments) || 0,
        uniqueWinners: parseInt(row.unique_winners) || 0,
        totalPrizePool: parseFloat(row.total_prize_pool) || 0,
        totalKills: parseInt(row.total_kills) || 0,
      })),
      platformStats: {
        totalTournamentsCompleted: parseInt(platformStats.rows[0]?.total_tournaments_completed) || 0,
        totalUniqueWinners: parseInt(platformStats.rows[0]?.total_unique_winners) || 0,
        totalPrizeDistributed: parseFloat(platformStats.rows[0]?.total_prize_distributed) || 0,
        totalKills: parseInt(platformStats.rows[0]?.total_kills) || 0,
      },
      filters: {
        gameType,
        period,
        limit,
      },
    };

    // Cache the result (15 minute TTL for hall of fame)
    cache.set(cacheKey, responseData, TTL.LONG).catch(() => {});

    return successResponse(responseData);
  } catch (error) {
    console.error("Hall of fame error:", error);
    return serverErrorResponse(error);
  }
}
