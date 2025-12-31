#!/usr/bin/env npx tsx
/**
 * Cache Warming Script
 * 
 * Pre-populates Redis cache with frequently accessed data.
 * Run on server startup or via scheduled job to improve cold-start performance.
 * 
 * Usage:
 *   npx tsx scripts/warm-cache.ts
 *   npx tsx scripts/warm-cache.ts --tournaments
 *   npx tsx scripts/warm-cache.ts --stats
 *   npx tsx scripts/warm-cache.ts --all
 * 
 * Options:
 *   --all          Warm all caches (default)
 *   --tournaments  Warm tournament caches only
 *   --stats        Warm statistics caches only
 *   --tournament <id>  Warm specific tournament cache
 */

import { warmCache, cachedQueries } from "../src/lib/db-cache";
import { cache } from "../src/lib/redis";
import pool from "../src/lib/db";

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  all: args.includes("--all") || args.length === 0,
  tournaments: args.includes("--tournaments"),
  stats: args.includes("--stats"),
  tournamentId: args.includes("--tournament") 
    ? args[args.indexOf("--tournament") + 1] 
    : null,
};

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("       🔥 Cache Warming Utility            ");
  console.log("═══════════════════════════════════════════\n");

  // Check Redis connection
  if (!cache.isAvailable()) {
    console.log("⚠️  Waiting for Redis connection...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!cache.isAvailable()) {
      console.error("❌ Redis is not available. Cannot warm cache.");
      console.log("   Make sure REDIS_URL environment variable is set.");
      process.exit(1);
    }
  }

  console.log("✅ Redis connected\n");

  const startTime = Date.now();
  let warmedCount = 0;

  try {
    // Warm specific tournament
    if (options.tournamentId) {
      console.log(`📍 Warming cache for tournament: ${options.tournamentId}\n`);
      await warmCache.tournament(options.tournamentId);
      warmedCount++;
    }
    // Warm all caches
    else if (options.all) {
      console.log("📍 Warming ALL caches\n");
      
      // Popular tournaments
      await warmCache.popularTournaments();
      warmedCount++;
      
      // Upcoming tournaments
      await warmCache.upcomingTournaments();
      warmedCount++;
      
      // Platform stats
      await warmCache.platformStats();
      warmedCount++;
      
      // Active tournaments (warm individual tournament caches)
      console.log("🔥 Warming cache: active tournament details...");
      const activeTournaments = await cachedQueries.getUpcomingTournaments(50);
      for (const tournament of activeTournaments.slice(0, 10)) {
        await cachedQueries.getTournamentLeaderboard(tournament.id);
      }
      console.log(`✅ Cache warmed: ${Math.min(activeTournaments.length, 10)} tournament leaderboards`);
      warmedCount++;
    }
    // Warm tournaments only
    else if (options.tournaments) {
      console.log("📍 Warming TOURNAMENT caches\n");
      
      await warmCache.popularTournaments();
      warmedCount++;
      
      await warmCache.upcomingTournaments();
      warmedCount++;
    }
    // Warm stats only
    else if (options.stats) {
      console.log("📍 Warming STATISTICS caches\n");
      
      await warmCache.platformStats();
      warmedCount++;
    }

    const elapsed = Date.now() - startTime;
    
    console.log("\n═══════════════════════════════════════════");
    console.log("              📊 Summary                    ");
    console.log("═══════════════════════════════════════════");
    console.log(`  Cache categories warmed: ${warmedCount}`);
    console.log(`  Time elapsed: ${elapsed}ms`);
    console.log("═══════════════════════════════════════════\n");

    // Get cache stats
    const stats = await cache.getStats();
    if (stats.connected && stats.info) {
      console.log("📈 Redis Memory Usage:");
      console.log(`   Used memory: ${stats.info.used_memory_human || "N/A"}`);
      console.log(`   Peak memory: ${stats.info.used_memory_peak_human || "N/A"}`);
    }

  } catch (error) {
    console.error("\n❌ Cache warming failed:", error);
    process.exit(1);
  } finally {
    // Clean up database connection
    await pool.end();
    console.log("\n👋 Done. Database connection closed.");
    process.exit(0);
  }
}

main();
