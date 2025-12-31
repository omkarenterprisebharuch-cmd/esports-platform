import { NextRequest } from "next/server";
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { requireOwner } from "@/lib/auth";
import {
  getInstanceStats,
  getColdStartMetrics,
  INFREQUENT_ROUTES,
  FREQUENT_ROUTES,
  isColdStart,
} from "@/lib/serverless";

// Serverless configuration for this endpoint
export const maxDuration = 10;
export const dynamic = "force-dynamic";

/**
 * GET /api/owner/serverless-stats
 * 
 * Get serverless function statistics and cold start metrics
 * Only accessible by owners
 */
export async function GET(request: NextRequest) {
  try {
    // Require owner role
    const user = requireOwner(request);
    if (!user) {
      return unauthorizedResponse("Owner access required");
    }

    const instanceStats = getInstanceStats();
    const coldStartMetrics = getColdStartMetrics();

    return successResponse({
      instance: {
        ...instanceStats,
        uptimeFormatted: formatUptime(instanceStats.uptime),
      },
      coldStarts: {
        total: coldStartMetrics.totalColdStarts,
        averageDurationMs: coldStartMetrics.averageDuration,
        byRoute: coldStartMetrics.byRoute,
        recent: coldStartMetrics.recentColdStarts.map(cs => ({
          route: cs.route,
          durationMs: Math.round(cs.duration),
          timestamp: new Date(cs.timestamp).toISOString(),
          instanceAgeMs: cs.instanceAge,
        })),
      },
      configuration: {
        infrequentRoutes: Object.entries(INFREQUENT_ROUTES).map(([path, config]) => ({
          path,
          maxDuration: config.maxDuration || 10,
          memory: config.memory || "default",
        })),
        frequentRoutes: Object.entries(FREQUENT_ROUTES).map(([path, config]) => ({
          path,
          memory: config.memory || "default",
        })),
      },
      recommendations: getRecommendations(instanceStats, coldStartMetrics),
    });
  } catch (error) {
    console.error("Serverless stats error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Generate recommendations based on metrics
 */
function getRecommendations(
  instanceStats: ReturnType<typeof getInstanceStats>,
  coldStartMetrics: ReturnType<typeof getColdStartMetrics>
): string[] {
  const recommendations: string[] = [];

  // Check cold start frequency
  if (coldStartMetrics.totalColdStarts > 10) {
    const avgDuration = coldStartMetrics.averageDuration;
    if (avgDuration > 1000) {
      recommendations.push(
        `High cold start latency (${avgDuration}ms avg). Consider: ` +
        "1) Reducing bundle size, 2) Lazy loading heavy dependencies, " +
        "3) Using Edge runtime for simple routes"
      );
    }
  }

  // Check for problematic routes
  for (const [route, stats] of Object.entries(coldStartMetrics.byRoute)) {
    if (stats.avgDuration > 2000) {
      recommendations.push(
        `Route "${route}" has slow cold starts (${Math.round(stats.avgDuration)}ms avg). ` +
        "Review dependencies and consider lazy loading."
      );
    }
    if (stats.count > 5 && route in FREQUENT_ROUTES) {
      recommendations.push(
        `Route "${route}" classified as frequent but experiencing cold starts. ` +
        "Consider implementing keep-warm pings."
      );
    }
  }

  // Instance uptime recommendations
  if (instanceStats.uptime < 60 && instanceStats.requestCount > 5) {
    recommendations.push(
      "Instance recycling frequently. This may indicate memory issues or scaling patterns."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("✓ Serverless performance looks healthy");
  }

  return recommendations;
}
