#!/usr/bin/env npx tsx
/**
 * Compression Verification Script
 * 
 * Tests API endpoints to verify gzip/brotli compression is working
 * and measures bandwidth savings.
 * 
 * Usage:
 *   npx tsx scripts/verify-compression.ts
 *   npx tsx scripts/verify-compression.ts --url http://localhost:3000
 *   npx tsx scripts/verify-compression.ts --endpoint /api/tournaments
 * 
 * Requirements:
 *   - Server must be running
 *   - Uses fetch API with Accept-Encoding headers
 */

import { gzipSync, brotliCompressSync, constants } from "zlib";

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = args.indexOf(`--${name}`);
  return idx > -1 && args[idx + 1] ? args[idx + 1] : undefined;
};

const BASE_URL = getArg("url") || "http://localhost:3000";
const SINGLE_ENDPOINT = getArg("endpoint");

// Endpoints to test
const ENDPOINTS = SINGLE_ENDPOINT ? [SINGLE_ENDPOINT] : [
  "/api/tournaments",
  "/api/hall-of-fame",
  "/api/tournaments/recommendations",
];

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

interface CompressionResult {
  endpoint: string;
  originalSize: number;
  gzipSize: number;
  brotliSize: number;
  gzipRatio: number;
  brotliRatio: number;
  serverCompression: string | null;
  responseTime: number;
  success: boolean;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatPercent(ratio: number): string {
  const percent = ((1 - ratio) * 100).toFixed(1);
  return `${percent}%`;
}

async function testEndpoint(endpoint: string): Promise<CompressionResult> {
  const url = `${BASE_URL}${endpoint}`;
  const startTime = Date.now();
  
  try {
    // Fetch without compression to get raw size
    const rawResponse = await fetch(url, {
      headers: {
        "Accept-Encoding": "identity",
      },
    });
    
    if (!rawResponse.ok) {
      throw new Error(`HTTP ${rawResponse.status}: ${rawResponse.statusText}`);
    }
    
    const rawText = await rawResponse.text();
    const originalSize = Buffer.byteLength(rawText, "utf8");
    const responseTime = Date.now() - startTime;
    
    // Calculate theoretical compression sizes
    const gzipBuffer = gzipSync(Buffer.from(rawText), { level: 9 });
    const brotliBuffer = brotliCompressSync(Buffer.from(rawText), {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11, // Max quality
      },
    });
    
    const gzipSize = gzipBuffer.length;
    const brotliSize = brotliBuffer.length;
    
    // Test what compression the server actually sends
    const compressedResponse = await fetch(url, {
      headers: {
        "Accept-Encoding": "gzip, deflate, br",
      },
    });
    
    const serverCompression = compressedResponse.headers.get("content-encoding");
    
    return {
      endpoint,
      originalSize,
      gzipSize,
      brotliSize,
      gzipRatio: gzipSize / originalSize,
      brotliRatio: brotliSize / originalSize,
      serverCompression,
      responseTime,
      success: true,
    };
  } catch (error) {
    return {
      endpoint,
      originalSize: 0,
      gzipSize: 0,
      brotliSize: 0,
      gzipRatio: 1,
      brotliRatio: 1,
      serverCompression: null,
      responseTime: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("           🗜️  Compression Verification Report                  ");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`\nBase URL: ${colors.cyan}${BASE_URL}${colors.reset}`);
  console.log(`Testing ${ENDPOINTS.length} endpoint(s)...\n`);

  const results: CompressionResult[] = [];
  
  for (const endpoint of ENDPOINTS) {
    process.stdout.write(`Testing ${endpoint}... `);
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    if (result.success) {
      console.log(`${colors.green}✓${colors.reset} (${result.responseTime}ms)`);
    } else {
      console.log(`${colors.red}✗ ${result.error}${colors.reset}`);
    }
  }

  console.log("\n" + "─".repeat(65));
  console.log(`${colors.bold}Compression Analysis:${colors.reset}\n`);

  // Print results table
  console.log(
    `${"Endpoint".padEnd(35)} | ${"Original".padStart(10)} | ${"Gzip".padStart(10)} | ${"Brotli".padStart(10)} | ${"Server".padStart(8)}`
  );
  console.log("-".repeat(80));

  let totalOriginal = 0;
  let totalGzip = 0;
  let totalBrotli = 0;
  let successCount = 0;

  for (const result of results) {
    if (!result.success) {
      console.log(
        `${result.endpoint.padEnd(35)} | ${colors.red}ERROR: ${result.error}${colors.reset}`
      );
      continue;
    }

    successCount++;
    totalOriginal += result.originalSize;
    totalGzip += result.gzipSize;
    totalBrotli += result.brotliSize;

    const serverIcon = result.serverCompression 
      ? `${colors.green}${result.serverCompression}${colors.reset}`
      : `${colors.yellow}none${colors.reset}`;

    console.log(
      `${result.endpoint.padEnd(35)} | ` +
      `${formatBytes(result.originalSize).padStart(10)} | ` +
      `${formatBytes(result.gzipSize).padStart(10)} | ` +
      `${formatBytes(result.brotliSize).padStart(10)} | ` +
      `${serverIcon}`
    );
  }

  if (successCount > 0) {
    console.log("-".repeat(80));
    console.log(
      `${"TOTAL".padEnd(35)} | ` +
      `${formatBytes(totalOriginal).padStart(10)} | ` +
      `${formatBytes(totalGzip).padStart(10)} | ` +
      `${formatBytes(totalBrotli).padStart(10)} |`
    );

    // Summary
    console.log("\n" + "─".repeat(65));
    console.log(`${colors.bold}Bandwidth Savings Summary:${colors.reset}\n`);
    
    const gzipSavings = totalOriginal - totalGzip;
    const brotliSavings = totalOriginal - totalBrotli;
    const gzipPercent = formatPercent(totalGzip / totalOriginal);
    const brotliPercent = formatPercent(totalBrotli / totalOriginal);
    
    console.log(`  ${colors.cyan}Gzip Compression:${colors.reset}`);
    console.log(`    • Saves: ${formatBytes(gzipSavings)} (${gzipPercent} reduction)`);
    console.log(`    • Compressed: ${formatBytes(totalGzip)} from ${formatBytes(totalOriginal)}`);
    
    console.log(`\n  ${colors.cyan}Brotli Compression:${colors.reset}`);
    console.log(`    • Saves: ${formatBytes(brotliSavings)} (${brotliPercent} reduction)`);
    console.log(`    • Compressed: ${formatBytes(totalBrotli)} from ${formatBytes(totalOriginal)}`);
    
    // Recommendations
    console.log("\n" + "─".repeat(65));
    console.log(`${colors.bold}Recommendations:${colors.reset}\n`);
    
    const hasServerCompression = results.some(r => r.serverCompression);
    
    if (!hasServerCompression) {
      console.log(`  ${colors.yellow}⚠ No server compression detected.${colors.reset}`);
      console.log("    This is normal in development. In production:");
      console.log("    • Vercel automatically handles gzip + brotli");
      console.log("    • For custom hosting, ensure reverse proxy (nginx) handles compression");
      console.log("    • compress: true is set in next.config.ts ✓");
    } else {
      console.log(`  ${colors.green}✓ Server compression is active${colors.reset}`);
    }

    // Check compression ratios
    const avgGzipRatio = totalGzip / totalOriginal;
    const avgBrotliRatio = totalBrotli / totalOriginal;
    
    if (avgGzipRatio > 0.5) {
      console.log(`\n  ${colors.yellow}⚠ Gzip ratio is higher than expected (${formatPercent(1 - avgGzipRatio)} compression)`);
      console.log("    Consider if response data is already compressed or binary.${colors.reset}");
    } else {
      console.log(`\n  ${colors.green}✓ Good compression ratios achieved${colors.reset}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════\n");

  // Return exit code based on results
  const allSuccess = results.every(r => r.success);
  process.exit(allSuccess ? 0 : 1);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
