/**
 * Organizer My Requests API
 * GET /api/organizer/my-requests
 * 
 * Get organizer's own deposit requests to owner
 */

import { NextRequest } from "next/server";
import { getUserFromRequest, isOrganizer } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { getMyDepositRequests } from "@/lib/wallet";

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
