/**
 * Wallet Transactions API
 * GET /api/wallet/transactions
 * 
 * Get current user's transaction history
 */

import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { getTransactionHistory, TransactionType } from "@/lib/wallet";

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") as TransactionType | null;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const { transactions, total } = await getTransactionHistory(
      user.id,
      page,
      limit,
      type || undefined
    );

    return successResponse({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch transactions",
      500
    );
  }
}
