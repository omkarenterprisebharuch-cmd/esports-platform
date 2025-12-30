/**
 * GDPR Compliance Utility
 * 
 * Handles GDPR-related operations:
 * - Account deletion with data anonymization
 * - Privacy consent tracking
 * 
 * @module gdpr
 */

import pool from "./db";
import crypto from "crypto";

// ============ Constants ============

export const PRIVACY_POLICY_VERSION = "1.0";
export const TERMS_VERSION = "1.0";
export const DELETION_GRACE_PERIOD_DAYS = 30;

// ============ Types ============

// User ID can be number or string (UUID)
type UserId = number | string;

export interface ConsentRecord {
  consentType: "privacy_policy" | "terms_of_service" | "marketing";
  version: string;
  consented: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface DeletionRequest {
  id: number;
  userId: number | string;
  reason?: string;
  status: "pending" | "scheduled" | "completed" | "cancelled";
  scheduledDeletionAt?: Date;
  createdAt: Date;
}

// ============ Consent Management ============

/**
 * Record user consent for privacy policy, terms, etc.
 */
export async function recordConsent(
  userId: UserId,
  consent: ConsentRecord
): Promise<void> {
  const { consentType, version, consented, ipAddress, userAgent } = consent;

  await pool.query(
    `INSERT INTO user_consent_history 
     (user_id, consent_type, consent_version, consented, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, consentType, version, consented, ipAddress, userAgent]
  );

  if (consentType === "privacy_policy") {
    await pool.query(
      `UPDATE users 
       SET privacy_policy_accepted_at = NOW(), privacy_policy_version = $1
       WHERE id = $2`,
      [version, userId]
    );
  } else if (consentType === "terms_of_service") {
    await pool.query(
      `UPDATE users 
       SET terms_accepted_at = NOW(), terms_version = $1
       WHERE id = $2`,
      [version, userId]
    );
  }
}

/**
 * Check if user has accepted current privacy policy
 */
export async function hasAcceptedPrivacyPolicy(userId: UserId): Promise<boolean> {
  const result = await pool.query(
    `SELECT privacy_policy_version FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) return false;
  return result.rows[0].privacy_policy_version === PRIVACY_POLICY_VERSION;
}

// ============ Account Deletion ============

/**
 * Request account deletion (starts 30-day grace period)
 */
export async function requestAccountDeletion(
  userId: UserId,
  reason?: string
): Promise<DeletionRequest> {
  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + DELETION_GRACE_PERIOD_DAYS);

  // Check for existing pending request
  const existing = await pool.query(
    `SELECT id FROM account_deletion_requests 
     WHERE user_id = $1 AND status IN ('pending', 'scheduled')`,
    [userId]
  );

  if (existing.rows.length > 0) {
    throw new Error("Account deletion already requested");
  }

  const result = await pool.query(
    `INSERT INTO account_deletion_requests 
     (user_id, reason, status, scheduled_deletion_at)
     VALUES ($1, $2, 'scheduled', $3)
     RETURNING id, user_id, reason, status, scheduled_deletion_at, created_at`,
    [userId, reason, scheduledDate]
  );

  await pool.query(
    `UPDATE users SET deletion_requested_at = NOW() WHERE id = $1`,
    [userId]
  );

  const req = result.rows[0];
  return {
    id: req.id,
    userId: req.user_id,
    reason: req.reason,
    status: req.status,
    scheduledDeletionAt: req.scheduled_deletion_at,
    createdAt: req.created_at,
  };
}

/**
 * Cancel account deletion request
 */
export async function cancelAccountDeletion(userId: UserId): Promise<boolean> {
  const result = await pool.query(
    `UPDATE account_deletion_requests 
     SET status = 'cancelled', cancelled_at = NOW()
     WHERE user_id = $1 AND status IN ('pending', 'scheduled')
     RETURNING id`,
    [userId]
  );

  if (result.rows.length > 0) {
    await pool.query(
      `UPDATE users SET deletion_requested_at = NULL WHERE id = $1`,
      [userId]
    );
    return true;
  }
  return false;
}

/**
 * Permanently delete/anonymize user data
 */
export async function executeAccountDeletion(userId: UserId): Promise<void> {
  const anonymousId = crypto.randomBytes(8).toString("hex");
  const anonymousEmail = `deleted_${anonymousId}@deleted.local`;
  const anonymousUsername = `deleted_user_${anonymousId}`;

  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    // 1. Anonymize user data
    await client.query(
      `UPDATE users SET
         username = $2,
         email = $3,
         password_hash = NULL,
         full_name = NULL,
         phone_number = NULL,
         profile_picture_url = NULL,
         in_game_ids = NULL,
         is_active = FALSE,
         deleted_at = NOW(),
         auth_provider_id = NULL
       WHERE id = $1`,
      [userId, anonymousUsername, anonymousEmail]
    );

    // 2. Leave teams
    await client.query(
      `UPDATE team_members SET left_at = NOW() WHERE user_id = $1 AND left_at IS NULL`,
      [userId]
    );

    // 3. Handle captained teams
    const teams = await client.query(
      `SELECT id FROM teams WHERE captain_id = $1 AND is_active = TRUE`,
      [userId]
    );

    for (const team of teams.rows) {
      const newCaptain = await client.query(
        `SELECT user_id FROM team_members 
         WHERE team_id = $1 AND user_id != $2 AND left_at IS NULL
         ORDER BY joined_at ASC LIMIT 1`,
        [team.id, userId]
      );

      if (newCaptain.rows.length > 0) {
        await client.query(
          `UPDATE teams SET captain_id = $1 WHERE id = $2`,
          [newCaptain.rows[0].user_id, team.id]
        );
        await client.query(
          `UPDATE team_members SET role = 'captain' WHERE team_id = $1 AND user_id = $2`,
          [team.id, newCaptain.rows[0].user_id]
        );
      } else {
        await client.query(`UPDATE teams SET is_active = FALSE WHERE id = $1`, [team.id]);
      }
    }

    // 4. Anonymize chat messages
    await client.query(
      `UPDATE chat_messages SET username = $2 WHERE user_id = $1`,
      [userId, anonymousUsername]
    );

    // 5. Revoke tokens and sessions
    await client.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM login_history WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM known_user_ips WHERE user_id = $1`, [userId]);

    // 6. Update deletion request
    await client.query(
      `UPDATE account_deletion_requests 
       SET status = 'completed', completed_at = NOW()
       WHERE user_id = $1 AND status = 'scheduled'`,
      [userId]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get deletion status for user
 */
export async function getDeletionStatus(userId: UserId): Promise<DeletionRequest | null> {
  const result = await pool.query(
    `SELECT id, user_id, reason, status, scheduled_deletion_at, created_at
     FROM account_deletion_requests
     WHERE user_id = $1 AND status IN ('pending', 'scheduled')
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) return null;

  const req = result.rows[0];
  return {
    id: req.id,
    userId: req.user_id,
    reason: req.reason,
    status: req.status,
    scheduledDeletionAt: req.scheduled_deletion_at,
    createdAt: req.created_at,
  };
}

/**
 * Process scheduled deletions (run as cron job)
 */
export async function processScheduledDeletions(): Promise<number> {
  const result = await pool.query(
    `SELECT user_id FROM account_deletion_requests
     WHERE status = 'scheduled' AND scheduled_deletion_at <= NOW()`
  );

  let count = 0;
  for (const row of result.rows) {
    try {
      await executeAccountDeletion(row.user_id);
      count++;
    } catch (error) {
      console.error(`Failed to delete user ${row.user_id}:`, error);
    }
  }
  return count;
}
