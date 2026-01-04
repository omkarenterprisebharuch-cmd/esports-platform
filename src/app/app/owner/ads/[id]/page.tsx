"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { AD_PLACEMENTS, formatAdCurrency, formatAdNumber } from "@/lib/ads";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { TabNav } from "@/components/app/TabNav";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/Badges";

interface AdDetail {
  id: number;
  name: string;
  advertiserName?: string;
  advertiserEmail?: string;
  adType: string;
  imageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  description?: string;
  ctaText: string;
  destinationUrl: string;
  placementIds: string[];
  status: string;
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  startDate: string;
  endDate?: string;
  frequencyCap: number;
  createdAt: string;
}

interface DailyStat {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
}

interface PlacementStat {
  placementId: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface FraudAnalysis {
  totalRecentClicks: number;
  validClicks: number;
  invalidClicks: number;
  fraudRate: string;
  avgTimeToClick: number;
}

const statusColors: Record<string, "success" | "warning" | "error" | "info" | "default"> = {
  active: "success",
  draft: "default",
  paused: "warning",
  completed: "info",
  rejected: "error",
};

/**
 * Ad Detail Page - View and manage individual advertisement
 * 
 * Features:
 * - View ad performance metrics
 * - Placement performance breakdown
 * - Daily stats
 * - Click quality analysis
 * - Status management (activate/pause/resume)
 */
export default function AdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [ad, setAd] = useState<AdDetail | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [placementStats, setPlacementStats] = useState<PlacementStat[]>([]);
  const [fraudAnalysis, setFraudAnalysis] = useState<FraudAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchAdDetails();
  }, [resolvedParams.id]);

  const fetchAdDetails = async () => {
    try {
      setLoading(true);
      const response = await api<{
        ad: AdDetail;
        dailyStats: DailyStat[];
        placementStats: PlacementStat[];
        fraudAnalysis: FraudAnalysis;
      }>(`/api/owner/ads/${resolvedParams.id}`);

      if (response.success && response.data) {
        setAd(response.data.ad);
        setDailyStats(response.data.dailyStats);
        setPlacementStats(response.data.placementStats);
        setFraudAnalysis(response.data.fraudAnalysis);
        setError(null);
      } else {
        if (response.message?.includes("Owner") || response.message?.includes("not found")) {
          router.push("/app/owner/ads");
          return;
        }
        setError(response.message || "Failed to load ad details");
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ad) return;

    try {
      const response = await api(`/api/owner/ads/${ad.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.success) {
        setAd(prev => prev ? { ...prev, status: newStatus } : null);
      } else {
        alert(response.message || "Failed to update status");
      }
    } catch {
      alert("Failed to update status");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !ad) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Advertisement Not Found"
          backLink={{ href: "/app/owner/ads", label: "Back to Ads" }}
        />
        <EmptyState
          icon="📢"
          title="Advertisement not found"
          description={error || "The advertisement you're looking for doesn't exist or you don't have access."}
          action={{ label: "Back to Ads", onClick: () => router.push("/app/owner/ads") }}
          variant="card"
        />
      </div>
    );
  }

  const ctr = ad.totalImpressions > 0 
    ? ((ad.totalClicks / ad.totalImpressions) * 100).toFixed(2) 
    : "0.00";

  const tabs = [
    { id: "overview", label: "📊 Overview" },
    { id: "placements", label: "📍 Placements" },
    { id: "daily", label: "📈 Daily Stats" },
    { id: "quality", label: "🛡️ Quality" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={ad.name}
        subtitle={`${ad.adType.charAt(0).toUpperCase() + ad.adType.slice(1)} Ad • Created ${new Date(ad.createdAt).toLocaleDateString()}`}
        backLink={{ href: "/app/owner/ads", label: "Back to Ads" }}
        badge={<StatusBadge status={statusColors[ad.status] ? ad.status : "default"} />}
        actions={
          <div className="flex items-center gap-2">
            {ad.status === "draft" && (
              <button
                onClick={() => handleStatusChange("active")}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl text-sm transition"
              >
                Activate
              </button>
            )}
            {ad.status === "active" && (
              <button
                onClick={() => handleStatusChange("paused")}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-xl text-sm transition"
              >
                Pause
              </button>
            )}
            {ad.status === "paused" && (
              <button
                onClick={() => handleStatusChange("active")}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl text-sm transition"
              >
                Resume
              </button>
            )}
          </div>
        }
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="👁️" title="Total Impressions" value={formatAdNumber(ad.totalImpressions)} />
        <StatCard icon="👆" title="Total Clicks" value={formatAdNumber(ad.totalClicks)} />
        <StatCard icon="📈" title="Click-Through Rate" value={`${ctr}%`} />
        <StatCard icon="💰" title="Total Spend" value={formatAdCurrency(ad.totalSpend)} />
      </div>

      {/* Tabs */}
      <TabNav tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ad Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Ad Preview</h3>
            <div className="bg-gray-100 dark:bg-gray-900 rounded-xl p-4 flex items-center justify-center min-h-[200px]">
              {ad.imageUrl ? (
                <img src={ad.imageUrl} alt={ad.name} className="max-w-full max-h-[300px] rounded-lg" />
              ) : ad.videoUrl ? (
                <video 
                  src={ad.videoUrl} 
                  poster={ad.thumbnailUrl}
                  className="max-w-full max-h-[300px] rounded-lg"
                  controls
                />
              ) : (
                <div className="text-center">
                  <div className="text-4xl mb-2">📢</div>
                  <p className="font-medium text-gray-900 dark:text-white">{ad.title || ad.name}</p>
                  {ad.description && <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{ad.description}</p>}
                </div>
              )}
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Destination:</span>
                <a href={ad.destinationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[200px]">
                  {ad.destinationUrl}
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">CTA:</span>
                <span className="text-gray-900 dark:text-white">{ad.ctaText}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Frequency Cap:</span>
                <span className="text-gray-900 dark:text-white">{ad.frequencyCap} views/day</span>
              </div>
            </div>
          </div>

          {/* Ad Details */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Ad Details</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Status</span>
                <StatusBadge status={ad.status} />
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Type</span>
                <span className="text-gray-900 dark:text-white capitalize">{ad.adType}</span>
              </div>
              {ad.advertiserName && (
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Advertiser</span>
                  <span className="text-gray-900 dark:text-white">{ad.advertiserName}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Start Date</span>
                <span className="text-gray-900 dark:text-white">{new Date(ad.startDate).toLocaleDateString()}</span>
              </div>
              {ad.endDate && (
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">End Date</span>
                  <span className="text-gray-900 dark:text-white">{new Date(ad.endDate).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-500 dark:text-gray-400">Placements</span>
                <span className="text-gray-900 dark:text-white">{ad.placementIds.length} active</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "placements" && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Placement Performance</h3>
          {placementStats.length === 0 ? (
            <EmptyState
              icon="📍"
              title="No placement data"
              description="Placement performance data will appear once impressions are recorded."
              variant="minimal"
            />
          ) : (
            <div className="space-y-3">
              {placementStats.map((stat) => {
                const placement = AD_PLACEMENTS[stat.placementId];
                const maxImpressions = Math.max(...placementStats.map(s => s.impressions));
                const barWidth = maxImpressions > 0 ? (stat.impressions / maxImpressions) * 100 : 0;
                
                return (
                  <div key={stat.placementId} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {placement?.name || stat.placementId}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">
                        CTR: {stat.ctr.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>{formatAdNumber(stat.impressions)} impressions</span>
                      <span>{formatAdNumber(stat.clicks)} clicks</span>
                    </div>
                    <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gray-900 dark:bg-white rounded-full transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "daily" && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Daily Performance (Last 30 Days)</h3>
          {dailyStats.length === 0 ? (
            <EmptyState
              icon="📈"
              title="No daily data"
              description="Daily performance data will appear once the ad starts running."
              variant="minimal"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-gray-500 dark:text-gray-400 font-medium">Date</th>
                    <th className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 font-medium">Impressions</th>
                    <th className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 font-medium">Clicks</th>
                    <th className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 font-medium">CTR</th>
                    <th className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 font-medium">Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {dailyStats.slice(0, 14).map((stat) => (
                    <tr key={stat.date} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {new Date(stat.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {formatAdNumber(stat.impressions)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {formatAdNumber(stat.clicks)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {stat.ctr.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {formatAdCurrency(stat.spend)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "quality" && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Click Quality Analysis</h3>
          {fraudAnalysis ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{fraudAnalysis.totalRecentClicks}</div>
                  <div className="text-gray-500 dark:text-gray-400 text-sm">Recent Clicks</div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{fraudAnalysis.validClicks}</div>
                  <div className="text-gray-500 dark:text-gray-400 text-sm">Valid Clicks</div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{fraudAnalysis.invalidClicks}</div>
                  <div className="text-gray-500 dark:text-gray-400 text-sm">Flagged Clicks</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className={`text-2xl font-bold ${parseFloat(fraudAnalysis.fraudRate) > 10 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                    {fraudAnalysis.fraudRate}%
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 text-sm">Fraud Rate</div>
                </div>
              </div>
              {fraudAnalysis.avgTimeToClick > 0 && (
                <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">
                    Average time to click: <span className="text-gray-900 dark:text-white font-medium">{(fraudAnalysis.avgTimeToClick / 1000).toFixed(1)}s</span>
                  </span>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon="🛡️"
              title="No quality data"
              description="Click quality analysis will appear once clicks are recorded."
              variant="minimal"
            />
          )}
        </div>
      )}
    </div>
  );
}
