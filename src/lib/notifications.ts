/**
 * Server-side notification utilities
 * For sending push notifications and emails programmatically
 * Respects user notification preferences and stores notification history
 */

import nodemailer from "nodemailer";
import webpush from "web-push";
import pool from "./db";

// Notification types
export type NotificationType = 
  | "tournament_update" 
  | "registration" 
  | "room_credentials" 
  | "reminder" 
  | "waitlist" 
  | "system" 
  | "marketing";

export type NotificationCategory = "info" | "success" | "warning" | "error";

// Preference key mapping
const PREFERENCE_KEY_MAP: Record<NotificationType, string> = {
  tournament_update: "tournament_updates",
  registration: "registration_confirmation",
  room_credentials: "room_credentials",
  reminder: "tournament_reminders",
  waitlist: "waitlist_updates",
  system: "tournament_updates", // System notifications always sent
  marketing: "marketing",
};

// Default notification preferences
const DEFAULT_PREFERENCES = {
  email: {
    tournament_updates: true,
    registration_confirmation: true,
    room_credentials: true,
    tournament_reminders: true,
    waitlist_updates: true,
    marketing: false,
  },
  push: {
    tournament_updates: true,
    registration_confirmation: true,
    room_credentials: true,
    tournament_reminders: true,
    waitlist_updates: true,
    marketing: false,
  },
};

// Configure web-push with VAPID keys
const configureWebPush = () => {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:noreply@esportsplatform.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
    process.env.VAPID_PRIVATE_KEY || ""
  );
};

// Create reusable email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

interface PushSubscriptionDB {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tournamentId?: string;
  type?: string;
  requireInteraction?: boolean;
}

/**
 * Send push notification to a specific user
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: { tournamentId?: string; type?: string; url?: string }
): Promise<{ sent: number; failed: number }> {
  try {
    configureWebPush();

    // Get user's push subscriptions
    const subscriptions = await pool.query<PushSubscriptionDB>(
      `SELECT id, user_id, endpoint, p256dh_key, auth_key
       FROM push_subscriptions
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    if (subscriptions.rows.length === 0) {
      console.log(`[Push] No active subscriptions for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    const payload: PushPayload = {
      title,
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      url: data?.url || (data?.tournamentId ? `/tournament/${data.tournamentId}` : "/dashboard"),
      tournamentId: data?.tournamentId,
      type: data?.type || "general",
      requireInteraction: data?.type === "waitlist_promotion",
    };

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.rows.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh_key,
                auth: sub.auth_key,
              },
            },
            JSON.stringify(payload)
          );

          // Update last_used_at
          await pool.query(
            `UPDATE push_subscriptions SET last_used_at = NOW() WHERE id = $1`,
            [sub.id]
          );

          return { success: true };
        } catch (error: unknown) {
          const webPushError = error as { statusCode?: number };
          if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
            // Subscription expired, mark as inactive
            await pool.query(
              `UPDATE push_subscriptions SET is_active = FALSE WHERE id = $1`,
              [sub.id]
            );
          }
          return { success: false, error };
        }
      })
    );

    const sent = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
    const failed = results.length - sent;

    console.log(`[Push] User ${userId}: Sent ${sent}, Failed ${failed}`);
    return { sent, failed };
  } catch (error) {
    console.error("[Push] Error sending notification:", error);
    return { sent: 0, failed: 1 };
  }
}

/**
 * Send a basic email
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<void> {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"Esports Platform" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text: text || subject,
  });
}

/**
 * Generate a tournament-related email HTML template
 */
export function generateTournamentEmail(
  username: string,
  tournamentName: string,
  subject: string,
  bodyContent: string,
  ctaText?: string,
  ctaUrl?: string
): string {
  const ctaButton = ctaText && ctaUrl
    ? `
      <tr>
        <td style="padding: 0 40px 30px 40px; text-align: center;">
          <a href="${ctaUrl}" 
             style="display: inline-block; padding: 14px 28px; background-color: #7c3aed; 
                    color: #ffffff; text-decoration: none; font-weight: 600; 
                    border-radius: 8px; font-size: 16px;">
            ${ctaText}
          </a>
        </td>
      </tr>
    `
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="padding: 40px 40px 30px 40px; text-align: center;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #111827;">
                    🎮 Esports Platform
                  </h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px 20px 40px; text-align: center;">
                  <h2 style="margin: 0; font-size: 22px; font-weight: 600; color: #374151;">
                    ${subject}
                  </h2>
                  <p style="margin: 16px 0 0 0; font-size: 16px; color: #6b7280; line-height: 1.5;">
                    Hello ${username},
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px 20px 40px;">
                  <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 8px;">
                    <p style="margin: 0; font-size: 16px; font-weight: 600; color: #15803d;">
                      ${tournamentName}
                    </p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px 20px 40px;">
                  <p style="margin: 0; font-size: 15px; color: #4b5563; line-height: 1.6;">
                    ${bodyContent.replace(/\n/g, "<br>")}
                  </p>
                </td>
              </tr>
              ${ctaButton}
              <tr>
                <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                    © 2025 Esports Platform. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ============ User Preference Helpers ============

interface UserPreferences {
  email: Record<string, boolean>;
  push: Record<string, boolean>;
}

/**
 * Get user's notification preferences
 */
async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const result = await pool.query(
    `SELECT notification_preferences FROM users WHERE id = $1`,
    [userId]
  );
  
  if (result.rows.length === 0 || !result.rows[0].notification_preferences) {
    return DEFAULT_PREFERENCES;
  }
  
  return result.rows[0].notification_preferences;
}

