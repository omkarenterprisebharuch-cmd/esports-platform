import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { z } from "zod";
import { validateWithSchema, validationErrorResponse } from "@/lib/validations";
import {
  recordConsent,
  hasAcceptedPrivacyPolicy,
  PRIVACY_POLICY_VERSION,
  TERMS_VERSION,
} from "@/lib/gdpr";
import pool from "@/lib/db";

// Schema for consent
const consentSchema = z.object({
  consentType: z.enum(["privacy_policy", "terms_of_service", "marketing"]),
  consented: z.boolean(),
});

/**
 * GET /api/users/privacy-consent
 * Get user's consent status
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const result = await pool.query(
      `SELECT 
         privacy_policy_accepted_at,
         privacy_policy_version,
         terms_accepted_at,
         terms_version
       FROM users WHERE id = $1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return errorResponse("User not found", 404);
    }

    const userData = result.rows[0];

    return successResponse({
      privacyPolicy: {
        accepted: !!userData.privacy_policy_accepted_at,
        acceptedAt: userData.privacy_policy_accepted_at,
        acceptedVersion: userData.privacy_policy_version,
        currentVersion: PRIVACY_POLICY_VERSION,
        needsUpdate: userData.privacy_policy_version !== PRIVACY_POLICY_VERSION,
      },
      termsOfService: {
        accepted: !!userData.terms_accepted_at,
        acceptedAt: userData.terms_accepted_at,
        acceptedVersion: userData.terms_version,
        currentVersion: TERMS_VERSION,
        needsUpdate: userData.terms_version !== TERMS_VERSION,
      },
    });
  } catch (error) {
    console.error("Get consent status error:", error);
    return serverErrorResponse(error);
  }
}

/**
 * POST /api/users/privacy-consent
 * Record user consent
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();

    const validation = validateWithSchema(consentSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }

    const { consentType, consented } = validation.data;

    // Get IP and user agent for audit
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                      request.headers.get("x-real-ip") || 
                      undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    // Determine version based on consent type
    const version = consentType === "privacy_policy" 
      ? PRIVACY_POLICY_VERSION 
      : consentType === "terms_of_service" 
        ? TERMS_VERSION 
        : "1.0";

    await recordConsent(user.id, {
      consentType,
      version,
      consented,
      ipAddress,
      userAgent,
    });

    return successResponse(
      { recorded: true },
      `${consentType.replace("_", " ")} consent recorded successfully`
    );
  } catch (error) {
    console.error("Record consent error:", error);
    return serverErrorResponse(error);
  }
}
