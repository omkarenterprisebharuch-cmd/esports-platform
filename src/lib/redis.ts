/**
 * Redis Cache Client
 * 
 * Provides caching functionality for API responses using Redis.
 * Falls back gracefully to no-cache mode if Redis is unavailable.
 * 
 * Environment Variables:
 * - REDIS_URL: Redis connection string (e.g., redis://localhost:6379 or rediss://... for TLS)
 * - REDIS_ENABLED: Set to "false" to disable caching (default: true if REDIS_URL is set)
 * 
 * Usage:
 *   import { cache, cacheKeys, invalidatePattern } from "@/lib/redis";
 *   
 *   // Get or set cached data
 *   const data = await cache.getOrSet("tournaments:list", () => fetchTournaments(), 300);
 *   
 *   // Invalidate on updates
 *   await invalidatePattern("tournaments:*");
 */

import Redis from "ioredis";

// ============ Configuration ============

const REDIS_URL = process.env.REDIS_URL;
const REDIS_ENABLED = process.env.REDIS_ENABLED !== "false" && !!REDIS_URL;

// Default TTL values (in seconds)
export const TTL = {
  SHORT: 60,           // 1 minute - for frequently changing data
  MEDIUM: 300,         // 5 minutes - default for lists
  LONG: 900,           // 15 minutes - for stable data
  HOUR: 3600,          // 1 hour - for rarely changing data
  DAY: 86400,          // 24 hours - for static data
} as const;

// Cache key prefixes for organization
export const CACHE_PREFIX = {
  TOURNAMENTS: "tournaments",
  TOURNAMENT: "tournament",
  USERS: "users",
  TEAMS: "teams",
  LEADERBOARD: "leaderboard",
  HALL_OF_FAME: "hof",
  STATS: "stats",
} as const;

// ============ Redis Client ============

let redis: Redis | null = null;
let isConnected = false;
let connectionAttempts = 0;
let hasWarnedAboutRedis = false;
const MAX_CONNECTION_ATTEMPTS = 3;

/**
 * Log Redis warning once (to avoid console spam)
 */
function warnOnce(message: string): void {
  if (!hasWarnedAboutRedis && process.env.NODE_ENV === "development") {
    console.warn(`⚠️  Redis: ${message} - Cache disabled, app will work without caching.`);
    hasWarnedAboutRedis = true;
  }
}

/**
 * Get or create Redis client
 */
function getRedisClient(): Redis | null {
  if (!REDIS_ENABLED) {
    return null;
  }

  if (redis && isConnected) {
    return redis;
  }

  if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
    return null;
  }

  try {
    connectionAttempts++;
    
    redis = new Redis(REDIS_URL!, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 2) {
          // Silently give up - will warn once via error handler
          return null;
        }
        const delay = Math.min(times * 200, 1000);
        return delay;
      },
      reconnectOnError(err) {
        const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
        return targetErrors.some(e => err.message.includes(e));
      },
      enableReadyCheck: true,
      connectTimeout: 5000,
      lazyConnect: true,
    });

    redis.on("connect", () => {
      isConnected = true;
      connectionAttempts = 0;
      hasWarnedAboutRedis = false;
      if (process.env.NODE_ENV === "development") {
        console.log("🔴 Redis connected");
      }
    });

    redis.on("error", (err) => {
      isConnected = false;
      // Only warn once to avoid console spam
      const message = err?.message || "Unknown error";
      if (message.includes("ECONNREFUSED")) {
        warnOnce("Connection refused (is Redis running?)");
      } else if (message.includes("ETIMEDOUT")) {
        warnOnce("Connection timed out");
      } else if (message.includes("ENOTFOUND")) {
        warnOnce("Host not found");
      } else if (message) {
        warnOnce(message);
      } else {
        warnOnce("Connection failed");
      }
    });

    redis.on("close", () => {
      isConnected = false;
    });

    // Connect asynchronously
    redis.connect().catch(() => {
      isConnected = false;
    });

    return redis;
  } catch (error) {
    warnOnce("Failed to create client");
    return null;
  }
}

// ============ Cache Operations ============

/**
 * Get a value from cache
 */
export async function get<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const value = await client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    // Silently fail - already warned about Redis issues
    return null;
  }
}

/**
 * Set a value in cache with TTL
 */
export async function set<T>(key: string, value: T, ttlSeconds: number = TTL.MEDIUM): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch {
    // Silently fail - already warned about Redis issues
    return false;
  }
}

/**
 * Delete a key from cache
 */
export async function del(key: string): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.del(key);
    return true;
  } catch {
    // Silently fail - already warned about Redis issues
    return false;
  }
}

/**
 * Delete all keys matching a pattern
 * Use with caution - scans entire keyspace
 */
export async function invalidatePattern(pattern: string): Promise<number> {
  const client = getRedisClient();
  if (!client) return 0;

  try {
    let cursor = "0";
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await client.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== "0");

    if (process.env.NODE_ENV === "development" && deletedCount > 0) {
      console.log(`🔴 Cache invalidated: ${pattern} (${deletedCount} keys)`);
    }

    return deletedCount;
  } catch {
    // Silently fail - already warned about Redis issues
    return 0;
  }
}

/**
 * Get cached value or compute and cache it
 */
export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = TTL.MEDIUM
): Promise<T> {
  // Try to get from cache first
  const cached = await get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();

  // Cache the result (don't await - fire and forget)
  set(key, data, ttlSeconds).catch(() => {});

  return data;
}

/**
 * Check if Redis is available
 */
export function isAvailable(): boolean {
  return REDIS_ENABLED && isConnected;
}

/**
 * Get cache statistics
 */
