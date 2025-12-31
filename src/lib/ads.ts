// Advertisement types and utilities

export type AdType = "banner" | "video" | "native" | "interstitial";
export type AdStatus = "draft" | "pending" | "active" | "paused" | "completed" | "rejected";
export type PricingModel = "cpm" | "cpc" | "cpa" | "flat";

export interface AdPlacement {
  id: string;
  name: string;
  description?: string;
  location: string;
  adType: AdType;
  width?: number;
  height?: number;
  isActive: boolean;
  priority: number;
}

export interface Advertisement {
  id: number;
  name: string;
  advertiserName?: string;
  advertiserEmail?: string;
  adType: AdType;
  imageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  description?: string;
  ctaText: string;
  destinationUrl: string;
  placementIds: string[];
  targetGames?: string[];
  targetRegions?: string[];
  startDate: string;
  endDate?: string;
  pricingModel: PricingModel;
  priceAmount: number;
  dailyBudget?: number;
  totalBudget?: number;
  dailyImpressionLimit?: number;
  totalImpressionLimit?: number;
  dailyClickLimit?: number;
  frequencyCap: number;
  status: AdStatus;
  rejectionReason?: string;
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: number;
}

export interface AdImpression {
  id: number;
  adId: number;
  placementId: string;
  userId?: number;
  sessionId?: string;
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
  ipHash?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  viewDurationMs?: number;
  viewabilityPercent?: number;
  createdAt: string;
}

export interface AdClick {
  id: number;
  adId: number;
  impressionId?: number;
  placementId: string;
  userId?: number;
  sessionId?: string;
  pageUrl?: string;
  destinationUrl?: string;
  ipHash?: string;
  timeToClickMs?: number;
  isValid: boolean;
  fraudReason?: string;
  createdAt: string;
}

export interface AdDailyStats {
  id: number;
  adId: number;
  placementId?: string;
  statDate: string;
  impressions: number;
  clicks: number;
  uniqueImpressions: number;
  uniqueClicks: number;
  totalViewTimeMs: number;
  avgViewabilityPercent: number;
  spend: number;
  ctr: number;
}

export interface ServedAd {
  adId: number;
  name: string;
  adType: AdType;
  imageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  description?: string;
  ctaText: string;
  destinationUrl: string;
  impressionToken: string; // For tracking
}

// Predefined placements configuration
export const AD_PLACEMENTS: Record<string, AdPlacement> = {
  dashboard_top: {
    id: "dashboard_top",
    name: "Dashboard Top Banner",
    description: "Large banner at the top of the dashboard",
    location: "dashboard",
    adType: "banner",
    width: 728,
    height: 90,
    isActive: true,
    priority: 100,
  },
  dashboard_sidebar: {
    id: "dashboard_sidebar",
    name: "Dashboard Sidebar",
    description: "Vertical banner in dashboard sidebar",
    location: "dashboard",
    adType: "banner",
    width: 300,
    height: 250,
    isActive: true,
    priority: 80,
  },
  tournament_list_top: {
    id: "tournament_list_top",
    name: "Tournament List Header",
    description: "Banner above tournament listings",
    location: "tournaments",
    adType: "banner",
    width: 728,
    height: 90,
    isActive: true,
    priority: 90,
  },
  tournament_detail_sidebar: {
    id: "tournament_detail_sidebar",
    name: "Tournament Detail Sidebar",
    description: "Ad on tournament detail page",
    location: "tournament_detail",
    adType: "banner",
    width: 300,
    height: 250,
    isActive: true,
    priority: 70,
  },
  registration_interstitial: {
    id: "registration_interstitial",
    name: "Registration Interstitial",
    description: "Full-screen ad after registration",
    location: "registration",
    adType: "interstitial",
    isActive: true,
    priority: 100,
  },
  registration_success: {
    id: "registration_success",
    name: "Registration Success",
    description: "Banner on registration success page",
    location: "registration",
    adType: "banner",
    width: 468,
    height: 60,
    isActive: true,
    priority: 60,
  },
  leaderboard_sidebar: {
    id: "leaderboard_sidebar",
    name: "Leaderboard Sidebar",
    description: "Ad on leaderboard page",
    location: "leaderboard",
    adType: "banner",
    width: 300,
    height: 600,
    isActive: true,
    priority: 50,
  },
  mobile_bottom: {
    id: "mobile_bottom",
    name: "Mobile Bottom Banner",
    description: "Sticky banner at bottom on mobile",
    location: "mobile",
    adType: "banner",
    width: 320,
    height: 50,
    isActive: true,
    priority: 40,
  },
  video_preroll: {
    id: "video_preroll",
    name: "Video Pre-roll",
    description: "Video ad before tournament streams",
    location: "video",
    adType: "video",
    isActive: true,
    priority: 100,
  },
};

// Generate a session ID for anonymous tracking
export function generateSessionId(): string {
  if (typeof window === "undefined") return "";
  
  let sessionId = sessionStorage.getItem("ad_session_id");
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem("ad_session_id", sessionId);
  }
  return sessionId;
}

// Calculate CTR percentage
export function calculateCTR(impressions: number, clicks: number): string {
  if (impressions === 0) return "0.00%";
  return ((clicks / impressions) * 100).toFixed(2) + "%";
}

// Format currency
export function formatAdCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

// Format large numbers
export function formatAdNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Detect device type
export function detectDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

// Parse user agent for browser/OS
export function parseUserAgent(): { browser: string; os: string } {
  if (typeof window === "undefined") return { browser: "unknown", os: "unknown" };
  
  const ua = navigator.userAgent;
  
  // Browser detection
  let browser = "unknown";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Opera")) browser = "Opera";
  
  // OS detection
  let os = "unknown";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  
  return { browser, os };
}

// Hash IP for privacy-safe storage
export async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + process.env.AD_HASH_SALT || "ad-salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Validate impression token
export function createImpressionToken(adId: number, placementId: string, timestamp: number): string {
  // Simple token for client-side tracking (not cryptographically secure, just for correlation)
  return `${adId}-${placementId}-${timestamp}-${Math.random().toString(36).substring(2, 8)}`;
}

// Parse impression token
export function parseImpressionToken(token: string): { adId: number; placementId: string; timestamp: number } | null {
  const parts = token.split("-");
  if (parts.length < 3) return null;
  
  return {
    adId: parseInt(parts[0]),
    placementId: parts[1],
    timestamp: parseInt(parts[2]),
  };
}
