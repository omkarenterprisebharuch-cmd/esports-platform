/**
 * Owner Deposit API
 * POST /api/owner/deposit
 * 
 * Direct deposit from owner to organizer wallet
 */

import { NextRequest } from "next/server";
import { getUserFromRequest, isOwner } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { ownerDepositToOrganizer, WALLET_CONFIG } from "@/lib/wallet";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isOwner(user.role)) {
      return errorResponse("Owner access required", 403);
    }

    const body = await request.json();
    const { organizerId, amount, description } = body;

    // Validation
    if (!organizerId) {
      return errorResponse("Organizer ID is required", 400);
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

    // Verify organizer exists and has correct role
    const organizerResult = await pool.query(
      "SELECT id, username, role FROM users WHERE id = $1",
      [organizerId]
    );

    if (organizerResult.rows.length === 0) {
      return errorResponse("PAY_6009");
    }

    const organizer = organizerResult.rows[0];
    if (organizer.role !== "organizer") {
      return errorResponse("PAY_6008");
    }

    // Execute deposit
    const transaction = await ownerDepositToOrganizer(
      user.id,
      organizerId,
      amountNum,
      description || `Deposit from platform owner`
    );

    return successResponse(
      {
        transaction,
        organizerUsername: organizer.username,
      },
      `Successfully deposited ₹${amountNum} to ${organizer.username}'s wallet`
    );
  } catch (error) {
    console.error("Owner deposit error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to process deposit",
      500
    );
  }
}
