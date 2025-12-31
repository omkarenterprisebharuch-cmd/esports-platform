import { NextRequest } from "next/server";
import { successResponse, unauthorizedResponse, serverErrorResponse } from "@/lib/api-response";
import { requireOwner } from "@/lib/auth";
import { getPoolStats } from "@/lib/db";

/**
 * GET /api/owner/db-stats
 * 
 * Get database connection pool statistics
 * Only accessible by owners
 */
export async function GET(request: NextRequest) {
  try {
    // Require owner role (handles auth check internally)
    const user = requireOwner(request);
    if (!user) {
      return unauthorizedResponse("Owner access required");
    }

    // Get pool statistics
    const stats = getPoolStats();

    return successResponse({
      pool: {
        ...stats,
        utilizationPercent: Math.round((stats.activeConnections / stats.maxConnections) * 100),
        healthy: stats.activeConnections < stats.maxConnections,
      },
      config: {
        maxConnections: stats.maxConnections,
        idleTimeoutMs: 30000,
        connectionTimeoutMs: 10000,
        queueTimeoutMs: 30000,
      },
      recommendations: getRecommendations(stats),
    });
  } catch (error) {
    console.error("Error fetching DB stats:", error);
    return serverErrorResponse("Failed to fetch database statistics");
  }
}

function getRecommendations(stats: ReturnType<typeof getPoolStats>): string[] {
  const recommendations: string[] = [];
  
  if (stats.queueLength > 0) {
    recommendations.push(
      `⚠️ ${stats.queueLength} requests are queued waiting for connections. Consider upgrading database plan.`
    );
  }
  
  if (stats.activeConnections >= stats.maxConnections) {
    recommendations.push(
      "🔴 All connections are in use. Database is at capacity."
    );
  } else if (stats.activeConnections >= stats.maxConnections * 0.8) {
    recommendations.push(
      "🟡 Connection pool is above 80% utilization. Monitor for potential bottlenecks."
    );
  } else {
    recommendations.push(
      "🟢 Connection pool is healthy with available capacity."
    );
  }
  
  if (stats.waitingClients > 0) {
    recommendations.push(
      `${stats.waitingClients} pg clients waiting. Consider connection release optimization.`
    );
  }
  
  return recommendations;
}
