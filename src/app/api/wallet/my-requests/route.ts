/**
 * User My Deposit Requests API
 * GET /api/wallet/my-requests
 * 
 * Get user's own deposit requests
 */

import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { getMyDepositRequests, cancelDepositRequest } from "@/lib/wallet";

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const { requests, total } = await getMyDepositRequests(
      user.id,
      page,
      limit
    );

    return successResponse({
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get my requests error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch your requests",
      500
    );
  }
}

/**
 * DELETE /api/wallet/my-requests
 * Cancel a pending deposit request
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { requestId } = body;

    if (!requestId) {
      return errorResponse("Request ID is required", 400);
    }

    const updatedRequest = await cancelDepositRequest(requestId, user.id);

    return successResponse(
      { request: updatedRequest },
      "Deposit request cancelled"
    );
  } catch (error) {
    console.error("Cancel request error:", error);

    if (error instanceof Error) {
      if (error.message === "Deposit request not found") {
        return errorResponse("PAY_6005");
      }
      if (error.message.includes("only cancel your own")) {
        return errorResponse("You can only cancel your own requests", 403);
      }
      if (error.message.includes("pending requests")) {
        return errorResponse("PAY_6006");
      }
    }

    return errorResponse(
      error instanceof Error ? error.message : "Failed to cancel request",
      500
    );
  }
}
