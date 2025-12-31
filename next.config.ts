import type { NextConfig } from "next";
import path from "path";

// Bundle analyzer setup
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),

  reactStrictMode: true,

  // Enable gzip compression for all responses
  // Note: Brotli is handled by reverse proxy (Vercel/Nginx) for better performance
  compress: true,

  productionBrowserSourceMaps: false,

  serverExternalPackages: [
    "cloudinary",
    "web-push", 
    "nodemailer",
    "bcryptjs",
    "jsonwebtoken",
    "pg",
    "sharp",
  ],

  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
    ],
    // Enable modern image formats for better compression
    formats: ["image/avif", "image/webp"],
    // Optimize image loading
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    // Minimize image memory usage
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
  },

  // Environment variables that are safe to expose to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: "Esports Platform",
  },

  // Server configuration for custom server (Socket.io)
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
    // Enable optimized package imports for better tree-shaking
    optimizePackageImports: [
      "socket.io-client",
      "zod",
      "idb",
    ],
  },

  // Allow cross-origin requests from these origins during development
  allowedDevOrigins: [
    "http://10.35.55.125:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://10.35.55.125:3001",
    "http://localhost:3001",
  ],

  // Webpack configuration for Socket.io and optimizations
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
      };
    }
    return config;
  },

  // Headers for security and caching
  async headers() {
    // Content Security Policy - adjust as needed for your CDN/external resources
    const cspHeader = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval for dev
      "style-src 'self' 'unsafe-inline'", // Tailwind uses inline styles
      "img-src 'self' data: blob: https://res.cloudinary.com https://ui-avatars.com",
      "font-src 'self' data:",
      "connect-src 'self' https://res.cloudinary.com wss: ws:", // WebSocket for Socket.io
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    // Security headers applied to all routes
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: process.env.NODE_ENV === "production" ? cspHeader : "", // Only in production
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "X-XSS-Protection",
        value: "1; mode=block",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=()",
      },
    ].filter(h => h.value); // Remove empty headers

    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // API responses - enable caching and compression hints
        source: "/api/:path*",
        headers: [
          {
            // Ensure API responses can be cached by CDN when appropriate
            key: "Vary",
            value: "Accept-Encoding, Authorization",
          },
        ],
      },
      {
        source: "/api/tournaments",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=30, stale-while-revalidate=60",
          },
        ],
      },
      {
        source: "/api/hall-of-fame",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, stale-while-revalidate=600",
          },
        ],
      },
      // ============================================
      // CDN STATIC ASSET CACHING
      // ============================================
      {
        // Next.js static assets (JS, CSS chunks) - immutable, cache forever
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Public static files (favicon, manifest, robots, etc.)
        source: "/:file(favicon.ico|robots.txt|sitemap.xml|manifest.json)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
      {
        // PWA icons and assets
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=2592000",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=604800",
          },
        ],
      },
      {
        // Font files - long cache with immutable
        source: "/:path*.woff2",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
      {
        // Image assets in public folder
        source: "/:path*.(png|jpg|jpeg|gif|webp|avif|svg|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=2592000",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=604800",
          },
        ],
      },
      {
        // Next.js optimized images
        source: "/_next/image/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
      {
        // Service worker - short cache to allow updates
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        // ISR pages - allow CDN caching with stale-while-revalidate
        source: "/tournament/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=120, stale-while-revalidate=300",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=120, stale-while-revalidate=300",
          },
        ],
      },
      {
        // Public leaderboard page
        source: "/leaderboard",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, stale-while-revalidate=900",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=300, stale-while-revalidate=900",
          },
        ],
      },
      {
        // Static pages (privacy, terms)
        source: "/:path(privacy-policy|terms)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
