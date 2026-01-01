/**
 * Organizer Deposit Requests API
 * GET /api/organizer/deposit-requests
 * 
 * List deposit requests from users to organizer
 */

import { NextRequest } from "next/server";
import { getUserFromRequest, isOrganizer } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { getDepositRequestsForTarget, DepositRequestStatus } from "@/lib/wallet";

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isOrganizer(user.role)) {
      return errorResponse("Organizer access required", 403);
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as DepositRequestStatus | null;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Get requests where target is the organizer (user_to_organizer type)
    const { requests, total } = await getDepositRequestsForTarget(
      user.id,
      "user_to_organizer",
      status || undefined,
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
    console.error("Get user deposit requests error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch deposit requests",
      500
    );
  }
}
