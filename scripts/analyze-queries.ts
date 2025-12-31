/**
 * Database Query Analysis Script
 * 
 * Utilities for analyzing query performance, index usage,
 * and identifying slow queries.
 * 
 * Usage: npx tsx scripts/analyze-queries.ts [command]
 * 
 * Commands:
 *   indexes     - Show all indexes and their usage stats
 *   unused      - Find unused or rarely used indexes
 *   missing     - Find tables that might need indexes (high seq scans)
 *   explain     - Run EXPLAIN ANALYZE on common queries
 *   stats       - Show table statistics
 *   all         - Run all analyses
 */

import { config } from "dotenv";
import { Pool } from "pg";
import * as readline from "readline";

// Load environment variables
config({ path: ".env.local" });

// Allow self-signed certificates for cloud database providers
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface IndexUsage {
  table: string;
  index: string;
  times_used: number;
  tuples_read: number;
  index_size: string;
}

interface TableStats {
  table: string;
  seq_scan: number;
  seq_tup_read: number;
  idx_scan: number;
  idx_tup_fetch: number;
  index_usage_percent: number;
  row_estimate: number;
}

interface ExplainResult {
  "QUERY PLAN": string;
}

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function header(title: string): void {
  console.log("\n" + "=".repeat(60));
  log(` ${title}`, colors.bright + colors.cyan);
  console.log("=".repeat(60));
}

async function showIndexUsage(): Promise<void> {
  header("INDEX USAGE STATISTICS");

  const result = await pool.query<IndexUsage>(`
    SELECT 
      schemaname || '.' || relname AS table,
      indexrelname AS index,
      idx_scan as times_used,
      idx_tup_read as tuples_read,
      pg_size_pretty(pg_relation_size(indexrelid)) as index_size
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    ORDER BY idx_scan DESC
    LIMIT 30
  `);

  console.log("\nTop 30 Most Used Indexes:");
  console.log("-".repeat(80));
  console.log(
    `${"Index".padEnd(45)} ${"Uses".padStart(10)} ${"Tuples".padStart(12)} ${"Size".padStart(10)}`
  );
  console.log("-".repeat(80));

  for (const row of result.rows) {
    const usageColor =
      row.times_used > 1000
        ? colors.green
        : row.times_used > 100
        ? colors.yellow
        : colors.red;
    console.log(
      `${row.index.substring(0, 44).padEnd(45)} ${usageColor}${String(
        row.times_used
      ).padStart(10)}${colors.reset} ${String(row.tuples_read).padStart(12)} ${row.index_size.padStart(10)}`
    );
  }
}

async function findUnusedIndexes(): Promise<void> {
  header("UNUSED OR RARELY USED INDEXES");

  const result = await pool.query<IndexUsage>(`
    SELECT
      schemaname || '.' || relname AS table,
      indexrelname AS index,
      idx_scan as times_used,
      idx_tup_read as tuples_read,
      pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size
    FROM pg_stat_user_indexes ui
    JOIN pg_index i ON ui.indexrelid = i.indexrelid
    WHERE NOT indisunique
      AND NOT indisprimary
      AND idx_scan < 50
      AND schemaname = 'public'
    ORDER BY pg_relation_size(i.indexrelid) DESC
  `);

  if (result.rows.length === 0) {
    log("\n✅ No unused indexes found!", colors.green);
    return;
  }

  console.log("\nIndexes used less than 50 times (candidates for removal):");
  console.log("-".repeat(80));
  console.log(
    `${"Index".padEnd(45)} ${"Uses".padStart(10)} ${"Size".padStart(10)}`
  );
  console.log("-".repeat(80));

  let totalWastedSize = 0;
  for (const row of result.rows) {
    log(
      `${row.index.substring(0, 44).padEnd(45)} ${String(row.times_used).padStart(10)} ${row.index_size.padStart(10)}`,
      colors.yellow
    );
    // Parse size for total (rough estimate)
    const sizeMatch = row.index_size.match(/(\d+)\s*(kB|MB|GB)/);
    if (sizeMatch) {
      const size = parseInt(sizeMatch[1]);
      const unit = sizeMatch[2];
      totalWastedSize +=
        unit === "GB" ? size * 1024 : unit === "MB" ? size : size / 1024;
    }
  }

  console.log("-".repeat(80));
  log(
    `Potential space savings: ~${totalWastedSize.toFixed(2)} MB`,
    colors.cyan
  );
  log(
    "\n⚠️  Review carefully before dropping - some indexes may be needed for rare queries",
    colors.yellow
  );
}

