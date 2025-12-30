import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { z } from "zod";
import { validateWithSchema, validationErrorResponse, uuidSchema } from "@/lib/validations";

// Schema for marking notifications as read
const markReadSchema = z.object({
  notification_ids: z.array(uuidSchema).min(1, "At least one notification ID required"),
});

// Schema for query params
const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  unread_only: z.coerce.boolean().default(false),
  type: z.string().optional(),
});

/**
 * GET /api/notifications/history
 * Get user's notification history
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const params = {
      limit: searchParams.get("limit") || "20",
      offset: searchParams.get("offset") || "0",
      unread_only: searchParams.get("unread_only") || "false",
      type: searchParams.get("type") || undefined,
    };

    const validation = validateWithSchema(querySchema, params);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }

    const { limit, offset, unread_only, type } = validation.data;

    // Build query conditions
    const conditions: string[] = ["user_id = $1"];
    const queryParams: (string | number | boolean)[] = [user.id];
    let paramIndex = 2;

    if (unread_only) {
      conditions.push("is_read = FALSE");
    }

    if (type) {
      conditions.push(`notification_type = $${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }

    // Exclude expired notifications
    conditions.push("(expires_at IS NULL OR expires_at > NOW())");

    const whereClause = conditions.join(" AND ");

    // Get notifications
    const notificationsResult = await pool.query(
      `SELECT 
        id,
        title,
        message,
        notification_type,
        category,
        tournament_id,
        channels_sent,
        is_read,
        read_at,
        action_url,
        created_at
       FROM notifications
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM notifications WHERE ${whereClause}`,
      queryParams
    );

    // Get unread count
    const unreadResult = await pool.query(
      `SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND is_read = FALSE AND (expires_at IS NULL OR expires_at > NOW())`,
      [user.id]
    );

    return successResponse({
      notifications: notificationsResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit,
        offset,
        has_more: (offset ?? 0) + (limit ?? 20) < parseInt(countResult.rows[0].total),
      },
      unread_count: parseInt(unreadResult.rows[0].unread),
    });
  } catch (error) {
    console.error("Get notification history error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * PUT /api/notifications/history
 * Mark notifications as read
 */
export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();

    // Validate input
    const validation = validateWithSchema(markReadSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }

    const { notification_ids } = validation.data;

    // Mark notifications as read (only if they belong to the user)
    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = NOW()
       WHERE id = ANY($1) AND user_id = $2 AND is_read = FALSE
       RETURNING id`,
      [notification_ids, user.id]
    );

    return successResponse({
      marked_read: result.rows.length,
      message: `${result.rows.length} notification(s) marked as read`,
    });
  } catch (error) {
    console.error("Mark notifications read error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/notifications/history
 * Mark all notifications as read
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body;

    if (action === "mark_all_read") {
      const result = await pool.query(
        `UPDATE notifications 
         SET is_read = TRUE, read_at = NOW()
         WHERE user_id = $1 AND is_read = FALSE
         RETURNING id`,
        [user.id]
      );

      return successResponse({
        marked_read: result.rows.length,
        message: "All notifications marked as read",
      });
    }

    return errorResponse("Invalid action. Use 'mark_all_read'", 400);
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * DELETE /api/notifications/history
 * Delete old notifications (user can only delete their own read notifications)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const olderThanDays = parseInt(searchParams.get("older_than_days") || "30");

    // Delete read notifications older than specified days
    const result = await pool.query(
      `DELETE FROM notifications 
       WHERE user_id = $1 
         AND is_read = TRUE 
         AND created_at < NOW() - INTERVAL '1 day' * $2
       RETURNING id`,
      [user.id, olderThanDays]
    );

    return successResponse({
      deleted: result.rows.length,
      message: `Deleted ${result.rows.length} old notification(s)`,
    });
  } catch (error) {
    console.error("Delete notifications error:", error);
    return serverErrorResponse(error);
  }
}
