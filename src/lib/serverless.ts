/**
 * Serverless Optimization Utilities
 * 
 * This module provides utilities for optimizing serverless API routes,
 * particularly for infrequently-called endpoints that are more susceptible
 * to cold start latency.
 * 
 * Key features:
 * - Cold start detection and measurement
 * - Lazy module loading for heavy dependencies
 * - Connection warming and pooling hints
 * - Performance timing instrumentation
 * 
 * @module serverless
 */

import { NextRequest, NextResponse } from "next/server";

// ============================================
// COLD START DETECTION
// ============================================

/**
 * Track whether this instance has been warmed up
 * In serverless, each cold start resets this flag
 */
let instanceWarmed = false;
let instanceStartTime = Date.now();
let requestCount = 0;

/**
 * Check if this is a cold start invocation
 */
export function isColdStart(): boolean {
  return !instanceWarmed;
}

/**
 * Mark the instance as warmed
 * Call this after first request is processed
 */
export function markWarmed(): void {
  instanceWarmed = true;
}

/**
 * Get instance statistics for monitoring
 */
export function getInstanceStats() {
  return {
    isColdStart: !instanceWarmed,
    instanceAge: Date.now() - instanceStartTime,
    requestCount,
    uptime: Math.floor((Date.now() - instanceStartTime) / 1000),
  };
}

// ============================================
// PERFORMANCE TIMING
// ============================================

export interface TimingResult {
  total: number;
  phases: Record<string, number>;
  coldStart: boolean;
  instanceAge: number;
}

/**
 * Performance timer for measuring route execution
 */
export class RouteTimer {
  private startTime: number;
  private phases: Map<string, { start: number; end?: number }>;
  private coldStart: boolean;
  private routeName: string;

  constructor(routeName: string) {
    this.startTime = performance.now();
    this.phases = new Map();
    this.coldStart = isColdStart();
    this.routeName = routeName;
    requestCount++;
  }

  /**
   * Start timing a phase
   */
  startPhase(name: string): void {
    this.phases.set(name, { start: performance.now() });
  }

  /**
   * End timing a phase
   */
  endPhase(name: string): number {
    const phase = this.phases.get(name);
    if (phase) {
      phase.end = performance.now();
      return phase.end - phase.start;
    }
    return 0;
  }

  /**
   * Get timing results
   */
  getResults(): TimingResult {
    const endTime = performance.now();
    const phaseResults: Record<string, number> = {};
    
    this.phases.forEach((timing, name) => {
      phaseResults[name] = timing.end 
        ? timing.end - timing.start 
        : endTime - timing.start;
    });

    return {
      total: endTime - this.startTime,
      phases: phaseResults,
      coldStart: this.coldStart,
      instanceAge: Date.now() - instanceStartTime,
    };
  }

  /**
   * Log timing results
   */
  log(): TimingResult {
    const results = this.getResults();
    
    // Log in development or when cold start
    if (process.env.NODE_ENV === "development" || results.coldStart) {
      console.log(`[Serverless] ${this.routeName}:`, {
        total: `${results.total.toFixed(2)}ms`,
        coldStart: results.coldStart,
        phases: Object.fromEntries(
          Object.entries(results.phases).map(([k, v]) => [k, `${v.toFixed(2)}ms`])
        ),
      });
    }

    markWarmed();
    return results;
  }
}

// ============================================
// LAZY LOADING HELPERS
// ============================================

/**
 * Cache for lazily loaded modules
 */
const moduleCache = new Map<string, unknown>();

/**
 * Lazily load a module only when needed
 * Helps reduce cold start time by not loading unused dependencies
 */
export async function lazyImport<T>(
  moduleId: string,
  importFn: () => Promise<T>
): Promise<T> {
  if (moduleCache.has(moduleId)) {
    return moduleCache.get(moduleId) as T;
  }
  
  const module = await importFn();
  moduleCache.set(moduleId, module);
  return module;
}

/**
 * Pre-load modules that will definitely be needed
 * Call during warm requests to prepare for subsequent cold starts
 */
export function preloadModules(moduleIds: string[]): void {
  // This is a hint for the bundler
  // Actual preloading happens through normal imports
  if (process.env.NODE_ENV === "development") {
    console.log(`[Serverless] Preloading modules: ${moduleIds.join(", ")}`);
  }
}

