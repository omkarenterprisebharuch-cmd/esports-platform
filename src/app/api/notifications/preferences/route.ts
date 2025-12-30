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
import { validateWithSchema, validationErrorResponse } from "@/lib/validations";

// Default notification preferences (local constant - cannot be exported from route files)
const DEFAULT_NOTIFICATION_PREFERENCES = {
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

// Schema for notification preferences
const notificationPreferencesSchema = z.object({
  email: z.object({
    tournament_updates: z.boolean().optional(),
    registration_confirmation: z.boolean().optional(),
    room_credentials: z.boolean().optional(),
    tournament_reminders: z.boolean().optional(),
    waitlist_updates: z.boolean().optional(),
    marketing: z.boolean().optional(),
  }).optional(),
  push: z.object({
    tournament_updates: z.boolean().optional(),
    registration_confirmation: z.boolean().optional(),
    room_credentials: z.boolean().optional(),
    tournament_reminders: z.boolean().optional(),
    waitlist_updates: z.boolean().optional(),
    marketing: z.boolean().optional(),
  }).optional(),
});

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const result = await pool.query(
      `SELECT notification_preferences FROM users WHERE id = $1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return errorResponse("User not found", 404);
    }

    const preferences = result.rows[0].notification_preferences || DEFAULT_NOTIFICATION_PREFERENCES;

    return successResponse({
      preferences,
    });
  } catch (error) {
    console.error("Get notification preferences error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * PUT /api/notifications/preferences
 * Update user's notification preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();

    // Validate input
    const validation = validateWithSchema(notificationPreferencesSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }

    const updates = validation.data;

    // Get current preferences
    const currentResult = await pool.query(
      `SELECT notification_preferences FROM users WHERE id = $1`,
      [user.id]
    );

    if (currentResult.rows.length === 0) {
      return errorResponse("User not found", 404);
    }

    const currentPrefs = currentResult.rows[0].notification_preferences || DEFAULT_NOTIFICATION_PREFERENCES;

    // Merge preferences (deep merge)
    const newPrefs = {
      email: {
        ...currentPrefs.email,
        ...(updates.email || {}),
      },
      push: {
        ...currentPrefs.push,
        ...(updates.push || {}),
      },
    };

    // Update preferences
    const updateResult = await pool.query(
      `UPDATE users 
       SET notification_preferences = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING notification_preferences`,
      [JSON.stringify(newPrefs), user.id]
    );

    return successResponse({
      preferences: updateResult.rows[0].notification_preferences,
      message: "Notification preferences updated successfully",
    });
  } catch (error) {
    console.error("Update notification preferences error:", error);
    return serverErrorResponse(error);
  }
}
