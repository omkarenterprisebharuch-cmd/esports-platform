import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { cache, getRedisInfo, isRedisConnected, TTL, CACHE_PREFIX } from "@/lib/redis";
import { getInstanceStats, getColdStartMetrics } from "@/lib/serverless";
import { getQueueStats as getEmailQueueStats } from "@/lib/email-queue";
import { getCleanupStats, getArchiveStats } from "@/lib/cleanup";

// Serverless configuration
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const MONITORING_CACHE_KEY = `${CACHE_PREFIX.STATS}:monitoring:dashboard`;
const MONITORING_CACHE_TTL = 60; // 1 minute

interface SystemHealth {
  status: "healthy" | "degraded" | "critical";
  score: number; // 0-100
  issues: string[];
}

interface MonitoringData {
  timestamp: string;
  health: SystemHealth;
  database: {
    pool: {
      total: number;
      active: number;
      idle: number;
      waiting: number;
      utilizationPercent: number;
    };
    performance: {
      avgQueryTimeMs: number;
      slowQueries: number;
      connections24h: number;
    };
    storage: {
      databaseSizeMB: number;
      largestTables: Array<{ table: string; sizeMB: number; rows: number }>;
    };
  };
  cache: {
    connected: boolean;
    memoryUsedMB: number;
    memoryMaxMB: number;
    utilizationPercent: number;
    hitRate: number;
    keys: number;
  };
  serverless: {
    instanceAge: number;
    requestCount: number;
    coldStarts: {
      total: number;
      avgDurationMs: number;
      last24h: number;
    };
  };
  email: {
    pending: number;
    failed: number;
    sent24h: number;
    rateLimitStatus: string;
  };
  storage: {
    mediaCount: number;
    mediaSizeEstimateMB: number;
  };
  platform: {
    users: {
      total: number;
      active24h: number;
      newThisWeek: number;
    };
    tournaments: {
      total: number;
      active: number;
      completedThisWeek: number;
    };
    registrations24h: number;
  };
  cleanup: {
    pendingItems: number;
    lastRunAt: string | null;
    archivedTournaments: number;
  };
}

/**
 * GET /api/owner/monitoring
 * 
 * Unified monitoring dashboard API
 * Aggregates all system metrics into a single response
 */
