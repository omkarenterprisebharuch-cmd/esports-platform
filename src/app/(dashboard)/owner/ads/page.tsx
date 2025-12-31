"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { AD_PLACEMENTS, formatAdCurrency, formatAdNumber, calculateCTR } from "@/lib/ads";

interface Advertisement {
  id: number;
  name: string;
  advertiserName?: string;
  adType: string;
  imageUrl?: string;
  destinationUrl: string;
  placementIds: string[];
  status: string;
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  ctr: number;
  createdAt: string;
}

interface AdsSummary {
  activeAds: number;
  draftAds: number;
  pausedAds: number;
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  overallCtr: string;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  pending: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const adTypeIcons: Record<string, string> = {
  banner: "🖼️",
  video: "🎬",
  native: "📝",
  interstitial: "📺",
};

export default function AdsManagementPage() {
  const router = useRouter();
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [summary, setSummary] = useState<AdsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchAds();
  }, [statusFilter]);

  const fetchAds = async () => {
    try {
      setLoading(true);
      const url = statusFilter 
        ? `/api/owner/ads?status=${statusFilter}` 
        : "/api/owner/ads";
      
      const response = await api<{ ads: Advertisement[]; summary: AdsSummary }>(url);
      
      if (response.success && response.data) {
        setAds(response.data.ads);
        setSummary(response.data.summary);
        setError(null);
      } else {
        if (response.message?.includes("Owner")) {
          router.push("/dashboard");
          return;
        }
        setError(response.message || "Failed to load ads");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (adId: number, newStatus: string) => {
    try {
      const response = await api(`/api/owner/ads/${adId}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.success) {
        fetchAds(); // Refresh list
      } else {
        alert(response.message || "Failed to update status");
      }
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handleDelete = async (adId: number, adName: string) => {
    if (!confirm(`Are you sure you want to delete "${adName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await api(`/api/owner/ads/${adId}`, {
        method: "DELETE",
      });
      
      if (response.success) {
        fetchAds(); // Refresh list
      } else {
        alert(response.message || "Failed to delete ad");
      }
    } catch (err) {
      alert("Failed to delete ad");
    }
  };

  if (loading && !ads.length) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-gray-700 rounded" />
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-800 rounded-lg" />
              ))}
            </div>
            <div className="h-96 bg-gray-800 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Advertisement Management</h1>
            <p className="text-gray-400 mt-1">Manage ads, track performance, and view analytics</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <span>+</span> Create Ad
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <SummaryCard icon="📊" label="Active Ads" value={summary.activeAds} />
            <SummaryCard icon="📝" label="Drafts" value={summary.draftAds} />
            <SummaryCard icon="⏸️" label="Paused" value={summary.pausedAds} />
            <SummaryCard icon="👁️" label="Impressions" value={formatAdNumber(summary.totalImpressions)} />
            <SummaryCard icon="👆" label="Clicks" value={formatAdNumber(summary.totalClicks)} />
            <SummaryCard icon="📈" label="CTR" value={`${summary.overallCtr}%`} />
            <SummaryCard icon="💰" label="Revenue" value={formatAdCurrency(summary.totalSpend)} />
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4">
          <label className="text-gray-400 text-sm">Filter by status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Ads Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ad</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Placements</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Impressions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Clicks</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">CTR</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {ads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      No advertisements found. Create your first ad to get started.
                    </td>
                  </tr>
                ) : (
                  ads.map((ad) => (
                    <tr key={ad.id} className="hover:bg-gray-750">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {ad.imageUrl ? (
                            <img 
                              src={ad.imageUrl} 
                              alt="" 
                              className="w-12 h-8 object-cover rounded"
                            />
                          ) : (
                            <div className="w-12 h-8 bg-gray-700 rounded flex items-center justify-center text-lg">
                              {adTypeIcons[ad.adType] || "📢"}
                            </div>
                          )}
                          <div>
                            <div className="text-white font-medium text-sm">{ad.name}</div>
                            {ad.advertiserName && (
                              <div className="text-gray-500 text-xs">{ad.advertiserName}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-300 text-sm capitalize">{ad.adType}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {ad.placementIds.slice(0, 2).map((pid) => (
                            <span 
                              key={pid}
                              className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded"
                              title={AD_PLACEMENTS[pid]?.name || pid}
                            >
                              {pid.replace(/_/g, " ").slice(0, 15)}
                            </span>
                          ))}
                          {ad.placementIds.length > 2 && (
                            <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                              +{ad.placementIds.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded border ${statusColors[ad.status] || statusColors.draft}`}>
                          {ad.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 text-sm">
                        {formatAdNumber(ad.totalImpressions)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 text-sm">
                        {formatAdNumber(ad.totalClicks)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 text-sm">
                        {ad.ctr.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(`/owner/ads/${ad.id}`)}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                            title="View Details"
                          >
                            📊
                          </button>
                          {ad.status === "draft" && (
                            <button
                              onClick={() => handleStatusChange(ad.id, "active")}
                              className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors"
                              title="Activate"
                            >
                              ▶️
                            </button>
                          )}
                          {ad.status === "active" && (
                            <button
                              onClick={() => handleStatusChange(ad.id, "paused")}
                              className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded transition-colors"
                              title="Pause"
                            >
                              ⏸️
                            </button>
                          )}
                          {ad.status === "paused" && (
                            <button
                              onClick={() => handleStatusChange(ad.id, "active")}
                              className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors"
                              title="Resume"
                            >
                              ▶️
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(ad.id, ad.name)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Placements Reference */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-white font-medium mb-3">Available Placements</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.values(AD_PLACEMENTS).map((placement) => (
              <div key={placement.id} className="flex items-center gap-3 p-3 bg-gray-750 rounded-lg">
                <div className="text-2xl">{adTypeIcons[placement.adType] || "📢"}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{placement.name}</div>
                  <div className="text-gray-500 text-xs">
                    {placement.width && placement.height 
                      ? `${placement.width}×${placement.height}px` 
                      : placement.adType}
                    {" · "}{placement.location}
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${placement.isActive ? "bg-green-500" : "bg-gray-600"}`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Ad Modal */}
      {showCreateModal && (
        <CreateAdModal 
          onClose={() => setShowCreateModal(false)} 
          onCreated={() => {
            setShowCreateModal(false);
            fetchAds();
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
}

function CreateAdModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    advertiserName: "",
    advertiserEmail: "",
    adType: "banner",
    imageUrl: "",
    videoUrl: "",
    title: "",
    description: "",
    ctaText: "Learn More",
    destinationUrl: "",
    placementIds: [] as string[],
    frequencyCap: 3,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.destinationUrl || !formData.placementIds.length) {
      setError("Name, destination URL, and at least one placement are required");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await api("/api/owner/ads", {
        method: "POST",
        body: JSON.stringify(formData),
      });

      if (response.success) {
        onCreated();
      } else {
        setError(response.message || "Failed to create ad");
      }
    } catch (err) {
      setError("Failed to create ad");
    } finally {
      setSubmitting(false);
    }
  };

  const togglePlacement = (placementId: string) => {
    setFormData(prev => ({
      ...prev,
      placementIds: prev.placementIds.includes(placementId)
        ? prev.placementIds.filter(id => id !== placementId)
        : [...prev.placementIds, placementId],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create New Advertisement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Ad Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Summer Campaign Banner"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Ad Type *</label>
              <select
                value={formData.adType}
                onChange={(e) => setFormData(prev => ({ ...prev, adType: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="banner">Banner</option>
                <option value="video">Video</option>
                <option value="native">Native</option>
                <option value="interstitial">Interstitial</option>
              </select>
            </div>
          </div>

          {/* Advertiser */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Advertiser Name</label>
              <input
                type="text"
                value={formData.advertiserName}
                onChange={(e) => setFormData(prev => ({ ...prev, advertiserName: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Company Inc."
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Advertiser Email</label>
              <input
                type="email"
                value={formData.advertiserEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, advertiserEmail: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="contact@company.com"
              />
            </div>
          </div>

          {/* Creative */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Image URL</label>
            <input
              type="url"
              value={formData.imageUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="https://example.com/banner.jpg"
            />
          </div>

          {formData.adType === "video" && (
            <div>
              <label className="block text-gray-400 text-sm mb-1">Video URL</label>
              <input
                type="url"
                value={formData.videoUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, videoUrl: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="https://example.com/video.mp4"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Title (for native ads)</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Check out this offer!"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">CTA Button Text</label>
              <input
                type="text"
                value={formData.ctaText}
                onChange={(e) => setFormData(prev => ({ ...prev, ctaText: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Learn More"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1">Destination URL *</label>
            <input
              type="url"
              value={formData.destinationUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, destinationUrl: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="https://example.com/landing-page"
              required
            />
          </div>

          {/* Placements */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Placements *</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(AD_PLACEMENTS)
                .filter(p => p.adType === formData.adType || formData.adType === "native")
                .map((placement) => (
                  <label 
                    key={placement.id}
                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                      formData.placementIds.includes(placement.id)
                        ? "bg-orange-500/20 border-orange-500/50 text-white"
                        : "bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.placementIds.includes(placement.id)}
                      onChange={() => togglePlacement(placement.id)}
                      className="sr-only"
                    />
                    <span className="text-lg">{adTypeIcons[placement.adType]}</span>
                    <span className="text-sm">{placement.name}</span>
                  </label>
                ))}
            </div>
          </div>

          {/* Frequency Cap */}
          <div>
            <label className="block text-gray-400 text-sm mb-1">
              Frequency Cap (max views per user/day)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={formData.frequencyCap}
              onChange={(e) => setFormData(prev => ({ ...prev, frequencyCap: parseInt(e.target.value) || 3 }))}
              className="w-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              {submitting ? "Creating..." : "Create Ad"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
