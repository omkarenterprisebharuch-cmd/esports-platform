import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";

// Serverless configuration - index analysis is infrequent
export const maxDuration = 30;
export const dynamic = "force-dynamic";

interface IndexStats {
  table: string;
  index: string;
  times_used: number;
  tuples_read: number;
  tuples_fetched: number;
  index_size: string;
}

interface TableStats {
  table: string;
  seq_scan: number;
  idx_scan: number;
  index_usage_percent: number;
  live_rows: number;
  dead_rows: number;
  last_analyze: string | null;
}

/**
 * GET /api/owner/db-indexes
 * Get database index usage statistics and recommendations
 * Owner only endpoint for database performance monitoring
 */
export async function GET(request: NextRequest) {
  try {
    // Require owner role
    const user = requireOwner(request);
    if (!user) {
      return unauthorizedResponse("Owner access required");
    }

    // Get index usage stats
    const indexStatsResult = await pool.query<IndexStats>(`
      SELECT 
        schemaname || '.' || tablename AS table,
        indexname AS index,
        idx_scan as times_used,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY idx_scan DESC
      LIMIT 50
    `);

    // Find unused indexes
    const unusedIndexesResult = await pool.query(`
      SELECT
        schemaname || '.' || relname AS table,
        indexrelname AS index,
        idx_scan as times_used,
        pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size
      FROM pg_stat_user_indexes ui
      JOIN pg_index i ON ui.indexrelid = i.indexrelid
      WHERE NOT indisunique
        AND NOT indisprimary
        AND idx_scan < 50
        AND schemaname = 'public'
      ORDER BY pg_relation_size(i.indexrelid) DESC
      LIMIT 20
    `);

    // Get table stats for index coverage
    const tableStatsResult = await pool.query<TableStats>(`
      SELECT 
        schemaname || '.' || relname AS table,
        seq_scan,
        COALESCE(idx_scan, 0) as idx_scan,
        CASE WHEN seq_scan > 0 
          THEN round(100.0 * COALESCE(idx_scan, 0) / (seq_scan + COALESCE(idx_scan, 0)), 2) 
          ELSE 100 
        END as index_usage_percent,
        n_live_tup as live_rows,
        n_dead_tup as dead_rows,
        last_analyze::text as last_analyze
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_live_tup DESC
      LIMIT 30
    `);

    // Get total index count and size
    const indexSummaryResult = await pool.query(`
      SELECT 
        COUNT(*) as total_indexes,
        pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_index_size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
    `);

    // Get database size
    const dbSizeResult = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);

    // Generate recommendations
    const recommendations: string[] = [];

    // Check for tables with low index usage
    const lowIndexTables = tableStatsResult.rows.filter(
      (t) => t.index_usage_percent < 70 && t.live_rows > 1000
    );
    if (lowIndexTables.length > 0) {
      recommendations.push(
        `⚠️ ${lowIndexTables.length} table(s) have less than 70% index usage with >1000 rows. Consider adding indexes.`
      );
    }

    // Check for unused indexes
    if (unusedIndexesResult.rows.length > 5) {
      recommendations.push(
        `🔍 ${unusedIndexesResult.rows.length} indexes are rarely used (<50 times). Review for potential removal.`
      );
    }

    // Check for tables needing ANALYZE
    const tablesNeedingAnalyze = tableStatsResult.rows.filter(
      (t) => !t.last_analyze && t.live_rows > 100
    );
    if (tablesNeedingAnalyze.length > 0) {
      recommendations.push(
        `📊 ${tablesNeedingAnalyze.length} table(s) have never been analyzed. Run ANALYZE to update statistics.`
      );
    }

    // Check for tables with high dead rows
    const tablesWithDeadRows = tableStatsResult.rows.filter(
      (t) => t.live_rows > 0 && t.dead_rows / t.live_rows > 0.1
    );
    if (tablesWithDeadRows.length > 0) {
      recommendations.push(
        `🧹 ${tablesWithDeadRows.length} table(s) have >10% dead rows. Consider running VACUUM.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ Database indexes are well-optimized!");
    }

    return successResponse({
      summary: {
        databaseSize: dbSizeResult.rows[0]?.size || "Unknown",
        totalIndexes: parseInt(indexSummaryResult.rows[0]?.total_indexes) || 0,
        totalIndexSize: indexSummaryResult.rows[0]?.total_index_size || "0 bytes",
      },
      indexStats: indexStatsResult.rows.map((row) => ({
        table: row.table,
        index: row.index,
        timesUsed: row.times_used,
        tuplesRead: row.tuples_read,
        tuplesFetched: row.tuples_fetched,
        indexSize: row.index_size,
      })),
      unusedIndexes: unusedIndexesResult.rows.map((row) => ({
        table: row.table,
        index: row.index,
        timesUsed: row.times_used,
        indexSize: row.index_size,
      })),
      tableStats: tableStatsResult.rows.map((row) => ({
        table: row.table,
        seqScans: row.seq_scan,
        indexScans: row.idx_scan,
        indexUsagePercent: row.index_usage_percent,
        liveRows: row.live_rows,
        deadRows: row.dead_rows,
        lastAnalyze: row.last_analyze,
      })),
      recommendations,
    });
  } catch (error) {
    console.error("Database index stats error:", error);
    return serverErrorResponse(error);
  }
}
