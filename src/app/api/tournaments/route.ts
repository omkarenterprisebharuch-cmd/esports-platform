import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { sanitizeTournamentName, sanitizeDescription, sanitizeText, sanitizeUrl } from "@/lib/sanitize";
import { cache, cacheKeys, invalidateTournamentCaches, TTL } from "@/lib/redis";

/**
 * GET /api/tournaments
 * Get all tournaments with filtering and sorting
 * 
 * Query params:
 * - status: filter by status
 * - game_type: filter by game (freefire, pubg, valorant, codm)
 * - filter: computed status filter (upcoming, live, active, ongoing)
 * - hosted: true to show only user's hosted tournaments
 * - min_prize: minimum prize pool
 * - max_prize: maximum prize pool
 * - start_date: filter tournaments starting after this date
 * - end_date: filter tournaments starting before this date
 * - sort: sorting option (prize_desc, prize_asc, date_asc, date_desc, popularity)
 * - page: pagination page number
 * - limit: results per page
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const gameType = searchParams.get("game_type");
    const filter = searchParams.get("filter");
    const hosted = searchParams.get("hosted");
    const minPrize = searchParams.get("min_prize");
    const maxPrize = searchParams.get("max_prize");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const sort = searchParams.get("sort") || "date_asc";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;
    const templates = searchParams.get("templates");

    // Get user for hosted filter
    let userId: string | null = null;
    if (hosted === "true") {
      const user = getUserFromRequest(request);
      if (!user) {
        return unauthorizedResponse();
      }
      userId = user.id;
    }

    // Build cache key for non-user-specific requests
    // User-specific requests (hosted=true) are not cached
    const isCacheable = hosted !== "true" && !userId;
    const cacheKey = isCacheable
      ? cacheKeys.tournamentList({
          status: status || undefined,
          gameType: gameType || undefined,
          page,
          limit,
          sort,
        })
      : null;

    // Try cache first for public requests
    if (cacheKey) {
      const cached = await cache.get<{
        tournaments: unknown[];
        total: number;
      }>(cacheKey);
      
      if (cached) {
        return successResponse(
          {
            tournaments: cached.tournaments,
            pagination: {
              page,
              limit,
              total: cached.total,
              pages: Math.ceil(cached.total / limit),
            },
            cached: true,
          },
          undefined,
          200,
          { maxAge: 30, staleWhileRevalidate: 60, isPrivate: false }
        );
      }
    }

    let query = `
      SELECT 
        t.*,
        u.username as host_name,
        -- Dynamic status calculation
        CASE
          WHEN t.tournament_end_date <= NOW() THEN 'completed'
          WHEN t.tournament_start_date <= NOW() THEN 'ongoing'
          WHEN t.registration_end_date <= NOW() THEN 'upcoming'
          WHEN t.registration_start_date <= NOW() THEN 'registration_open'
          ELSE 'upcoming'
        END as computed_status,
        -- Time until next status change
        CASE
          WHEN t.registration_start_date > NOW() THEN 
            EXTRACT(EPOCH FROM (t.registration_start_date - NOW()))
          WHEN t.registration_end_date > NOW() THEN 
            EXTRACT(EPOCH FROM (t.registration_end_date - NOW()))
          WHEN t.tournament_start_date > NOW() THEN 
            EXTRACT(EPOCH FROM (t.tournament_start_date - NOW()))
          WHEN t.tournament_end_date > NOW() THEN 
            EXTRACT(EPOCH FROM (t.tournament_end_date - NOW()))
          ELSE 0
        END as seconds_to_next_status,
        -- Next status change type
        CASE
          WHEN t.registration_start_date > NOW() THEN 'registration_start'
          WHEN t.registration_end_date > NOW() THEN 'registration_end'
          WHEN t.tournament_start_date > NOW() THEN 'tournament_start'
          WHEN t.tournament_end_date > NOW() THEN 'tournament_end'
          ELSE 'completed'
        END as next_status_change
      FROM tournaments t
      JOIN users u ON t.host_id = u.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    // Check if we want templates or regular tournaments
    if (templates === "true") {
      query += ` AND t.is_template = TRUE`;
    } else {
      // By default, exclude templates from regular listings
      query += ` AND (t.is_template = FALSE OR t.is_template IS NULL)`;
    }

    // Filter by host
    if (hosted === "true" && userId) {
      query += ` AND t.host_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    // Filter by computed status
    if (filter === "upcoming") {
      query += ` AND t.registration_start_date > NOW()`;
    } else if (filter === "live") {
      query += ` AND t.registration_start_date <= NOW() AND t.registration_end_date > NOW()`;
    } else if (filter === "active") {
      query += ` AND t.registration_end_date > NOW()`;
    } else if (filter === "ongoing") {
      query += ` AND t.tournament_start_date <= NOW() AND t.tournament_end_date > NOW()`;
    }

    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (gameType) {
      query += ` AND t.game_type = $${paramIndex}`;
      params.push(gameType);
      paramIndex++;
    }

    // Prize pool range filters
    if (minPrize) {
      const minPrizeNum = parseFloat(minPrize);
      if (!isNaN(minPrizeNum)) {
        query += ` AND t.prize_pool >= $${paramIndex}`;
        params.push(minPrizeNum);
        paramIndex++;
      }
    }

    if (maxPrize) {
      const maxPrizeNum = parseFloat(maxPrize);
      if (!isNaN(maxPrizeNum)) {
        query += ` AND t.prize_pool <= $${paramIndex}`;
        params.push(maxPrizeNum);
        paramIndex++;
      }
    }

    // Date range filters
    if (startDate) {
      query += ` AND t.tournament_start_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND t.tournament_start_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Sorting options
    let orderBy = "t.registration_start_date ASC"; // default
    switch (sort) {
      case "prize_desc":
        orderBy = "t.prize_pool DESC NULLS LAST";
        break;
      case "prize_asc":
        orderBy = "t.prize_pool ASC NULLS LAST";
        break;
      case "date_desc":
        orderBy = "t.tournament_start_date DESC";
        break;
      case "date_asc":
        orderBy = "t.tournament_start_date ASC";
        break;
      case "popularity":
        // Sort by number of registrations (most popular first)
        orderBy = "t.max_teams DESC, t.registration_start_date ASC";
        break;
    }

    query += ` ORDER BY ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Replace status with computed_status
    const tournaments = result.rows.map((t) => ({
      ...t,
      status: t.computed_status,
    }));

    // Get total count with same filters (excluding pagination)
    let countQuery = `SELECT COUNT(*) FROM tournaments t WHERE 1=1`;
    const countParams: (string | number)[] = [];
    let countParamIndex = 1;

    // Apply same filters for count
    if (templates === "true") {
      countQuery += ` AND t.is_template = TRUE`;
    } else {
      countQuery += ` AND (t.is_template = FALSE OR t.is_template IS NULL)`;
    }

    if (hosted === "true" && userId) {
      countQuery += ` AND t.host_id = $${countParamIndex}`;
      countParams.push(userId);
      countParamIndex++;
    }

    if (filter === "upcoming") {
      countQuery += ` AND t.registration_start_date > NOW()`;
    } else if (filter === "live") {
      countQuery += ` AND t.registration_start_date <= NOW() AND t.registration_end_date > NOW()`;
    } else if (filter === "active") {
      countQuery += ` AND t.registration_end_date > NOW()`;
    } else if (filter === "ongoing") {
      countQuery += ` AND t.tournament_start_date <= NOW() AND t.tournament_end_date > NOW()`;
    }

    if (status) {
      countQuery += ` AND t.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    if (gameType) {
      countQuery += ` AND t.game_type = $${countParamIndex}`;
      countParams.push(gameType);
      countParamIndex++;
    }

    if (minPrize) {
      const minPrizeNum = parseFloat(minPrize);
      if (!isNaN(minPrizeNum)) {
        countQuery += ` AND t.prize_pool >= $${countParamIndex}`;
        countParams.push(minPrizeNum);
        countParamIndex++;
      }
    }

    if (maxPrize) {
      const maxPrizeNum = parseFloat(maxPrize);
      if (!isNaN(maxPrizeNum)) {
        countQuery += ` AND t.prize_pool <= $${countParamIndex}`;
        countParams.push(maxPrizeNum);
        countParamIndex++;
      }
    }

    if (startDate) {
      countQuery += ` AND t.tournament_start_date >= $${countParamIndex}`;
      countParams.push(startDate);
      countParamIndex++;
    }

    if (endDate) {
      countQuery += ` AND t.tournament_start_date <= $${countParamIndex}`;
      countParams.push(endDate);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Cache the result for public requests (5 minute TTL)
    if (cacheKey) {
      cache.set(cacheKey, { tournaments, total }, TTL.MEDIUM).catch(() => {});
    }

    return successResponse(
      {
        tournaments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      undefined,
      200,
      // Cache for 30 seconds, allow stale for 60 seconds while revalidating
      { maxAge: 30, staleWhileRevalidate: 60, isPrivate: false }
    );
  } catch (error) {
    console.error("Get tournaments error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/tournaments
 * Create a new tournament (Host/Admin only)
 * Supports schedule_type: "once" (one-time) or "everyday" (recurring daily)
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    // Check if user is host or admin (by username)
    const userResult = await pool.query(
      "SELECT is_host, username FROM users WHERE id = $1",
      [user.id]
    );
    const dbUser = userResult.rows[0];

    if (!dbUser?.is_host && dbUser?.username !== "admin") {
      return errorResponse("Only hosts can create tournaments", 403);
    }

    const body = await request.json();
    const {
      tournament_name,
      description,
      prize_pool,
      tournament_start_date,
      tournament_end_date,
      game_type,
      tournament_type,
      max_teams,
      entry_fee,
      match_rules,
      map_name,
      registration_start_date,
      registration_end_date,
      total_matches,
      tournament_banner_url,
      // Auto-scheduling fields
      schedule_type = "once",
      publish_time,
    } = body;

    // Validate required fields
    if (
      !tournament_name ||
      !description ||
      prize_pool === undefined ||
      !tournament_start_date ||
      !tournament_end_date
    ) {
      return errorResponse(
        "Tournament name, description, prize pool, start date, and end date are required"
      );
    }

    // Validate everyday schedule requires publish_time
    if (schedule_type === "everyday" && !publish_time) {
      return errorResponse(
        "Publish time is required for everyday scheduled tournaments"
      );
    }

    // For everyday schedule, create as template
    const isTemplate = schedule_type === "everyday";

    const result = await pool.query(
      `INSERT INTO tournaments (
        host_id,
        tournament_name,
        game_type,
        tournament_type,
        description,
        tournament_banner_url,
        max_teams,
        entry_fee,
        prize_pool,
        match_rules,
        map_name,
        total_matches,
        status,
        registration_start_date,
        registration_end_date,
        tournament_start_date,
        tournament_end_date,
        schedule_type,
        publish_time,
        is_template
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        user.id,
        sanitizeTournamentName(tournament_name), // XSS protection
        game_type || "freefire",
        tournament_type || "squad",
        sanitizeDescription(description), // XSS protection - allows limited HTML
        tournament_banner_url ? sanitizeUrl(tournament_banner_url) : null, // URL validation
        max_teams || 100,
        entry_fee || 0,
        prize_pool,
        match_rules ? sanitizeDescription(match_rules) : "", // XSS protection
        map_name ? sanitizeText(map_name, 100) : "", // XSS protection
        total_matches || 1,
        isTemplate ? "template" : "upcoming",
        registration_start_date || new Date(),
        registration_end_date || tournament_start_date,
        tournament_start_date,
        tournament_end_date,
        schedule_type,
        publish_time || null,
        isTemplate,
      ]
    );

    const message = isTemplate 
      ? `Tournament template created! It will auto-publish daily at ${publish_time}`
      : "Tournament created successfully";

    // Invalidate tournament list caches
    invalidateTournamentCaches().catch(() => {});

    // On-demand ISR revalidation for public pages
    try {
      revalidatePath("/dashboard");
      revalidatePath("/leaderboard");
      // New tournament page will be generated on first visit
      revalidatePath(`/t/${result.rows[0].id}`);
    } catch {
      // Revalidation is best-effort
    }

    return successResponse(
      { tournament: result.rows[0] },
      message,
      201
    );
  } catch (error) {
    console.error("Create tournament error:", error);
    return serverErrorResponse(error);
  }
}
