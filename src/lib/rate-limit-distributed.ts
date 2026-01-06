/**
 * Distributed Rate Limiter using Redis
 * 
 * This rate limiter works correctly across serverless function instances.
 * Uses Redis sliding window algorithm for accurate rate limiting.
 */

import Redis from "ioredis";
import { NextRequest, NextResponse } from "next/server";

// ============ Redis Client for Rate Limiting ============
// Separate from cache client to ensure rate limiting always attempts connection

const REDIS_URL = process.env.REDIS_URL;
let rateLimitRedis: Redis | null = null;
let isConnected = false;

function getRateLimitRedis(): Redis | null {
  if (!REDIS_URL) {
    return null;
  }

  if (rateLimitRedis && isConnected) {
    return rateLimitRedis;
  }

  try {
    rateLimitRedis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 2) return null;
        return Math.min(times * 200, 1000);
      },
      connectTimeout: 3000,
      lazyConnect: false,
    });

    rateLimitRedis.on("connect", () => {
      isConnected = true;
    });

    rateLimitRedis.on("error", () => {
      isConnected = false;
    });

    rateLimitRedis.on("close", () => {
      isConnected = false;
    });

    return rateLimitRedis;
  } catch {
    return null;
  }
}

// Check if connected
function isRedisAvailable(): boolean {
  return isConnected && rateLimitRedis !== null;
}

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Optional identifier prefix for different rate limit groups */
  prefix?: string;
  /** Block duration in seconds after limit exceeded (optional escalation) */
  blockDuration?: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number;
  limit: number;
  blocked?: boolean;
}

/**
 * Distributed rate limiting using Redis sliding window
 */