export async function GET(request: NextRequest) {
  try {
    const user = requireOwner(request);
    if (!user) {
      return unauthorizedResponse("Owner access required");
    }

    // Check for fresh param to bypass cache
    const { searchParams } = new URL(request.url);
    const fresh = searchParams.get("fresh") === "true";

    if (!fresh) {
      const cached = await cache.get<MonitoringData>(MONITORING_CACHE_KEY);
      if (cached) {
        return successResponse({ ...cached, cached: true });
      }
    }

    // Collect all metrics in parallel
    const [
      dbPoolStats,
      dbPerformance,
      dbStorage,
      redisInfo,
      platformStats,
      cleanupStats,
      archiveStats,
      lastCleanupRun,
      mediaStats,
    ] = await Promise.all([
      getDbPoolStats(),
      getDbPerformanceStats(),
      getDbStorageStats(),
      getRedisStats(),
      getPlatformStats(),
      getCleanupStats(),
      getArchiveStats(),
      getLastCleanupRun(),
      getMediaStats(),
    ]);

    // Get in-memory stats (no await needed)
    const instanceStats = getInstanceStats();
    const coldStartMetrics = getColdStartMetrics();
    const emailStats = getEmailQueueStats();

    // Calculate system health
    const health = calculateSystemHealth({
      dbPool: dbPoolStats,
      cache: redisInfo,
      email: emailStats,
      coldStarts: coldStartMetrics,
    });

    const monitoringData: MonitoringData = {
      timestamp: new Date().toISOString(),
      health,
      database: {
        pool: dbPoolStats,
        performance: dbPerformance,
        storage: dbStorage,
      },
      cache: redisInfo,
      serverless: {
        instanceAge: instanceStats.instanceAge,
        requestCount: instanceStats.requestCount,
        coldStarts: {
          total: coldStartMetrics.totalColdStarts,
          avgDurationMs: coldStartMetrics.averageDuration,
          last24h: countRecentColdStarts(coldStartMetrics.recentColdStarts),
        },
      },
      email: {
        pending: emailStats.pending,
        failed: emailStats.failed,
        sent24h: emailStats.completed || 0,
        rateLimitStatus: emailStats.rateLimited ? "limited" : "ok",
      },
      storage: mediaStats,
      platform: platformStats,
      cleanup: {
        pendingItems: Object.values(cleanupStats).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0),
        lastRunAt: lastCleanupRun,
        archivedTournaments: archiveStats.totalArchived,
      },
    };

    // Cache the result
    await cache.set(MONITORING_CACHE_KEY, monitoringData, MONITORING_CACHE_TTL);

    return successResponse(monitoringData);
  } catch (error) {
    console.error("Monitoring API error:", error);
    return serverErrorResponse(error);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getDbPoolStats() {
  try {
    const stats = {
      total: pool.totalCount,
      active: pool.totalCount - pool.idleCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
      utilizationPercent: Math.round(((pool.totalCount - pool.idleCount) / Math.max(pool.totalCount, 1)) * 100),
    };
    return stats;
  } catch {
    return { total: 0, active: 0, idle: 0, waiting: 0, utilizationPercent: 0 };
  }
}

async function getDbPerformanceStats() {
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(ROUND(AVG(mean_exec_time)::numeric, 2), 0) as avg_query_time,
        COUNT(*) FILTER (WHERE mean_exec_time > 1000) as slow_queries
      FROM pg_stat_statements
      WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user)
      LIMIT 1
    `).catch(() => ({ rows: [{ avg_query_time: 0, slow_queries: 0 }] }));

    const connections = await pool.query(`
      SELECT COUNT(*) as count 
      FROM pg_stat_activity 
      WHERE state = 'active'
    `).catch(() => ({ rows: [{ count: 0 }] }));

    return {
      avgQueryTimeMs: parseFloat(result.rows[0]?.avg_query_time) || 0,
      slowQueries: parseInt(result.rows[0]?.slow_queries) || 0,
      connections24h: parseInt(connections.rows[0]?.count) || 0,
    };
  } catch {
    return { avgQueryTimeMs: 0, slowQueries: 0, connections24h: 0 };
  }
}

async function getDbStorageStats() {
  try {
    const sizeResult = await pool.query(`
      SELECT pg_database_size(current_database()) / 1024 / 1024 as size_mb
    `);

    const tablesResult = await pool.query(`
      SELECT 
        relname as table,
        pg_total_relation_size(relid) / 1024 / 1024 as size_mb,
        n_live_tup as rows
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 5
    `);

    return {
      databaseSizeMB: Math.round(parseFloat(sizeResult.rows[0]?.size_mb) || 0),
      largestTables: tablesResult.rows.map(r => ({
        table: r.table,
        sizeMB: Math.round(parseFloat(r.size_mb) || 0),
        rows: parseInt(r.rows) || 0,
      })),
    };
  } catch {
    return { databaseSizeMB: 0, largestTables: [] };
  }
}

async function getRedisStats() {
  try {
    if (!isRedisConnected()) {
      return {
        connected: false,
        memoryUsedMB: 0,
        memoryMaxMB: 0,
        utilizationPercent: 0,
        hitRate: 0,
        keys: 0,
      };
    }

    const info = await getRedisInfo();
    
    return {
      connected: true,
      memoryUsedMB: Math.round((info?.usedMemory || 0) / 1024 / 1024),
      memoryMaxMB: Math.round((info?.maxMemory || 0) / 1024 / 1024),
      utilizationPercent: info?.maxMemory 
        ? Math.round((info.usedMemory / info.maxMemory) * 100) 
        : 0,
      hitRate: info?.hitRate || 0,
      keys: info?.keys || 0,
    };
  } catch {
    return {
      connected: false,
      memoryUsedMB: 0,
      memoryMaxMB: 0,
      utilizationPercent: 0,
      hitRate: 0,
      keys: 0,
    };
  }
}

async function getPlatformStats() {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE last_login_at > NOW() - INTERVAL '24 hours') as active_24h,
        (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week,
        (SELECT COUNT(*) FROM tournaments) as total_tournaments,
        (SELECT COUNT(*) FROM tournaments WHERE status IN ('upcoming', 'registration_open', 'ongoing')) as active_tournaments,
        (SELECT COUNT(*) FROM tournaments WHERE status = 'completed' AND updated_at > NOW() - INTERVAL '7 days') as completed_this_week,
        (SELECT COUNT(*) FROM tournament_registrations WHERE created_at > NOW() - INTERVAL '24 hours') as registrations_24h
    `);

    const row = result.rows[0];
    return {
      users: {
        total: parseInt(row.total_users) || 0,
        active24h: parseInt(row.active_24h) || 0,
        newThisWeek: parseInt(row.new_this_week) || 0,
      },
      tournaments: {
        total: parseInt(row.total_tournaments) || 0,
        active: parseInt(row.active_tournaments) || 0,
        completedThisWeek: parseInt(row.completed_this_week) || 0,
      },
      registrations24h: parseInt(row.registrations_24h) || 0,
    };
  } catch {
    return {
      users: { total: 0, active24h: 0, newThisWeek: 0 },
      tournaments: { total: 0, active: 0, completedThisWeek: 0 },
      registrations24h: 0,
    };
  }
}

