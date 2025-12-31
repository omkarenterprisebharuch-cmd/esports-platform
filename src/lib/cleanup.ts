/**
 * Resource Cleanup Utility
 * 
 * Handles cleanup operations for:
 * - Archiving completed tournament data
 * - Cleaning up unused media (Cloudinary)
 * - Removing stale sessions and expired data
 * 
 * @module cleanup
 */

import pool, { query, queryOne } from "./db";
import cloudinary from "./cloudinary";

// ============ Configuration ============

export const CLEANUP_CONFIG = {
  // Archive tournaments older than X days after completion
  ARCHIVE_AFTER_DAYS: 90,
  
  // Delete archived tournaments after X days (set to 0 to keep forever)
  DELETE_ARCHIVE_AFTER_DAYS: 365,
  
  // Remove refresh tokens expired for X days
  EXPIRED_TOKENS_RETENTION_DAYS: 7,
  
  // Remove login history older than X days
  LOGIN_HISTORY_RETENTION_DAYS: 90,
  
  // Remove read notifications older than X days
  READ_NOTIFICATIONS_RETENTION_DAYS: 30,
  
  // Remove chat messages older than X days (0 = keep forever)
  CHAT_MESSAGES_RETENTION_DAYS: 180,
  
  // Remove cancelled registrations older than X days
  CANCELLED_REGISTRATIONS_RETENTION_DAYS: 30,
  
  // Remove inactive push subscriptions (no activity) older than X days
  INACTIVE_PUSH_SUBSCRIPTIONS_DAYS: 90,
  
  // Remove resolved player reports older than X days
  RESOLVED_REPORTS_RETENTION_DAYS: 180,
  
  // Remove cleanup job logs older than X days
  CLEANUP_LOG_RETENTION_DAYS: 30,
  
  // Batch size for processing
  BATCH_SIZE: 100,
};

// ============ Types ============

export interface CleanupResult {
  operation: string;
  success: boolean;
  itemsProcessed: number;
  itemsFailed: number;
  details?: string;
  error?: string;
  duration: number; // milliseconds
}

export interface CleanupSummary {
  startedAt: Date;
  completedAt: Date;
  totalDuration: number;
  results: CleanupResult[];
  overallSuccess: boolean;
}

export interface ArchiveStats {
  tournamentsToArchive: number;
  tournamentsArchived: number;
  mediaToClean: number;
  mediaCleaned: number;
}

// ============ Tournament Archival ============

/**
 * Get tournaments eligible for archiving (completed > X days ago)
 */
export async function getTournamentsToArchive(): Promise<{ id: number; tournament_banner_url?: string }[]> {
  const result = await query<{ id: number; tournament_banner_url?: string }>(
    `SELECT id, tournament_banner_url
     FROM tournaments
     WHERE status = 'completed'
       AND is_archived IS NOT TRUE
       AND tournament_end_date < NOW() - INTERVAL '${CLEANUP_CONFIG.ARCHIVE_AFTER_DAYS} days'
     ORDER BY tournament_end_date ASC
     LIMIT $1`,
    [CLEANUP_CONFIG.BATCH_SIZE]
  );
  
  return result;
}

/**
 * Archive a single tournament
 * Moves essential data to archive table and marks original as archived
 */
