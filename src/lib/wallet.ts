/**
 * Wallet Utility Library
 * 
 * Handles all wallet operations including:
 * - Balance queries and updates
 * - Balance hold operations (for waitlist, pending transactions)
 * - Deposit transactions (owner → organizer, organizer → user)
 * - Deposit request management
 * - Transaction history
 * 
 * @module wallet
 */

import pool, { withTransaction, queryOne, query } from "./db";
import { PoolClient } from "pg";

// ============ Types ============

export type TransactionType = 
  | "deposit" 
  | "withdrawal" 
  | "entry_fee" 
  | "prize" 
  | "refund" 
  | "owner_deposit" 
  | "organizer_deposit"
  | "hold_confirmed";

export type TransactionStatus = "pending" | "completed" | "failed";

export type DepositRequestType = "organizer_to_owner" | "user_to_organizer";

export type HoldType = "waitlist_entry_fee" | "pending_withdrawal" | "dispute";

export type HoldStatus = "active" | "released" | "confirmed" | "expired";

export interface BalanceHold {
  id: number;
  user_id: string;
  amount: number;
  hold_type: HoldType;
  status: HoldStatus;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  expires_at: Date | null;
  released_at: Date | null;
  confirmed_at: Date | null;
  transaction_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export type DepositRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface WalletTransaction {
  id: number;
  user_id: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  description: string | null;
  reference_id: string | null;
  from_user_id: string | null;
  balance_before: number | null;
  balance_after: number | null;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  from_username?: string;
}

export interface DepositRequest {
  id: number;
  requester_id: string;
  target_id: string;
  amount: number;
  request_type: DepositRequestType;
  status: DepositRequestStatus;
  requester_note: string | null;
  responder_note: string | null;
  payment_proof_url: string | null;
  payment_reference: string | null;
  processed_by: string | null;
  processed_at: Date | null;
  transaction_id: number | null;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  requester_username?: string;
  requester_email?: string;
  target_username?: string;
  processor_username?: string;
}

// ============ Configuration ============

export const WALLET_CONFIG = {
  MIN_DEPOSIT_AMOUNT: 10,
  MAX_DEPOSIT_AMOUNT: 100000,
  MAX_PENDING_REQUESTS: 5,
  TRANSACTION_PAGE_SIZE: 20,
};

// ============ Balance Operations ============

/**
 * Get user's current wallet balance
 */
export async function getWalletBalance(userId: number | string): Promise<number> {
  const result = await queryOne<{ wallet_balance: number }>(
    "SELECT wallet_balance FROM users WHERE id = $1",
    [userId]
  );
  return result?.wallet_balance ?? 0;
}

/**
 * Update user's wallet balance (internal use - use deposit/debit functions instead)
 */
async function updateBalance(
  client: PoolClient,
  userId: number | string,
  newBalance: number
): Promise<void> {
  await client.query(
    "UPDATE users SET wallet_balance = $1, updated_at = NOW() WHERE id = $2",
    [newBalance, userId]
  );
}

/**
 * Credit amount to user's wallet (add money)
 */
export async function creditWallet(
  userId: number | string,
  amount: number,
  type: TransactionType,
  description: string,
  fromUserId?: number | string,
  referenceId?: string
): Promise<WalletTransaction> {
  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }

  return withTransaction(async (client) => {
    // Get current balance with row lock
    const userResult = await client.query(
      "SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    const balanceBefore = parseFloat(userResult.rows[0].wallet_balance) || 0;
    const balanceAfter = balanceBefore + amount;

    // Update balance
    await updateBalance(client, userId, balanceAfter);

    // Create transaction record
    const txResult = await client.query(
      `INSERT INTO wallet_transactions 
       (user_id, amount, type, status, description, reference_id, from_user_id, balance_before, balance_after)
       VALUES ($1, $2, $3, 'completed', $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, amount, type, description, referenceId, fromUserId, balanceBefore, balanceAfter]
    );

    return txResult.rows[0] as WalletTransaction;
  });
}

/**
 * Debit amount from user's wallet (remove money)
 */
export async function debitWallet(
  userId: number | string,
  amount: number,
  type: TransactionType,
  description: string,
  referenceId?: string
): Promise<WalletTransaction> {
  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }

  return withTransaction(async (client) => {
    // Get current balance with row lock
    const userResult = await client.query(
      "SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    const balanceBefore = parseFloat(userResult.rows[0].wallet_balance) || 0;

    if (balanceBefore < amount) {
      throw new Error("Insufficient balance");
    }

    const balanceAfter = balanceBefore - amount;

    // Update balance
    await updateBalance(client, userId, balanceAfter);

    // Create transaction record
    const txResult = await client.query(
      `INSERT INTO wallet_transactions 
       (user_id, amount, type, status, description, reference_id, balance_before, balance_after)
       VALUES ($1, $2, $3, 'completed', $4, $5, $6, $7)
       RETURNING *`,
      [userId, -amount, type, description, referenceId, balanceBefore, balanceAfter]
    );

    return txResult.rows[0] as WalletTransaction;
  });
}

// ============ Balance Hold Operations ============

/**
 * Get user's current hold balance (amount currently on hold)
 */
export async function getHoldBalance(userId: number | string): Promise<number> {
  const result = await queryOne<{ hold_balance: number }>(
    "SELECT hold_balance FROM users WHERE id = $1",
    [userId]
  );
  return result?.hold_balance ?? 0;
}

/**
 * Get user's available balance (wallet balance minus hold balance)
 */
export async function getAvailableBalance(userId: number | string): Promise<number> {
  const result = await queryOne<{ wallet_balance: number; hold_balance: number }>(
    "SELECT wallet_balance, hold_balance FROM users WHERE id = $1",
    [userId]
  );
  const walletBalance = result?.wallet_balance ?? 0;
  const holdBalance = result?.hold_balance ?? 0;
  return Math.max(0, walletBalance - holdBalance);
}

/**
 * Get user's balance summary (wallet, hold, available)
 */
export async function getBalanceSummary(userId: number | string): Promise<{
  wallet_balance: number;
  hold_balance: number;
  available_balance: number;
}> {
  const result = await queryOne<{ wallet_balance: number; hold_balance: number }>(
    "SELECT wallet_balance, hold_balance FROM users WHERE id = $1",
    [userId]
  );
  const walletBalance = result?.wallet_balance ?? 0;
  const holdBalance = result?.hold_balance ?? 0;
  return {
    wallet_balance: walletBalance,
    hold_balance: holdBalance,
    available_balance: Math.max(0, walletBalance - holdBalance),
  };
}

/**
 * Hold amount from user's wallet
 * This doesn't deduct from wallet_balance, but increases hold_balance
 */
export async function holdBalance(
  userId: number | string,
  amount: number,
  holdType: HoldType,
  referenceType: string,
  referenceId: string,
  description?: string,
  expiresAt?: Date
): Promise<BalanceHold> {
  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }

  return withTransaction(async (client) => {
    // Get current balances with row lock
    const userResult = await client.query(
      "SELECT wallet_balance, hold_balance FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    const walletBalance = parseFloat(userResult.rows[0].wallet_balance) || 0;
    const currentHoldBalance = parseFloat(userResult.rows[0].hold_balance) || 0;
    const availableBalance = walletBalance - currentHoldBalance;

    if (availableBalance < amount) {
      throw new Error(`Insufficient available balance. Available: ₹${availableBalance.toFixed(2)}, Required: ₹${amount}`);
    }

    // Update hold balance
    const newHoldBalance = currentHoldBalance + amount;
    await client.query(
      "UPDATE users SET hold_balance = $1, updated_at = NOW() WHERE id = $2",
      [newHoldBalance, userId]
    );

    // Create hold record
    const holdResult = await client.query(
      `INSERT INTO balance_holds 
       (user_id, amount, hold_type, status, reference_type, reference_id, description, expires_at)
       VALUES ($1, $2, $3, 'active', $4, $5, $6, $7)
       RETURNING *`,
      [userId, amount, holdType, referenceType, referenceId, description, expiresAt]
    );

    return holdResult.rows[0] as BalanceHold;
  });
}

/**
 * Release a hold - return the held amount to available balance
 * Used when: waitlist registration is cancelled, withdrawal request is rejected
 */
export async function releaseHold(
  holdId: number | string,
  reason?: string
): Promise<BalanceHold> {
  return withTransaction(async (client) => {
    // Get hold record with lock
    const holdResult = await client.query(
      "SELECT * FROM balance_holds WHERE id = $1 FOR UPDATE",
      [holdId]
    );

    if (holdResult.rows.length === 0) {
      throw new Error("Hold not found");
    }

    const hold = holdResult.rows[0] as BalanceHold;

    if (hold.status !== "active") {
      throw new Error(`Hold is already ${hold.status}`);
    }

    // Get user's current hold balance with lock
    const userResult = await client.query(
      "SELECT hold_balance FROM users WHERE id = $1 FOR UPDATE",
      [hold.user_id]
    );

    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    const currentHoldBalance = parseFloat(userResult.rows[0].hold_balance) || 0;
    const newHoldBalance = Math.max(0, currentHoldBalance - hold.amount);

    // Update user's hold balance
    await client.query(
      "UPDATE users SET hold_balance = $1, updated_at = NOW() WHERE id = $2",
      [newHoldBalance, hold.user_id]
    );

    // Update hold status
    const updatedHoldResult = await client.query(
      `UPDATE balance_holds 
       SET status = 'released', 
           released_at = NOW(), 
           description = COALESCE($2, description),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [holdId, reason ? `${hold.description} - Released: ${reason}` : null]
    );

    return updatedHoldResult.rows[0] as BalanceHold;
  });
}

/**
 * Release a hold by reference (e.g., tournament registration ID)
 * Convenience method to release hold without knowing the hold ID
 */
export async function releaseHoldByReference(
  referenceType: string,
  referenceId: string,
  reason?: string
): Promise<BalanceHold | null> {
  // Find active hold for this reference
  const holdResult = await queryOne<BalanceHold>(
    `SELECT * FROM balance_holds 
     WHERE reference_type = $1 AND reference_id = $2 AND status = 'active'`,
    [referenceType, referenceId]
  );

  if (!holdResult) {
    return null;
  }

  return releaseHold(holdResult.id, reason);
}

/**
 * Confirm a hold - deduct the held amount from wallet
 * Used when: waitlist user is promoted to tournament, withdrawal is processed
 */
export async function confirmHold(
  holdId: number | string,
  transactionType: TransactionType = "hold_confirmed",
  description?: string
): Promise<{ hold: BalanceHold; transaction: WalletTransaction }> {
  return withTransaction(async (client) => {
    // Get hold record with lock
    const holdResult = await client.query(
      "SELECT * FROM balance_holds WHERE id = $1 FOR UPDATE",
      [holdId]
    );

    if (holdResult.rows.length === 0) {
      throw new Error("Hold not found");
    }

    const hold = holdResult.rows[0] as BalanceHold;

    if (hold.status !== "active") {
      throw new Error(`Hold is already ${hold.status}`);
    }

    // Get user's current balances with lock
    const userResult = await client.query(
      "SELECT wallet_balance, hold_balance FROM users WHERE id = $1 FOR UPDATE",
      [hold.user_id]
    );

    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    const walletBalance = parseFloat(userResult.rows[0].wallet_balance) || 0;
    const currentHoldBalance = parseFloat(userResult.rows[0].hold_balance) || 0;

    // Deduct from both wallet_balance and hold_balance
    const newWalletBalance = Math.max(0, walletBalance - hold.amount);
    const newHoldBalance = Math.max(0, currentHoldBalance - hold.amount);

    // Update user's balances
    await client.query(
      "UPDATE users SET wallet_balance = $1, hold_balance = $2, updated_at = NOW() WHERE id = $3",
      [newWalletBalance, newHoldBalance, hold.user_id]
    );

    // Create transaction record
    const txDescription = description || `Hold confirmed: ${hold.description || hold.hold_type}`;
    const txResult = await client.query(
      `INSERT INTO wallet_transactions 
       (user_id, amount, type, status, description, reference_id, balance_before, balance_after)
       VALUES ($1, $2, $3, 'completed', $4, $5, $6, $7)
       RETURNING *`,
      [
        hold.user_id, 
        -hold.amount, 
        transactionType, 
        txDescription, 
        hold.reference_id,
        walletBalance, 
        newWalletBalance
      ]
    );

    const transaction = txResult.rows[0] as WalletTransaction;

    // Update hold status
    const updatedHoldResult = await client.query(
      `UPDATE balance_holds 
       SET status = 'confirmed', 
           confirmed_at = NOW(), 
           transaction_id = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [holdId, transaction.id]
    );

    return {
      hold: updatedHoldResult.rows[0] as BalanceHold,
      transaction,
    };
  });
}

/**
 * Confirm a hold by reference (e.g., tournament registration ID)
 * Convenience method to confirm hold without knowing the hold ID
 */
export async function confirmHoldByReference(
  referenceType: string,
  referenceId: string,
  transactionType: TransactionType = "entry_fee",
  description?: string
): Promise<{ hold: BalanceHold; transaction: WalletTransaction } | null> {
  // Find active hold for this reference
  const holdResult = await queryOne<BalanceHold>(
    `SELECT * FROM balance_holds 
     WHERE reference_type = $1 AND reference_id = $2 AND status = 'active'`,
    [referenceType, referenceId]
  );

  if (!holdResult) {
    return null;
  }

  return confirmHold(holdResult.id, transactionType, description);
}

/**
 * Get all active holds for a user
 */
export async function getUserActiveHolds(
  userId: number | string
): Promise<BalanceHold[]> {
  const result = await query<BalanceHold>(
    `SELECT * FROM balance_holds 
     WHERE user_id = $1 AND status = 'active'
     ORDER BY created_at DESC`,
    [userId]
  );
  return result;
}

/**
 * Get hold by reference
 */
export async function getHoldByReference(
  referenceType: string,
  referenceId: string
): Promise<BalanceHold | null> {
  const result = await queryOne<BalanceHold>(
    `SELECT * FROM balance_holds 
     WHERE reference_type = $1 AND reference_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [referenceType, referenceId]
  );
  return result;
}

/**
 * Get all holds for a user (with pagination)
 */
export async function getUserHolds(
  userId: number | string,
  status?: HoldStatus,
  page: number = 1,
  limit: number = 20
): Promise<{ holds: BalanceHold[]; total: number }> {
  const offset = (page - 1) * limit;
  
  let whereClause = "WHERE user_id = $1";
  const params: (string | number)[] = [userId as number];
  let paramIndex = 2;

  if (status) {
    whereClause += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) as count FROM balance_holds ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  params.push(limit, offset);
  const dataResult = await pool.query(
    `SELECT * FROM balance_holds 
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  return {
    holds: dataResult.rows as BalanceHold[],
    total,
  };
}

/**
 * Expire holds that have passed their expiry time
 * This should be run periodically (e.g., via cron job)
 */
export async function expireHolds(): Promise<number> {
  return withTransaction(async (client) => {
    // Find expired holds
    const expiredHolds = await client.query(
      `SELECT * FROM balance_holds 
       WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()
       FOR UPDATE`,
      []
    );

    let expiredCount = 0;

    for (const hold of expiredHolds.rows) {
      // Get user's current hold balance with lock
      const userResult = await client.query(
        "SELECT hold_balance FROM users WHERE id = $1 FOR UPDATE",
        [hold.user_id]
      );

      if (userResult.rows.length > 0) {
        const currentHoldBalance = parseFloat(userResult.rows[0].hold_balance) || 0;
        const newHoldBalance = Math.max(0, currentHoldBalance - hold.amount);

        // Update user's hold balance
        await client.query(
          "UPDATE users SET hold_balance = $1, updated_at = NOW() WHERE id = $2",
          [newHoldBalance, hold.user_id]
        );
      }

      // Update hold status
      await client.query(
        `UPDATE balance_holds 
         SET status = 'expired', 
             released_at = NOW(),
             description = COALESCE(description, '') || ' - Expired',
             updated_at = NOW()
         WHERE id = $1`,
        [hold.id]
      );

      expiredCount++;
    }

    return expiredCount;
  });
}

// ============ Deposit Operations ============

/**
 * Owner deposits to organizer's wallet
 */
export async function ownerDepositToOrganizer(
  ownerId: number | string,
  organizerId: number | string,
  amount: number,
  description?: string
): Promise<WalletTransaction> {
  // Verify organizer exists and has organizer role
  const organizer = await queryOne<{ id: number; role: string; username: string }>(
    "SELECT id, role, username FROM users WHERE id = $1",
    [organizerId]
  );

  if (!organizer) {
    throw new Error("Organizer not found");
  }

  if (organizer.role !== "organizer") {
    throw new Error("Target user is not an organizer");
  }

  const desc = description || `Deposit from platform owner`;
  
  return creditWallet(
    organizerId,
    amount,
    "owner_deposit",
    desc,
    ownerId
  );
}

/**
 * Organizer deposits to user's wallet
 * This debits from organizer and credits to user
 */
export async function organizerDepositToUser(
  organizerId: number | string,
  userId: number | string,
  amount: number,
  description?: string
): Promise<{ debitTransaction: WalletTransaction; creditTransaction: WalletTransaction }> {
  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }

  // Verify user exists
  const user = await queryOne<{ id: string; username: string }>(
    "SELECT id, username FROM users WHERE id = $1",
    [userId]
  );

  if (!user) {
    throw new Error("User not found");
  }

  return withTransaction(async (client) => {
    // Get organizer's balance with lock
    const organizerResult = await client.query(
      "SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE",
      [organizerId]
    );

    if (organizerResult.rows.length === 0) {
      throw new Error("Organizer not found");
    }

    const organizerBalanceBefore = parseFloat(organizerResult.rows[0].wallet_balance) || 0;

    if (organizerBalanceBefore < amount) {
      throw new Error("Insufficient balance");
    }

    const organizerBalanceAfter = organizerBalanceBefore - amount;

    // Get user's balance with lock
    const userResult = await client.query(
      "SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    const userBalanceBefore = parseFloat(userResult.rows[0].wallet_balance) || 0;
    const userBalanceAfter = userBalanceBefore + amount;

    // Update organizer's balance (debit)
    await client.query(
      "UPDATE users SET wallet_balance = $1, updated_at = NOW() WHERE id = $2",
      [organizerBalanceAfter, organizerId]
    );

    // Update user's balance (credit)
    await client.query(
      "UPDATE users SET wallet_balance = $1, updated_at = NOW() WHERE id = $2",
      [userBalanceAfter, userId]
    );

    const desc = description || `Deposit to user ${user.username}`;

    // Create debit transaction for organizer
    const debitTxResult = await client.query(
      `INSERT INTO wallet_transactions 
       (user_id, amount, type, status, description, from_user_id, balance_before, balance_after)
       VALUES ($1, $2, 'organizer_deposit', 'completed', $3, $4, $5, $6)
       RETURNING *`,
      [organizerId, -amount, `Transfer to ${user.username}`, userId, organizerBalanceBefore, organizerBalanceAfter]
    );

    // Create credit transaction for user
    const creditTxResult = await client.query(
      `INSERT INTO wallet_transactions 
       (user_id, amount, type, status, description, from_user_id, balance_before, balance_after)
       VALUES ($1, $2, 'organizer_deposit', 'completed', $3, $4, $5, $6)
       RETURNING *`,
      [userId, amount, desc, organizerId, userBalanceBefore, userBalanceAfter]
    );

    return {
      debitTransaction: debitTxResult.rows[0] as WalletTransaction,
      creditTransaction: creditTxResult.rows[0] as WalletTransaction,
    };
  });
}

// ============ Deposit Request Operations ============

/**
 * Create a deposit request
 */
export async function createDepositRequest(
  requesterId: number | string,
  targetId: number | string,
  amount: number,
  requestType: DepositRequestType,
  note?: string,
  paymentProofUrl?: string,
  paymentReference?: string
): Promise<DepositRequest> {
  // Validate amount
  if (amount < WALLET_CONFIG.MIN_DEPOSIT_AMOUNT) {
    throw new Error(`Minimum deposit amount is ₹${WALLET_CONFIG.MIN_DEPOSIT_AMOUNT}`);
  }

  if (amount > WALLET_CONFIG.MAX_DEPOSIT_AMOUNT) {
    throw new Error(`Maximum deposit amount is ₹${WALLET_CONFIG.MAX_DEPOSIT_AMOUNT}`);
  }

  // Check pending requests limit
  const pendingCount = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM deposit_requests 
     WHERE requester_id = $1 AND status = 'pending'`,
    [requesterId]
  );

  if ((pendingCount?.count || 0) >= WALLET_CONFIG.MAX_PENDING_REQUESTS) {
    throw new Error("Maximum pending requests limit reached");
  }

  const result = await pool.query(
    `INSERT INTO deposit_requests 
     (requester_id, target_id, amount, request_type, requester_note, payment_proof_url, payment_reference)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [requesterId, targetId, amount, requestType, note, paymentProofUrl, paymentReference]
  );

  return result.rows[0] as DepositRequest;
}

/**
 * Get deposit requests for a target (owner or organizer reviewing requests)
 */
export async function getDepositRequestsForTarget(
  targetId: number | string,
  requestType?: DepositRequestType,
  status?: DepositRequestStatus,
  page: number = 1,
  limit: number = 20
): Promise<{ requests: DepositRequest[]; total: number }> {
  const offset = (page - 1) * limit;
  
  let whereClause = "WHERE dr.target_id = $1";
  const params: (string | number)[] = [targetId as number];
  let paramIndex = 2;

  if (requestType) {
    whereClause += ` AND dr.request_type = $${paramIndex}`;
    params.push(requestType);
    paramIndex++;
  }

  if (status) {
    whereClause += ` AND dr.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  // Count query
  const countResult = await pool.query(
    `SELECT COUNT(*) as count FROM deposit_requests dr ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Data query with joins
  params.push(limit, offset);
  const dataResult = await pool.query(
    `SELECT 
      dr.*,
      requester.username as requester_username,
      requester.email as requester_email,
      target.username as target_username,
      processor.username as processor_username
     FROM deposit_requests dr
     LEFT JOIN users requester ON dr.requester_id = requester.id
     LEFT JOIN users target ON dr.target_id = target.id
     LEFT JOIN users processor ON dr.processed_by = processor.id
     ${whereClause}
     ORDER BY 
       CASE WHEN dr.status = 'pending' THEN 0 ELSE 1 END,
       dr.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  return {
    requests: dataResult.rows as DepositRequest[],
    total,
  };
}

/**
 * Get deposit requests made by a user (requester viewing their own requests)
 */
export async function getMyDepositRequests(
  requesterId: number | string,
  page: number = 1,
  limit: number = 20
): Promise<{ requests: DepositRequest[]; total: number }> {
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    "SELECT COUNT(*) as count FROM deposit_requests WHERE requester_id = $1",
    [requesterId]
  );
  const total = parseInt(countResult.rows[0].count);

  const dataResult = await pool.query(
    `SELECT 
      dr.*,
      target.username as target_username,
      processor.username as processor_username
     FROM deposit_requests dr
     LEFT JOIN users target ON dr.target_id = target.id
     LEFT JOIN users processor ON dr.processed_by = processor.id
     WHERE dr.requester_id = $1
     ORDER BY dr.created_at DESC
     LIMIT $2 OFFSET $3`,
    [requesterId, limit, offset]
  );

  return {
    requests: dataResult.rows as DepositRequest[],
    total,
  };
}

/**
 * Approve a deposit request and credit the wallet
 * For user_to_organizer requests, this also debits from the organizer
 */
export async function approveDepositRequest(
  requestId: number | string,
  processorId: number | string,
  responderNote?: string
): Promise<{ request: DepositRequest; transaction: WalletTransaction; debitTransaction?: WalletTransaction }> {
  return withTransaction(async (client) => {
    // Lock the deposit request first
    const lockResult = await client.query(
      `SELECT * FROM deposit_requests WHERE id = $1 FOR UPDATE`,
      [requestId]
    );

    if (lockResult.rows.length === 0) {
      throw new Error("Deposit request not found");
    }

    // Now get full details with join (no lock needed, already locked above)
    const requestResult = await client.query(
      `SELECT dr.*, requester.username as requester_username 
       FROM deposit_requests dr
       LEFT JOIN users requester ON dr.requester_id = requester.id
       WHERE dr.id = $1`,
      [requestId]
    );

    const request = requestResult.rows[0] as DepositRequest;

    if (request.status !== "pending") {
      throw new Error("Deposit request already processed");
    }

    if (request.requester_id === processorId) {
      throw new Error("Cannot approve your own request");
    }

    // Determine transaction type based on request type
    const transactionType: TransactionType = 
      request.request_type === "organizer_to_owner" 
        ? "owner_deposit" 
        : "organizer_deposit";

    const depositAmount = parseFloat(String(request.amount)) || 0;
    let debitTransaction: WalletTransaction | undefined;

    // For user_to_organizer requests, debit from the organizer (processor)
    if (request.request_type === "user_to_organizer") {
      // Get processor's (organizer's) balance with lock
      const processorResult = await client.query(
        "SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE",
        [processorId]
      );

      if (processorResult.rows.length === 0) {
        throw new Error("Processor not found");
      }

      const processorBalanceBefore = parseFloat(processorResult.rows[0].wallet_balance) || 0;

      if (processorBalanceBefore < depositAmount) {
        throw new Error("Insufficient balance to approve this request");
      }

      const processorBalanceAfter = processorBalanceBefore - depositAmount;

      // Debit from processor (organizer)
      await client.query(
        "UPDATE users SET wallet_balance = $1, updated_at = NOW() WHERE id = $2",
        [processorBalanceAfter, processorId]
      );

      // Create debit transaction for processor
      const debitTxResult = await client.query(
        `INSERT INTO wallet_transactions 
         (user_id, amount, type, status, description, reference_id, from_user_id, balance_before, balance_after)
         VALUES ($1, $2, $3, 'completed', $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          processorId, 
          -depositAmount, 
          transactionType, 
          `Transfer to ${request.requester_username || 'user'} (request #${request.id})`, 
          `deposit_request_${request.id}`,
          request.requester_id,
          processorBalanceBefore, 
          processorBalanceAfter
        ]
      );
      debitTransaction = debitTxResult.rows[0] as WalletTransaction;
    }

    // Get requester's current balance with lock
    const userResult = await client.query(
      "SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE",
      [request.requester_id]
    );

    if (userResult.rows.length === 0) {
      throw new Error("Requester not found");
    }

    const balanceBefore = parseFloat(userResult.rows[0].wallet_balance) || 0;
    const balanceAfter = balanceBefore + depositAmount;

    // Credit requester's balance
    await client.query(
      "UPDATE users SET wallet_balance = $1, updated_at = NOW() WHERE id = $2",
      [balanceAfter, request.requester_id]
    );

    // Create credit transaction record for requester
    const description = `Deposit request #${request.id} approved`;
    const txResult = await client.query(
      `INSERT INTO wallet_transactions 
       (user_id, amount, type, status, description, reference_id, from_user_id, balance_before, balance_after)
       VALUES ($1, $2, $3, 'completed', $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        request.requester_id, 
        depositAmount, 
        transactionType, 
        description, 
        `deposit_request_${request.id}`,
        processorId,
        balanceBefore, 
        balanceAfter
      ]
    );

    const transaction = txResult.rows[0] as WalletTransaction;

    // Update request status
    await client.query(
      `UPDATE deposit_requests 
       SET status = 'approved', 
           processed_by = $1, 
           processed_at = NOW(), 
           responder_note = $2,
           transaction_id = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [processorId, responderNote, transaction.id, requestId]
    );

    // Fetch updated request
    const updatedResult = await client.query(
      "SELECT * FROM deposit_requests WHERE id = $1",
      [requestId]
    );

    return {
      request: updatedResult.rows[0] as DepositRequest,
      transaction,
      debitTransaction,
    };
  });
}

/**
 * Reject a deposit request
 */
export async function rejectDepositRequest(
  requestId: number | string,
  processorId: number | string,
  responderNote?: string
): Promise<DepositRequest> {
  // Get request first
  const requestResult = await pool.query(
    "SELECT * FROM deposit_requests WHERE id = $1",
    [requestId]
  );

  if (requestResult.rows.length === 0) {
    throw new Error("Deposit request not found");
  }

  const request = requestResult.rows[0] as DepositRequest;

  if (request.status !== "pending") {
    throw new Error("Deposit request already processed");
  }

  // Update request status
  await pool.query(
    `UPDATE deposit_requests 
     SET status = 'rejected', 
         processed_by = $1, 
         processed_at = NOW(), 
         responder_note = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [processorId, responderNote || "Request rejected", requestId]
  );

  // Fetch updated request
  const updatedResult = await pool.query(
    "SELECT * FROM deposit_requests WHERE id = $1",
    [requestId]
  );

  return updatedResult.rows[0] as DepositRequest;
}

/**
 * Cancel a deposit request (by requester)
 */
export async function cancelDepositRequest(
  requestId: number | string,
  requesterId: number | string
): Promise<DepositRequest> {
  const requestResult = await pool.query(
    "SELECT * FROM deposit_requests WHERE id = $1",
    [requestId]
  );

  if (requestResult.rows.length === 0) {
    throw new Error("Deposit request not found");
  }

  const request = requestResult.rows[0] as DepositRequest;

  if (request.requester_id !== requesterId) {
    throw new Error("You can only cancel your own requests");
  }

  if (request.status !== "pending") {
    throw new Error("Can only cancel pending requests");
  }

  await pool.query(
    `UPDATE deposit_requests 
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1`,
    [requestId]
  );

  const updatedResult = await pool.query(
    "SELECT * FROM deposit_requests WHERE id = $1",
    [requestId]
  );

  return updatedResult.rows[0] as DepositRequest;
}

// ============ Transaction History ============

/**
 * Get wallet transaction history for a user
 */
export async function getTransactionHistory(
  userId: number | string,
  page: number = 1,
  limit: number = WALLET_CONFIG.TRANSACTION_PAGE_SIZE,
  type?: TransactionType
): Promise<{ transactions: WalletTransaction[]; total: number }> {
  const offset = (page - 1) * limit;

  let whereClause = "WHERE wt.user_id = $1";
  const params: (string | number)[] = [userId as number];
  let paramIndex = 2;

  if (type) {
    whereClause += ` AND wt.type = $${paramIndex}`;
    params.push(type);
    paramIndex++;
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) as count FROM wallet_transactions wt ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  params.push(limit, offset);
  const dataResult = await pool.query(
    `SELECT 
      wt.*,
      from_user.username as from_username
     FROM wallet_transactions wt
     LEFT JOIN users from_user ON wt.from_user_id = from_user.id
     ${whereClause}
     ORDER BY wt.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  return {
    transactions: dataResult.rows as WalletTransaction[],
    total,
  };
}

/**
 * Get all organizers for owner deposit selection
 */
export async function getOrganizers(): Promise<{ id: string; username: string; email: string; wallet_balance: number }[]> {
  const result = await pool.query(
    `SELECT id, username, email, wallet_balance 
     FROM users 
     WHERE role = 'organizer' AND is_active = true
     ORDER BY username ASC`
  );
  return result.rows;
}

/**
 * Get all users for organizer deposit selection
 */
export async function getUsers(
  search?: string,
  page: number = 1,
  limit: number = 20
): Promise<{ users: { id: number; username: string; email: string; wallet_balance: number }[]; total: number }> {
  const offset = (page - 1) * limit;

  let whereClause = "WHERE is_active = true";
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (search) {
    whereClause += ` AND (username ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) as count FROM users ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  params.push(limit, offset);
  const dataResult = await pool.query(
    `SELECT id, username, email, wallet_balance 
     FROM users 
     ${whereClause}
     ORDER BY username ASC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  return {
    users: dataResult.rows,
    total,
  };
}

/**
 * Get deposit request by ID
 */
export async function getDepositRequestById(
  requestId: number | string
): Promise<DepositRequest | null> {
  const result = await pool.query(
    `SELECT 
      dr.*,
      requester.username as requester_username,
      requester.email as requester_email,
      target.username as target_username,
      processor.username as processor_username
     FROM deposit_requests dr
     LEFT JOIN users requester ON dr.requester_id = requester.id
     LEFT JOIN users target ON dr.target_id = target.id
     LEFT JOIN users processor ON dr.processed_by = processor.id
     WHERE dr.id = $1`,
    [requestId]
  );

  return result.rows[0] as DepositRequest | null;
}

/**
 * Get pending deposit request counts
 */
export async function getPendingRequestCounts(
  userId: number | string,
  role: "owner" | "organizer"
): Promise<{ incoming: number; outgoing: number }> {
  const incomingResult = await pool.query(
    `SELECT COUNT(*) as count FROM deposit_requests 
     WHERE target_id = $1 AND status = 'pending'`,
    [userId]
  );

  const outgoingResult = await pool.query(
    `SELECT COUNT(*) as count FROM deposit_requests 
     WHERE requester_id = $1 AND status = 'pending'`,
    [userId]
  );

  return {
    incoming: parseInt(incomingResult.rows[0].count),
    outgoing: parseInt(outgoingResult.rows[0].count),
  };
}
