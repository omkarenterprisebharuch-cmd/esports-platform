/**
 * Organizer Approve User Deposit Request API
 * POST /api/organizer/deposit-requests/[id]/approve
 * 
 * Organizer approves user's deposit request
 */

import { NextRequest } from "next/server";
import { getUserFromRequest, isOrganizer } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { approveDepositRequest, getDepositRequestById } from "@/lib/wallet";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isOrganizer(user.role)) {
      return errorResponse("Organizer access required", 403);
    }

    const { id } = await context.params;
    const requestId = parseInt(id);

    if (isNaN(requestId)) {
      return errorResponse("Invalid request ID", 400);
    }

    // Verify this request is for the organizer
    const depositRequest = await getDepositRequestById(requestId);
    if (!depositRequest) {
      return errorResponse("PAY_6005");
    }

    if (depositRequest.target_id !== user.id) {
      return errorResponse("You are not authorized to approve this request", 403);
    }

    if (depositRequest.request_type !== "user_to_organizer") {
      return errorResponse("Invalid request type for organizer approval", 400);
    }

    const body = await request.json().catch(() => ({}));
    const { note } = body;

    const { request: updatedRequest, transaction } = await approveDepositRequest(
      requestId,
      user.id,
      note
    );

    return successResponse(
      {
        request: updatedRequest,
        transaction,
      },
      `Deposit request approved. ₹${depositRequest.amount} credited to ${depositRequest.requester_username}'s wallet.`
    );
  } catch (error) {
    console.error("Approve user deposit request error:", error);
    
    if (error instanceof Error) {
      if (error.message === "Deposit request not found") {
        return errorResponse("PAY_6005");
      }
      if (error.message === "Deposit request already processed") {
        return errorResponse("PAY_6006");
      }
      if (error.message === "Cannot approve your own request") {
        return errorResponse("PAY_6007");
      }
    }

    return errorResponse(
      error instanceof Error ? error.message : "Failed to approve request",
      500
    );
  }
}
