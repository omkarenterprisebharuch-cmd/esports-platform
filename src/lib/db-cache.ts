/**
 * Database Query Result Caching Layer
 * 
 * Provides cached versions of frequently accessed database queries.
 * Uses Redis for caching with automatic cache invalidation.
 * 
 * Features:
 * - Transparent caching of common queries
 * - Type-safe cached query results
 * - Automatic cache invalidation on updates
 * - Cache warming utilities
 * - Graceful fallback to direct DB queries when cache unavailable
 * 
 * Usage:
 *   import { cachedQueries, warmCache } from "@/lib/db-cache";
 *   
 *   // Get cached user profile
 *   const user = await cachedQueries.getUserById(userId);
 *   
 *   // Warm cache on startup
 *   await warmCache.popularTournaments();
 */

import { query, queryOne } from "./db";
import { cache, cacheKeys, TTL, CACHE_PREFIX, invalidatePattern, del } from "./redis";

// ============ Type Definitions ============

interface CachedUser {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  role: string;
  is_host: boolean;
  email_verified: boolean;
  created_at: string;
  // Encrypted fields not cached for security
}

interface CachedTeam {
  id: string;
  name: string;
  team_code: string;
  captain_id: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  member_count: number;
}

interface CachedTournament {
  id: string;
  title: string;
  game_type: string;
  team_size: number;
  max_teams: number;
  start_date: string;
  registration_deadline: string;
  prize_pool: number;
  description: string;
  rules: string | null;
  status: string;
  host_id: string;
  host_username: string;
  banner_url: string | null;
  registration_count: number;
  created_at: string;
}

interface UserStats {
  tournaments_played: number;
  tournaments_won: number;
  total_kills: number;
  total_points: number;
  total_earnings: number;
  favorite_game: string | null;
}

interface TeamStats {
  tournaments_played: number;
  first_places: number;
  second_places: number;
  third_places: number;
  total_kills: number;
  total_earnings: number;
}

interface PlatformStats {
  total_users: number;
  total_tournaments: number;
  completed_tournaments: number;
  active_tournaments: number;
  total_teams: number;
  total_registrations: number;
  total_prize_distributed: number;
}

// ============ Cache Key Builders (Extended) ============

const dbCacheKeys = {
  ...cacheKeys,
  
  // User stats
  userStats: (userId: string): string => `${CACHE_PREFIX.USERS}:${userId}:stats`,
  
  // Team stats
  teamStats: (teamId: string): string => `${CACHE_PREFIX.TEAMS}:${teamId}:stats`,
  
  // Team members
  teamMembers: (teamId: string): string => `${CACHE_PREFIX.TEAMS}:${teamId}:members`,
  
  // Popular tournaments (for discovery)
  popularTournaments: (gameType?: string): string => 
    gameType ? `${CACHE_PREFIX.TOURNAMENTS}:popular:${gameType}` : `${CACHE_PREFIX.TOURNAMENTS}:popular:all`,
  
  // Upcoming tournaments
  upcomingTournaments: (limit: number): string => `${CACHE_PREFIX.TOURNAMENTS}:upcoming:${limit}`,
  
  // User's active registrations
  userRegistrations: (userId: string): string => `${CACHE_PREFIX.USERS}:${userId}:registrations`,
  
  // Platform statistics
  platformStats: (): string => `${CACHE_PREFIX.STATS}:platform`,
  
  // Game-specific stats
  gameStats: (gameType: string): string => `${CACHE_PREFIX.STATS}:game:${gameType}`,
};

// ============ Cached Queries ============

