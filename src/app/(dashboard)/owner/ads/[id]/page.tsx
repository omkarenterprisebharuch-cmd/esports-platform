"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { AD_PLACEMENTS, formatAdCurrency, formatAdNumber } from "@/lib/ads";

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

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function AdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [ad, setAd] = useState<AdDetail | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [placementStats, setPlacementStats] = useState<PlacementStat[]>([]);
  const [fraudAnalysis, setFraudAnalysis] = useState<FraudAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          router.push("/owner/ads");
          return;
        }
        setError(response.message || "Failed to load ad details");
      }
    } catch (err) {
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
    } catch (err) {
      alert("Failed to update status");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-64 bg-gray-700 rounded" />
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-800 rounded-lg" />
              ))}
            </div>
            <div className="h-64 bg-gray-800 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !ad) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="p-8 bg-gray-800 rounded-lg border border-red-500/30 text-center">
            <p className="text-red-400 mb-4">{error || "Advertisement not found"}</p>
            <button
              onClick={() => router.push("/owner/ads")}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              Back to Ads
            </button>
          </div>
        </div>
      </div>
    );
  }

  const ctr = ad.totalImpressions > 0 
    ? ((ad.totalClicks / ad.totalImpressions) * 100).toFixed(2) 
    : "0.00";

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <button
              onClick={() => router.push("/owner/ads")}
              className="text-gray-400 hover:text-white text-sm mb-2 flex items-center gap-1"
            >
              ← Back to Ads
            </button>
            <h1 className="text-2xl font-bold text-white">{ad.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={`px-2 py-1 text-xs rounded border ${statusColors[ad.status]}`}>
                {ad.status}
              </span>
              <span className="text-gray-400 text-sm capitalize">{ad.adType}</span>
              {ad.advertiserName && (
                <span className="text-gray-500 text-sm">by {ad.advertiserName}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {ad.status === "draft" && (
              <button
                onClick={() => handleStatusChange("active")}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
              >
                Activate
              </button>
            )}
            {ad.status === "active" && (
              <button
                onClick={() => handleStatusChange("paused")}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm"
              >
                Pause
              </button>
            )}
            {ad.status === "paused" && (
              <button
                onClick={() => handleStatusChange("active")}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
              >
                Resume
              </button>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard icon="👁️" label="Total Impressions" value={formatAdNumber(ad.totalImpressions)} />
          <MetricCard icon="👆" label="Total Clicks" value={formatAdNumber(ad.totalClicks)} />
          <MetricCard icon="📈" label="Click-Through Rate" value={`${ctr}%`} />
          <MetricCard icon="💰" label="Total Spend" value={formatAdCurrency(ad.totalSpend)} />
        </div>

        {/* Ad Preview & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preview */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-white font-medium mb-4">Ad Preview</h3>
            <div className="bg-gray-900 rounded-lg p-4 flex items-center justify-center min-h-[200px]">
              {ad.imageUrl ? (
                <img src={ad.imageUrl} alt={ad.name} className="max-w-full max-h-[300px] rounded" />
              ) : ad.videoUrl ? (
                <video 
                  src={ad.videoUrl} 
                  poster={ad.thumbnailUrl}
                  className="max-w-full max-h-[300px] rounded"
                  controls
                />
              ) : (
                <div className="text-center">
                  <div className="text-4xl mb-2">📢</div>
                  <p className="text-white font-medium">{ad.title || ad.name}</p>
                  {ad.description && <p className="text-gray-400 text-sm mt-1">{ad.description}</p>}
                </div>
              )}
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Destination:</span>
                <a href={ad.destinationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate max-w-[200px]">
                  {ad.destinationUrl}
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">CTA:</span>
                <span className="text-white">{ad.ctaText}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Frequency Cap:</span>
                <span className="text-white">{ad.frequencyCap} views/day</span>
              </div>
            </div>
          </div>

          {/* Placement Performance */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-white font-medium mb-4">Placement Performance</h3>
            {placementStats.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No data yet</p>
            ) : (
              <div className="space-y-3">
                {placementStats.map((stat) => {
                  const placement = AD_PLACEMENTS[stat.placementId];
                  const maxImpressions = Math.max(...placementStats.map(s => s.impressions));
                  const barWidth = maxImpressions > 0 ? (stat.impressions / maxImpressions) * 100 : 0;
                  
                  return (
                    <div key={stat.placementId} className="bg-gray-750 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-sm font-medium">
                          {placement?.name || stat.placementId}
                        </span>
                        <span className="text-gray-400 text-xs">
                          CTR: {stat.ctr.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>{formatAdNumber(stat.impressions)} impressions</span>
                        <span>{formatAdNumber(stat.clicks)} clicks</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-orange-500 rounded-full"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Fraud Analysis */}
        {fraudAnalysis && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-white font-medium mb-4">Click Quality Analysis</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{fraudAnalysis.totalRecentClicks}</div>
                <div className="text-gray-400 text-sm">Recent Clicks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{fraudAnalysis.validClicks}</div>
                <div className="text-gray-400 text-sm">Valid Clicks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{fraudAnalysis.invalidClicks}</div>
                <div className="text-gray-400 text-sm">Flagged Clicks</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${parseFloat(fraudAnalysis.fraudRate) > 10 ? "text-red-400" : "text-green-400"}`}>
                  {fraudAnalysis.fraudRate}%
                </div>
                <div className="text-gray-400 text-sm">Fraud Rate</div>
              </div>
            </div>
            {fraudAnalysis.avgTimeToClick > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700 text-center">
                <span className="text-gray-400 text-sm">
                  Average time to click: <span className="text-white">{(fraudAnalysis.avgTimeToClick / 1000).toFixed(1)}s</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Daily Stats Chart (simplified table view) */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-white font-medium mb-4">Daily Performance (Last 30 Days)</h3>
          {dailyStats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Date</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Impressions</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Clicks</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">CTR</th>
                    <th className="px-3 py-2 text-right text-gray-400 font-medium">Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {dailyStats.slice(0, 14).map((stat) => (
                    <tr key={stat.date} className="hover:bg-gray-750">
                      <td className="px-3 py-2 text-white">
                        {new Date(stat.date).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">
                        {formatAdNumber(stat.impressions)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">
                        {formatAdNumber(stat.clicks)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">
                        {stat.ctr.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">
                        {formatAdCurrency(stat.spend)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