export async function checkDistributedRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { maxRequests, windowSeconds, prefix = "rl", blockDuration } = config;
  const key = `${prefix}:${identifier}`;
  const blockKey = `${prefix}:block:${identifier}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = now - windowMs;

  // Get Redis client
  const redis = getRateLimitRedis();

  // Check if Redis is available
  if (!redis || !isRedisAvailable()) {
    // Fallback: allow request but log warning
    console.warn("[RateLimit] Redis not connected, allowing request");
    return {
      success: true,
      remaining: maxRequests - 1,
      resetIn: windowSeconds,
      limit: maxRequests,
    };
  }

  try {
    // Check if identifier is blocked (escalation)
    if (blockDuration) {
      const blocked = await redis.get(blockKey);
      if (blocked) {
        const ttl = await redis.ttl(blockKey);
        return {
          success: false,
          remaining: 0,
          resetIn: ttl > 0 ? ttl : blockDuration,
          limit: maxRequests,
          blocked: true,
        };
      }
    }

    // Use Redis MULTI for atomic operations
    const pipeline = redis.multi();
    
    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count current entries in window
    pipeline.zcard(key);
    
    // Add current request timestamp
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiry on the sorted set
    pipeline.expire(key, windowSeconds + 1);
    
    const results = await pipeline.exec();
    
    if (!results) {
      console.error("[RateLimit] Redis pipeline returned null");
      return { success: true, remaining: maxRequests, resetIn: windowSeconds, limit: maxRequests };
    }

    // Get count from second command result
    const currentCount = (results[1][1] as number) || 0;

    if (currentCount >= maxRequests) {
      // Rate limit exceeded
      if (blockDuration) {
        // Escalate: block this identifier
        await redis.set(blockKey, "1", "EX", blockDuration);
      }
      
      return {
        success: false,
        remaining: 0,
        resetIn: windowSeconds,
        limit: maxRequests,
      };
    }

    return {
      success: true,
      remaining: Math.max(0, maxRequests - currentCount - 1),
      resetIn: windowSeconds,
      limit: maxRequests,
    };
  } catch (error) {
    console.error("[RateLimit] Redis error:", error);
    // Fail open: allow request on Redis error
    return {
      success: true,
      remaining: maxRequests,
      resetIn: windowSeconds,
      limit: maxRequests,
    };
  }
}

/**
 * Get client IP from request headers (works with Vercel/Cloudflare)
 */
export function getClientIpFromRequest(request: NextRequest): string {
  // Vercel's real IP header
  const vercelIp = request.headers.get("x-real-ip");
  if (vercelIp) return vercelIp;

  // Cloudflare's connecting IP
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  // Standard forwarded header
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return "unknown";
}

/**
 * Get additional bot detection signals
 */
export function getBotSignals(request: NextRequest): {
  isLikelyBot: boolean;
  signals: string[];
} {
  const signals: string[] = [];
  const userAgent = request.headers.get("user-agent") || "";
  
  // No user agent
  if (!userAgent) {
    signals.push("no-user-agent");
  }
  
  // Known bot patterns
  const botPatterns = [
    /bot/i, /crawl/i, /spider/i, /scraper/i, /curl/i, /wget/i,
    /python/i, /requests/i, /http-client/i, /java\//i, /go-http/i,
    /axios/i, /node-fetch/i, /phantom/i, /headless/i, /selenium/i,
    /puppeteer/i, /playwright/i
  ];
  
  if (botPatterns.some(pattern => pattern.test(userAgent))) {
    signals.push("bot-user-agent");
  }
  
  // Missing common browser headers
  if (!request.headers.get("accept-language")) {
    signals.push("no-accept-language");
  }
  
  if (!request.headers.get("accept-encoding")) {
    signals.push("no-accept-encoding");
  }
  
  // Check for automation headers
  if (request.headers.get("x-automation") || request.headers.get("x-requested-with") === "XMLHttpRequest" && !userAgent.includes("Mozilla")) {
    signals.push("automation-header");
  }

  return {
    isLikelyBot: signals.length >= 2,
    signals,
  };
}

// ============ Pre-configured Distributed Rate Limiters ============

/** Global API rate limit - 60 requests per minute per IP */
export const globalApiLimit: RateLimitConfig = {
  maxRequests: 60,
  windowSeconds: 60,
  prefix: "api:global",
};

/** Strict limit for auth endpoints - 5 per 15 minutes with 30 min block */
export const authRateLimit: RateLimitConfig = {
  maxRequests: 5,
  windowSeconds: 15 * 60,
  prefix: "api:auth",
  blockDuration: 30 * 60,
};

/** OTP sending - 3 per 10 minutes */
export const otpDistributedLimit: RateLimitConfig = {
  maxRequests: 3,
  windowSeconds: 10 * 60,
  prefix: "api:otp",
};

/** Tournament listing - 30 per minute (generous for browsing) */
export const tournamentListLimit: RateLimitConfig = {
  maxRequests: 30,
  windowSeconds: 60,
  prefix: "api:tournaments",
};

/** Registration actions - 10 per minute per IP */
export const registrationLimit: RateLimitConfig = {
  maxRequests: 10,
  windowSeconds: 60,
  prefix: "api:registrations",
};

/** WebSocket connections - 5 per minute per IP */
export const wsConnectionLimit: RateLimitConfig = {
  maxRequests: 5,
  windowSeconds: 60,
  prefix: "ws:connect",
};

/**
 * Middleware helper to apply rate limiting
 */
export async function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const ip = getClientIpFromRequest(request);
  const result = await checkDistributedRateLimit(ip, config);

  if (!result.success) {
    const response = NextResponse.json(
      {
        success: false,
        error: "RATE_LIMITED",
        message: result.blocked
          ? `Too many requests. You are temporarily blocked. Try again in ${Math.ceil(result.resetIn / 60)} minutes.`
          : `Too many requests. Please try again in ${result.resetIn} seconds.`,
        retryAfter: result.resetIn,
      },
      {
        status: 429,
        headers: {
          "Retry-After": result.resetIn.toString(),
          "X-RateLimit-Limit": result.limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": result.resetIn.toString(),
        },
      }
    );
    return { allowed: false, response };
  }

  return { allowed: true };
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeadersToResponse(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set("X-RateLimit-Limit", result.limit.toString());
  response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
  response.headers.set("X-RateLimit-Reset", result.resetIn.toString());
  return response;
}