export async function getStats(): Promise<{
  connected: boolean;
  enabled: boolean;
  info: Record<string, string> | null;
}> {
  const client = getRedisClient();
  
  if (!client || !isConnected) {
    return { connected: false, enabled: REDIS_ENABLED, info: null };
  }

  try {
    const info = await client.info("memory");
    const stats: Record<string, string> = {};
    
    info.split("\r\n").forEach(line => {
      const [key, value] = line.split(":");
      if (key && value) {
        stats[key] = value;
      }
    });

    return { connected: true, enabled: true, info: stats };
  } catch (error) {
    return { connected: false, enabled: REDIS_ENABLED, info: null };
  }
}

// ============ Cache Key Builders ============

/**
 * Build cache keys consistently
 */
export const cacheKeys = {
  // Tournament list with filters
  tournamentList: (filters: {
    status?: string;
    gameType?: string;
    filter?: string;
    page?: number;
    limit?: number;
    sort?: string;
    hosted?: string;
    search?: string;
    tournamentType?: string;
    minPrize?: string;
    maxPrize?: string;
  }): string => {
    const parts = [CACHE_PREFIX.TOURNAMENTS, "list"];
    
    // Create a normalized filter string
    const filterParts: string[] = [];
    if (filters.status) filterParts.push(`s:${filters.status}`);
    if (filters.gameType) filterParts.push(`g:${filters.gameType}`);
    if (filters.filter) filterParts.push(`f:${filters.filter}`);
    if (filters.page) filterParts.push(`p:${filters.page}`);
    if (filters.limit) filterParts.push(`l:${filters.limit}`);
    if (filters.sort) filterParts.push(`o:${filters.sort}`);
    if (filters.hosted) filterParts.push(`h:${filters.hosted}`);
    if (filters.search) filterParts.push(`q:${filters.search}`);
    if (filters.tournamentType) filterParts.push(`tt:${filters.tournamentType}`);
    if (filters.minPrize) filterParts.push(`minp:${filters.minPrize}`);
    if (filters.maxPrize) filterParts.push(`maxp:${filters.maxPrize}`);
    
    if (filterParts.length > 0) {
      parts.push(filterParts.sort().join(":"));
    }
    
    return parts.join(":");
  },

  // Single tournament
  tournament: (id: string): string => `${CACHE_PREFIX.TOURNAMENT}:${id}`,

  // Tournament registrations
  tournamentRegistrations: (tournamentId: string): string => 
    `${CACHE_PREFIX.TOURNAMENT}:${tournamentId}:registrations`,

  // Tournament leaderboard
  tournamentLeaderboard: (tournamentId: string): string =>
    `${CACHE_PREFIX.LEADERBOARD}:${tournamentId}`,

  // Hall of fame
  hallOfFame: (gameType?: string, period?: string): string => {
    const parts: string[] = [CACHE_PREFIX.HALL_OF_FAME];
    if (gameType) parts.push(gameType);
    if (period) parts.push(period);
    return parts.join(":");
  },

  // User profile
  userProfile: (userId: string): string => `${CACHE_PREFIX.USERS}:${userId}`,

  // Team info
  team: (teamId: string): string => `${CACHE_PREFIX.TEAMS}:${teamId}`,

  // Platform stats
  platformStats: (): string => `${CACHE_PREFIX.STATS}:platform`,
};

// ============ Cache Invalidation Helpers ============

/**
 * Invalidate all tournament-related caches
 */
export async function invalidateTournamentCaches(tournamentId?: string): Promise<void> {
  // Always invalidate list caches
  await invalidatePattern(`${CACHE_PREFIX.TOURNAMENTS}:*`);
  
  // Invalidate specific tournament if ID provided
  if (tournamentId) {
    await invalidatePattern(`${CACHE_PREFIX.TOURNAMENT}:${tournamentId}*`);
  }
  
  // Invalidate hall of fame (depends on tournament results)
  await invalidatePattern(`${CACHE_PREFIX.HALL_OF_FAME}:*`);
}

/**
 * Invalidate user-related caches
 */
export async function invalidateUserCaches(userId: string): Promise<void> {
  await del(cacheKeys.userProfile(userId));
}

/**
 * Invalidate team-related caches
 */
export async function invalidateTeamCaches(teamId: string): Promise<void> {
  await del(cacheKeys.team(teamId));
}

// ============ Export cache object ============

export const cache = {
  get,
  set,
  del,
  getOrSet,
  invalidatePattern,
  isAvailable,
  getStats,
};

/**
 * Check if Redis is currently connected
 */
export function isRedisConnected(): boolean {
  return isConnected && REDIS_ENABLED;
}

/**
 * Get Redis server info for monitoring
 */
export async function getRedisInfo(): Promise<{
  usedMemory: number;
  maxMemory: number;
  hitRate: number;
  keys: number;
} | null> {
  const client = getRedisClient();
  if (!client || !isConnected) return null;

  try {
    const info = await client.info();
    const dbSize = await client.dbsize();
    
    // Parse memory info
    const usedMemoryMatch = info.match(/used_memory:(\d+)/);
    const maxMemoryMatch = info.match(/maxmemory:(\d+)/);
    const hitsMatch = info.match(/keyspace_hits:(\d+)/);
    const missesMatch = info.match(/keyspace_misses:(\d+)/);

    const usedMemory = usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0;
    const maxMemory = maxMemoryMatch ? parseInt(maxMemoryMatch[1]) : 0;
    const hits = hitsMatch ? parseInt(hitsMatch[1]) : 0;
    const misses = missesMatch ? parseInt(missesMatch[1]) : 0;
    
    const hitRate = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0;

    return {
      usedMemory,
      maxMemory,
      hitRate,
      keys: dbSize,
    };
  } catch (error) {
    console.error("Failed to get Redis info:", error);
    return null;
  }
}

export default cache;
