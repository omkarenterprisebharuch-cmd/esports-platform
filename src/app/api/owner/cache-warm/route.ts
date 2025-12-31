import { NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import { warmCache, invalidateDbCache } from "@/lib/db-cache";
import { cache } from "@/lib/redis";
import {
  successResponse,
  errorResponse,
  forbiddenResponse,
  serverErrorResponse,
} from "@/lib/api-response";

// Serverless configuration - cache warming can take time
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/owner/cache-warm
 * Warm caches (Owner only or via cron secret)
 * 
 * Body options:
 * - { target: "all" } - Warm all caches
 * - { target: "tournaments" } - Warm tournament caches
 * - { target: "stats" } - Warm statistics caches  
 * - { target: "tournament", id: "xxx" } - Warm specific tournament
 * 
 * Headers:
 * - X-Cron-Secret: For automated cron jobs
 */
export async function POST(request: NextRequest) {
  try {
    // Check for cron secret or owner auth
    const cronSecret = request.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET;
    
    if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
      // Authorized via cron secret
    } else {
      // Check owner role
      const user = requireOwner(request);
      if (!user) {
        return forbiddenResponse("Owner access or valid cron secret required");
      }
    }

    // Check Redis availability
    if (!cache.isAvailable()) {
      return errorResponse("Redis is not available", 503);
    }

    const body = await request.json().catch(() => ({ target: "all" }));
    const { target, id } = body;

    const startTime = Date.now();
    let result: { warmed: string[]; errors: string[] } = { warmed: [], errors: [] };

    switch (target) {
      case "tournament":
        if (!id) {
          return errorResponse("Tournament ID required", 400);
        }
        try {
          await warmCache.tournament(id);
          result.warmed.push(`tournament:${id}`);
        } catch (error) {
          result.errors.push(`tournament:${id}`);
        }
        break;

      case "tournaments":
        try {
          await warmCache.popularTournaments();
          result.warmed.push("popular_tournaments");
        } catch (error) {
          result.errors.push("popular_tournaments");
        }
        try {
          await warmCache.upcomingTournaments();
          result.warmed.push("upcoming_tournaments");
        } catch (error) {
          result.errors.push("upcoming_tournaments");
        }
        break;

      case "stats":
        try {
          await warmCache.platformStats();
          result.warmed.push("platform_stats");
        } catch (error) {
          result.errors.push("platform_stats");
        }
        break;

      case "all":
      default:
        try {
          await warmCache.all();
          result.warmed.push("all");
        } catch (error) {
          result.errors.push("all");
        }
        break;
    }

    const elapsed = Date.now() - startTime;

    return successResponse({
      success: result.errors.length === 0,
      target,
      warmed: result.warmed,
      errors: result.errors,
      elapsed_ms: elapsed,
    });
  } catch (error) {
    console.error("Cache warm error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * DELETE /api/owner/cache-warm
 * Invalidate caches (Owner only)
 * 
 * Body options:
 * - { target: "all" } - Invalidate all caches
 * - { target: "tournaments" } - Invalidate tournament caches
 * - { target: "users" } - Invalidate user caches
 * - { target: "stats" } - Invalidate stats caches
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = requireOwner(request);
    if (!user) {
      return forbiddenResponse("Owner access required");
    }

    if (!cache.isAvailable()) {
      return errorResponse("Redis is not available", 503);
    }

    const body = await request.json().catch(() => ({ target: "all" }));
    const { target } = body;

    const startTime = Date.now();

    switch (target) {
      case "tournaments":
        await cache.invalidatePattern("tournaments:*");
        await cache.invalidatePattern("tournament:*");
        break;
      case "users":
        await cache.invalidatePattern("users:*");
        break;
      case "teams":
        await cache.invalidatePattern("teams:*");
        break;
      case "stats":
        await invalidateDbCache.stats();
        break;
      case "all":
      default:
        await invalidateDbCache.all();
        break;
    }

    const elapsed = Date.now() - startTime;

    return successResponse({
      success: true,
      target,
      invalidated: target === "all" ? "all caches" : `${target} caches`,
      elapsed_ms: elapsed,
    });
  } catch (error) {
    console.error("Cache invalidation error:", error);
    return serverErrorResponse(error);
  }
}