export const cachedQueries = {
  /**
   * Get user by ID (cached)
   * TTL: 5 minutes - user data changes infrequently
   */
  getUserById: async (userId: string): Promise<CachedUser | null> => {
    const cacheKey = dbCacheKeys.userProfile(userId);
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        return queryOne<CachedUser>(`
          SELECT id, username, email, avatar_url, role, is_host, 
                 email_verified, created_at
          FROM users 
          WHERE id = $1
        `, [userId]);
      },
      TTL.MEDIUM
    );
  },

  /**
   * Get user stats (cached)
   * TTL: 15 minutes - stats update after tournament completion
   */
  getUserStats: async (userId: string): Promise<UserStats> => {
    const cacheKey = dbCacheKeys.userStats(userId);
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        const stats = await queryOne<{
          tournaments_played: string;
          tournaments_won: string;
          total_kills: string;
          total_points: string;
          total_earnings: string;
          favorite_game: string | null;
        }>(`
          WITH user_tournaments AS (
            SELECT DISTINCT tr.tournament_id, t.game_type, t.prize_pool
            FROM tournament_registrations tr
            JOIN tournaments t ON t.id = tr.tournament_id
            WHERE tr.user_id = $1 AND tr.status = 'confirmed'
          ),
          user_placements AS (
            SELECT 
              COUNT(*) as tournaments_played,
              SUM(CASE WHEN tl.final_rank = 1 THEN 1 ELSE 0 END) as tournaments_won,
              COALESCE(SUM(tl.total_kills), 0) as total_kills,
              COALESCE(SUM(tl.total_points), 0) as total_points
            FROM tournament_leaderboard tl
            WHERE tl.user_id = $1
          ),
          earnings AS (
            SELECT COALESCE(SUM(
              CASE tl.final_rank
                WHEN 1 THEN t.prize_pool * 0.5
                WHEN 2 THEN t.prize_pool * 0.3
                WHEN 3 THEN t.prize_pool * 0.15
                ELSE 0
              END
            ), 0) as total_earnings
            FROM tournament_leaderboard tl
            JOIN tournaments t ON t.id = tl.tournament_id
            WHERE tl.user_id = $1 AND tl.final_rank <= 3
          ),
          game_pref AS (
            SELECT game_type as favorite_game
            FROM user_tournaments
            GROUP BY game_type
            ORDER BY COUNT(*) DESC
            LIMIT 1
          )
          SELECT 
            COALESCE(up.tournaments_played, 0) as tournaments_played,
            COALESCE(up.tournaments_won, 0) as tournaments_won,
            COALESCE(up.total_kills, 0) as total_kills,
            COALESCE(up.total_points, 0) as total_points,
            COALESCE(e.total_earnings, 0) as total_earnings,
            gp.favorite_game
          FROM user_placements up
          CROSS JOIN earnings e
          LEFT JOIN game_pref gp ON true
        `, [userId]);

        return {
          tournaments_played: parseInt(stats?.tournaments_played || "0"),
          tournaments_won: parseInt(stats?.tournaments_won || "0"),
          total_kills: parseInt(stats?.total_kills || "0"),
          total_points: parseInt(stats?.total_points || "0"),
          total_earnings: parseFloat(stats?.total_earnings || "0"),
          favorite_game: stats?.favorite_game || null,
        };
      },
      TTL.LONG
    );
  },

  /**
   * Get team by ID (cached)
   * TTL: 5 minutes
   */
  getTeamById: async (teamId: string): Promise<CachedTeam | null> => {
    const cacheKey = dbCacheKeys.team(teamId);
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        return queryOne<CachedTeam>(`
          SELECT t.id, t.name, t.team_code, t.captain_id, t.logo_url, 
                 t.is_active, t.created_at,
                 COUNT(DISTINCT tm.user_id) as member_count
          FROM teams t
          LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.is_active = true
          WHERE t.id = $1
          GROUP BY t.id
        `, [teamId]);
      },
      TTL.MEDIUM
    );
  },

  /**
   * Get team stats (cached)
   * TTL: 15 minutes
   */
  getTeamStats: async (teamId: string): Promise<TeamStats> => {
    const cacheKey = dbCacheKeys.teamStats(teamId);
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        const stats = await queryOne<{
          tournaments_played: string;
          first_places: string;
          second_places: string;
          third_places: string;
          total_kills: string;
          total_earnings: string;
        }>(`
          WITH team_results AS (
            SELECT 
              tl.tournament_id,
              tl.final_rank,
              tl.total_kills,
              t.prize_pool
            FROM tournament_leaderboard tl
            JOIN tournaments t ON t.id = tl.tournament_id
            WHERE tl.team_id = $1
          )
          SELECT
            COUNT(DISTINCT tournament_id) as tournaments_played,
            SUM(CASE WHEN final_rank = 1 THEN 1 ELSE 0 END) as first_places,
            SUM(CASE WHEN final_rank = 2 THEN 1 ELSE 0 END) as second_places,
            SUM(CASE WHEN final_rank = 3 THEN 1 ELSE 0 END) as third_places,
            COALESCE(SUM(total_kills), 0) as total_kills,
            COALESCE(SUM(
              CASE final_rank
                WHEN 1 THEN prize_pool * 0.5
                WHEN 2 THEN prize_pool * 0.3
                WHEN 3 THEN prize_pool * 0.15
                ELSE 0
              END
            ), 0) as total_earnings
          FROM team_results
        `, [teamId]);

        return {
          tournaments_played: parseInt(stats?.tournaments_played || "0"),
          first_places: parseInt(stats?.first_places || "0"),
          second_places: parseInt(stats?.second_places || "0"),
          third_places: parseInt(stats?.third_places || "0"),
          total_kills: parseInt(stats?.total_kills || "0"),
          total_earnings: parseFloat(stats?.total_earnings || "0"),
        };
      },
      TTL.LONG
    );
  },

  /**
   * Get team members (cached)
   * TTL: 5 minutes
   */
  getTeamMembers: async (teamId: string): Promise<Array<{
    user_id: string;
    username: string;
    avatar_url: string | null;
    is_captain: boolean;
    joined_at: string;
  }>> => {
    const cacheKey = dbCacheKeys.teamMembers(teamId);
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        return query(`
          SELECT tm.user_id, u.username, u.avatar_url,
                 (tm.user_id = t.captain_id) as is_captain,
                 tm.joined_at
          FROM team_members tm
          JOIN users u ON u.id = tm.user_id
          JOIN teams t ON t.id = tm.team_id
          WHERE tm.team_id = $1 AND tm.is_active = true
          ORDER BY is_captain DESC, tm.joined_at ASC
        `, [teamId]);
      },
      TTL.MEDIUM
    );
  },

  /**
   * Get single tournament (cached)
   * TTL: 2 minutes - tournament data may change more frequently
   */
  getTournamentById: async (tournamentId: string): Promise<CachedTournament | null> => {
    const cacheKey = dbCacheKeys.tournament(tournamentId);
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        return queryOne<CachedTournament>(`
          SELECT t.*, u.username as host_username,
                 (SELECT COUNT(*) FROM tournament_registrations tr 
                  WHERE tr.tournament_id = t.id AND tr.status = 'confirmed') as registration_count
          FROM tournaments t
          JOIN users u ON u.id = t.host_id
          WHERE t.id = $1
        `, [tournamentId]);
      },
      TTL.SHORT * 2 // 2 minutes
    );
  },

  /**
   * Get popular tournaments (cached)
   * TTL: 10 minutes
   */
  getPopularTournaments: async (gameType?: string, limit: number = 10): Promise<CachedTournament[]> => {
    const cacheKey = dbCacheKeys.popularTournaments(gameType);
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        return query<CachedTournament>(`
          SELECT t.*, u.username as host_username,
                 (SELECT COUNT(*) FROM tournament_registrations tr 
                  WHERE tr.tournament_id = t.id AND tr.status = 'confirmed') as registration_count
          FROM tournaments t
          JOIN users u ON u.id = t.host_id
          WHERE t.status IN ('published', 'registration_open')
            ${gameType ? "AND t.game_type = $2" : ""}
          ORDER BY registration_count DESC, t.prize_pool DESC
          LIMIT $1
        `, gameType ? [limit, gameType] : [limit]);
      },
      TTL.MEDIUM * 2 // 10 minutes
    );
  },

  /**
   * Get upcoming tournaments (cached)
   * TTL: 5 minutes
   */
  getUpcomingTournaments: async (limit: number = 10): Promise<CachedTournament[]> => {
    const cacheKey = dbCacheKeys.upcomingTournaments(limit);
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        return query<CachedTournament>(`
          SELECT t.*, u.username as host_username,
                 (SELECT COUNT(*) FROM tournament_registrations tr 
                  WHERE tr.tournament_id = t.id AND tr.status = 'confirmed') as registration_count
          FROM tournaments t
          JOIN users u ON u.id = t.host_id
          WHERE t.status IN ('published', 'registration_open')
            AND t.start_date > NOW()
          ORDER BY t.start_date ASC
          LIMIT $1
        `, [limit]);
      },
      TTL.MEDIUM
    );
  },

  /**
   * Get user's active tournament registrations (cached)
   * TTL: 2 minutes
   */
  getUserRegistrations: async (userId: string): Promise<Array<{
    tournament_id: string;
    tournament_title: string;
    game_type: string;
    start_date: string;
    status: string;
    registration_status: string;
  }>> => {
    const cacheKey = dbCacheKeys.userRegistrations(userId);
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        return query(`
          SELECT tr.tournament_id, t.title as tournament_title, t.game_type,
                 t.start_date, t.status, tr.status as registration_status
          FROM tournament_registrations tr
          JOIN tournaments t ON t.id = tr.tournament_id
          WHERE tr.user_id = $1 
            AND tr.status IN ('confirmed', 'pending', 'waitlisted')
            AND t.status NOT IN ('completed', 'cancelled')
          ORDER BY t.start_date ASC
        `, [userId]);
      },
      TTL.SHORT * 2 // 2 minutes
    );
  },

  /**
   * Get platform statistics (cached)
   * TTL: 1 hour - updated infrequently
   */
  getPlatformStats: async (): Promise<PlatformStats> => {
    const cacheKey = dbCacheKeys.platformStats();
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        const stats = await queryOne<{
          total_users: string;
          total_tournaments: string;
          completed_tournaments: string;
          active_tournaments: string;
          total_teams: string;
          total_registrations: string;
          total_prize_distributed: string;
        }>(`
          SELECT
            (SELECT COUNT(*) FROM users) as total_users,
            (SELECT COUNT(*) FROM tournaments) as total_tournaments,
            (SELECT COUNT(*) FROM tournaments WHERE status = 'completed') as completed_tournaments,
            (SELECT COUNT(*) FROM tournaments WHERE status IN ('published', 'registration_open', 'registration_closed', 'in_progress')) as active_tournaments,
            (SELECT COUNT(*) FROM teams WHERE is_active = true) as total_teams,
            (SELECT COUNT(*) FROM tournament_registrations WHERE status = 'confirmed') as total_registrations,
            (SELECT COALESCE(SUM(prize_pool), 0) FROM tournaments WHERE status = 'completed') as total_prize_distributed
        `);

        return {
          total_users: parseInt(stats?.total_users || "0"),
          total_tournaments: parseInt(stats?.total_tournaments || "0"),
          completed_tournaments: parseInt(stats?.completed_tournaments || "0"),
          active_tournaments: parseInt(stats?.active_tournaments || "0"),
          total_teams: parseInt(stats?.total_teams || "0"),
          total_registrations: parseInt(stats?.total_registrations || "0"),
          total_prize_distributed: parseFloat(stats?.total_prize_distributed || "0"),
        };
      },
      TTL.HOUR
    );
  },

  /**
   * Get game-specific statistics (cached)
   * TTL: 1 hour
   */
  getGameStats: async (gameType: string): Promise<{
    total_tournaments: number;
    completed_tournaments: number;
    total_participants: number;
    total_prize: number;
    avg_prize: number;
  }> => {
    const cacheKey = dbCacheKeys.gameStats(gameType);
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        const stats = await queryOne<{
          total_tournaments: string;
          completed_tournaments: string;
          total_participants: string;
          total_prize: string;
          avg_prize: string;
        }>(`
          SELECT
            COUNT(*) as total_tournaments,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_tournaments,
            (SELECT COUNT(*) FROM tournament_registrations tr 
             JOIN tournaments t ON t.id = tr.tournament_id 
             WHERE t.game_type = $1 AND tr.status = 'confirmed') as total_participants,
            COALESCE(SUM(prize_pool) FILTER (WHERE status = 'completed'), 0) as total_prize,
            COALESCE(AVG(prize_pool), 0) as avg_prize
          FROM tournaments
          WHERE game_type = $1
        `, [gameType]);

        return {
          total_tournaments: parseInt(stats?.total_tournaments || "0"),
          completed_tournaments: parseInt(stats?.completed_tournaments || "0"),
          total_participants: parseInt(stats?.total_participants || "0"),
          total_prize: parseFloat(stats?.total_prize || "0"),
          avg_prize: parseFloat(stats?.avg_prize || "0"),
        };
      },
      TTL.HOUR
    );
  },

  /**
   * Get tournament leaderboard (cached)
   * TTL: 5 minutes for ongoing, 1 hour for completed
   */
  getTournamentLeaderboard: async (tournamentId: string): Promise<Array<{
    rank: number;
    user_id: string | null;
    team_id: string | null;
    username: string | null;
    team_name: string | null;
    total_kills: number;
    total_points: number;
  }>> => {
    const cacheKey = dbCacheKeys.tournamentLeaderboard(tournamentId);
    
    // Check if tournament is completed for TTL decision
    const tournament = await queryOne<{ status: string }>(
      "SELECT status FROM tournaments WHERE id = $1",
      [tournamentId]
    );
    
    const ttl = tournament?.status === "completed" ? TTL.HOUR : TTL.MEDIUM;
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        return query(`
          SELECT 
            tl.final_rank as rank,
            tl.user_id,
            tl.team_id,
            u.username,
            t.name as team_name,
            COALESCE(tl.total_kills, 0) as total_kills,
            COALESCE(tl.total_points, 0) as total_points
          FROM tournament_leaderboard tl
          LEFT JOIN users u ON u.id = tl.user_id
          LEFT JOIN teams t ON t.id = tl.team_id
          WHERE tl.tournament_id = $1
          ORDER BY tl.final_rank ASC
        `, [tournamentId]);
      },
      ttl
    );
  },
};

