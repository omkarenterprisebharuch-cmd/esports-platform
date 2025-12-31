#!/usr/bin/env npx tsx
/**
 * CDN Cache Verification Script
 * 
 * Tests cache headers on various endpoints to verify CDN configuration.
 * 
 * Usage:
 *   npx tsx scripts/verify-cdn.ts [--url <base-url>]
 * 
 * Examples:
 *   npx tsx scripts/verify-cdn.ts
 *   npx tsx scripts/verify-cdn.ts --url https://your-domain.com
 */

const BASE_URL = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "http://localhost:3000";

// ANSI colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

interface CacheTest {
  name: string;
  path: string;
  expectedMaxAge: number;
  expectedDirectives: string[];
  expectCacheable: boolean;
}

const CACHE_TESTS: CacheTest[] = [
  {
    name: "API - Tournaments",
    path: "/api/tournaments?limit=1",
    expectedMaxAge: 30,
    expectedDirectives: ["public", "stale-while-revalidate"],
    expectCacheable: true,
  },
  {
    name: "API - Hall of Fame",
    path: "/api/hall-of-fame?limit=1",
    expectedMaxAge: 300,
    expectedDirectives: ["public", "stale-while-revalidate"],
    expectCacheable: true,
  },
  {
    name: "Static Page - Privacy Policy",
    path: "/privacy-policy",
    expectedMaxAge: 86400,
    expectedDirectives: ["public"],
    expectCacheable: true,
  },
  {
    name: "Static Page - Terms",
    path: "/terms",
    expectedMaxAge: 86400,
    expectedDirectives: ["public"],
    expectCacheable: true,
  },
  {
    name: "ISR Page - Leaderboard",
    path: "/leaderboard",
    expectedMaxAge: 300,
    expectedDirectives: ["public", "stale-while-revalidate"],
    expectCacheable: true,
  },
  {
    name: "PWA - Manifest",
    path: "/manifest.json",
    expectedMaxAge: 86400,
    expectedDirectives: ["public"],
    expectCacheable: true,
  },
  {
    name: "PWA - Service Worker",
    path: "/sw.js",
    expectedMaxAge: 0,
    expectedDirectives: ["must-revalidate"],
    expectCacheable: false,
  },
  {
    name: "Protected API - Auth Check",
    path: "/api/auth/me",
    expectedMaxAge: 0,
    expectedDirectives: [],
    expectCacheable: false, // Should NOT be cached (private data)
  },
];

interface TestResult {
  test: CacheTest;
  status: number;
  cacheControl: string | null;
  cdnCacheControl: string | null;
  age: string | null;
  xCache: string | null;
  vary: string | null;
  passed: boolean;
  issues: string[];
}

async function testEndpoint(test: CacheTest): Promise<TestResult> {
  const url = `${BASE_URL}${test.path}`;
  const issues: string[] = [];

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept-Encoding": "gzip, deflate, br",
      },
    });

    const cacheControl = response.headers.get("cache-control");
    const cdnCacheControl = response.headers.get("cdn-cache-control");
    const age = response.headers.get("age");
    const xCache = response.headers.get("x-cache") || 
                   response.headers.get("x-vercel-cache") || 
                   response.headers.get("cf-cache-status");
    const vary = response.headers.get("vary");

    // Analyze cache-control header
    let passed = true;

    if (test.expectCacheable) {
      if (!cacheControl) {
        issues.push("Missing Cache-Control header");
        passed = false;
      } else {
        // Check max-age
        const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
        if (maxAgeMatch) {
          const actualMaxAge = parseInt(maxAgeMatch[1], 10);
          if (actualMaxAge < test.expectedMaxAge) {
            issues.push(`max-age=${actualMaxAge} is less than expected ${test.expectedMaxAge}`);
            passed = false;
          }
        } else if (test.expectedMaxAge > 0) {
          issues.push("Missing max-age directive");
          passed = false;
        }

        // Check expected directives
        for (const directive of test.expectedDirectives) {
          if (!cacheControl.toLowerCase().includes(directive.toLowerCase())) {
            issues.push(`Missing '${directive}' directive`);
            passed = false;
          }
        }
      }
    } else {
      // Should NOT be cacheable
      if (cacheControl) {
        const hasNoStore = cacheControl.includes("no-store");
        const hasNoCache = cacheControl.includes("no-cache");
        const hasPrivate = cacheControl.includes("private");
        const maxAgeZero = cacheControl.includes("max-age=0");
        
        if (!hasNoStore && !hasNoCache && !hasPrivate && !maxAgeZero) {
          issues.push("Response may be incorrectly cached (should be private/no-store)");
          passed = false;
        }
      }
    }

    return {
      test,
      status: response.status,
      cacheControl,
      cdnCacheControl,
      age,
      xCache,
      vary,
      passed,
      issues,
    };
  } catch (error) {
    return {
      test,
      status: 0,
      cacheControl: null,
      cdnCacheControl: null,
      age: null,
      xCache: null,
      vary: null,
      passed: false,
      issues: [`Request failed: ${error instanceof Error ? error.message : "Unknown error"}`],
    };
  }
}

