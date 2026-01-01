/**
 * Organizer Request Deposit API
 * POST /api/organizer/request-deposit
 * 
 * Organizer creates a deposit request to owner
 */

import { NextRequest } from "next/server";
import { getUserFromRequest, isOrganizer } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { createDepositRequest, WALLET_CONFIG } from "@/lib/wallet";
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

    // Organizers cannot use this endpoint (only organizers can)
    if (user.role === "owner") {
      return errorResponse("Owners cannot request deposits", 400);
    }

    const body = await request.json();
    const { amount, note, paymentProofUrl, paymentReference } = body;

    // Validation
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

    // Find an owner to send the request to
    // In this system, we send to the first/primary owner
    const ownerResult = await pool.query(
      "SELECT id, username FROM users WHERE role = 'owner' AND is_active = true ORDER BY id ASC LIMIT 1"
    );

    if (ownerResult.rows.length === 0) {
      return errorResponse("No platform owner found", 500);
    }

    const owner = ownerResult.rows[0];

    // Create the deposit request
    const depositRequest = await createDepositRequest(
      user.id,
      owner.id,
      amountNum,
      "organizer_to_owner",
      note,
      paymentProofUrl,
      paymentReference
    );

    return successResponse(
      { request: depositRequest },
      `Deposit request for ₹${amountNum} submitted successfully. Awaiting owner approval.`,
      201
    );
  } catch (error) {
    console.error("Organizer request deposit error:", error);

    if (error instanceof Error) {
      if (error.message.includes("Minimum deposit")) {
        return errorResponse("PAY_6011");
      }
      if (error.message.includes("Maximum deposit")) {
        return errorResponse("PAY_6010");
      }
      if (error.message.includes("pending requests")) {
        return errorResponse("PAY_6012");
      }
    }

    return errorResponse(
      error instanceof Error ? error.message : "Failed to create deposit request",
      500
    );
  }
}
