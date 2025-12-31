import { NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getUserFromRequest, requireRole } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
  forbiddenResponse,
} from "@/lib/api-response";

// Serverless configuration - revalidation is triggered by webhooks
export const maxDuration = 10;
export const dynamic = "force-dynamic";

/**
 * POST /api/revalidate
 * On-demand revalidation for ISR pages
 * 
 * Can be called:
 * 1. By owners/organizers after tournament updates
 * 2. By cron jobs with CRON_SECRET
 * 3. By webhooks with REVALIDATION_SECRET
 * 
 * Body:
 * - type: "tournament" | "leaderboard" | "all"
 * - id?: string (tournament ID for specific revalidation)
 * - secret?: string (for external webhook calls)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, id, secret } = body;

    // Check authentication - either user token, cron secret, or revalidation secret
    const cronSecret = request.headers.get("x-cron-secret");
    const user = getUserFromRequest(request);
    const revalidationSecret = process.env.REVALIDATION_SECRET;

    const isAuthorizedByCron = cronSecret && cronSecret === process.env.CRON_SECRET;
    const isAuthorizedBySecret = secret && revalidationSecret && secret === revalidationSecret;
    const isAuthorizedByRole = user && (user.role === "owner" || user.role === "organizer");

    if (!isAuthorizedByCron && !isAuthorizedBySecret && !isAuthorizedByRole) {
      return unauthorizedResponse("Invalid authentication");
    }

    if (!type) {
      return errorResponse("Missing 'type' parameter", 400);
    }

    const revalidated: string[] = [];

    switch (type) {
      case "tournament":
        if (id) {
          // Revalidate public ISR tournament page
          revalidatePath(`/t/${id}`);
          revalidated.push(`/t/${id}`);
          
          // Also revalidate the dashboard version
          revalidatePath(`/dashboard/tournament/${id}`);
          revalidated.push(`/dashboard/tournament/${id}`);
        } else {
          // Revalidate all tournament-related pages
          revalidatePath("/dashboard");
          revalidatePath("/leaderboard");
          revalidated.push("/dashboard", "/leaderboard");
        }
        break;

      case "leaderboard":
        revalidatePath("/leaderboard");
        if (id) {
          revalidatePath(`/dashboard/tournament/${id}/leaderboard`);
          revalidated.push(`/dashboard/tournament/${id}/leaderboard`);
        }
        revalidated.push("/leaderboard");
        break;

      case "hall-of-fame":
        revalidatePath("/leaderboard");
        revalidated.push("/leaderboard");
        break;

      case "all":
        // Revalidate all ISR pages
        revalidatePath("/leaderboard");
        revalidatePath("/privacy-policy");
        revalidatePath("/terms");
        revalidatePath("/dashboard");
        revalidated.push("/leaderboard", "/privacy-policy", "/terms", "/dashboard");
        
        // If ID provided, also revalidate that tournament
        if (id) {
          revalidatePath(`/tournament/${id}`);
          revalidated.push(`/tournament/${id}`);
        }
        break;

      default:
        return errorResponse(`Unknown type: ${type}`, 400);
    }

    return successResponse({
      revalidated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Revalidation error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * GET /api/revalidate
 * Get revalidation status and available options (owner only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = requireRole(request, ["owner"]);
    if (!user) {
      return unauthorizedResponse("Owner access required");
    }

    return successResponse({
      availableTypes: ["tournament", "leaderboard", "hall-of-fame", "all"],
      usage: {
        tournament: "Revalidate tournament detail pages. Pass 'id' for specific tournament.",
        leaderboard: "Revalidate leaderboard pages. Pass 'id' for tournament-specific leaderboard.",
        "hall-of-fame": "Revalidate the public hall of fame page.",
        all: "Revalidate all ISR pages.",
      },
      authentication: {
        userToken: "Owner or organizer role required",
        cronSecret: "X-Cron-Secret header with CRON_SECRET",
        webhookSecret: "Pass 'secret' in body matching REVALIDATION_SECRET",
      },
      envVars: {
        CRON_SECRET: process.env.CRON_SECRET ? "Set" : "Not set",
        REVALIDATION_SECRET: process.env.REVALIDATION_SECRET ? "Set" : "Not set",
      },
    });
  } catch (error) {
    console.error("Revalidation info error:", error);
    return serverErrorResponse(error);
  }
}
