import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  forbiddenResponse,
  serverErrorResponse,
} from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Ad row type from database
interface AdRow {
  id: number;
  name: string;
  advertiser_name?: string;
  advertiser_email?: string;
  ad_type: string;
  image_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  title?: string;
  description?: string;
  cta_text?: string;
  destination_url: string;
  placement_ids?: string[];
  target_games?: string[];
  target_regions?: string[];
  start_date: string;
  end_date?: string;
  pricing_model: string;
  price_amount?: string;
  daily_budget?: string;
  total_budget?: string;
  daily_impression_limit?: number;
  total_impression_limit?: number;
  daily_click_limit?: number;
  frequency_cap: number;
  status: string;
  rejection_reason?: string;
  total_impressions: number;
  total_clicks: number;
  total_spend?: string;
  created_at: string;
  updated_at: string;
  created_by_username?: string;
  ctr?: string;
}

interface SummaryStats {
  active_ads: string;
  draft_ads: string;
  paused_ads: string;
  total_impressions: string;
  total_clicks: string;
  total_spend: string;
}

// GET /api/owner/ads - List all ads with stats
// POST /api/owner/ads - Create new ad
export async function GET(request: NextRequest) {
  try {
    const user = requireOwner(request);
    if (!user) {
      return forbiddenResponse("Owner access required");
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build query
    let whereClause = "WHERE 1=1";
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Get ads with calculated CTR
    const adsResult = await pool.query<AdRow>(
      `SELECT 
        a.*,
        CASE WHEN a.total_impressions > 0 
          THEN ROUND((a.total_clicks::numeric / a.total_impressions) * 100, 2)
          ELSE 0 
        END as ctr
      FROM advertisements a
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    // Get total count
    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM advertisements a ${whereClause}`,
      params
    );

    // Get summary stats
    const statsResult = await pool.query<SummaryStats>(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'active') as active_ads,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_ads,
        COUNT(*) FILTER (WHERE status = 'paused') as paused_ads,
        COALESCE(SUM(total_impressions), 0) as total_impressions,
        COALESCE(SUM(total_clicks), 0) as total_clicks,
        COALESCE(SUM(total_spend), 0) as total_spend
      FROM advertisements
    `);

    const stats = statsResult.rows[0];
    const totalImpressions = parseInt(stats.total_impressions || "0");
    const totalClicks = parseInt(stats.total_clicks || "0");

    return successResponse({
      ads: adsResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        advertiserName: row.advertiser_name,
        advertiserEmail: row.advertiser_email,
        adType: row.ad_type,
        imageUrl: row.image_url,
        videoUrl: row.video_url,
        thumbnailUrl: row.thumbnail_url,
        title: row.title,
        description: row.description,
        ctaText: row.cta_text,
        destinationUrl: row.destination_url,
        placementIds: row.placement_ids || [],
        targetGames: row.target_games || [],
        targetRegions: row.target_regions || [],
        startDate: row.start_date,
        endDate: row.end_date,
        pricingModel: row.pricing_model,
        priceAmount: parseFloat(row.price_amount || "0"),
        dailyBudget: row.daily_budget ? parseFloat(row.daily_budget) : null,
        totalBudget: row.total_budget ? parseFloat(row.total_budget) : null,
        dailyImpressionLimit: row.daily_impression_limit,
        totalImpressionLimit: row.total_impression_limit,
        frequencyCap: row.frequency_cap,
        status: row.status,
        rejectionReason: row.rejection_reason,
        totalImpressions: row.total_impressions,
        totalClicks: row.total_clicks,
        totalSpend: parseFloat(row.total_spend || "0"),
        ctr: parseFloat(row.ctr || "0"),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdByUsername: row.created_by_username,
      })),
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
      },
      summary: {
        activeAds: parseInt(stats.active_ads || "0"),
        draftAds: parseInt(stats.draft_ads || "0"),
        pausedAds: parseInt(stats.paused_ads || "0"),
        totalImpressions,
        totalClicks,
        totalSpend: parseFloat(stats.total_spend || "0"),
        overallCtr: totalImpressions > 0 
          ? ((totalClicks / totalImpressions) * 100).toFixed(2)
          : "0.00",
      },
    });
  } catch (error) {
    console.error("Error fetching ads:", error);
    return serverErrorResponse("Failed to fetch ads");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireOwner(request);
    if (!user) {
      return forbiddenResponse("Owner access required");
    }

    const body = await request.json();
    const {
      name,
      advertiserName,
      advertiserEmail,
      adType,
      imageUrl,
      videoUrl,
      thumbnailUrl,
      title,
      description,
      ctaText,
      destinationUrl,
      placementIds,
      targetGames,
      targetRegions,
      startDate,
      endDate,
      pricingModel,
      priceAmount,
      dailyBudget,
      totalBudget,
      dailyImpressionLimit,
      totalImpressionLimit,
      frequencyCap,
      status = "draft",
    } = body;

    // Validation
    if (!name || !destinationUrl || !adType || !placementIds?.length) {
      return errorResponse("Name, destination URL, ad type, and at least one placement are required", 400);
    }

    const result = await pool.query<{ id: number }>(
      `INSERT INTO advertisements (
        name, advertiser_name, advertiser_email, ad_type,
        image_url, video_url, thumbnail_url, title, description, cta_text,
        destination_url, placement_ids, target_games, target_regions,
        start_date, end_date, pricing_model, price_amount,
        daily_budget, total_budget, daily_impression_limit, total_impression_limit,
        frequency_cap, status, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25
      ) RETURNING id`,
      [
        name,
        advertiserName,
        advertiserEmail,
        adType,
        imageUrl,
        videoUrl,
        thumbnailUrl,
        title,
        description,
        ctaText || "Learn More",
        destinationUrl,
        placementIds,
        targetGames || [],
        targetRegions || [],
        startDate || new Date().toISOString(),
        endDate,
        pricingModel || "cpm",
        priceAmount || 0,
        dailyBudget,
        totalBudget,
        dailyImpressionLimit,
        totalImpressionLimit,
        frequencyCap || 3,
        status,
        user.id,
      ]
    );

    return successResponse(
      { id: result.rows[0].id },
      "Advertisement created successfully"
    );
  } catch (error) {
    console.error("Error creating ad:", error);
    return serverErrorResponse("Failed to create advertisement");
  }
}