async function findMissingIndexes(): Promise<void> {
  header("TABLES THAT MAY NEED INDEXES");
  console.log("(Tables with high sequential scans vs index scans)\n");

  const result = await pool.query<TableStats>(`
    SELECT 
      schemaname || '.' || relname AS table,
      seq_scan,
      seq_tup_read,
      COALESCE(idx_scan, 0) as idx_scan,
      COALESCE(idx_tup_fetch, 0) as idx_tup_fetch,
      CASE WHEN seq_scan > 0 
        THEN round(100.0 * COALESCE(idx_scan, 0) / (seq_scan + COALESCE(idx_scan, 0)), 2) 
        ELSE 100 
      END as index_usage_percent,
      n_live_tup as row_estimate
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
      AND seq_scan > 50
    ORDER BY seq_tup_read DESC
    LIMIT 20
  `);

  console.log(
    `${"Table".padEnd(35)} ${"Seq Scans".padStart(12)} ${"Idx %".padStart(8)} ${"~Rows".padStart(10)}`
  );
  console.log("-".repeat(70));

  for (const row of result.rows) {
    const color =
      row.index_usage_percent < 50
        ? colors.red
        : row.index_usage_percent < 80
        ? colors.yellow
        : colors.green;
    console.log(
      `${row.table.substring(0, 34).padEnd(35)} ${String(row.seq_scan).padStart(12)} ${color}${String(row.index_usage_percent).padStart(7)}%${colors.reset} ${String(row.row_estimate).padStart(10)}`
    );
  }

  log(
    "\n📊 Tables with <80% index usage may benefit from additional indexes",
    colors.cyan
  );
}

async function runExplainAnalyze(): Promise<void> {
  header("QUERY PLAN ANALYSIS");
  console.log(
    "Running EXPLAIN ANALYZE on common query patterns...\n"
  );

  // Common queries to analyze
  const queries = [
    {
      name: "Tournament List (Active)",
      sql: `
        SELECT t.*, u.username as host_name
        FROM tournaments t
        JOIN users u ON t.host_id = u.id
        WHERE t.status IN ('upcoming', 'registration_open', 'ongoing')
        AND (t.is_template = FALSE OR t.is_template IS NULL)
        ORDER BY t.registration_start_date ASC
        LIMIT 50
      `,
    },
    {
      name: "User Registrations Count",
      sql: `
        SELECT COUNT(*) 
        FROM tournament_registrations 
        WHERE tournament_id = (SELECT id FROM tournaments LIMIT 1)
        AND status != 'cancelled'
      `,
    },
    {
      name: "Hall of Fame - Top Players",
      sql: `
        SELECT 
          u.id,
          u.username,
          COUNT(DISTINCT CASE WHEN tl.position = 1 THEN tl.tournament_id END) as wins
        FROM users u
        INNER JOIN tournament_leaderboard tl ON u.id = tl.user_id
        INNER JOIN tournaments t ON tl.tournament_id = t.id
        WHERE t.status = 'completed'
        GROUP BY u.id, u.username
        ORDER BY wins DESC
        LIMIT 10
      `,
    },
    {
      name: "Unread Notifications Count",
      sql: `
        SELECT COUNT(*) 
        FROM notifications 
        WHERE user_id = (SELECT id FROM users LIMIT 1)
        AND is_read = FALSE
      `,
    },
    {
      name: "Login History Check",
      sql: `
        SELECT COUNT(*) 
        FROM login_history 
        WHERE ip_address = '192.168.1.1'
        AND status = 'failed'
        AND created_at >= NOW() - INTERVAL '15 minutes'
      `,
    },
  ];

  for (const query of queries) {
    log(`\n📋 ${query.name}`, colors.bright + colors.blue);
    console.log("-".repeat(50));

    try {
      const result = await pool.query<ExplainResult>(
        `EXPLAIN (ANALYZE, COSTS, BUFFERS, FORMAT TEXT) ${query.sql}`
      );

      let hasSeqScan = false;
      let executionTime = "";

      for (const row of result.rows) {
        const plan = row["QUERY PLAN"];

        // Highlight issues
        if (plan.includes("Seq Scan")) {
          hasSeqScan = true;
          log(plan, colors.yellow);
        } else if (plan.includes("Index")) {
          log(plan, colors.green);
        } else if (plan.includes("Execution Time")) {
          executionTime = plan;
          console.log(plan);
        } else {
          console.log(plan);
        }
      }

      if (hasSeqScan) {
        log("⚠️  Sequential scan detected - may benefit from an index", colors.yellow);
      }
    } catch (error) {
      log(`Error analyzing query: ${(error as Error).message}`, colors.red);
    }
  }
}

