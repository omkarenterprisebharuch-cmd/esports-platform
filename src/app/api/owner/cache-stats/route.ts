import { NextRequest } from "next/server";
import { successResponse, unauthorizedResponse, serverErrorResponse } from "@/lib/api-response";
import { requireOwner } from "@/lib/auth";
import { cache } from "@/lib/redis";

/**
 * GET /api/owner/cache-stats
 * 
 * Get Redis cache statistics
 * Only accessible by owners
 */
export async function GET(request: NextRequest) {
  try {
    // Require owner role
    const user = requireOwner(request);
    if (!user) {
      return unauthorizedResponse("Owner access required");
    }

    // Get cache statistics
    const stats = await cache.getStats();

    return successResponse({
      cache: {
        enabled: stats.enabled,
        connected: stats.connected,
        status: stats.connected ? "healthy" : stats.enabled ? "disconnected" : "disabled",
      },
      memory: stats.info ? {
        usedMemory: stats.info["used_memory_human"] || "Unknown",
        peakMemory: stats.info["used_memory_peak_human"] || "Unknown",
        fragmentation: stats.info["mem_fragmentation_ratio"] || "Unknown",
      } : null,
      recommendations: getRecommendations(stats),
    });
  } catch (error) {
    console.error("Error fetching cache stats:", error);
    return serverErrorResponse("Failed to fetch cache statistics");
  }
}

function getRecommendations(stats: { connected: boolean; enabled: boolean; info: Record<string, string> | null }): string[] {
  const recommendations: string[] = [];
  
  if (!stats.enabled) {
    recommendations.push(
      "⚠️ Redis caching is disabled. Set REDIS_URL environment variable to enable caching."
    );
    return recommendations;
  }
  
  if (!stats.connected) {
    recommendations.push(
      "🔴 Redis is not connected. Check your REDIS_URL configuration and ensure Redis server is running."
    );
    return recommendations;
  }

  if (stats.info) {
    const fragRatio = parseFloat(stats.info["mem_fragmentation_ratio"] || "1");
    if (fragRatio > 1.5) {
      recommendations.push(
        `⚠️ Memory fragmentation is high (${fragRatio}). Consider restarting Redis to defragment.`
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("✅ Redis cache is healthy and operating normally.");
  }

  return recommendations;
}