// ============ Cache Invalidation ============

export const invalidateDbCache = {
  /**
   * Invalidate user cache when profile is updated
   */
  user: async (userId: string): Promise<void> => {
    await Promise.all([
      del(dbCacheKeys.userProfile(userId)),
      del(dbCacheKeys.userStats(userId)),
      del(dbCacheKeys.userRegistrations(userId)),
    ]);
  },

  /**
   * Invalidate team cache when team is updated
   */
  team: async (teamId: string): Promise<void> => {
    await Promise.all([
      del(dbCacheKeys.team(teamId)),
      del(dbCacheKeys.teamStats(teamId)),
      del(dbCacheKeys.teamMembers(teamId)),
    ]);
  },

  /**
   * Invalidate tournament cache when tournament is updated
   */
  tournament: async (tournamentId: string): Promise<void> => {
    await Promise.all([
      del(dbCacheKeys.tournament(tournamentId)),
      del(dbCacheKeys.tournamentLeaderboard(tournamentId)),
      invalidatePattern(`${CACHE_PREFIX.TOURNAMENTS}:popular:*`),
      invalidatePattern(`${CACHE_PREFIX.TOURNAMENTS}:upcoming:*`),
    ]);
  },

  /**
   * Invalidate registration-related caches
   */
  registration: async (userId: string, tournamentId: string): Promise<void> => {
    await Promise.all([
      del(dbCacheKeys.userRegistrations(userId)),
      del(dbCacheKeys.tournament(tournamentId)),
      // Invalidate popularity rankings
      invalidatePattern(`${CACHE_PREFIX.TOURNAMENTS}:popular:*`),
    ]);
  },

  /**
   * Invalidate leaderboard cache
   */
  leaderboard: async (tournamentId: string): Promise<void> => {
    await Promise.all([
      del(dbCacheKeys.tournamentLeaderboard(tournamentId)),
      // Also invalidate hall of fame when leaderboard changes
      invalidatePattern(`${CACHE_PREFIX.HALL_OF_FAME}:*`),
    ]);
  },

  /**
   * Invalidate all stats caches
   */
  stats: async (): Promise<void> => {
    await invalidatePattern(`${CACHE_PREFIX.STATS}:*`);
  },

  /**
   * Full cache clear (use sparingly)
   */
  all: async (): Promise<void> => {
    await Promise.all([
      invalidatePattern(`${CACHE_PREFIX.TOURNAMENTS}:*`),
      invalidatePattern(`${CACHE_PREFIX.TOURNAMENT}:*`),
      invalidatePattern(`${CACHE_PREFIX.USERS}:*`),
      invalidatePattern(`${CACHE_PREFIX.TEAMS}:*`),
      invalidatePattern(`${CACHE_PREFIX.LEADERBOARD}:*`),
      invalidatePattern(`${CACHE_PREFIX.HALL_OF_FAME}:*`),
      invalidatePattern(`${CACHE_PREFIX.STATS}:*`),
    ]);
  },
};

