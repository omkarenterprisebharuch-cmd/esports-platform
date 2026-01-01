/**
 * Fix Wallet Balances Script
 * 
 * This script recalculates wallet balances for all users based on their
 * wallet_transactions history. Use this to fix any incorrect balances
 * caused by bugs or data inconsistencies.
 * 
 * Usage: npx ts-node scripts/fix-wallet-balances.ts [userId]
 * 
 * If userId is provided, only that user's balance will be fixed.
 * If no userId is provided, all users with transactions will be checked.
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface UserBalance {
  user_id: string;
  username: string;
  current_balance: number;
  calculated_balance: number;
  difference: number;
}

async function calculateCorrectBalance(userId: string): Promise<number> {
  // Sum all transactions for this user
  // Positive amounts are credits, negative amounts are debits
  const result = await pool.query(
    `SELECT COALESCE(SUM(amount::numeric), 0) as total 
     FROM wallet_transactions 
     WHERE user_id = $1 AND status = 'completed'`,
    [userId]
  );
  
  return parseFloat(result.rows[0].total) || 0;
}

async function getUsersWithTransactions(): Promise<string[]> {
  const result = await pool.query(
    `SELECT DISTINCT user_id FROM wallet_transactions`
  );
  return result.rows.map(row => row.user_id);
}

async function getUserInfo(userId: string): Promise<{ username: string; wallet_balance: number } | null> {
  const result = await pool.query(
    `SELECT username, wallet_balance FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function updateUserBalance(userId: string, newBalance: number): Promise<void> {
  await pool.query(
    `UPDATE users SET wallet_balance = $1, updated_at = NOW() WHERE id = $2`,
    [newBalance, userId]
  );
}

async function fixBalances(specificUserId?: string): Promise<void> {
  console.log("=".repeat(60));
  console.log("Wallet Balance Fix Script");
  console.log("=".repeat(60));
  console.log("");

  const userIds = specificUserId 
    ? [specificUserId] 
    : await getUsersWithTransactions();

  if (userIds.length === 0) {
    console.log("No users with wallet transactions found.");
    return;
  }

  console.log(`Checking ${userIds.length} user(s)...\n`);

  const discrepancies: UserBalance[] = [];

  for (const userId of userIds) {
    const userInfo = await getUserInfo(userId);
    if (!userInfo) {
      console.log(`⚠️  User ${userId} not found in users table`);
      continue;
    }

    const currentBalance = parseFloat(String(userInfo.wallet_balance)) || 0;
    const calculatedBalance = await calculateCorrectBalance(userId);
    const difference = calculatedBalance - currentBalance;

    if (Math.abs(difference) > 0.01) { // Allow for small floating point differences
      discrepancies.push({
        user_id: userId,
        username: userInfo.username,
        current_balance: currentBalance,
        calculated_balance: calculatedBalance,
        difference: difference,
      });
    }
  }

  if (discrepancies.length === 0) {
    console.log("✅ All wallet balances are correct!");
    return;
  }

  console.log(`Found ${discrepancies.length} balance discrepancy(ies):\n`);
  console.table(discrepancies.map(d => ({
    User: d.username,
    "Current Balance": `₹${d.current_balance.toLocaleString()}`,
    "Correct Balance": `₹${d.calculated_balance.toLocaleString()}`,
    "Difference": `₹${d.difference.toLocaleString()}`,
  })));

  console.log("\nFixing balances...\n");

  for (const discrepancy of discrepancies) {
    try {
      await updateUserBalance(discrepancy.user_id, discrepancy.calculated_balance);
      console.log(
        `✅ Fixed ${discrepancy.username}: ₹${discrepancy.current_balance} → ₹${discrepancy.calculated_balance}`
      );
    } catch (error) {
      console.error(`❌ Failed to fix ${discrepancy.username}:`, error);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Balance fix complete!");
  console.log("=".repeat(60));
}

async function main() {
  const specificUserId = process.argv[2];
  
  if (specificUserId) {
    console.log(`Fixing balance for specific user: ${specificUserId}\n`);
  }

  try {
    await fixBalances(specificUserId);
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