function formatResult(result: TestResult): void {
  const statusColor = result.passed ? colors.green : colors.red;
  const statusIcon = result.passed ? "✓" : "✗";
  
  console.log(`\n${statusColor}${statusIcon}${colors.reset} ${colors.bright}${result.test.name}${colors.reset}`);
  console.log(`  ${colors.dim}Path:${colors.reset} ${result.test.path}`);
  console.log(`  ${colors.dim}Status:${colors.reset} ${result.status}`);
  
  if (result.cacheControl) {
    console.log(`  ${colors.dim}Cache-Control:${colors.reset} ${result.cacheControl}`);
  }
  
  if (result.cdnCacheControl) {
    console.log(`  ${colors.dim}CDN-Cache-Control:${colors.reset} ${result.cdnCacheControl}`);
  }
  
  if (result.xCache) {
    const cacheHit = result.xCache.toUpperCase().includes("HIT");
    const cacheColor = cacheHit ? colors.green : colors.yellow;
    console.log(`  ${colors.dim}CDN Status:${colors.reset} ${cacheColor}${result.xCache}${colors.reset}`);
  }
  
  if (result.age) {
    console.log(`  ${colors.dim}Age:${colors.reset} ${result.age}s`);
  }
  
  if (result.vary) {
    console.log(`  ${colors.dim}Vary:${colors.reset} ${result.vary}`);
  }
  
  if (result.issues.length > 0) {
    console.log(`  ${colors.yellow}Issues:${colors.reset}`);
    for (const issue of result.issues) {
      console.log(`    - ${issue}`);
    }
  }
}

async function main(): Promise<void> {
  console.log(`${colors.bright}${colors.cyan}CDN Cache Verification${colors.reset}`);
  console.log(`${colors.dim}Testing: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.dim}${"=".repeat(50)}${colors.reset}`);

  const results: TestResult[] = [];
  
  for (const test of CACHE_TESTS) {
    const result = await testEndpoint(test);
    results.push(result);
    formatResult(result);
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\n${colors.dim}${"=".repeat(50)}${colors.reset}`);
  console.log(`${colors.bright}Summary${colors.reset}`);
  console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`  ${colors.dim}Total:  ${results.length}${colors.reset}`);

  // CDN-specific advice
  console.log(`\n${colors.bright}${colors.cyan}CDN Integration Tips${colors.reset}`);
  console.log(`${colors.dim}${"─".repeat(50)}${colors.reset}`);
  
  const hasXCache = results.some(r => r.xCache);
  if (!hasXCache) {
    console.log(`
${colors.yellow}⚠ No CDN cache headers detected${colors.reset}

If running locally, this is expected. In production:

${colors.bright}Vercel:${colors.reset}
  - Automatic CDN caching based on Cache-Control headers
  - Check x-vercel-cache header for HIT/MISS/STALE

${colors.bright}Cloudflare:${colors.reset}
  - Check cf-cache-status header
  - Set Page Rules for static assets: Cache Level = Cache Everything
  - Enable "Browser Cache TTL: Respect Existing Headers"

${colors.bright}Custom CDN:${colors.reset}
  - Ensure origin Cache-Control headers are respected
  - Configure x-cache header for debugging
`);
  } else {
    const hitCount = results.filter(r => r.xCache?.toUpperCase().includes("HIT")).length;
    const hitRate = ((hitCount / results.filter(r => r.xCache).length) * 100).toFixed(1);
    console.log(`\n${colors.green}CDN detected! Cache hit rate: ${hitRate}%${colors.reset}`);
  }

  // Exit with error if any tests failed
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
