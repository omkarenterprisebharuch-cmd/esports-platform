import { NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import { successResponse, serverErrorResponse, unauthorizedResponse } from "@/lib/api-response";

/**
 * GET /api/owner/cdn-stats
 * CDN and caching statistics for monitoring
 */
export async function GET(request: NextRequest) {
  try {
    const user = requireOwner(request);
    if (!user) return unauthorizedResponse("Owner access required");

    // Define expected cache configurations
    const cacheConfigurations = {
      staticAssets: {
        description: "Next.js static chunks (JS, CSS)",
        pattern: "/_next/static/*",
        expectedMaxAge: 31536000,
        expectedDirectives: ["public", "immutable"],
      },
      images: {
        description: "Image files (png, jpg, webp, etc.)",
        pattern: "/*.{png,jpg,jpeg,webp,avif,svg}",
        expectedMaxAge: 604800,
        expectedDirectives: ["public", "stale-while-revalidate"],
      },
      optimizedImages: {
        description: "Next.js optimized images",
        pattern: "/_next/image/*",
        expectedMaxAge: 86400,
        expectedDirectives: ["public", "stale-while-revalidate"],
      },
      fonts: {
        description: "Font files (woff2)",
        pattern: "/*.woff2",
        expectedMaxAge: 31536000,
        expectedDirectives: ["public", "immutable"],
      },
      pwaAssets: {
        description: "PWA icons and manifest",
        pattern: "/icons/*, /manifest.json",
        expectedMaxAge: 604800,
        expectedDirectives: ["public"],
      },
      serviceWorker: {
        description: "Service worker",
        pattern: "/sw.js",
        expectedMaxAge: 0,
        expectedDirectives: ["must-revalidate"],
      },
      isrPages: {
        description: "ISR tournament pages",
        pattern: "/tournament/[id]",
        expectedMaxAge: 120,
        expectedDirectives: ["public", "stale-while-revalidate"],
      },
      leaderboard: {
        description: "Public leaderboard",
        pattern: "/leaderboard",
        expectedMaxAge: 300,
        expectedDirectives: ["public", "stale-while-revalidate"],
      },
      staticPages: {
        description: "Static pages (privacy, terms)",
        pattern: "/privacy-policy, /terms",
        expectedMaxAge: 86400,
        expectedDirectives: ["public"],
      },
      apiTournaments: {
        description: "Tournament list API",
        pattern: "/api/tournaments",
        expectedMaxAge: 30,
        expectedDirectives: ["public", "stale-while-revalidate"],
      },
      apiHallOfFame: {
        description: "Hall of Fame API",
        pattern: "/api/hall-of-fame",
        expectedMaxAge: 300,
        expectedDirectives: ["public", "stale-while-revalidate"],
      },
    };

    // CDN-specific headers explanation
    const cdnHeaders = {
      "Cache-Control": {
        description: "Standard HTTP caching header, respected by browsers and CDNs",
        directives: {
          "public": "Response can be cached by any cache (browser, CDN, proxy)",
          "private": "Response is for a single user, only browser cache",
          "max-age": "Maximum time (seconds) response is considered fresh",
          "s-maxage": "Max age for shared caches (CDN) only",
          "stale-while-revalidate": "Serve stale while fetching fresh in background",
          "stale-if-error": "Serve stale if origin returns error",
          "immutable": "Response will never change, don't revalidate",
          "must-revalidate": "Must check origin when stale",
          "no-cache": "Revalidate before using cached response",
          "no-store": "Never cache this response",
        },
      },
      "CDN-Cache-Control": {
        description: "CDN-specific header (Cloudflare, Vercel Edge, etc.)",
        note: "Takes precedence over Cache-Control for CDN edge servers",
      },
      "Surrogate-Control": {
        description: "For Fastly and other surrogate/edge caches",
        note: "Similar to CDN-Cache-Control but for specific CDN providers",
      },
      "Vary": {
        description: "Cache varies by these request headers",
        common: ["Accept-Encoding", "Authorization", "Accept"],
      },
    };

    // Deployment platform recommendations
    const platformRecommendations = {
      vercel: {
        name: "Vercel",
        features: [
          "Automatic Edge caching for static assets",
          "ISR support with on-demand revalidation",
          "Automatic Brotli/Gzip compression",
          "Global CDN with 100+ edge locations",
        ],
        configuration: "Headers in next.config.ts are automatically applied",
        dashboard: "Check Analytics → Edge Network for cache hit rates",
      },
      cloudflare: {
        name: "Cloudflare",
        features: [
          "Full Page caching rules available",
          "Tiered caching for origin shield",
          "Browser Cache TTL settings",
          "Cache Analytics dashboard",
        ],
        configuration: "Set Page Rules or Cache Rules in dashboard",
        cacheRules: [
          "Cache Level: Cache Everything for static assets",
          "Edge Cache TTL: Match origin headers",
          "Browser Cache TTL: Respect Existing Headers",
        ],
      },
      nginx: {
        name: "Nginx (self-hosted)",
        configuration: `
# Add to nginx.conf or site config
location /_next/static/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    add_header X-Cache-Status $upstream_cache_status;
}

location ~* \\.(png|jpg|jpeg|gif|webp|avif|svg|ico|woff2)$ {
    add_header Cache-Control "public, max-age=604800";
    add_header X-Cache-Status $upstream_cache_status;
}
        `.trim(),
      },
    };

    // Monitoring recommendations
    const monitoring = {
      headers_to_check: [
        "X-Cache (Cloudflare: HIT/MISS/EXPIRED)",
        "X-Vercel-Cache (Vercel: HIT/MISS/STALE)",
        "CF-Cache-Status (Cloudflare)",
        "Age (seconds since cached)",
        "X-Cache-Status (Nginx)",
      ],
      tools: [
        "curl -I <url> (check response headers)",
        "Chrome DevTools → Network → Headers",
        "WebPageTest.org (waterfall shows cache status)",
        "scripts/verify-cdn.ts (included in this project)",
      ],
      metrics_to_track: [
        "Cache Hit Rate (target: >90% for static assets)",
        "Edge Response Time (should be <50ms for cached)",
        "Origin Requests (should decrease with good caching)",
        "Bandwidth Savings (cached responses save bandwidth)",
      ],
    };

    return successResponse({
      cacheConfigurations,
      cdnHeaders,
      platformRecommendations,
      monitoring,
      configured: true,
      configFile: "next.config.ts",
    });
  } catch (error) {
    console.error("CDN stats error:", error);
    return serverErrorResponse(error);
  }
}
