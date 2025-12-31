import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import {
  successResponse,
  notFoundResponse,
  forbiddenResponse,
  serverErrorResponse,
} from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Row types
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
  frequency_cap: number;
  status: string;
  rejection_reason?: string;
  total_impressions: number;
  total_clicks: number;
  total_spend?: string;
  created_at: string;
  updated_at: string;
  created_by_username?: string;
}

interface DailyStatRow {
  stat_date: string;
  impressions: string;
  clicks: string;
  spend: string;
  ctr: string;
}

interface PlacementStatRow {
  placement_id: string;
  impressions: string;
  clicks: string;
  ctr: string;
}

interface ClickRow {
  is_valid: boolean;
  fraud_reason?: string;
  time_to_click_ms?: number;
  created_at: string;
}

// GET /api/owner/ads/[id] - Get single ad with detailed stats
// PUT /api/owner/ads/[id] - Update ad
// DELETE /api/owner/ads/[id] - Delete ad
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireOwner(request);
    if (!user) {
      return forbiddenResponse("Owner access required");
    }

    const { id } = await params;
    const adId = parseInt(id);

    // Get ad details
    const adResult = await pool.query<AdRow>(
      `SELECT a.*, u.username as created_by_username
       FROM advertisements a
       LEFT JOIN users u ON a.created_by = u.id
       WHERE a.id = $1`,
      [adId]
    );

    if (adResult.rows.length === 0) {
      return notFoundResponse("Advertisement not found");
    }

    const row = adResult.rows[0];

    // Get daily stats for last 30 days
    const statsResult = await pool.query<DailyStatRow>(
      `SELECT 
        stat_date,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(spend) as spend,
        AVG(ctr) as ctr
       FROM ad_daily_stats
       WHERE ad_id = $1 AND stat_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY stat_date
       ORDER BY stat_date DESC`,
      [adId]
    );

    // Get placement breakdown
    const placementStats = await pool.query<PlacementStatRow>(
      `SELECT 
        placement_id,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        AVG(ctr) as ctr
       FROM ad_daily_stats
       WHERE ad_id = $1
       GROUP BY placement_id
       ORDER BY impressions DESC`,
      [adId]
    );

    // Get recent clicks (for fraud analysis)
    const recentClicks = await pool.query<ClickRow>(
      `SELECT 
        is_valid,
        fraud_reason,
        time_to_click_ms,
        created_at
       FROM ad_clicks
       WHERE ad_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [adId]
    );

    const validClicks = recentClicks.rows.filter(c => c.is_valid).length;
    const invalidClicks = recentClicks.rows.filter(c => !c.is_valid).length;
    const clicksWithTime = recentClicks.rows.filter(c => c.time_to_click_ms);

    return successResponse({
      ad: {
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
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdByUsername: row.created_by_username,
      },
      dailyStats: statsResult.rows.map(s => ({
        date: s.stat_date,
        impressions: parseInt(s.impressions),
        clicks: parseInt(s.clicks),
        spend: parseFloat(s.spend || "0"),
        ctr: parseFloat(s.ctr || "0"),
      })),
      placementStats: placementStats.rows.map(p => ({
        placementId: p.placement_id,
        impressions: parseInt(p.impressions),
        clicks: parseInt(p.clicks),
        ctr: parseFloat(p.ctr || "0"),
      })),
      fraudAnalysis: {
        totalRecentClicks: recentClicks.rows.length,
        validClicks,
        invalidClicks,
        fraudRate: recentClicks.rows.length > 0 
          ? ((invalidClicks / recentClicks.rows.length) * 100).toFixed(2)
          : "0.00",
        avgTimeToClick: clicksWithTime.length > 0
          ? Math.round(
              clicksWithTime.reduce((sum, c) => sum + (c.time_to_click_ms || 0), 0) / 
              clicksWithTime.length
            )
          : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching ad:", error);
    return serverErrorResponse("Failed to fetch advertisement");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireOwner(request);
    if (!user) {
      return forbiddenResponse("Owner access required");
    }

    const { id } = await params;
    const adId = parseInt(id);
    const body = await request.json();

    // Check if ad exists
    const existingAd = await pool.query<{ id: number }>(
      "SELECT id FROM advertisements WHERE id = $1",
      [adId]
    );

    if (existingAd.rows.length === 0) {
      return notFoundResponse("Advertisement not found");
    }

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
      status,
    } = body;

    await pool.query(
      `UPDATE advertisements SET
        name = COALESCE($1, name),
        advertiser_name = COALESCE($2, advertiser_name),
        advertiser_email = COALESCE($3, advertiser_email),
        ad_type = COALESCE($4, ad_type),
        image_url = COALESCE($5, image_url),
        video_url = COALESCE($6, video_url),
        thumbnail_url = COALESCE($7, thumbnail_url),
        title = COALESCE($8, title),
        description = COALESCE($9, description),
        cta_text = COALESCE($10, cta_text),
        destination_url = COALESCE($11, destination_url),
        placement_ids = COALESCE($12, placement_ids),
        target_games = COALESCE($13, target_games),
        target_regions = COALESCE($14, target_regions),
        start_date = COALESCE($15, start_date),
        end_date = $16,
        pricing_model = COALESCE($17, pricing_model),
        price_amount = COALESCE($18, price_amount),
        daily_budget = $19,
        total_budget = $20,
        daily_impression_limit = $21,
        total_impression_limit = $22,
        frequency_cap = COALESCE($23, frequency_cap),
        status = COALESCE($24, status),
        updated_at = NOW()
      WHERE id = $25`,
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
        status,
        adId,
      ]
    );

    return successResponse(null, "Advertisement updated successfully");
  } catch (error) {
    console.error("Error updating ad:", error);
    return serverErrorResponse("Failed to update advertisement");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireOwner(request);
    if (!user) {
      return forbiddenResponse("Owner access required");
    }

    const { id } = await params;
    const adId = parseInt(id);

    // Check if ad exists
    const existingAd = await pool.query<{ id: number }>(
      "SELECT id FROM advertisements WHERE id = $1",
      [adId]
    );

    if (existingAd.rows.length === 0) {
      return notFoundResponse("Advertisement not found");
    }

    // Delete ad (cascades to impressions, clicks, stats)
    await pool.query("DELETE FROM advertisements WHERE id = $1", [adId]);

    return successResponse(null, "Advertisement deleted successfully");
  } catch (error) {
    console.error("Error deleting ad:", error);
    return serverErrorResponse("Failed to delete advertisement");
  }
}
