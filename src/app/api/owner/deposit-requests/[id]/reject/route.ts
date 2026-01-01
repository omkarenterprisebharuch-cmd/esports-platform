/**
 * Reject Deposit Request API
 * POST /api/owner/deposit-requests/[id]/reject
 * 
 * Owner rejects organizer's deposit request
 */

import { NextRequest } from "next/server";
import { getUserFromRequest, isOwner } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { rejectDepositRequest, getDepositRequestById } from "@/lib/wallet";

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
      return errorResponse("You are not authorized to reject this request", 403);
    }

    if (depositRequest.request_type !== "organizer_to_owner") {
      return errorResponse("Invalid request type for owner rejection", 400);
    }

    const body = await request.json().catch(() => ({}));
    const { note } = body;

    if (!note || note.trim().length === 0) {
      return errorResponse("Please provide a reason for rejection", 400);
    }

    const updatedRequest = await rejectDepositRequest(
      requestId,
      user.id,
      note
    );

    return successResponse(
      { request: updatedRequest },
      "Deposit request rejected"
    );
  } catch (error) {
    console.error("Reject deposit request error:", error);
    
    if (error instanceof Error) {
      if (error.message === "Deposit request not found") {
        return errorResponse("PAY_6005");
      }
      if (error.message === "Deposit request already processed") {
        return errorResponse("PAY_6006");
      }
    }

    return errorResponse(
      error instanceof Error ? error.message : "Failed to reject request",
      500
    );
  }
}
