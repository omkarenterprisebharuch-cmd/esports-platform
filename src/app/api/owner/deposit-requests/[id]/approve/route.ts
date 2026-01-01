/**
 * Approve Deposit Request API
 * POST /api/owner/deposit-requests/[id]/approve
 * 
 * Owner approves organizer's deposit request
 */

import { NextRequest } from "next/server";
import { getUserFromRequest, isOwner } from "@/lib/auth";
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

    if (!isOwner(user.role)) {
      return errorResponse("Owner access required", 403);
    }

    const { id } = await context.params;
    const requestId = parseInt(id);

    if (isNaN(requestId)) {
      return errorResponse("Invalid request ID", 400);
    }

    // Verify this request is for the owner
    const depositRequest = await getDepositRequestById(requestId);
    if (!depositRequest) {
      return errorResponse("PAY_6005");
    }

    if (depositRequest.target_id !== user.id) {
      return errorResponse("You are not authorized to approve this request", 403);
    }

    if (depositRequest.request_type !== "organizer_to_owner") {
      return errorResponse("Invalid request type for owner approval", 400);
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
    console.error("Approve deposit request error:", error);
    
    // Handle specific errors
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
