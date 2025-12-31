import { NextRequest } from "next/server";
import { getUserFromRequest, requireOwner } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { 
  getFlaggedLogins, 
  reviewFlaggedLogin, 
  getFraudStats,
  getLoginHistory,
} from "@/lib/fraud-detection";
import { z } from "zod";
import { validateWithSchema, validationErrorResponse, uuidSchema } from "@/lib/validations";

// Serverless configuration - fraud review is infrequent
export const maxDuration = 30;
export const dynamic = "force-dynamic";

// Schema for reviewing a flagged login
const reviewSchema = z.object({
  login_id: uuidSchema,
});

// Schema for getting user login history
const historySchema = z.object({
  user_id: uuidSchema,
  limit: z.number().min(1).max(100).optional().default(20),
});

/**
 * GET /api/owner/fraud
 * Get fraud detection statistics and flagged logins
 * Requires owner role
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    // Check if user is owner
    if (!requireOwner(request)) {
      return forbiddenResponse("Access denied. Owner privileges required.");
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "stats";
    const userId = searchParams.get("user_id");
    const includeReviewed = searchParams.get("include_reviewed") === "true";

    if (action === "stats") {
      // Get fraud statistics
      const stats = await getFraudStats();
      return successResponse({ stats });
    }

    if (action === "flagged") {
      // Get flagged logins
      const flaggedLogins = await getFlaggedLogins(!includeReviewed);
      return successResponse({ 
        flaggedLogins,
        count: flaggedLogins.length,
      });
    }

    if (action === "history" && userId) {
      // Get login history for a specific user
      const limit = parseInt(searchParams.get("limit") || "20");
      const history = await getLoginHistory(userId, Math.min(limit, 100));
      return successResponse({ 
        loginHistory: history,
        count: history.length,
      });
    }

    return errorResponse("Invalid action. Use 'stats', 'flagged', or 'history'", 400);
  } catch (error) {
    console.error("Get fraud data error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/owner/fraud
 * Mark a flagged login as reviewed
 * Requires owner role
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    // Check if user is owner
    if (!requireOwner(request)) {
      return forbiddenResponse("Access denied. Owner privileges required.");
    }

    const body = await request.json();
    
    // Validate input
    const validation = validateWithSchema(reviewSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }

    const { login_id } = validation.data;

    // Mark as reviewed
    await reviewFlaggedLogin(login_id, user.id);

    return successResponse(
      { reviewedLoginId: login_id },
      "Login marked as reviewed"
    );
  } catch (error) {
    console.error("Review flagged login error:", error);
    return serverErrorResponse(error);
  }
}