// ============================================
// CONNECTION WARMING
// ============================================

/**
 * Database connection warming state
 */
let dbWarmed = false;

/**
 * Warm the database connection pool
 * Call at the start of infrequent routes to reduce query latency
 */
export async function warmDatabaseConnection(): Promise<void> {
  if (dbWarmed) return;
  
  try {
    // Lazy import to avoid loading pg on routes that don't need it
    const { default: pool } = await import("@/lib/db");
    
    // Execute a simple query to warm the connection
    await pool.query("SELECT 1");
    dbWarmed = true;
  } catch (error) {
    console.error("[Serverless] Failed to warm database connection:", error);
  }
}

/**
 * Check if database is warmed
 */
export function isDatabaseWarmed(): boolean {
  return dbWarmed;
}

// ============================================
// RESPONSE HELPERS
// ============================================

/**
 * Add serverless timing headers to response
 */
export function addTimingHeaders(
  response: NextResponse,
  timing: TimingResult
): NextResponse {
  // Server-Timing header for browser DevTools
  const phases = Object.entries(timing.phases)
    .map(([name, duration]) => `${name};dur=${duration.toFixed(2)}`)
    .join(", ");
  
  response.headers.set(
    "Server-Timing",
    `total;dur=${timing.total.toFixed(2)}, ${phases}${timing.coldStart ? ", cold-start" : ""}`
  );
  
  // Custom header for monitoring
  response.headers.set("X-Cold-Start", timing.coldStart.toString());
  response.headers.set("X-Instance-Age", timing.instanceAge.toString());
  
  return response;
}

// ============================================
// ROUTE CONFIGURATION HELPERS
// ============================================

/**
 * Configuration for serverless routes
 */
export interface ServerlessRouteConfig {
  /** Maximum execution time in seconds */
  maxDuration?: number;
  /** Whether to prefer edge runtime (faster cold starts) */
  preferEdge?: boolean;
  /** Memory limit in MB (Vercel-specific) */
  memory?: number;
  /** Regions to deploy to (Vercel-specific) */
  regions?: string[];
}

/**
 * Infrequent route configurations
 * These routes are accessed rarely and should be optimized for cold starts
 */
export const INFREQUENT_ROUTES: Record<string, ServerlessRouteConfig> = {
  // Admin/Owner routes - accessed rarely
  "/api/owner/cleanup": { maxDuration: 60 },
  "/api/owner/fraud": { maxDuration: 30 },
  "/api/owner/db-indexes": { maxDuration: 30 },
  "/api/owner/cache-warm": { maxDuration: 60 },
  
  // User account management - rare operations
  "/api/users/account": { maxDuration: 30 },
  "/api/users/privacy-consent": { maxDuration: 10 },
  
  // Password reset - infrequent
  "/api/auth/forgot-password": { maxDuration: 10 },
  "/api/auth/reset-password": { maxDuration: 10 },
  
  // Reports/Bans - admin operations
  "/api/reports": { maxDuration: 15 },
  "/api/bans/game-id": { maxDuration: 15 },
  
  // Revalidation - triggered by webhooks
  "/api/revalidate": { maxDuration: 10 },
};

/**
 * Frequent route configurations
 * These routes should be kept warm and optimized for throughput
 */
export const FREQUENT_ROUTES: Record<string, ServerlessRouteConfig> = {
  // Core user flows - high traffic
  "/api/tournaments": { memory: 256 },
  "/api/registrations/register": { memory: 256 },
  "/api/auth/login": { memory: 256 },
  "/api/auth/refresh": { memory: 256 },
  "/api/auth/me": { memory: 256 },
  
  // Real-time features
  "/api/notifications/history": { memory: 256 },
  
  // Public pages
  "/api/hall-of-fame": { memory: 256 },
};

/**
 * Get route configuration
 */
export function getRouteConfig(path: string): ServerlessRouteConfig | undefined {
  return INFREQUENT_ROUTES[path] || FREQUENT_ROUTES[path];
}

/**
 * Check if a route is classified as infrequent
 */
export function isInfrequentRoute(path: string): boolean {
  return path in INFREQUENT_ROUTES;
}

// ============================================
// MONITORING & METRICS
// ============================================

/**
 * Cold start metrics storage (in-memory, resets on cold start)
 */
interface ColdStartMetric {
  route: string;
  timestamp: number;
  duration: number;
  instanceAge: number;
}

