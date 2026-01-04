import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createImpressionToken, type ServedAd } from "@/lib/ads";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

// Ad row type from database
interface AdRow {
  ad_id: number;
  ad_type: string;
  image_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  title?: string;
  description?: string;
  cta_text?: string;
  destination_url: string;
}

// GET /api/ads?placement=dashboard_top - Get ad for placement
// POST /api/ads/impression - Track impression
// POST /api/ads/click - Track click

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placementId = searchParams.get("placement");
    
    if (!placementId) {
      return NextResponse.json(
        { success: false, message: "Placement ID required" },
        { status: 400 }
      );
    }
    
    // Get eligible ads for this placement
    let rows: AdRow[] = [];
    try {
      rows = await query<AdRow>(
        `SELECT 
          a.id as ad_id,
          a.ad_type,
          a.image_url,
          a.video_url,
          a.thumbnail_url,
          a.title,
          a.description,
          a.cta_text,
          a.destination_url
        FROM advertisements a
        WHERE 
          a.status = 'active'
          AND $1 = ANY(a.placement_ids)
          AND (a.start_date IS NULL OR a.start_date <= NOW())
          AND (a.end_date IS NULL OR a.end_date > NOW())
          AND (a.total_impression_limit IS NULL OR a.total_impressions < a.total_impression_limit)
        ORDER BY RANDOM()
        LIMIT 1`,
        [placementId]
      );
    } catch (queryError) {
      // Table might not exist or no ads yet - return null ad gracefully
      console.log("No ads available or table not ready:", queryError);
      return NextResponse.json({ success: true, ad: null });
    }
    
    if (rows.length === 0) {
      return NextResponse.json({ success: true, ad: null });
    }
    
    const adRow = rows[0];
    const timestamp = Date.now();
    const impressionToken = createImpressionToken(adRow.ad_id, placementId, timestamp);
    
    const ad: ServedAd = {
      adId: adRow.ad_id,
      name: adRow.title || "Ad",
      adType: adRow.ad_type as ServedAd["adType"],
      imageUrl: adRow.image_url,
      videoUrl: adRow.video_url,
      thumbnailUrl: adRow.thumbnail_url,
      title: adRow.title,
      description: adRow.description,
      ctaText: adRow.cta_text || "Learn More",
      destinationUrl: adRow.destination_url,
      impressionToken,
    };
    
    return NextResponse.json({ success: true, ad });
  } catch (error) {
    console.error("Error fetching ad:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch ad" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action === "impression") {
      return handleImpression(request, body);
    } else if (action === "click") {
      return handleClick(request, body);
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid action" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error processing ad action:", error);
    return NextResponse.json(
      { success: false, message: "Failed to process action" },
      { status: 500 }
    );
  }
}

async function handleImpression(request: NextRequest, body: {
  adId: number;
  placementId: string;
  impressionToken: string;
  sessionId?: string;
  pageUrl?: string;
  viewDurationMs?: number;
  viewabilityPercent?: number;
}) {
  const { adId, placementId, impressionToken, sessionId, pageUrl, viewDurationMs, viewabilityPercent } = body;
  
  if (!adId || !placementId) {
    return NextResponse.json(
      { success: false, message: "Ad ID and placement ID required" },
      { status: 400 }
    );
  }
  
  // Get client info
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : "unknown";
  const ipHash = createHash("sha256").update(ip + (process.env.AD_HASH_SALT || "ad-salt")).digest("hex");
  const userAgent = request.headers.get("user-agent") || "";
  const referrer = request.headers.get("referer") || "";
  
  // Insert impression
  const rows = await query<{ id: number }>(
    `INSERT INTO ad_impressions (
      ad_id, placement_id, session_id, page_url, referrer, 
      user_agent, ip_hash, view_duration_ms, viewability_percent
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id`,
    [adId, placementId, sessionId, pageUrl, referrer, userAgent, ipHash, viewDurationMs, viewabilityPercent]
  );
  
  const impressionId = rows[0]?.id;
  
  // Update daily stats and ad counters
  await query(
    `SELECT update_ad_daily_stats($1, $2, CURRENT_DATE, 1, 0, 0)`,
    [adId, placementId]
  );
  
  return NextResponse.json({ 
    success: true, 
    impressionId,
    message: "Impression recorded" 
  });
}

async function handleClick(request: NextRequest, body: {
  adId: number;
  impressionId?: number;
  placementId: string;
  sessionId?: string;
  pageUrl?: string;
  destinationUrl?: string;
  timeToClickMs?: number;
}) {
  const { adId, impressionId, placementId, sessionId, pageUrl, destinationUrl, timeToClickMs } = body;
  
  if (!adId || !placementId) {
    return NextResponse.json(
      { success: false, message: "Ad ID and placement ID required" },
      { status: 400 }
    );
  }
  
  // Get client info
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : "unknown";
  const ipHash = createHash("sha256").update(ip + (process.env.AD_HASH_SALT || "ad-salt")).digest("hex");
  
  // Basic fraud detection
  let isValid = true;
  let fraudReason = null;
  
  // Check for suspiciously fast clicks (< 100ms is likely bot)
  if (timeToClickMs && timeToClickMs < 100) {
    isValid = false;
    fraudReason = "Click too fast";
  }
  
  // Check for duplicate clicks from same IP within 1 minute
  const duplicateRows = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM ad_clicks 
     WHERE ad_id = $1 AND ip_hash = $2 AND created_at > NOW() - INTERVAL '1 minute'`,
    [adId, ipHash]
  );
  
  if (parseInt(duplicateRows[0]?.count || "0") > 0) {
    isValid = false;
    fraudReason = "Duplicate click";
  }
  
  // Insert click
  await query(
    `INSERT INTO ad_clicks (
      ad_id, impression_id, placement_id, session_id, 
      page_url, destination_url, ip_hash, time_to_click_ms, is_valid, fraud_reason
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [adId, impressionId, placementId, sessionId, pageUrl, destinationUrl, ipHash, timeToClickMs, isValid, fraudReason]
  );
  
  // Update daily stats and ad counters (only for valid clicks)
  if (isValid) {
    await query(
      `SELECT update_ad_daily_stats($1, $2, CURRENT_DATE, 0, 1, 0)`,
      [adId, placementId]
    );
  }
  
  return NextResponse.json({ 
    success: true, 
    valid: isValid,
    message: isValid ? "Click recorded" : "Click flagged for review"
  });
}
