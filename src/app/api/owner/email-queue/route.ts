import { NextRequest } from "next/server";
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { requireOwner } from "@/lib/auth";
import {
  getQueueStats,
  flushQueue,
  clearQueue,
  EMAIL_QUEUE_CONFIG,
} from "@/lib/email-queue";

/**
 * GET /api/owner/email-queue
 * 
 * Get email queue statistics
 * Only accessible by owners
 */
export async function GET(request: NextRequest) {
  try {
    const user = requireOwner(request);
    if (!user) {
      return unauthorizedResponse("Owner access required");
    }

    const stats = getQueueStats();

    return successResponse({
      config: EMAIL_QUEUE_CONFIG,
      stats: {
        pending: stats.pending,
        processing: stats.processing,
        completed: stats.completed,
        failed: stats.failed,
        rateLimited: stats.rateLimited,
        emailsSentThisMinute: stats.emailsSentThisMinute,
        emailsSentThisHour: stats.emailsSentThisHour,
        rateLimits: {
          maxPerMinute: EMAIL_QUEUE_CONFIG.MAX_EMAILS_PER_MINUTE,
          maxPerHour: EMAIL_QUEUE_CONFIG.MAX_EMAILS_PER_HOUR,
          remainingThisMinute: EMAIL_QUEUE_CONFIG.MAX_EMAILS_PER_MINUTE - stats.emailsSentThisMinute,
          remainingThisHour: EMAIL_QUEUE_CONFIG.MAX_EMAILS_PER_HOUR - stats.emailsSentThisHour,
        },
      },
      health: {
        status: stats.rateLimited ? "rate_limited" : stats.pending > 100 ? "backlogged" : "healthy",
        queueUtilization: Math.round((stats.pending / EMAIL_QUEUE_CONFIG.MAX_QUEUE_SIZE) * 100),
        recommendations: getRecommendations(stats),
      },
    });
  } catch (error) {
    console.error("Email queue stats error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/owner/email-queue
 * 
 * Perform actions on the email queue
 * 
 * Body:
 *   action: "flush" | "clear"
 */
export async function POST(request: NextRequest) {
  try {
    const user = requireOwner(request);
    if (!user) {
      return unauthorizedResponse("Owner access required");
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (!action) {
      return errorResponse("Action required: 'flush' or 'clear'", 400);
    }

    switch (action) {
      case "flush": {
        const result = await flushQueue();
        return successResponse({
          action: "flush",
          message: "Queue flushed successfully",
          result: {
            sent: result.sent,
            failed: result.failed,
          },
        });
      }

      case "clear": {
        clearQueue();
        return successResponse({
          action: "clear",
          message: "Queue cleared successfully",
        });
      }

      default:
        return errorResponse(`Invalid action: ${action}. Valid options: flush, clear`, 400);
    }
  } catch (error) {
    console.error("Email queue action error:", error);
    return serverErrorResponse(error);
  }
}

function getRecommendations(stats: ReturnType<typeof getQueueStats>): string[] {
  const recommendations: string[] = [];

  if (stats.rateLimited) {
    recommendations.push("Queue is rate limited. Consider increasing rate limits or check for email spam.");
  }

  if (stats.pending > EMAIL_QUEUE_CONFIG.MAX_QUEUE_SIZE * 0.8) {
    recommendations.push("Queue is nearly full. Consider flushing or increasing queue size.");
  }

  if (stats.failed > stats.completed * 0.1) {
    recommendations.push("High failure rate detected. Check SMTP configuration and email content.");
  }

  if (stats.emailsSentThisHour > EMAIL_QUEUE_CONFIG.MAX_EMAILS_PER_HOUR * 0.9) {
    recommendations.push("Approaching hourly email limit. Monitor for potential abuse.");
  }

  if (recommendations.length === 0) {
    recommendations.push("Email queue is healthy. No action required.");
  }

  return recommendations;
}