async function showTableStats(): Promise<void> {
  header("TABLE STATISTICS");

  const result = await pool.query(`
    SELECT 
      schemaname || '.' || relname AS table,
      n_live_tup as live_rows,
      n_dead_tup as dead_rows,
      last_vacuum::date as last_vacuum,
      last_autovacuum::date as last_autovacuum,
      last_analyze::date as last_analyze,
      pg_size_pretty(pg_total_relation_size(relid)) as total_size
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY n_live_tup DESC
    LIMIT 20
  `);

  console.log(
    `${"Table".padEnd(35)} ${"Rows".padStart(10)} ${"Dead".padStart(8)} ${"Last Analyze".padStart(14)} ${"Size".padStart(10)}`
  );
  console.log("-".repeat(85));

  for (const row of result.rows) {
    const deadRowRatio =
      row.live_rows > 0 ? row.dead_rows / row.live_rows : 0;
    const deadColor = deadRowRatio > 0.1 ? colors.yellow : colors.reset;

    console.log(
      `${row.table.substring(0, 34).padEnd(35)} ${String(row.live_rows).padStart(10)} ${deadColor}${String(row.dead_rows).padStart(8)}${colors.reset} ${(row.last_analyze || "Never").toString().padStart(14)} ${row.total_size.padStart(10)}`
    );
  }

  log(
    "\n💡 Run VACUUM ANALYZE on tables with high dead row counts",
    colors.cyan
  );
}

async function showDatabaseSize(): Promise<void> {
  header("DATABASE SIZE OVERVIEW");

  const dbSize = await pool.query(`
    SELECT pg_size_pretty(pg_database_size(current_database())) as size
  `);

  const tablesSizes = await pool.query(`
    SELECT 
      relname as table,
      pg_size_pretty(pg_total_relation_size(relid)) as total_size,
      pg_size_pretty(pg_relation_size(relid)) as data_size,
      pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) as index_size
    FROM pg_catalog.pg_statio_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 15
  `);

  log(`\nTotal Database Size: ${dbSize.rows[0].size}`, colors.bright);
  console.log("\nTop 15 Tables by Size:");
  console.log("-".repeat(70));
  console.log(
    `${"Table".padEnd(30)} ${"Total".padStart(12)} ${"Data".padStart(12)} ${"Indexes".padStart(12)}`
  );
  console.log("-".repeat(70));

  for (const row of tablesSizes.rows) {
    console.log(
      `${row.table.padEnd(30)} ${row.total_size.padStart(12)} ${row.data_size.padStart(12)} ${row.index_size.padStart(12)}`
    );
  }
}

async function runAllAnalyses(): Promise<void> {
  await showDatabaseSize();
  await showTableStats();
  await showIndexUsage();
  await findUnusedIndexes();
  await findMissingIndexes();
  await runExplainAnalyze();
}

async function interactiveMode(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  header("DATABASE QUERY ANALYZER");
  console.log("\nAvailable commands:");
  console.log("  indexes  - Show index usage statistics");
  console.log("  unused   - Find unused indexes");
  console.log("  missing  - Find tables needing indexes");
  console.log("  explain  - Run EXPLAIN ANALYZE on common queries");
  console.log("  stats    - Show table statistics");
  console.log("  size     - Show database size overview");
  console.log("  all      - Run all analyses");
  console.log("  exit     - Exit the analyzer\n");

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  let running = true;
  while (running) {
    const cmd = await question("\n> ");

    switch (cmd.trim().toLowerCase()) {
      case "indexes":
        await showIndexUsage();
        break;
      case "unused":
        await findUnusedIndexes();
        break;
      case "missing":
        await findMissingIndexes();
        break;
      case "explain":
        await runExplainAnalyze();
        break;
      case "stats":
        await showTableStats();
        break;
      case "size":
        await showDatabaseSize();
        break;
      case "all":
        await runAllAnalyses();
        break;
      case "exit":
      case "quit":
      case "q":
        running = false;
        break;
      default:
        log("Unknown command. Type 'exit' to quit.", colors.yellow);
    }
  }

  rl.close();
}

// Main execution
async function main(): Promise<void> {
  const command = process.argv[2]?.toLowerCase();

  try {
    // Test connection
    await pool.query("SELECT 1");
    log("✅ Connected to database", colors.green);

    switch (command) {
      case "indexes":
        await showIndexUsage();
        break;
      case "unused":
        await findUnusedIndexes();
        break;
      case "missing":
        await findMissingIndexes();
        break;
      case "explain":
        await runExplainAnalyze();
        break;
      case "stats":
        await showTableStats();
        break;
      case "size":
        await showDatabaseSize();
        break;
      case "all":
        await runAllAnalyses();
        break;
      case undefined:
      case "":
      case "interactive":
      case "-i":
        await interactiveMode();
        break;
      default:
        log(`Unknown command: ${command}`, colors.red);
        console.log("\nUsage: npx tsx scripts/analyze-queries.ts [command]");
        console.log("\nCommands: indexes, unused, missing, explain, stats, size, all");
    }
  } catch (error) {
    log(`Error: ${(error as Error).message}`, colors.red);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
