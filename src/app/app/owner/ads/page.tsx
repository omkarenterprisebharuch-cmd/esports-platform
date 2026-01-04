"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { AD_PLACEMENTS, formatAdCurrency, formatAdNumber } from "@/lib/ads";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { TabNav } from "@/components/app/TabNav";
import { Modal } from "@/components/app/Modal";
import { FormField, FormSelect } from "@/components/app/FormComponents";
import { EmptyState } from "@/components/app/EmptyState";
import { StatusBadge } from "@/components/app/Badges";

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

const statusColors: Record<string, "success" | "warning" | "error" | "info" | "default"> = {
  active: "success",
  draft: "default",
  paused: "warning",
  completed: "info",
  rejected: "error",
  pending: "warning",
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
  const [activeTab, setActiveTab] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const statusFilter = activeTab === "all" ? "" : activeTab;

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
          router.push("/app");
          return;
        }
        setError(response.message || "Failed to load ads");
      }
    } catch {
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
        fetchAds();
      } else {
        alert(response.message || "Failed to update status");
      }
    } catch {
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
        fetchAds();
      } else {
        alert(response.message || "Failed to delete ad");
      }
    } catch {
      alert("Failed to delete ad");
    }
  };

  if (loading && !ads.length) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-500">Loading advertisements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Advertisement Management"
        subtitle="Manage ads, track performance, and view analytics"
        backLink={{ href: "/app/owner", label: "Back to Owner Portal" }}
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <span>+</span> Create Ad
          </button>
        }
      />

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <StatCard icon={<span className="text-2xl">📊</span>} title="Active Ads" value={summary.activeAds} />
          <StatCard icon={<span className="text-2xl">📝</span>} title="Drafts" value={summary.draftAds} />
          <StatCard icon={<span className="text-2xl">⏸️</span>} title="Paused" value={summary.pausedAds} />
          <StatCard icon={<span className="text-2xl">👁️</span>} title="Impressions" value={formatAdNumber(summary.totalImpressions)} />
          <StatCard icon={<span className="text-2xl">👆</span>} title="Clicks" value={formatAdNumber(summary.totalClicks)} />
          <StatCard icon={<span className="text-2xl">📈</span>} title="CTR" value={`${summary.overallCtr}%`} />
          <StatCard icon={<span className="text-2xl">💰</span>} title="Revenue" value={formatAdCurrency(summary.totalSpend)} />
        </div>
      )}

      {/* Filters */}
      <TabNav
        tabs={[
          { id: "all", label: "All Ads" },
          { id: "active", label: "Active" },
          { id: "draft", label: "Drafts" },
          { id: "paused", label: "Paused" },
          { id: "completed", label: "Completed" },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Ads Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ad</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Placements</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Impressions</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Clicks</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">CTR</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {ads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <EmptyState
                      icon="📢"
                      title="No advertisements found"
                      description="Create your first ad to get started with advertising."
                      action={{
                        label: "Create Ad",
                        onClick: () => setShowCreateModal(true),
                      }}
                    />
                  </td>
                </tr>
              ) : (
                ads.map((ad) => (
                  <tr key={ad.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {ad.imageUrl ? (
                          <img 
                            src={ad.imageUrl} 
                            alt="" 
                            className="w-12 h-8 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-lg">
                            {adTypeIcons[ad.adType] || "📢"}
                          </div>
                        )}
                        <div>
                          <div className="text-gray-900 dark:text-white font-medium text-sm">{ad.name}</div>
                          {ad.advertiserName && (
                            <div className="text-gray-500 text-xs">{ad.advertiserName}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600 dark:text-gray-300 text-sm capitalize">{ad.adType}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {ad.placementIds.slice(0, 2).map((pid) => (
                          <span 
                            key={pid}
                            className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded"
                            title={AD_PLACEMENTS[pid]?.name || pid}
                          >
                            {pid.replace(/_/g, " ").slice(0, 15)}
                          </span>
                        ))}
                        {ad.placementIds.length > 2 && (
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 text-xs rounded">
                            +{ad.placementIds.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ad.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 text-sm">
                      {formatAdNumber(ad.totalImpressions)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 text-sm">
                      {formatAdNumber(ad.totalClicks)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 text-sm">
                      {ad.ctr.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => router.push(`/app/owner/ads/${ad.id}`)}
                          className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="View Details"
                        >
                          📊
                        </button>
                        {ad.status === "draft" && (
                          <button
                            onClick={() => handleStatusChange(ad.id, "active")}
                            className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Activate"
                          >
                            ▶️
                          </button>
                        )}
                        {ad.status === "active" && (
                          <button
                            onClick={() => handleStatusChange(ad.id, "paused")}
                            className="p-1.5 text-gray-400 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Pause"
                          >
                            ⏸️
                          </button>
                        )}
                        {ad.status === "paused" && (
                          <button
                            onClick={() => handleStatusChange(ad.id, "active")}
                            className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Resume"
                          >
                            ▶️
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(ad.id, ad.name)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
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
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h3 className="text-gray-900 dark:text-white font-medium mb-4">Available Placements</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.values(AD_PLACEMENTS).map((placement) => (
            <div key={placement.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl">{adTypeIcons[placement.adType] || "📢"}</div>
              <div className="flex-1 min-w-0">
                <div className="text-gray-900 dark:text-white text-sm font-medium truncate">{placement.name}</div>
                <div className="text-gray-500 text-xs">
                  {placement.width && placement.height 
                    ? `${placement.width}×${placement.height}px` 
                    : placement.adType}
                  {" · "}{placement.location}
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${placement.isActive ? "bg-green-500" : "bg-gray-400"}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Create Ad Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Advertisement"
        size="lg"
      >
        <CreateAdForm 
          onClose={() => setShowCreateModal(false)} 
          onCreated={() => {
            setShowCreateModal(false);
            fetchAds();
          }}
        />
      </Modal>
    </div>
  );
}

function CreateAdForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
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
    } catch {
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Ad Name *"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter ad name"
        />
        <FormSelect
          label="Ad Type"
          value={formData.adType}
          onChange={(e) => setFormData(prev => ({ ...prev, adType: e.target.value }))}
          options={[
            { value: "banner", label: "Banner" },
            { value: "video", label: "Video" },
            { value: "native", label: "Native" },
            { value: "interstitial", label: "Interstitial" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Advertiser Name"
          value={formData.advertiserName}
          onChange={(e) => setFormData(prev => ({ ...prev, advertiserName: e.target.value }))}
          placeholder="Company name"
        />
        <FormField
          label="Advertiser Email"
          type="email"
          value={formData.advertiserEmail}
          onChange={(e) => setFormData(prev => ({ ...prev, advertiserEmail: e.target.value }))}
          placeholder="contact@company.com"
        />
      </div>

      <FormField
        label="Destination URL *"
        value={formData.destinationUrl}
        onChange={(e) => setFormData(prev => ({ ...prev, destinationUrl: e.target.value }))}
        placeholder="https://example.com/landing-page"
      />

      <FormField
        label="Image URL"
        value={formData.imageUrl}
        onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
        placeholder="https://example.com/ad-image.jpg"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Placements *
        </label>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
          {Object.values(AD_PLACEMENTS).map((placement) => (
            <label
              key={placement.id}
              className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                formData.placementIds.includes(placement.id)
                  ? "bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <input
                type="checkbox"
                checked={formData.placementIds.includes(placement.id)}
                onChange={() => togglePlacement(placement.id)}
                className="rounded text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{placement.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Ad"}
        </button>
      </div>
    </form>
  );
}
