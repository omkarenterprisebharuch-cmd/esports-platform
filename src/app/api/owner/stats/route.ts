import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import {
  successResponse,
  forbiddenResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { cache, TTL, CACHE_PREFIX } from "@/lib/redis";

const OWNER_STATS_CACHE_KEY = `${CACHE_PREFIX.STATS}:owner:detailed`;

/**
 * GET /api/owner/stats
 * Get platform statistics (Owner only)
 * Cached for 5 minutes
 */
export async function GET(request: NextRequest) {
  try {
    // Verify owner role
    const user = requireOwner(request);
    if (!user) {
      return forbiddenResponse("Owner access required");
    }

    // Check for cached stats
    const cached = await cache.get<object>(OWNER_STATS_CACHE_KEY);
    if (cached) {
      return successResponse({ ...cached, cached: true });
    }

    // Get all stats in parallel
    const [
      usersStats,
      tournamentsStats,
      registrationsStats,
      teamsStats,
      recentUsers,
      roleDistribution,
    ] = await Promise.all([
      // Users count
      pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week,
          COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '24 hours') as active_today
        FROM users
      `),
      
      // Tournaments count
      pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'upcoming') as upcoming,
          COUNT(*) FILTER (WHERE status = 'registration_open') as registration_open,
          COUNT(*) FILTER (WHERE status = 'ongoing') as ongoing,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week
        FROM tournaments
      `),
      
      // Registrations count
      pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE registered_at > NOW() - INTERVAL '7 days') as new_this_week
        FROM tournament_registrations
      `),
      
      // Teams count (teams table may not have created_at)
      pool.query(`
        SELECT COUNT(*) as total FROM teams
      `),
      
      // Recent users (last 5 signups)
      pool.query(`
        SELECT id, username, email, COALESCE(role, 'player') as role, created_at, profile_picture_url as avatar_url
        FROM users 
        ORDER BY created_at DESC 
        LIMIT 5
      `),
      
      // Role distribution
      pool.query(`
        SELECT 
          COALESCE(role, 'player') as role,
          COUNT(*) as count
        FROM users
        GROUP BY COALESCE(role, 'player')
        ORDER BY count DESC
      `),
    ]);

    const stats = {
      users: {
        total: parseInt(usersStats.rows[0].total),
        newThisWeek: parseInt(usersStats.rows[0].new_this_week),
        activeToday: parseInt(usersStats.rows[0].active_today),
      },
      tournaments: {
        total: parseInt(tournamentsStats.rows[0].total),
        upcoming: parseInt(tournamentsStats.rows[0].upcoming),
        registrationOpen: parseInt(tournamentsStats.rows[0].registration_open),
        ongoing: parseInt(tournamentsStats.rows[0].ongoing),
        completed: parseInt(tournamentsStats.rows[0].completed),
        newThisWeek: parseInt(tournamentsStats.rows[0].new_this_week),
      },
      registrations: {
        total: parseInt(registrationsStats.rows[0].total),
        newThisWeek: parseInt(registrationsStats.rows[0].new_this_week),
      },
      teams: {
        total: parseInt(teamsStats.rows[0].total),
      },
      recentUsers: recentUsers.rows,
      roleDistribution: roleDistribution.rows,
    };

    // Cache the stats for 5 minutes
    await cache.set(OWNER_STATS_CACHE_KEY, stats, TTL.MEDIUM);

    return successResponse(stats);
  } catch (error) {
    console.error("Get owner stats error:", error);
    return serverErrorResponse(error);
  }
}