// ============ Cache Warming ============

export const warmCache = {
  /**
   * Warm cache with popular tournaments
   * Call on server startup or after major data changes
   */
  popularTournaments: async (): Promise<void> => {
    console.log("🔥 Warming cache: popular tournaments...");
    
    const games = ["freefire", "pubg", "valorant", "codm"];
    
    // Warm overall popular tournaments
    await cachedQueries.getPopularTournaments(undefined, 20);
    
    // Warm game-specific popular tournaments
    await Promise.all(
      games.map(game => cachedQueries.getPopularTournaments(game, 10))
    );
    
    console.log("✅ Cache warmed: popular tournaments");
  },

  /**
   * Warm cache with upcoming tournaments
   */
  upcomingTournaments: async (): Promise<void> => {
    console.log("🔥 Warming cache: upcoming tournaments...");
    await cachedQueries.getUpcomingTournaments(20);
    console.log("✅ Cache warmed: upcoming tournaments");
  },

  /**
   * Warm cache with platform stats
   */
  platformStats: async (): Promise<void> => {
    console.log("🔥 Warming cache: platform stats...");
    
    const games = ["freefire", "pubg", "valorant", "codm"];
    
    await cachedQueries.getPlatformStats();
    await Promise.all(
      games.map(game => cachedQueries.getGameStats(game))
    );
    
    console.log("✅ Cache warmed: platform stats");
  },

  /**
   * Warm cache for a specific tournament (call before tournament starts)
   */
  tournament: async (tournamentId: string): Promise<void> => {
    console.log(`🔥 Warming cache: tournament ${tournamentId}...`);
    
    await Promise.all([
      cachedQueries.getTournamentById(tournamentId),
      cachedQueries.getTournamentLeaderboard(tournamentId),
    ]);
    
    console.log(`✅ Cache warmed: tournament ${tournamentId}`);
  },

  /**
   * Warm all essential caches
   * Call on server startup
   */
  all: async (): Promise<void> => {
    console.log("🔥 Starting full cache warm...");
    const startTime = Date.now();
    
    try {
      await Promise.all([
        warmCache.popularTournaments(),
        warmCache.upcomingTournaments(),
        warmCache.platformStats(),
      ]);
      
      const elapsed = Date.now() - startTime;
      console.log(`✅ Full cache warm completed in ${elapsed}ms`);
    } catch (error) {
      console.error("❌ Cache warming failed:", error);
    }
  },
};

// ============ Export ============

export { dbCacheKeys };

export default cachedQueries;
