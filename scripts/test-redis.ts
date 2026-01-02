#!/usr/bin/env npx tsx
/**
 * Redis Connection Test Script
 * Tests connectivity to Redis Cloud
 */

// Load environment variables from .env.local
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error("❌ REDIS_URL environment variable is not set.");
  console.log("   Please set REDIS_URL in your .env.local file.");
  process.exit(1);
}

// TypeScript now knows REDIS_URL is defined after the check above
const redisUrl: string = REDIS_URL;

async function testRedisConnection() {
  console.log("═══════════════════════════════════════════");
  console.log("       🔴 Redis Connection Test            ");
  console.log("═══════════════════════════════════════════\n");
  
  // Mask password in URL for display
  const maskedUrl = redisUrl.replace(/:([^@]+)@/, ':****@');
  console.log(`📍 Connecting to: ${maskedUrl}\n`);
  
  const redis = new Redis(redisUrl, {
    connectTimeout: 10000,
    maxRetriesPerRequest: 1,
  });

  redis.on("connect", () => {
    console.log("✅ Connected to Redis Cloud!");
  });

  redis.on("error", (err) => {
    console.error("❌ Redis error:", err.message);
  });

  try {
    // Test PING
    const pong = await redis.ping();
    console.log(`✅ PING response: ${pong}`);

    // Test SET/GET
    await redis.set("test:esports", "Connection successful!", "EX", 60);
    const value = await redis.get("test:esports");
    console.log(`✅ SET/GET test: ${value}`);

    // Clean up test key
    await redis.del("test:esports");
    console.log("✅ Cleanup successful");

    // Get server info
    const serverInfo = await redis.info("server");
    const version = serverInfo.match(/redis_version:(.+)/)?.[1]?.trim();
    console.log(`\n📊 Redis Version: ${version}`);

    // Get memory info
    const memInfo = await redis.info("memory");
    const usedMem = memInfo.match(/used_memory_human:(.+)/)?.[1]?.trim();
    const peakMem = memInfo.match(/used_memory_peak_human:(.+)/)?.[1]?.trim();
    console.log(`📊 Memory Used: ${usedMem}`);
    console.log(`📊 Peak Memory: ${peakMem}`);

    // Get client info
    const clientInfo = await redis.info("clients");
    const connectedClients = clientInfo.match(/connected_clients:(.+)/)?.[1]?.trim();
    console.log(`📊 Connected Clients: ${connectedClients}`);

    console.log("\n═══════════════════════════════════════════");
    console.log("  🎉 SUCCESS! Redis is configured correctly ");
    console.log("═══════════════════════════════════════════\n");

    await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Connection test failed:", error);
    await redis.quit();
    process.exit(1);
  }
}

testRedisConnection();
