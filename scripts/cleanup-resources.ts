/**
 * Resource Cleanup Script
 * 
 * This script performs cleanup operations for:
 * - Archiving completed tournament data
 * - Cleaning up unused media (Cloudinary)
 * - Removing stale sessions and expired data
 * - Cleaning inactive push subscriptions
 * - Removing old resolved player reports
 * 
 * Run as a cron job:
 * - Daily (full cleanup): 0 3 * * * npx tsx scripts/cleanup-resources.ts
 * - Hourly (scheduled/lightweight): 0 * * * * npx tsx scripts/cleanup-resources.ts --operation scheduled
 * - Windows Task Scheduler: Schedule to run daily at 3 AM
 * - Cloud: Use your platform's scheduled job feature (Vercel Cron, Railway, etc.)
 * 
 * Usage:
 *   npx tsx scripts/cleanup-resources.ts [--dry-run] [--operation <name>]
 * 
 * Options:
 *   --dry-run          Show what would be cleaned without actually cleaning
 *   --operation <name> Run only a specific operation:
 *                      - archive       Archive completed tournaments
 *                      - media         Clean orphaned media files
 *                      - tokens        Clean expired tokens
 *                      - history       Clean login history
 *                      - notifications Clean old notifications
 *                      - registrations Clean cancelled registrations
 *                      - chat          Clean old chat messages
 *                      - ips           Clean old known IP records
 *                      - push          Clean inactive push subscriptions
 *                      - reports       Clean resolved player reports
 *                      - logs          Clean old cleanup job logs
 *                      - scheduled     Run lightweight scheduled cleanup (hourly)
 *                      - all           Run all operations (default)
 *   --stats            Show cleanup statistics only (no cleanup)
 */

import "dotenv/config";
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
  type CleanupSummary,
} from "../src/lib/cleanup";
import pool from "../src/lib/db";

// ============ CLI Argument Parsing ============

interface CliArgs {
  dryRun: boolean;
  operation: string;
  statsOnly: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  
  return {
    dryRun: args.includes("--dry-run") || args.includes("-n"),
    operation: args.includes("--operation") 
      ? args[args.indexOf("--operation") + 1] || "all"
      : args.includes("-o")
        ? args[args.indexOf("-o") + 1] || "all"
        : "all",
    statsOnly: args.includes("--stats") || args.includes("-s"),
  };
}

// ============ Logging Helpers ============

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function printHeader(title: string): void {
  console.log("\n" + "═".repeat(60));
  console.log(`  ${title}`);
  console.log("═".repeat(60));
}

function printResult(result: CleanupResult): void {
  const status = result.success ? "✓" : "✗";
  const color = result.success ? "\x1b[32m" : "\x1b[31m";
  const reset = "\x1b[0m";
  
  console.log(`  ${color}${status}${reset} ${result.operation}`);
  console.log(`    Items processed: ${result.itemsProcessed}`);
  if (result.itemsFailed > 0) {
    console.log(`    Items failed: ${result.itemsFailed}`);
  }
  if (result.details) {
    console.log(`    Details: ${result.details}`);
  }
  if (result.error) {
    console.log(`    Error: ${result.error}`);
  }
  console.log(`    Duration: ${formatDuration(result.duration)}`);
}

function printSummary(summary: CleanupSummary): void {
  printHeader("Cleanup Summary");
  
  const successCount = summary.results.filter(r => r.success).length;
  const totalCount = summary.results.length;
  
  console.log(`  Started:   ${summary.startedAt.toISOString()}`);
  console.log(`  Completed: ${summary.completedAt.toISOString()}`);
  console.log(`  Duration:  ${formatDuration(summary.totalDuration)}`);
  console.log(`  Success:   ${successCount}/${totalCount} operations`);
  console.log(`  Status:    ${summary.overallSuccess ? "✓ All succeeded" : "✗ Some failed"}`);
  
  const totalProcessed = summary.results.reduce((sum, r) => sum + r.itemsProcessed, 0);
  const totalFailed = summary.results.reduce((sum, r) => sum + r.itemsFailed, 0);
  
  console.log(`\n  Total items processed: ${totalProcessed}`);
  if (totalFailed > 0) {
    console.log(`  Total items failed: ${totalFailed}`);
  }
}