async function getLastCleanupRun() {
  try {
    const result = await pool.query(`
      SELECT completed_at 
      FROM cleanup_job_logs 
      WHERE success = true 
      ORDER BY completed_at DESC 
      LIMIT 1
    `);
    return result.rows[0]?.completed_at?.toISOString() || null;
  } catch {
    return null;
  }
}

async function getMediaStats() {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE avatar_url IS NOT NULL) +
        (SELECT COUNT(*) FROM tournaments WHERE banner_url IS NOT NULL) +
        (SELECT COUNT(*) FROM teams WHERE logo_url IS NOT NULL) as media_count
    `);
    
    // Estimate ~500KB average per image
    const count = parseInt(result.rows[0]?.media_count) || 0;
    return {
      mediaCount: count,
      mediaSizeEstimateMB: Math.round(count * 0.5),
    };
  } catch {
    return { mediaCount: 0, mediaSizeEstimateMB: 0 };
  }
}

function countRecentColdStarts(recentColdStarts: Array<{ timestamp: number }>): number {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return recentColdStarts.filter(cs => cs.timestamp > oneDayAgo).length;
}

function calculateSystemHealth(metrics: {
  dbPool: { utilizationPercent: number; waiting: number };
  cache: { connected: boolean; utilizationPercent: number };
  email: { failed: number; pending: number };
  coldStarts: { averageDuration: number; totalColdStarts: number };
}): SystemHealth {
  const issues: string[] = [];
  let score = 100;

  // Database health
  if (metrics.dbPool.utilizationPercent > 80) {
    issues.push("Database connection pool >80% utilized");
    score -= 15;
  }
  if (metrics.dbPool.waiting > 5) {
    issues.push(`${metrics.dbPool.waiting} queries waiting for connection`);
    score -= 10;
  }

  // Cache health
  if (!metrics.cache.connected) {
    issues.push("Redis cache not connected");
    score -= 20;
  } else if (metrics.cache.utilizationPercent > 90) {
    issues.push("Redis memory >90% utilized");
    score -= 10;
  }

  // Email health
  if (metrics.email.failed > 10) {
    issues.push(`${metrics.email.failed} failed emails in queue`);
    score -= 10;
  }
  if (metrics.email.pending > 100) {
    issues.push(`${metrics.email.pending} emails pending - possible backlog`);
    score -= 5;
  }

  // Serverless health
  if (metrics.coldStarts.averageDuration > 2000) {
    issues.push(`High cold start latency (${metrics.coldStarts.averageDuration}ms avg)`);
    score -= 10;
  }

  // Determine status
  let status: "healthy" | "degraded" | "critical";
  if (score >= 80) {
    status = "healthy";
  } else if (score >= 50) {
    status = "degraded";
  } else {
    status = "critical";
  }

  return { status, score: Math.max(0, score), issues };
}
