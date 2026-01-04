/**
 * User Request Deposit API
 * POST /api/wallet/request-deposit
 * 
 * User creates a deposit request to an organizer
 */

import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { createDepositRequest, WALLET_CONFIG } from "@/lib/wallet";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { organizerId, amount, note, paymentProofUrl, paymentReference } = body;

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

    // Verify organizer exists and has organizer role
    const organizerResult = await pool.query(
      "SELECT id, username, role FROM users WHERE id = $1 AND is_active = true",
      [organizerId]
    );

    if (organizerResult.rows.length === 0) {
      return errorResponse("Organizer not found", 400);
    }

    const organizer = organizerResult.rows[0];
    if (organizer.role !== "organizer" && organizer.role !== "owner") {
      return errorResponse("Selected user is not an organizer", 400);
    }

    // Cannot request from self
    if (organizer.id === user.id) {
      return errorResponse("Cannot request deposit from yourself", 400);
    }

    // Create the deposit request
    const depositRequest = await createDepositRequest(
      user.id,
      organizerId,
      amountNum,
      "user_to_organizer",
      note,
      paymentProofUrl,
      paymentReference
    );

    return successResponse(
      { request: depositRequest },
      `Deposit request for ₹${amountNum} submitted to ${organizer.username}. Awaiting approval.`,
      201
    );
  } catch (error) {
    console.error("User request deposit error:", error);

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