export async function archiveTournament(tournamentId: number): Promise<boolean> {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // Get tournament data
    const tournament = await client.query(
      `SELECT * FROM tournaments WHERE id = $1`,
      [tournamentId]
    );
    
    if (tournament.rows.length === 0) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }
    
    const t = tournament.rows[0];
    
    // Get leaderboard data
    const leaderboard = await client.query(
      `SELECT * FROM tournament_leaderboard WHERE tournament_id = $1`,
      [tournamentId]
    );
    
    // Get registration count
    const regCount = await client.query(
      `SELECT COUNT(*) as count FROM tournament_registrations WHERE tournament_id = $1`,
      [tournamentId]
    );
    
    // Insert into archive table (create if not exists)
    await client.query(
      `INSERT INTO tournament_archives (
        original_id,
        tournament_name,
        game_type,
        tournament_type,
        host_id,
        prize_pool,
        entry_fee,
        max_teams,
        final_teams,
        tournament_start_date,
        tournament_end_date,
        leaderboard_snapshot,
        registration_count,
        archived_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      ON CONFLICT (original_id) DO NOTHING`,
      [
        t.id,
        t.tournament_name,
        t.game_type,
        t.tournament_type,
        t.host_id,
        t.prize_pool,
        t.entry_fee,
        t.max_teams,
        t.current_teams,
        t.tournament_start_date,
        t.tournament_end_date,
        JSON.stringify(leaderboard.rows),
        regCount.rows[0].count,
      ]
    );
    
    // Mark tournament as archived
    await client.query(
      `UPDATE tournaments SET is_archived = TRUE, archived_at = NOW() WHERE id = $1`,
      [tournamentId]
    );
    
    // Delete detailed registrations (archived tournament no longer needs them)
    await client.query(
      `DELETE FROM tournament_registrations WHERE tournament_id = $1`,
      [tournamentId]
    );
    
    // Delete chat messages for this tournament (if retention allows)
    if (CLEANUP_CONFIG.CHAT_MESSAGES_RETENTION_DAYS > 0) {
      await client.query(
        `DELETE FROM chat_messages 
         WHERE tournament_id = $1 
           AND created_at < NOW() - INTERVAL '${CLEANUP_CONFIG.CHAT_MESSAGES_RETENTION_DAYS} days'`,
        [tournamentId]
      );
    }
    
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`Error archiving tournament ${tournamentId}:`, error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Archive all eligible tournaments
 */
