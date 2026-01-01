/**
 * Get Organizers API
 * GET /api/wallet/organizers
 * 
 * Get list of organizers for users to request deposits from
 */

import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { getOrganizers } from "@/lib/wallet";

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const organizers = await getOrganizers();

    // Don't expose wallet balance to regular users
    const safeOrganizers = organizers.map(org => ({
      id: org.id,
      username: org.username,
    }));

    return successResponse({ organizers: safeOrganizers });
  } catch (error) {
    console.error("Get organizers error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch organizers",
      500
    );
  }
}
