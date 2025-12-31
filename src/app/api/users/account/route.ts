import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { z } from "zod";
import { validateWithSchema, validationErrorResponse } from "@/lib/validations";
import {
  requestAccountDeletion,
  cancelAccountDeletion,
  getDeletionStatus,
  executeAccountDeletion,
  DELETION_GRACE_PERIOD_DAYS,
} from "@/lib/gdpr";
import pool from "@/lib/db";
import { verifyPassword } from "@/lib/auth";

// Serverless configuration - account operations are infrequent
export const maxDuration = 30;
export const dynamic = "force-dynamic";

// Schema for deletion request
const deletionRequestSchema = z.object({
  reason: z.string().max(500).optional(),
  password: z.string().min(1, "Password is required to confirm deletion"),
  immediate: z.boolean().optional().default(false),
});

// Schema for cancellation
const cancelDeletionSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: "Must confirm cancellation" }),
  }),
});

/**
 * GET /api/users/account
 * Get account deletion status
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const deletionStatus = await getDeletionStatus(user.id);

    return successResponse({
      deletionRequested: !!deletionStatus,
      deletionStatus: deletionStatus
        ? {
            status: deletionStatus.status,
            scheduledDeletionAt: deletionStatus.scheduledDeletionAt,
            reason: deletionStatus.reason,
            createdAt: deletionStatus.createdAt,
            gracePeriodDays: DELETION_GRACE_PERIOD_DAYS,
          }
        : null,
    });
  } catch (error) {
    console.error("Get account status error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * DELETE /api/users/account
 * Request account deletion
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();

    const validation = validateWithSchema(deletionRequestSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }

    const { reason, password, immediate } = validation.data;

    // Verify password
    const userResult = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [user.id]
    );

    if (userResult.rows.length === 0) {
      return errorResponse("User not found", 404);
    }

    const passwordValid = await verifyPassword(
      password,
      userResult.rows[0].password_hash
    );

    if (!passwordValid) {
      return errorResponse("Invalid password", 401);
    }

    // Check for existing request
    const existingDeletion = await getDeletionStatus(user.id);
    if (existingDeletion) {
      return errorResponse(
        `Account deletion already scheduled for ${existingDeletion.scheduledDeletionAt?.toLocaleDateString()}`,
        400
      );
    }

    if (immediate) {
      await executeAccountDeletion(user.id);
      return successResponse(
        { deleted: true },
        "Your account has been permanently deleted."
      );
    }

    const deletionRequest = await requestAccountDeletion(user.id, reason);

    return successResponse(
      {
        deletionRequested: true,
        scheduledDeletionAt: deletionRequest.scheduledDeletionAt,
        gracePeriodDays: DELETION_GRACE_PERIOD_DAYS,
      },
      `Account deletion scheduled. You have ${DELETION_GRACE_PERIOD_DAYS} days to cancel.`
    );
  } catch (error) {
    console.error("Account deletion error:", error);
    
    if (error instanceof Error && error.message === "Account deletion already requested") {
      return errorResponse(error.message, 400);
    }
    
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/users/account
 * Cancel account deletion request
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();

    const validation = validateWithSchema(cancelDeletionSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }

    const cancelled = await cancelAccountDeletion(user.id);

    if (!cancelled) {
      return errorResponse("No pending deletion request found", 404);
    }

    return successResponse(
      { cancelled: true },
      "Account deletion cancelled successfully!"
    );
  } catch (error) {
    console.error("Cancel deletion error:", error);
    return serverErrorResponse(error);
  }
}