/**
 * Check if user wants to receive notifications of a specific type via a channel
 */
function shouldSend(
  preferences: UserPreferences,
  channel: "email" | "push",
  notificationType: NotificationType
): boolean {
  // System notifications always sent (except marketing)
  if (notificationType === "system") return true;
  
  const prefKey = PREFERENCE_KEY_MAP[notificationType];
  return preferences[channel]?.[prefKey] ?? DEFAULT_PREFERENCES[channel][prefKey as keyof typeof DEFAULT_PREFERENCES.email] ?? true;
}

// ============ Comprehensive Notification System ============

export interface NotificationOptions {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  category?: NotificationCategory;
  tournamentId?: string;
  tournamentName?: string;
  actionUrl?: string;
  expiresAt?: Date;
  emailSubject?: string; // Optional custom email subject
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  emailSent: boolean;
  pushSent: boolean;
  errors?: string[];
}

/**
 * Send a notification to a user
 * - Respects user preferences
 * - Stores notification history
 * - Sends via enabled channels (email, push)
 */
export async function sendNotification(
  options: NotificationOptions
): Promise<NotificationResult> {
  const {
    userId,
    title,
    message,
    type,
    category = "info",
    tournamentId,
    tournamentName,
    actionUrl,
    expiresAt,
    emailSubject,
  } = options;

  const result: NotificationResult = {
    success: false,
    emailSent: false,
    pushSent: false,
    errors: [],
  };

  try {
    // Get user info and preferences
    const userResult = await pool.query(
      `SELECT id, email, username, notification_preferences FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      result.errors?.push("User not found");
      return result;
    }

    const user = userResult.rows[0];
    const preferences: UserPreferences = user.notification_preferences || DEFAULT_PREFERENCES;

    // Track which channels were used
    const channelsSent: string[] = [];
    let emailSentAt: Date | null = null;
    let pushSentAt: Date | null = null;

    // Send push notification if enabled
    if (shouldSend(preferences, "push", type)) {
      try {
        const pushResult = await sendPushNotification(userId, title, message, {
          tournamentId,
          type,
          url: actionUrl,
        });
        if (pushResult.sent > 0) {
          result.pushSent = true;
          channelsSent.push("push");
          pushSentAt = new Date();
        }
      } catch (error) {
        console.error("Push notification failed:", error);
        result.errors?.push("Push notification failed");
      }
    }

    // Send email notification if enabled
    if (shouldSend(preferences, "email", type)) {
      try {
        const subject = emailSubject || title;
        const emailHtml = tournamentName
          ? generateTournamentEmail(
              user.username,
              tournamentName,
              subject,
              message,
              actionUrl ? "View Details" : undefined,
              actionUrl ? `${process.env.NEXT_PUBLIC_APP_URL || ""}${actionUrl}` : undefined
            )
          : generateGeneralEmail(user.username, subject, message, actionUrl);

        await sendEmail(user.email, subject, emailHtml);
        result.emailSent = true;
        channelsSent.push("email");
        emailSentAt = new Date();
      } catch (error) {
        console.error("Email notification failed:", error);
        result.errors?.push("Email notification failed");
      }
    }

    // Store notification in history
    const insertResult = await pool.query(
      `INSERT INTO notifications (
        user_id, title, message, notification_type, category,
        tournament_id, channels_sent, email_sent_at, push_sent_at,
        action_url, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        userId,
        title,
        message,
        type,
        category,
        tournamentId || null,
        channelsSent,
        emailSentAt,
        pushSentAt,
        actionUrl || null,
        expiresAt || null,
      ]
    );

    result.notificationId = insertResult.rows[0].id;
    result.success = result.emailSent || result.pushSent || channelsSent.length === 0;

    return result;
  } catch (error) {
    console.error("Send notification error:", error);
    result.errors?.push(error instanceof Error ? error.message : "Unknown error");
    return result;
  }
}

/**
 * Send notification to multiple users
 */
export async function sendBulkNotification(
  userIds: string[],
  options: Omit<NotificationOptions, "userId">
): Promise<{ total: number; successful: number; failed: number }> {
  const results = await Promise.allSettled(
    userIds.map((userId) => sendNotification({ ...options, userId }))
  );

  const successful = results.filter(
    (r) => r.status === "fulfilled" && r.value.success
  ).length;

  return {
    total: userIds.length,
    successful,
    failed: userIds.length - successful,
  };
}

/**
 * Send notification to all registered users of a tournament
 */
