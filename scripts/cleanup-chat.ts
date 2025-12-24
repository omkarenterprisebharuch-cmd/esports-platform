#!/usr/bin/env npx tsx
/**
 * Chat Messages Cleanup Script
 * 
 * Deletes chat messages from tournaments that have ended more than 7 days ago.
 * Run this daily via cron job:
 * 
 * Example cron (daily at 3 AM):
 *   0 3 * * * cd /path/to/esports-nextjs && npx tsx scripts/cleanup-chat.ts
 * 
 * Or with Node.js cron scheduler like node-cron in your server.
 */

import { Pool } from "pg";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const DAYS_TO_KEEP = 7; // Keep messages for 7 days after tournament ends

async function cleanupChatMessages() {
  const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME || "esports_platform",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    ssl:
      process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  console.log("🧹 Starting chat messages cleanup...");
  console.log(`   Retention period: ${DAYS_TO_KEEP} days after tournament end`);

  try {
    // Test connection
    await pool.query("SELECT NOW()");
    console.log("✅ Database connected");

    // Get count before deletion
    const countBefore = await pool.query(
      `SELECT COUNT(*) as count FROM chat_messages`
    );
    console.log(`   Total messages before cleanup: ${countBefore.rows[0].count}`);

    // Delete messages from tournaments that ended more than DAYS_TO_KEEP days ago
    const result = await pool.query(
      `DELETE FROM chat_messages
       WHERE tournament_id IN (
         SELECT id FROM tournaments
         WHERE tournament_end_date < NOW() - INTERVAL '${DAYS_TO_KEEP} days'
       )
       RETURNING id`
    );

    const deletedCount = result.rowCount || 0;

    // Get count after deletion
    const countAfter = await pool.query(
      `SELECT COUNT(*) as count FROM chat_messages`
    );

    console.log(`\n📊 Cleanup Results:`);
    console.log(`   Messages deleted: ${deletedCount}`);
    console.log(`   Messages remaining: ${countAfter.rows[0].count}`);

    // Get list of tournaments that had messages cleaned
    const tournamentsResult = await pool.query(
      `SELECT id, tournament_name, tournament_end_date
       FROM tournaments
       WHERE tournament_end_date < NOW() - INTERVAL '${DAYS_TO_KEEP} days'
       AND id NOT IN (SELECT DISTINCT tournament_id FROM chat_messages)
       ORDER BY tournament_end_date DESC
       LIMIT 10`
    );

    if (tournamentsResult.rowCount && tournamentsResult.rowCount > 0) {
      console.log(`\n🏆 Recently cleaned tournaments:`);
      tournamentsResult.rows.forEach((t: { id: number; tournament_name: string; tournament_end_date: Date }) => {
        console.log(`   - ${t.tournament_name} (ID: ${t.id}, ended: ${t.tournament_end_date})`);
      });
    }

    console.log("\n✅ Cleanup completed successfully!");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the cleanup
cleanupChatMessages();