export async function archiveCompletedTournaments(): Promise<CleanupResult> {
  const start = Date.now();
  let processed = 0;
  let failed = 0;
  
  try {
    const tournaments = await getTournamentsToArchive();
    
    for (const tournament of tournaments) {
      const success = await archiveTournament(tournament.id);
      if (success) {
        processed++;
      } else {
        failed++;
      }
    }
    
    return {
      operation: "archive_tournaments",
      success: true,
      itemsProcessed: processed,
      itemsFailed: failed,
      details: `Archived ${processed} tournaments, ${failed} failed`,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      operation: "archive_tournaments",
      success: false,
      itemsProcessed: processed,
      itemsFailed: failed,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

// ============ Media Cleanup ============

/**
 * Extract Cloudinary public ID from URL
 */
function extractPublicId(url: string): string | null {
  if (!url || !url.includes("cloudinary.com")) {
    return null;
  }
  
  try {
    // Example URL: https://res.cloudinary.com/demo/image/upload/v1234567890/esports/tournaments/abc123.jpg
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z]+)?$/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Get orphaned media (images from deleted/archived tournaments)
 */
export async function getOrphanedTournamentMedia(): Promise<string[]> {
  // Get banner URLs from archived tournaments that are old enough for deletion
  const result = await query<{ tournament_banner_url: string }>(
    `SELECT tournament_banner_url
     FROM tournaments
     WHERE is_archived = TRUE
       AND archived_at < NOW() - INTERVAL '${CLEANUP_CONFIG.DELETE_ARCHIVE_AFTER_DAYS} days'
       AND tournament_banner_url IS NOT NULL
       AND tournament_banner_url != ''
     LIMIT $1`,
    [CLEANUP_CONFIG.BATCH_SIZE]
  );
  
  return result
    .map(r => extractPublicId(r.tournament_banner_url))
    .filter((id): id is string => id !== null);
}

/**
 * Get unused avatar images (from deleted users)
 */
export async function getOrphanedAvatars(): Promise<string[]> {
  // Find avatars from anonymized users (GDPR deletions)
  const result = await query<{ profile_picture_url: string }>(
    `SELECT profile_picture_url
     FROM users
     WHERE username LIKE 'deleted_user_%'
       AND profile_picture_url IS NOT NULL
       AND profile_picture_url != ''
     LIMIT $1`,
    [CLEANUP_CONFIG.BATCH_SIZE]
  );
  
  return result
    .map(r => extractPublicId(r.profile_picture_url))
    .filter((id): id is string => id !== null);
}

/**
 * Delete image from Cloudinary
 */
async function deleteCloudinaryImage(publicId: string): Promise<boolean> {
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error) {
    console.error(`Failed to delete Cloudinary image ${publicId}:`, error);
    return false;
  }
}

/**
 * Clean up orphaned media files
 */
export async function cleanupOrphanedMedia(): Promise<CleanupResult> {
  const start = Date.now();
  let processed = 0;
  let failed = 0;
  
  try {
    // Get tournament banners to clean
    const tournamentMedia = await getOrphanedTournamentMedia();
    
    // Get orphaned avatars
    const avatars = await getOrphanedAvatars();
    
    const allMedia = [...tournamentMedia, ...avatars];
    
    for (const publicId of allMedia) {
      const success = await deleteCloudinaryImage(publicId);
      if (success) {
        processed++;
      } else {
        failed++;
      }
    }
    
    // Clear the profile_picture_url for deleted users after cleaning
    if (avatars.length > 0) {
      await query(
        `UPDATE users 
         SET profile_picture_url = NULL 
         WHERE username LIKE 'deleted_user_%' 
           AND profile_picture_url IS NOT NULL`
      );
    }
    
    return {
      operation: "cleanup_media",
      success: true,
      itemsProcessed: processed,
      itemsFailed: failed,
      details: `Cleaned ${processed} media files (${tournamentMedia.length} banners, ${avatars.length} avatars)`,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      operation: "cleanup_media",
      success: false,
      itemsProcessed: processed,
      itemsFailed: failed,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

// ============ Session & Token Cleanup ============

/**
 * Remove expired refresh tokens
 */
export async function cleanupExpiredTokens(): Promise<CleanupResult> {
  const start = Date.now();
  
  try {
    const result = await query(
      `DELETE FROM refresh_tokens
       WHERE (expires_at < NOW() - INTERVAL '${CLEANUP_CONFIG.EXPIRED_TOKENS_RETENTION_DAYS} days')
          OR (revoked = TRUE AND revoked_at < NOW() - INTERVAL '${CLEANUP_CONFIG.EXPIRED_TOKENS_RETENTION_DAYS} days')
       RETURNING id`
    );
    
    return {
      operation: "cleanup_expired_tokens",
      success: true,
      itemsProcessed: result.length,
      itemsFailed: 0,
      details: `Removed ${result.length} expired/revoked refresh tokens`,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      operation: "cleanup_expired_tokens",
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

/**
 * Remove old login history entries
 */
export async function cleanupLoginHistory(): Promise<CleanupResult> {
  const start = Date.now();
  
  try {
    const result = await query(
      `DELETE FROM login_history
       WHERE created_at < NOW() - INTERVAL '${CLEANUP_CONFIG.LOGIN_HISTORY_RETENTION_DAYS} days'
         AND (flagged = FALSE OR reviewed = TRUE)
       RETURNING id`
    );
    
    return {
      operation: "cleanup_login_history",
      success: true,
      itemsProcessed: result.length,
      itemsFailed: 0,
      details: `Removed ${result.length} old login history entries`,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      operation: "cleanup_login_history",
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

/**
 * Remove old read notifications
 */
export async function cleanupReadNotifications(): Promise<CleanupResult> {
  const start = Date.now();
  
  try {
    const result = await query(
      `DELETE FROM notifications
       WHERE is_read = TRUE
         AND created_at < NOW() - INTERVAL '${CLEANUP_CONFIG.READ_NOTIFICATIONS_RETENTION_DAYS} days'
       RETURNING id`
    );
    
    return {
      operation: "cleanup_notifications",
      success: true,
      itemsProcessed: result.length,
      itemsFailed: 0,
      details: `Removed ${result.length} old read notifications`,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      operation: "cleanup_notifications",
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

/**
 * Remove old cancelled registrations
 */
export async function cleanupCancelledRegistrations(): Promise<CleanupResult> {
  const start = Date.now();
  
  try {
    const result = await query(
      `DELETE FROM tournament_registrations
       WHERE status = 'cancelled'
         AND registered_at < NOW() - INTERVAL '${CLEANUP_CONFIG.CANCELLED_REGISTRATIONS_RETENTION_DAYS} days'
       RETURNING id`
    );
    
    return {
      operation: "cleanup_cancelled_registrations",
      success: true,
      itemsProcessed: result.length,
      itemsFailed: 0,
      details: `Removed ${result.length} old cancelled registrations`,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      operation: "cleanup_cancelled_registrations",
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

/**
 * Remove old chat messages
 */
export async function cleanupOldChatMessages(): Promise<CleanupResult> {
  const start = Date.now();
  
  if (CLEANUP_CONFIG.CHAT_MESSAGES_RETENTION_DAYS === 0) {
    return {
      operation: "cleanup_chat_messages",
      success: true,
      itemsProcessed: 0,
      itemsFailed: 0,
      details: "Chat message cleanup disabled (retention = 0)",
      duration: Date.now() - start,
    };
  }
  
  try {
    const result = await query(
      `DELETE FROM chat_messages
       WHERE created_at < NOW() - INTERVAL '${CLEANUP_CONFIG.CHAT_MESSAGES_RETENTION_DAYS} days'
       RETURNING id`
    );
    
    return {
      operation: "cleanup_chat_messages",
      success: true,
      itemsProcessed: result.length,
      itemsFailed: 0,
      details: `Removed ${result.length} old chat messages`,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      operation: "cleanup_chat_messages",
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

/**
 * Clean up known user IPs (keep only recent ones)
 */
export async function cleanupOldKnownIPs(): Promise<CleanupResult> {
  const start = Date.now();
  
  try {
    // Keep only the 10 most recent IPs per user
    const result = await query(
      `DELETE FROM known_user_ips
       WHERE id IN (
         SELECT id FROM (
           SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY last_used_at DESC) as rn
           FROM known_user_ips
         ) ranked
         WHERE rn > 10
       )
       RETURNING id`
    );
    
    return {
      operation: "cleanup_known_ips",
      success: true,
      itemsProcessed: result.length,
      itemsFailed: 0,
      details: `Removed ${result.length} old known IP records`,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      operation: "cleanup_known_ips",
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

// ============ Push Subscription Cleanup ============

/**
 * Clean up inactive push subscriptions
 * Removes subscriptions that have been inactive for X days
 */
export async function cleanupInactivePushSubscriptions(): Promise<CleanupResult> {
  const start = Date.now();
  
  try {
    const result = await query(
      `DELETE FROM push_subscriptions
       WHERE is_active = FALSE
          OR (last_used_at IS NOT NULL AND last_used_at < NOW() - INTERVAL '${CLEANUP_CONFIG.INACTIVE_PUSH_SUBSCRIPTIONS_DAYS} days')
          OR (last_used_at IS NULL AND subscribed_at < NOW() - INTERVAL '${CLEANUP_CONFIG.INACTIVE_PUSH_SUBSCRIPTIONS_DAYS} days')
       RETURNING id`
    );
    
    return {
      operation: "cleanup_push_subscriptions",
      success: true,
      itemsProcessed: result.length,
      itemsFailed: 0,
      details: `Removed ${result.length} inactive push subscriptions`,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      operation: "cleanup_push_subscriptions",
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

// ============ Player Report Cleanup ============

/**
 * Clean up old resolved player reports
 * Keeps reports for audit purposes but removes very old resolved ones
 */
export async function cleanupResolvedReports(): Promise<CleanupResult> {
  const start = Date.now();
  
  try {
    // Only delete resolved reports, keep pending/active reports
    const result = await query(
      `DELETE FROM player_reports
       WHERE status IN ('resolved', 'dismissed', 'action_taken')
         AND resolved_at < NOW() - INTERVAL '${CLEANUP_CONFIG.RESOLVED_REPORTS_RETENTION_DAYS} days'
       RETURNING id`
    );
    
    return {
      operation: "cleanup_resolved_reports",
      success: true,
      itemsProcessed: result.length,
      itemsFailed: 0,
      details: `Removed ${result.length} old resolved reports`,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      operation: "cleanup_resolved_reports",
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

// ============ Cleanup Job Log Cleanup ============

/**
 * Clean up old cleanup job logs
 * Keeps recent logs for debugging but removes very old ones
 */
export async function cleanupOldJobLogs(): Promise<CleanupResult> {
  const start = Date.now();
  
  try {
    const result = await query(
      `DELETE FROM cleanup_job_logs
       WHERE completed_at < NOW() - INTERVAL '${CLEANUP_CONFIG.CLEANUP_LOG_RETENTION_DAYS} days'
       RETURNING id`
    );
    
    return {
      operation: "cleanup_job_logs",
      success: true,
      itemsProcessed: result.length,
      itemsFailed: 0,
      details: `Removed ${result.length} old cleanup job logs`,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      operation: "cleanup_job_logs",
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

// ============ Lightweight Scheduled Cleanup ============

/**
 * Run lightweight cleanup for expired data only
 * Suitable for running hourly via cron
 * Does not include heavy operations like media cleanup or archival
 */
export async function runScheduledCleanup(): Promise<CleanupSummary> {
  const startedAt = new Date();
  const results: CleanupResult[] = [];
  
  console.log("⏰ Starting scheduled cleanup (lightweight)...");
  
  // Lightweight operations only - suitable for hourly runs
  const operations = [
    { name: "Removing expired tokens", fn: cleanupExpiredTokens },
    { name: "Removing old notifications", fn: cleanupReadNotifications },
    { name: "Cleaning inactive push subscriptions", fn: cleanupInactivePushSubscriptions },
    { name: "Cleaning old cleanup logs", fn: cleanupOldJobLogs },
  ];
  
  for (const op of operations) {
    console.log(`  → ${op.name}...`);
    const result = await op.fn();
    results.push(result);
    
    if (result.success) {
      console.log(`    ✓ ${result.details}`);
    } else {
      console.log(`    ✗ Failed: ${result.error}`);
    }
  }
  
  const completedAt = new Date();
  const overallSuccess = results.every(r => r.success);
  
  console.log(`\n⏰ Scheduled cleanup ${overallSuccess ? "completed successfully" : "completed with errors"}`);
  
  return {
    startedAt,
    completedAt,
    totalDuration: completedAt.getTime() - startedAt.getTime(),
    results,
    overallSuccess,
  };
}

// ============ Full Cleanup ============

/**
 * Run all cleanup operations
 */
export async function runFullCleanup(): Promise<CleanupSummary> {
  const startedAt = new Date();
  const results: CleanupResult[] = [];
  
  console.log("🧹 Starting full cleanup...");
  
  // Run cleanup operations in sequence
  const operations = [
    { name: "Archiving completed tournaments", fn: archiveCompletedTournaments },
    { name: "Cleaning orphaned media", fn: cleanupOrphanedMedia },
    { name: "Removing expired tokens", fn: cleanupExpiredTokens },
    { name: "Cleaning login history", fn: cleanupLoginHistory },
    { name: "Removing old notifications", fn: cleanupReadNotifications },
    { name: "Cleaning cancelled registrations", fn: cleanupCancelledRegistrations },
    { name: "Removing old chat messages", fn: cleanupOldChatMessages },
    { name: "Cleaning known IP records", fn: cleanupOldKnownIPs },
    { name: "Cleaning inactive push subscriptions", fn: cleanupInactivePushSubscriptions },
    { name: "Cleaning resolved player reports", fn: cleanupResolvedReports },
    { name: "Cleaning old cleanup logs", fn: cleanupOldJobLogs },
  ];
  
  for (const op of operations) {
    console.log(`  → ${op.name}...`);
    const result = await op.fn();
    results.push(result);
    
    if (result.success) {
      console.log(`    ✓ ${result.details}`);
    } else {
      console.log(`    ✗ Failed: ${result.error}`);
    }
  }
  
  const completedAt = new Date();
  const overallSuccess = results.every(r => r.success);
  
  console.log(`\n🧹 Cleanup ${overallSuccess ? "completed successfully" : "completed with errors"}`);
  
  return {
    startedAt,
    completedAt,
    totalDuration: completedAt.getTime() - startedAt.getTime(),
    results,
    overallSuccess,
  };
}

// ============ Statistics ============

/**
 * Get cleanup statistics (items pending cleanup)
 */
export async function getCleanupStats(): Promise<{
  tournamentsToArchive: number;
  expiredTokens: number;
  oldLoginHistory: number;
  readNotifications: number;
  cancelledRegistrations: number;
  oldChatMessages: number;
  orphanedAvatars: number;
  inactivePushSubscriptions: number;
  resolvedReports: number;
  oldCleanupLogs: number;
}> {
  const [
    tournamentsToArchive,
    expiredTokens,
    oldLoginHistory,
    readNotifications,
    cancelledRegistrations,
    oldChatMessages,
    orphanedAvatars,
    inactivePushSubscriptions,
    resolvedReports,
    oldCleanupLogs,
  ] = await Promise.all([
    queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM tournaments
       WHERE status = 'completed'
         AND is_archived IS NOT TRUE
         AND tournament_end_date < NOW() - INTERVAL '${CLEANUP_CONFIG.ARCHIVE_AFTER_DAYS} days'`
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM refresh_tokens
       WHERE (expires_at < NOW() - INTERVAL '${CLEANUP_CONFIG.EXPIRED_TOKENS_RETENTION_DAYS} days')
          OR (revoked = TRUE AND revoked_at < NOW() - INTERVAL '${CLEANUP_CONFIG.EXPIRED_TOKENS_RETENTION_DAYS} days')`
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM login_history
       WHERE created_at < NOW() - INTERVAL '${CLEANUP_CONFIG.LOGIN_HISTORY_RETENTION_DAYS} days'
         AND (flagged = FALSE OR reviewed = TRUE)`
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM notifications
       WHERE is_read = TRUE
         AND created_at < NOW() - INTERVAL '${CLEANUP_CONFIG.READ_NOTIFICATIONS_RETENTION_DAYS} days'`
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM tournament_registrations
       WHERE status = 'cancelled'
         AND registered_at < NOW() - INTERVAL '${CLEANUP_CONFIG.CANCELLED_REGISTRATIONS_RETENTION_DAYS} days'`
    ),
    CLEANUP_CONFIG.CHAT_MESSAGES_RETENTION_DAYS > 0
      ? queryOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM chat_messages
           WHERE created_at < NOW() - INTERVAL '${CLEANUP_CONFIG.CHAT_MESSAGES_RETENTION_DAYS} days'`
        )
      : Promise.resolve({ count: 0 }),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM users
       WHERE username LIKE 'deleted_user_%'
         AND profile_picture_url IS NOT NULL`
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM push_subscriptions
       WHERE is_active = FALSE
          OR (last_used_at IS NOT NULL AND last_used_at < NOW() - INTERVAL '${CLEANUP_CONFIG.INACTIVE_PUSH_SUBSCRIPTIONS_DAYS} days')
          OR (last_used_at IS NULL AND subscribed_at < NOW() - INTERVAL '${CLEANUP_CONFIG.INACTIVE_PUSH_SUBSCRIPTIONS_DAYS} days')`
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM player_reports
       WHERE status IN ('resolved', 'dismissed', 'action_taken')
         AND resolved_at < NOW() - INTERVAL '${CLEANUP_CONFIG.RESOLVED_REPORTS_RETENTION_DAYS} days'`
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM cleanup_job_logs
       WHERE completed_at < NOW() - INTERVAL '${CLEANUP_CONFIG.CLEANUP_LOG_RETENTION_DAYS} days'`
    ),
  ]);
  
  return {
    tournamentsToArchive: tournamentsToArchive?.count || 0,
    expiredTokens: expiredTokens?.count || 0,
    oldLoginHistory: oldLoginHistory?.count || 0,
    readNotifications: readNotifications?.count || 0,
    cancelledRegistrations: cancelledRegistrations?.count || 0,
    oldChatMessages: oldChatMessages?.count || 0,
    orphanedAvatars: orphanedAvatars?.count || 0,
    inactivePushSubscriptions: inactivePushSubscriptions?.count || 0,
    resolvedReports: resolvedReports?.count || 0,
    oldCleanupLogs: oldCleanupLogs?.count || 0,
  };
}

/**
 * Get archive statistics
 */
export async function getArchiveStats(): Promise<{
  totalArchived: number;
  oldestArchive: Date | null;
  newestArchive: Date | null;
  totalPrizePoolArchived: number;
}> {
  const result = await queryOne<{
    total: number;
    oldest: Date | null;
    newest: Date | null;
    prize_total: number;
  }>(
    `SELECT 
       COUNT(*) as total,
       MIN(archived_at) as oldest,
       MAX(archived_at) as newest,
       COALESCE(SUM(prize_pool), 0) as prize_total
     FROM tournament_archives`
  );
  
  return {
    totalArchived: result?.total || 0,
    oldestArchive: result?.oldest || null,
    newestArchive: result?.newest || null,
    totalPrizePoolArchived: result?.prize_total || 0,
  };
}