const coldStartMetrics: ColdStartMetric[] = [];
const MAX_METRICS = 100;

/**
 * Record a cold start event
 */
export function recordColdStart(
  route: string,
  duration: number,
  instanceAge: number
): void {
  coldStartMetrics.push({
    route,
    timestamp: Date.now(),
    duration,
    instanceAge,
  });
  
  // Keep only recent metrics
  if (coldStartMetrics.length > MAX_METRICS) {
    coldStartMetrics.shift();
  }
}

/**
 * Get cold start metrics for monitoring
 */
export function getColdStartMetrics() {
  const total = coldStartMetrics.length;
  const avgDuration = total > 0
    ? coldStartMetrics.reduce((sum, m) => sum + m.duration, 0) / total
    : 0;
  
  // Group by route
  const byRoute: Record<string, { count: number; avgDuration: number }> = {};
  for (const metric of coldStartMetrics) {
    if (!byRoute[metric.route]) {
      byRoute[metric.route] = { count: 0, avgDuration: 0 };
    }
    byRoute[metric.route].count++;
    byRoute[metric.route].avgDuration += metric.duration;
  }
  
  for (const route in byRoute) {
    byRoute[route].avgDuration /= byRoute[route].count;
  }
  
  return {
    totalColdStarts: total,
    averageDuration: Math.round(avgDuration),
    byRoute,
    recentColdStarts: coldStartMetrics.slice(-10).reverse(),
  };
}

// ============================================
// MIDDLEWARE WRAPPER
// ============================================

/**
 * Wrap a route handler with serverless optimizations
 * Use this for infrequent routes that need cold start monitoring
 */
export function withServerlessOptimization<
  T extends (
    request: NextRequest,
    context?: { params?: Promise<Record<string, string>> }
  ) => Promise<NextResponse>
>(
  routeName: string,
  handler: T,
  options: {
    warmDatabase?: boolean;
    addTimingHeaders?: boolean;
  } = {}
): T {
  return (async (
    request: NextRequest,
    context?: { params?: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const timer = new RouteTimer(routeName);
    
    // Warm database if needed
    if (options.warmDatabase) {
      timer.startPhase("db-warm");
      await warmDatabaseConnection();
      timer.endPhase("db-warm");
    }
    
    // Execute handler
    timer.startPhase("handler");
    let response: NextResponse;
    try {
      response = await handler(request, context);
    } finally {
      timer.endPhase("handler");
    }
    
    // Record timing
    const timing = timer.log();
    
    // Record cold start if applicable
    if (timing.coldStart) {
      recordColdStart(routeName, timing.total, timing.instanceAge);
    }
    
    // Add timing headers if enabled
    if (options.addTimingHeaders) {
      response = addTimingHeaders(response, timing);
    }
    
    return response;
  }) as T;
}

// ============================================
// EDGE RUNTIME HELPERS
// ============================================

// Declare EdgeRuntime global for TypeScript
declare const EdgeRuntime: string | undefined;

/**
 * Check if running in Edge runtime
 * Edge has faster cold starts but limited API access
 */
export function isEdgeRuntime(): boolean {
  return typeof EdgeRuntime !== "undefined";
}

/**
 * Features available in Edge runtime
 */
export const EDGE_LIMITATIONS = {
  noNodeModules: ["pg", "bcryptjs", "nodemailer", "sharp"],
  noDatabaseDirect: true,
  noFileSystem: true,
  maxExecutionTime: 30, // seconds
};

/**
 * Check if a route is suitable for Edge runtime
 */
export function canRunOnEdge(route: string): boolean {
  // Routes that don't need database, crypto, or email
  const edgeSafeRoutes = [
    "/api/revalidate",
    "/api/health",
  ];
  
  return edgeSafeRoutes.includes(route);
}

// ============================================
// VERCEL-SPECIFIC CONFIGURATIONS
// ============================================

/**
 * Generate Vercel function configuration
 * Export these from your route files
 */
export function generateVercelConfig(
  config: ServerlessRouteConfig
): Record<string, unknown> {
  return {
    maxDuration: config.maxDuration || 10,
    ...(config.memory && { memory: config.memory }),
    ...(config.regions && { regions: config.regions }),
  };
}

// Example usage for route exports:
// export const maxDuration = 60;
// export const dynamic = "force-dynamic";
