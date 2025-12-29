import type { NextConfig } from "next";
import path from "path";

// Bundle analyzer setup
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),

  reactStrictMode: true,

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

  // Headers for better caching
  async headers() {
    return [
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
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