// ============ Stats Display ============

async function showStats(): Promise<void> {
  printHeader("Cleanup Statistics");
  
  console.log("  Cleanup Configuration:");
  console.log(`    Archive after: ${CLEANUP_CONFIG.ARCHIVE_AFTER_DAYS} days`);
  console.log(`    Delete archives after: ${CLEANUP_CONFIG.DELETE_ARCHIVE_AFTER_DAYS} days`);
  console.log(`    Token retention: ${CLEANUP_CONFIG.EXPIRED_TOKENS_RETENTION_DAYS} days`);
  console.log(`    Login history retention: ${CLEANUP_CONFIG.LOGIN_HISTORY_RETENTION_DAYS} days`);
  console.log(`    Notification retention: ${CLEANUP_CONFIG.READ_NOTIFICATIONS_RETENTION_DAYS} days`);
  console.log(`    Chat message retention: ${CLEANUP_CONFIG.CHAT_MESSAGES_RETENTION_DAYS} days (0 = forever)`);
  console.log(`    Cancelled registration retention: ${CLEANUP_CONFIG.CANCELLED_REGISTRATIONS_RETENTION_DAYS} days`);
  console.log(`    Push subscription retention: ${CLEANUP_CONFIG.INACTIVE_PUSH_SUBSCRIPTIONS_DAYS} days`);
  console.log(`    Resolved report retention: ${CLEANUP_CONFIG.RESOLVED_REPORTS_RETENTION_DAYS} days`);
  console.log(`    Cleanup log retention: ${CLEANUP_CONFIG.CLEANUP_LOG_RETENTION_DAYS} days`);
  
  console.log("\n  Pending Cleanup:");
  const stats = await getCleanupStats();
  console.log(`    Tournaments to archive: ${stats.tournamentsToArchive}`);
  console.log(`    Expired tokens: ${stats.expiredTokens}`);
  console.log(`    Old login history: ${stats.oldLoginHistory}`);
  console.log(`    Read notifications: ${stats.readNotifications}`);
  console.log(`    Cancelled registrations: ${stats.cancelledRegistrations}`);
  console.log(`    Old chat messages: ${stats.oldChatMessages}`);
  console.log(`    Orphaned avatars: ${stats.orphanedAvatars}`);
  console.log(`    Inactive push subscriptions: ${stats.inactivePushSubscriptions}`);
  console.log(`    Resolved player reports: ${stats.resolvedReports}`);
  console.log(`    Old cleanup logs: ${stats.oldCleanupLogs}`);
  
  console.log("\n  Archive Statistics:");
  const archiveStats = await getArchiveStats();
  console.log(`    Total archived: ${archiveStats.totalArchived}`);
  if (archiveStats.oldestArchive) {
    console.log(`    Oldest archive: ${archiveStats.oldestArchive.toISOString()}`);
  }
  if (archiveStats.newestArchive) {
    console.log(`    Newest archive: ${archiveStats.newestArchive.toISOString()}`);
  }
  console.log(`    Total prize pool archived: ₹${archiveStats.totalPrizePoolArchived.toLocaleString()}`);
}

// ============ Single Operation Runners ============

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

