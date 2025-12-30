/**
 * Process Scheduled Account Deletions
 * 
 * This script processes account deletion requests that have passed
 * the 30-day grace period and executes the data anonymization.
 * 
 * Run this as a daily cron job:
 * - Linux/Mac: 0 2 * * * npx ts-node scripts/process-deletions.ts
 * - Windows Task Scheduler: Schedule to run daily at 2 AM
 * - Cloud: Use your platform's scheduled job feature
 * 
 * Usage: npx ts-node scripts/process-deletions.ts
 */

import "dotenv/config";
import { processScheduledDeletions } from "../src/lib/gdpr";

async function main() {
  console.log("=".repeat(50));
  console.log("Processing Scheduled Account Deletions");
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("=".repeat(50));

  try {
    const processedCount = await processScheduledDeletions();

    if (processedCount === 0) {
      console.log("✅ No accounts to process today.");
    } else {
      console.log(`✅ Successfully processed ${processedCount} account deletion(s)`);
    }

    console.log("\n" + "=".repeat(50));
    console.log("Deletion processing complete");
    console.log("=".repeat(50));

    process.exit(0);
  } catch (error) {
    console.error("❌ Fatal error processing deletions:", error);
    process.exit(1);
  }
}

main();
