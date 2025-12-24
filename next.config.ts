import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

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
  },

  // Allow mobile devices on the same network to access dev server
  allowedDevOrigins: ["http://10.155.223.125:3000"],

  // Webpack configuration for Socket.io
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
};

export default nextConfig;