async function runSingleOperation(operation: string): Promise<void> {
  // Handle scheduled cleanup separately (returns CleanupSummary, not CleanupResult)
  if (operation === "scheduled") {
    printHeader("Running: Scheduled Cleanup (Lightweight)");
    const summary = await runScheduledCleanup();
    await logCleanupExecution("scheduled_cleanup", summary, "cron");
    printSummary(summary);
    return;
  }
  
  const fn = operations[operation];
  if (!fn) {
    console.error(`Unknown operation: ${operation}`);
    console.error(`Available operations: ${Object.keys(operations).join(", ")}, scheduled`);
    process.exit(1);
  }
  
  printHeader(`Running: ${operation}`);
  const result = await fn();
  printResult(result);
}

// ============ Dry Run Mode ============

async function dryRun(): Promise<void> {
  printHeader("DRY RUN - No Changes Will Be Made");
  
  const stats = await getCleanupStats();
  
  console.log("\n  The following items WOULD be processed:\n");
  console.log(`    🗃️  Tournaments to archive: ${stats.tournamentsToArchive}`);
  console.log(`    🔑  Expired tokens to remove: ${stats.expiredTokens}`);
  console.log(`    📜  Login history entries to remove: ${stats.oldLoginHistory}`);
  console.log(`    🔔  Read notifications to remove: ${stats.readNotifications}`);
  console.log(`    ❌  Cancelled registrations to remove: ${stats.cancelledRegistrations}`);
  console.log(`    💬  Old chat messages to remove: ${stats.oldChatMessages}`);
  console.log(`    🖼️  Orphaned avatars to clean: ${stats.orphanedAvatars}`);
  console.log(`    📱  Inactive push subscriptions: ${stats.inactivePushSubscriptions}`);
  console.log(`    ⚠️  Resolved player reports: ${stats.resolvedReports}`);
  console.log(`    📋  Old cleanup logs: ${stats.oldCleanupLogs}`);
  
  const totalItems = 
    stats.tournamentsToArchive +
    stats.expiredTokens +
    stats.oldLoginHistory +
    stats.readNotifications +
    stats.cancelledRegistrations +
    stats.oldChatMessages +
    stats.orphanedAvatars +
    stats.inactivePushSubscriptions +
    stats.resolvedReports +
    stats.oldCleanupLogs;
  
  console.log(`\n    Total items: ${totalItems}`);
  console.log("\n  Run without --dry-run to execute cleanup.");
}

// ============ Log Cleanup Execution ============

async function logCleanupExecution(
  jobType: string,
  summary: CleanupSummary | CleanupResult,
  triggeredBy: string
): Promise<void> {
  try {
    const isSummary = "results" in summary;
    
    await pool.query(
      `INSERT INTO cleanup_job_logs 
       (job_type, started_at, completed_at, success, summary, triggered_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        jobType,
        isSummary ? summary.startedAt : new Date(Date.now() - summary.duration),
        isSummary ? summary.completedAt : new Date(),
        isSummary ? summary.overallSuccess : summary.success,
        JSON.stringify(isSummary ? summary.results : summary),
        triggeredBy,
      ]
    );
  } catch (error) {
    console.error("Failed to log cleanup execution:", error);
    // Don't throw - logging failure shouldn't fail the cleanup
  }
}

// ============ Main ============

async function main() {
  const args = parseArgs();
  
  console.log("═".repeat(60));
  console.log("  🧹 Resource Cleanup Script");
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log("═".repeat(60));
  
  try {
    // Stats only mode
    if (args.statsOnly) {
      await showStats();
      process.exit(0);
    }
    
    // Dry run mode
    if (args.dryRun) {
      await dryRun();
      process.exit(0);
    }
    
    // Single operation mode
    if (args.operation !== "all") {
      await runSingleOperation(args.operation);
      process.exit(0);
    }
    
    // Full cleanup
    const summary = await runFullCleanup();
    
    // Log execution
    await logCleanupExecution("full_cleanup", summary, "cron");
    
    // Print summary
    printSummary(summary);
    
    process.exit(summary.overallSuccess ? 0 : 1);
  } catch (error) {
    console.error("\n❌ Fatal error during cleanup:", error);
    process.exit(1);
  }
}

main();
