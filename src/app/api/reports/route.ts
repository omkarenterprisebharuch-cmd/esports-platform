/**
 * Reports API - Player Reporting System
 * 
 * POST - Submit a new report
 * GET - List reports (admin only) or user's own reports
 */

import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, requireOwner } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { sanitizeText } from "@/lib/sanitize";
import { z } from "zod";

// Serverless configuration - reports are moderately frequent
export const maxDuration = 15;
export const dynamic = "force-dynamic";

// Validation schema for new report
const createReportSchema = z.object({
  reported_user_id: z.number().optional(),
  reported_game_id: z.string().min(1).max(100),
  reported_game_type: z.enum(["freefire", "pubg", "valorant", "codm", "bgmi"]),
  tournament_id: z.number().optional(),
  match_id: z.number().optional(),
  category_id: z.number(),
  subcategory_id: z.number().optional(),
  description: z.string().min(10).max(2000),
  evidence_urls: z.array(z.string().url()).max(5).optional(),
});

/**
 * POST /api/reports - Submit a new player report
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const validation = createReportSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(validation.error.errors[0]?.message || "Invalid input", 400);
    }

    const data = validation.data;

    // Sanitize description
    const sanitizedDescription = sanitizeText(data.description);

    // Verify category exists and is a main category
    const categoryResult = await pool.query(
      "SELECT id, parent_id FROM report_categories WHERE id = $1 AND is_active = TRUE",
      [data.category_id]
    );

    if (categoryResult.rows.length === 0) {
      return errorResponse("Invalid category", 400);
    }

    // If subcategory provided, verify it belongs to the category
    if (data.subcategory_id) {
      const subcategoryResult = await pool.query(
        "SELECT id FROM report_categories WHERE id = $1 AND parent_id = $2 AND is_active = TRUE",
        [data.subcategory_id, data.category_id]
      );

      if (subcategoryResult.rows.length === 0) {
        return errorResponse("Invalid subcategory for this category", 400);
      }
    }

    // Check if user has already reported this game ID recently (prevent spam)
    const recentReportResult = await pool.query(
      `SELECT id FROM player_reports 
       WHERE reporter_id = $1 
       AND reported_game_id = $2 
       AND reported_game_type = $3 
       AND created_at > NOW() - INTERVAL '24 hours'`,
      [user.id, data.reported_game_id, data.reported_game_type]
    );

    if (recentReportResult.rows.length > 0) {
      return errorResponse(
        "You have already reported this player in the last 24 hours",
        429
      );
    }

    // Determine priority based on category
    let priority = "normal";
    const highPriorityCategories = [1, 4]; // Cheating, Fraud
    if (highPriorityCategories.includes(data.category_id)) {
      priority = "high";
    }

    // Create the report
    const result = await pool.query(
      `INSERT INTO player_reports (
        reporter_id,
        reported_user_id,
        reported_game_id,
        reported_game_type,
        tournament_id,
        match_id,
        category_id,
        subcategory_id,
        description,
        evidence_urls,
        priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, created_at`,
      [
        user.id,
        data.reported_user_id || null,
        data.reported_game_id,
        data.reported_game_type,
        data.tournament_id || null,
        data.match_id || null,
        data.category_id,
        data.subcategory_id || null,
        sanitizedDescription,
        data.evidence_urls || [],
        priority,
      ]
    );

    return successResponse(
      {
        report_id: result.rows[0].id,
        created_at: result.rows[0].created_at,
      },
      "Report submitted successfully. Our team will review it shortly.",
      201
    );
  } catch (error) {
    console.error("Create report error:", error);
    return errorResponse("Failed to submit report", 500);
  }
}

/**
 * GET /api/reports - List reports
 * - Regular users see their own submitted reports
 * - Admins/owners see all reports with filters
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = (page - 1) * limit;

    const isAdmin = user.role === "owner" || user.role === "organizer";

    // Build query based on role
    let whereClause = "";
    const params: unknown[] = [];
    let paramIndex = 1;

    if (!isAdmin) {
      // Regular users see only their own reports
      whereClause = `WHERE pr.reporter_id = $${paramIndex}`;
      params.push(user.id);
      paramIndex++;
    } else {
      // Admin filters
      const status = searchParams.get("status");
      const priority = searchParams.get("priority");
      const category = searchParams.get("category");
      const gameType = searchParams.get("game_type");

      const conditions: string[] = [];

      if (status) {
        conditions.push(`pr.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (priority) {
        conditions.push(`pr.priority = $${paramIndex}`);
        params.push(priority);
        paramIndex++;
      }

      if (category) {
        conditions.push(`pr.category_id = $${paramIndex}`);
        params.push(parseInt(category));
        paramIndex++;
      }

      if (gameType) {
        conditions.push(`pr.reported_game_type = $${paramIndex}`);
        params.push(gameType);
        paramIndex++;
      }

      if (conditions.length > 0) {
        whereClause = `WHERE ${conditions.join(" AND ")}`;
      }
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM player_reports pr ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get reports with related data
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT 
        pr.*,
        reporter.username as reporter_username,
        reported.username as reported_username,
        cat.name as category_name,
        subcat.name as subcategory_name,
        t.tournament_name,
        reviewer.username as reviewer_username
      FROM player_reports pr
      LEFT JOIN users reporter ON pr.reporter_id = reporter.id
      LEFT JOIN users reported ON pr.reported_user_id = reported.id
      LEFT JOIN report_categories cat ON pr.category_id = cat.id
      LEFT JOIN report_categories subcat ON pr.subcategory_id = subcat.id
      LEFT JOIN tournaments t ON pr.tournament_id = t.id
      LEFT JOIN users reviewer ON pr.reviewed_by = reviewer.id
      ${whereClause}
      ORDER BY 
        CASE pr.priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'normal' THEN 3 
          WHEN 'low' THEN 4 
        END,
        pr.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return successResponse({
      reports: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List reports error:", error);
    return errorResponse("Failed to fetch reports", 500);
  }
}
