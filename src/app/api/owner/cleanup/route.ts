import { NextRequest } from "next/server";
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { requireOwner } from "@/lib/auth";
import {
  runFullCleanup,
  runScheduledCleanup,
  archiveCompletedTournaments,
  cleanupOrphanedMedia,
  cleanupExpiredTokens,
  cleanupLoginHistory,
  cleanupReadNotifications,
  cleanupCancelledRegistrations,
  cleanupOldChatMessages,
  cleanupOldKnownIPs,
  cleanupInactivePushSubscriptions,
  cleanupResolvedReports,
  cleanupOldJobLogs,
  getCleanupStats,
  getArchiveStats,
  CLEANUP_CONFIG,
  type CleanupResult,
} from "@/lib/cleanup";
import pool from "@/lib/db";
import { RouteTimer, recordColdStart } from "@/lib/serverless";

// Serverless configuration - long timeout for cleanup operations
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * GET /api/owner/cleanup
 * 
 * Get cleanup statistics and configuration
 * Only accessible by owners
 */
export async function GET(request: NextRequest) {
  const timer = new RouteTimer("/api/owner/cleanup GET");
  
  try {
    // Require owner role
    timer.startPhase("auth");
    const user = requireOwner(request);
    if (!user) {
      return unauthorizedResponse("Owner access required");
    }
    timer.endPhase("auth");

    // Get cleanup statistics
    timer.startPhase("stats");
    const stats = await getCleanupStats();
    const archiveStats = await getArchiveStats();
    timer.endPhase("stats");
    
    // Get recent cleanup logs
    timer.startPhase("logs");
    const logsResult = await pool.query(
      `SELECT id, job_type, started_at, completed_at, success, summary, triggered_by
       FROM cleanup_job_logs
       ORDER BY started_at DESC
       LIMIT 10`
    );
    timer.endPhase("logs");

    const timing = timer.log();
    if (timing.coldStart) {
      recordColdStart("/api/owner/cleanup GET", timing.total, timing.instanceAge);
    }

    return successResponse({
      config: CLEANUP_CONFIG,
      pending: {
        tournamentsToArchive: stats.tournamentsToArchive,
        expiredTokens: stats.expiredTokens,
        oldLoginHistory: stats.oldLoginHistory,
        readNotifications: stats.readNotifications,
        cancelledRegistrations: stats.cancelledRegistrations,
        oldChatMessages: stats.oldChatMessages,
        orphanedAvatars: stats.orphanedAvatars,
        inactivePushSubscriptions: stats.inactivePushSubscriptions,
        resolvedReports: stats.resolvedReports,
        oldCleanupLogs: stats.oldCleanupLogs,
        total: 
          stats.tournamentsToArchive +
          stats.expiredTokens +
          stats.oldLoginHistory +
          stats.readNotifications +
          stats.cancelledRegistrations +
          stats.oldChatMessages +
          stats.orphanedAvatars +
          stats.inactivePushSubscriptions +
          stats.resolvedReports +
          stats.oldCleanupLogs,
      },
      archive: {
        totalArchived: archiveStats.totalArchived,
        oldestArchive: archiveStats.oldestArchive,
        newestArchive: archiveStats.newestArchive,
        totalPrizePoolArchived: archiveStats.totalPrizePoolArchived,
      },
      recentJobs: logsResult.rows.map(row => ({
        id: row.id,
        type: row.job_type,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        success: row.success,
        summary: row.summary,
        triggeredBy: row.triggered_by,
      })),
    });
  } catch (error) {
    console.error("Cleanup stats error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/owner/cleanup
 * 
 * Run cleanup operations manually
 * Only accessible by owners or via cron secret
 * 
 * Body:
 *   operation: string - "all" | "scheduled" | "archive" | "media" | "tokens" | "history" | "notifications" | "registrations" | "chat" | "ips" | "push" | "reports" | "logs"
 */
export async function POST(request: NextRequest) {
  try {
    // Check for cron secret or owner authentication
    const cronSecret = request.headers.get("X-Cron-Secret");
    const isValidCron = cronSecret && cronSecret === process.env.CRON_SECRET;
    
    if (!isValidCron) {
      const user = requireOwner(request);
      if (!user) {
        return unauthorizedResponse("Owner access or cron secret required");
      }
    }

    const body = await request.json().catch(() => ({}));
    const operation = body.operation || "all";
    
    const operations: Record<string, () => Promise<CleanupResult>> = {
      archive: archiveCompletedTournaments,
      media: cleanupOrphanedMedia,
      tokens: cleanupExpiredTokens,
      history: cleanupLoginHistory,
      notifications: cleanupReadNotifications,
      registrations: cleanupCancelledRegistrations,
      chat: cleanupOldChatMessages,
      ips: cleanupOldKnownIPs,
      push: cleanupInactivePushSubscriptions,
      reports: cleanupResolvedReports,
      logs: cleanupOldJobLogs,
    };
    
    const triggeredBy = isValidCron ? "cron" : "manual";
    
    // Run full cleanup
    if (operation === "all") {
      const summary = await runFullCleanup();
      
      // Log execution
      await logCleanupExecution("full_cleanup", summary, triggeredBy);
      
      return successResponse({
        operation: "full_cleanup",
        summary: {
          startedAt: summary.startedAt,
          completedAt: summary.completedAt,
          totalDuration: summary.totalDuration,
          overallSuccess: summary.overallSuccess,
          results: summary.results,
        },
      });
    }
    
    // Run scheduled (lightweight) cleanup - suitable for hourly cron
    if (operation === "scheduled") {
      const summary = await runScheduledCleanup();
      
      // Log execution
      await logCleanupExecution("scheduled_cleanup", summary, triggeredBy);
      
      return successResponse({
        operation: "scheduled_cleanup",
        summary: {
          startedAt: summary.startedAt,
          completedAt: summary.completedAt,
          totalDuration: summary.totalDuration,
          overallSuccess: summary.overallSuccess,
          results: summary.results,
        },
      });
    }
    
    // Run single operation
    const fn = operations[operation];
    if (!fn) {
      return errorResponse(`Invalid operation: ${operation}. Valid options: all, scheduled, ${Object.keys(operations).join(", ")}`, 400);
    }
    
    const result = await fn();
    
    // Log execution
    await logCleanupExecution(operation, result, triggeredBy);
    
    return successResponse({
      operation,
      result,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * Log cleanup execution to database
 */
async function logCleanupExecution(
  jobType: string,
  result: CleanupResult | { startedAt: Date; completedAt: Date; overallSuccess: boolean; results: CleanupResult[] },
  triggeredBy: string
): Promise<void> {
  try {
    const isSummary = "results" in result;
    
    await pool.query(
      `INSERT INTO cleanup_job_logs 
       (job_type, started_at, completed_at, success, summary, triggered_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        jobType,
        isSummary ? result.startedAt : new Date(Date.now() - result.duration),
        isSummary ? result.completedAt : new Date(),
        isSummary ? result.overallSuccess : result.success,
        JSON.stringify(isSummary ? result.results : result),
        triggeredBy,
      ]
    );
  } catch (error) {
    console.error("Failed to log cleanup execution:", error);
    // Don't throw - logging failure shouldn't fail the response
  }
}
