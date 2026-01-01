/**
 * Wallet Balance API
 * GET /api/wallet/balance
 * 
 * Get current user's wallet balance
 */

import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { successResponse, unauthorizedResponse } from "@/lib/api-response";
import { getWalletBalance, getPendingRequestCounts } from "@/lib/wallet";

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const balance = await getWalletBalance(user.id);
    
    // Get pending request counts for organizers
    let pendingCounts = { incoming: 0, outgoing: 0 };
    if (user.role === "organizer" || user.role === "owner") {
      pendingCounts = await getPendingRequestCounts(user.id, user.role);
    }

    return successResponse({
      balance,
      pendingRequests: pendingCounts,
    });
  } catch (error) {
    console.error("Get wallet balance error:", error);
    return successResponse({ balance: 0 });
  }
}
