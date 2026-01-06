import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ============ Bot Detection Configuration ============
const BOT_USER_AGENT_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /scraper/i, /curl/i, /wget/i,
  /python-requests/i, /python-urllib/i, /http-client/i, /java\//i,
  /go-http-client/i, /axios/i, /node-fetch/i, /phantom/i,
  /headless/i, /selenium/i, /puppeteer/i, /playwright/i,
  /mechanize/i, /scrapy/i, /httpclient/i, /libwww/i,
];

// Paths that don't require authentication
const publicPaths = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/tournaments",
  "/leaderboard",
  "/hall-of-fame",
  "/privacy-policy",
  "/terms",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/refresh",
];

// API paths that allow GET without authentication (public read)
const publicApiGetPaths = [
  "/api/tournaments",
  "/api/hall-of-fame",
  "/api/revalidate",
];

// Paths exempt from CSRF validation (unauthenticated endpoints)
const csrfExemptPaths = [
  "/api/auth/login",
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

// Paths that require host/admin role
const adminPaths = ["/admin", "/app/admin"];

// Paths that need auth - redirect to login with return URL
const protectedPaths = [
  "/app",
  "/profile",
  "/my-teams",
  "/my-registrations",
  "/wallet",
  "/register-tournament",
  "/admin",
  "/owner",
];

// ============ Bot Detection Helper ============
function detectBot(request: NextRequest): { isBot: boolean; reason?: string } {
  const userAgent = request.headers.get("user-agent") || "";
  
  // No user agent is highly suspicious
  if (!userAgent) {
    return { isBot: true, reason: "no-user-agent" };
  }
  
  // Check against known bot patterns
  for (const pattern of BOT_USER_AGENT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return { isBot: true, reason: `bot-pattern:${pattern.source}` };
    }
  }
  
  // Missing essential browser headers
  const acceptLanguage = request.headers.get("accept-language");
  const acceptEncoding = request.headers.get("accept-encoding");
  const accept = request.headers.get("accept");
  
  // Real browsers always send these
  if (!acceptLanguage && !accept) {
    return { isBot: true, reason: "missing-browser-headers" };
  }
  
  return { isBot: false };
}

// ============ Simple In-Edge Rate Limiting ============
// Note: For true distributed rate limiting, use Redis in API routes
// This provides first-line defense at the edge
const edgeRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const EDGE_RATE_LIMIT = 120; // requests per minute at edge
const EDGE_RATE_WINDOW = 60 * 1000; // 1 minute

function checkEdgeRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = edgeRateLimitMap.get(ip);
  
  // Cleanup old entries periodically (every 100 checks)
  if (Math.random() < 0.01) {
    for (const [key, value] of edgeRateLimitMap.entries()) {
      if (now > value.resetTime) {
        edgeRateLimitMap.delete(key);
      }
    }
  }
  
  if (!entry || now > entry.resetTime) {
    edgeRateLimitMap.set(ip, { count: 1, resetTime: now + EDGE_RATE_WINDOW });
    return true; // allowed
  }
  
  if (entry.count >= EDGE_RATE_LIMIT) {
    return false; // rate limited
  }
  
  entry.count++;
  return true; // allowed
}

