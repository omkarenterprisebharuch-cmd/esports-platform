/**
 * Organizer Deposit to User API
 * POST /api/organizer/deposit
 * 
 * Direct deposit from organizer to user wallet
 */

import { NextRequest } from "next/server";
import { getUserFromRequest, isOrganizer } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { organizerDepositToUser, WALLET_CONFIG } from "@/lib/wallet";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isOrganizer(user.role)) {
      return errorResponse("Organizer access required", 403);
    }

    const body = await request.json();
    const { userId, amount, description } = body;

    // Validation
    if (!userId) {
      return errorResponse("User ID is required", 400);
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return errorResponse("PAY_6002");
    }

    if (amountNum < WALLET_CONFIG.MIN_DEPOSIT_AMOUNT) {
      return errorResponse("PAY_6011");
    }

    if (amountNum > WALLET_CONFIG.MAX_DEPOSIT_AMOUNT) {
      return errorResponse("PAY_6010");
    }

    // Verify user exists
    const userResult = await pool.query(
      "SELECT id, username FROM users WHERE id = $1 AND is_active = true",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return errorResponse("PAY_6009");
    }

    const targetUser = userResult.rows[0];

    // Cannot deposit to self
    if (targetUser.id === user.id) {
      return errorResponse("Cannot deposit to your own wallet", 400);
    }

    // Execute deposit (debits from organizer, credits to user)
    const { creditTransaction, debitTransaction } = await organizerDepositToUser(
      user.id,
      userId,
      amountNum,
      description || `Deposit from organizer`
    );

    return successResponse(
      {
        creditTransaction,
        debitTransaction,
        username: targetUser.username,
      },
      `Successfully transferred ₹${amountNum} to ${targetUser.username}'s wallet`
    );
  } catch (error) {
    console.error("Organizer deposit error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to process deposit",
      500
    );
  }
}