export async function sendTournamentNotification(
  tournamentId: string,
  options: Omit<NotificationOptions, "userId" | "tournamentId">
): Promise<{ total: number; successful: number; failed: number }> {
  // Get all registered users for the tournament
  const registrations = await pool.query(
    `SELECT DISTINCT user_id FROM tournament_registrations 
     WHERE tournament_id = $1 AND status != 'cancelled'`,
    [tournamentId]
  );

  const userIds = registrations.rows.map((r) => r.user_id);

  if (userIds.length === 0) {
    return { total: 0, successful: 0, failed: 0 };
  }

  return sendBulkNotification(userIds, { ...options, tournamentId });
}

// ============ Specific Notification Helpers ============

/**
 * Send registration confirmation notification
 */
export async function sendRegistrationConfirmation(
  userId: string,
  tournamentId: string,
  tournamentName: string,
  slotNumber: number
): Promise<NotificationResult> {
  return sendNotification({
    userId,
    title: "Registration Confirmed! 🎮",
    message: `You're registered for ${tournamentName}. Your slot number is #${slotNumber}. Room credentials will be shared before the tournament starts.`,
    type: "registration",
    category: "success",
    tournamentId,
    tournamentName,
    actionUrl: `/tournament/${tournamentId}`,
  });
}

/**
 * Send room credentials notification
 */
export async function sendRoomCredentialsNotification(
  userId: string,
  tournamentId: string,
  tournamentName: string,
  roomId: string,
  roomPassword: string
): Promise<NotificationResult> {
  return sendNotification({
    userId,
    title: "🔐 Room Credentials Available!",
    message: `Room ID: ${roomId}\nPassword: ${roomPassword}\n\nGet ready! The tournament is about to begin.`,
    type: "room_credentials",
    category: "info",
    tournamentId,
    tournamentName,
    actionUrl: `/tournament/${tournamentId}`,
  });
}

/**
 * Send tournament reminder notification
 */
export async function sendTournamentReminder(
  userId: string,
  tournamentId: string,
  tournamentName: string,
  minutesUntilStart: number
): Promise<NotificationResult> {
  const timeText = minutesUntilStart >= 60
    ? `${Math.floor(minutesUntilStart / 60)} hour(s)`
    : `${minutesUntilStart} minutes`;

  return sendNotification({
    userId,
    title: `⏰ Tournament Starting Soon!`,
    message: `${tournamentName} starts in ${timeText}. Make sure you're ready!`,
    type: "reminder",
    category: "warning",
    tournamentId,
    tournamentName,
    actionUrl: `/tournament/${tournamentId}`,
    expiresAt: new Date(Date.now() + minutesUntilStart * 60 * 1000),
  });
}

/**
 * Send waitlist promotion notification
 */
export async function sendWaitlistPromotionNotification(
  userId: string,
  tournamentId: string,
  tournamentName: string,
  slotNumber: number
): Promise<NotificationResult> {
  return sendNotification({
    userId,
    title: "🎉 You've Been Promoted from Waitlist!",
    message: `Great news! A spot opened up in ${tournamentName} and you've been promoted. Your slot number is #${slotNumber}.`,
    type: "waitlist",
    category: "success",
    tournamentId,
    tournamentName,
    actionUrl: `/tournament/${tournamentId}`,
  });
}

/**
 * Send tournament update notification
 */
export async function sendTournamentUpdateNotification(
  userId: string,
  tournamentId: string,
  tournamentName: string,
  updateMessage: string
): Promise<NotificationResult> {
  return sendNotification({
    userId,
    title: "📢 Tournament Update",
    message: updateMessage,
    type: "tournament_update",
    category: "info",
    tournamentId,
    tournamentName,
    actionUrl: `/tournament/${tournamentId}`,
  });
}

// ============ Email Templates ============

/**
 * Generate a general email HTML template (non-tournament)
 */
function generateGeneralEmail(
  username: string,
  subject: string,
  bodyContent: string,
  ctaUrl?: string
): string {
  const ctaButton = ctaUrl
    ? `
      <tr>
        <td style="padding: 0 40px 30px 40px; text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}${ctaUrl}" 
             style="display: inline-block; padding: 14px 28px; background-color: #7c3aed; 
                    color: #ffffff; text-decoration: none; font-weight: 600; 
                    border-radius: 8px; font-size: 16px;">
            View Details
          </a>
        </td>
      </tr>
    `
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="padding: 40px 40px 30px 40px; text-align: center;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #111827;">
                    🎮 Esports Platform
                  </h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px 20px 40px; text-align: center;">
                  <h2 style="margin: 0; font-size: 22px; font-weight: 600; color: #374151;">
                    ${subject}
                  </h2>
                  <p style="margin: 16px 0 0 0; font-size: 16px; color: #6b7280; line-height: 1.5;">
                    Hello ${username},
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px 20px 40px;">
                  <p style="margin: 0; font-size: 15px; color: #4b5563; line-height: 1.6;">
                    ${bodyContent.replace(/\n/g, "<br>")}
                  </p>
                </td>
              </tr>
              ${ctaButton}
              <tr>
                <td style="padding: 20px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                    © 2025 Esports Platform. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