function getClientIp(request: NextRequest): string {
  // Vercel provides real IP
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  
  // Cloudflare provides connecting IP
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  return "unknown";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const clientIp = getClientIp(request);

  // ============ Bot Detection (First Line of Defense) ============
  // Block obvious bots from accessing API endpoints
  if (pathname.startsWith("/api/")) {
    const botCheck = detectBot(request);
    
    // Allow legitimate crawlers to access specific endpoints
    const allowedBotPaths = ["/api/revalidate"]; // ISR revalidation
    const isAllowedBotPath = allowedBotPaths.some(p => pathname.startsWith(p));
    
    if (botCheck.isBot && !isAllowedBotPath) {
      console.warn(`[Bot Blocked] IP: ${clientIp}, Reason: ${botCheck.reason}, Path: ${pathname}`);
      return NextResponse.json(
        { success: false, error: "ACCESS_DENIED", message: "Automated requests are not allowed" },
        { status: 403 }
      );
    }
  }

  // ============ Edge Rate Limiting ============
  if (pathname.startsWith("/api/")) {
    if (!checkEdgeRateLimit(clientIp)) {
      console.warn(`[Rate Limited] IP: ${clientIp}, Path: ${pathname}`);
      return NextResponse.json(
        { success: false, error: "RATE_LIMITED", message: "Too many requests. Please slow down." },
        { 
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Limit": EDGE_RATE_LIMIT.toString(),
            "X-RateLimit-Remaining": "0",
          }
        }
      );
    }
  }

  // Check if it's a public path
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  // Check if it's a public API GET endpoint (allow GET without auth)
  const method = request.method.toUpperCase();
  const isPublicApiGet = method === "GET" && publicApiGetPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  // Get token from httpOnly cookie (primary) or Authorization header (fallback)
  const cookieToken = request.cookies.get("auth_token")?.value;
  const headerToken = request.headers.get("authorization")?.replace("Bearer ", "");
  const token = cookieToken || headerToken;

  // If accessing a public path and has token, redirect to app
  if (isPublicPath && token && pathname !== "/api/auth/login" && pathname !== "/api/auth/logout") {
    // Don't redirect API routes
    if (!pathname.startsWith("/api/")) {
      // Don't redirect from public viewing pages (tournaments, leaderboard, root, etc.)
      const viewingOnlyPaths = ["/", "/tournaments", "/leaderboard", "/hall-of-fame", "/privacy-policy", "/terms"];
      const isViewingPath = viewingOnlyPaths.some(p => pathname === p || (p !== "/" && pathname.startsWith(p + "/")));
      if (!isViewingPath) {
        return NextResponse.redirect(new URL("/app", request.url));
      }
    }
  }

  // If accessing a protected path without token, redirect to login with return URL
  // Skip for public API GET endpoints (they can be accessed without auth)
  if (!isPublicPath && !isPublicApiGet && !token) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // For pages, redirect to login with the original URL as redirect param
    const loginUrl = new URL("/login", request.url);
    
    // Encode the full path (including query params) for redirect after login
    const redirectPath = pathname + request.nextUrl.search;
    loginUrl.searchParams.set("redirect", redirectPath);
    
    // Add a reason for better UX messaging
    if (pathname.startsWith("/register-tournament")) {
      loginUrl.searchParams.set("reason", "registration");
    } else {
      loginUrl.searchParams.set("reason", "protected");
    }
    
    return NextResponse.redirect(loginUrl);
  }

  // CSRF validation for mutation requests on API routes
  if (pathname.startsWith("/api/") && token) {
    const method = request.method.toUpperCase();
    const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(method);
    const isCsrfExempt = csrfExemptPaths.some(
      (path) => pathname === path || pathname.startsWith(path + "/")
    );

    // Skip CSRF for tournament, registration, teams, and notifications operations (they're protected by auth cookies)
    // This allows backwards compatibility with clients that don't send CSRF tokens
    const isTournamentOperation = pathname === "/api/tournaments" || pathname.startsWith("/api/tournaments/");
    const isRegistrationOperation = pathname.startsWith("/api/registrations/");
    const isTeamsOperation = pathname.startsWith("/api/teams");
    const isNotificationsOperation = pathname.startsWith("/api/notifications/");
    
    if (isMutation && !isCsrfExempt && !isTournamentOperation && !isRegistrationOperation && !isTeamsOperation && !isNotificationsOperation) {
      // Get CSRF token from header (check both cases)
      const csrfToken = request.headers.get("x-csrf-token") || request.headers.get("X-CSRF-Token");
      
      if (!csrfToken) {
        return NextResponse.json(
          { success: false, message: "CSRF token required" },
          { status: 403 }
        );
      }
      // Note: Full CSRF validation happens in auth.ts verifyCsrfToken
      // Middleware just ensures the header is present
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - socket.io (WebSocket connections)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|socket\\.io).*)",
  ],
};
