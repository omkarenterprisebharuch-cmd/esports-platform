"use client";

import React, { useState, useEffect } from "react";
import { secureFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import { TabNav } from "@/components/app/TabNav";
import { Modal } from "@/components/app/Modal";
import { FormField, FormSelect, FormTextArea } from "@/components/app/FormComponents";
import { EmptyState } from "@/components/app/EmptyState";
import { GameBadge, StatusBadge } from "@/components/app/Badges";

interface Ban {
  id: number;
  game_id: string;
  game_type: string;
  reason: string;
  banned_by: number;
  banned_by_username: string;
  original_user_id: number | null;
  original_user_username: string | null;
  report_id: number | null;
  is_permanent: boolean;
  ban_expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const GAME_OPTIONS = [
  { value: "", label: "All Games" },
  { value: "freefire", label: "Free Fire" },
  { value: "pubg", label: "PUBG" },
  { value: "valorant", label: "Valorant" },
  { value: "codm", label: "COD Mobile" },
  { value: "bgmi", label: "BGMI" },
];

/**
 * Admin Bans Management Page
 * 
 * Features:
 * - View all banned game IDs
 * - Filter by game type and active status
 * - Add new bans (permanent or temporary)
 * - Lift existing bans
 * - Link to related reports
 */
export default function BannedGameIdsPage() {
  const [bans, setBans] = useState<Ban[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameTypeFilter, setGameTypeFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState("active");
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfirmUnban, setShowConfirmUnban] = useState<Ban | null>(null);

  useEffect(() => {
    fetchBans();
  }, [gameTypeFilter, activeTab, page]);

  const fetchBans = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      params.set("active", (activeTab === "active").toString());
      if (gameTypeFilter) params.set("game_type", gameTypeFilter);

      const res = await secureFetch(`/api/bans/game-id?${params}`);
      const data = await res.json();

      if (data.success) {
        setBans(data.data.bans);
        setPagination(data.data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch bans:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async (ban: Ban) => {
    try {
      const res = await secureFetch(`/api/bans/game-id/${ban.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchBans();
        setShowConfirmUnban(null);
      }
    } catch (err) {
      console.error("Failed to unban:", err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const tabs = [
    { id: "active", label: "🚫 Active Bans" },
    { id: "all", label: "📋 All Bans" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Game ID Bans"
        subtitle="Manage banned game IDs across all tournaments"
        backLink={{ href: "/app/admin", label: "Back to Admin" }}
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl text-sm transition"
          >
            + Ban Game ID
          </button>
        }
      />

      {/* Tabs */}
      <TabNav tabs={tabs} activeTab={activeTab} onChange={(tab: string) => { setActiveTab(tab); setPage(1); }} />

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48">
            <FormSelect
              label="Game Type"
              value={gameTypeFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setGameTypeFilter(e.target.value); setPage(1); }}
              options={GAME_OPTIONS}
            />
          </div>
          {pagination && (
            <div className="ml-auto text-sm text-gray-500 dark:text-gray-400 py-2">
              {pagination.total} {activeTab === "active" ? "active" : "total"} bans
            </div>
          )}
        </div>
      </div>

      {/* Bans Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-gray-900 dark:border-white border-t-transparent rounded-full" />
          </div>
        ) : bans.length === 0 ? (
          <EmptyState
            icon="🚫"
            title={activeTab === "active" ? "No active bans" : "No bans found"}
            description="Banned game IDs will appear here."
            variant="card"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Game ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Game
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Reason
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Original User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Banned On
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {bans.map((ban) => (
                    <tr key={ban.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
                          {ban.game_id}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <GameBadge game={ban.game_type} />
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {ban.reason}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {ban.original_user_username || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {ban.is_permanent ? (
                          <span className="text-red-600 dark:text-red-400 font-medium">Permanent</span>
                        ) : (
                          <span className="text-orange-600 dark:text-orange-400">
                            Until {formatDate(ban.ban_expires_at!)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {formatDate(ban.created_at)}
                        <div className="text-xs text-gray-400 dark:text-gray-500">by {ban.banned_by_username}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          ban.is_active 
                            ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" 
                            : "bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-400"
                        }`}>
                          {ban.is_active ? "Active" : "Lifted"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {ban.is_active && (
                            <button
                              onClick={() => setShowConfirmUnban(ban)}
                              className="text-green-600 hover:text-green-800 dark:hover:text-green-400 text-sm font-medium transition"
                            >
                              Lift Ban
                            </button>
                          )}
                          {ban.report_id && (
                            <a
                              href={`/app/admin/reports?id=${ban.report_id}`}
                              className="text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 text-sm transition"
                            >
                              View Report
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {(page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === pagination.totalPages}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Ban Modal */}
      {showAddModal && (
        <AddBanModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchBans();
          }}
        />
      )}

      {/* Confirm Unban Modal */}
      {showConfirmUnban && (
        <Modal isOpen onClose={() => setShowConfirmUnban(null)} title="Lift Ban?">
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Are you sure you want to lift the ban on game ID{" "}
            <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
              {showConfirmUnban.game_id}
            </code>
            ? This player will be able to register for tournaments again.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirmUnban(null)}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => handleUnban(showConfirmUnban)}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition"
            >
              Lift Ban
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Add Ban Modal Component
function AddBanModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [gameId, setGameId] = useState("");
  const [gameType, setGameType] = useState("");
  const [reason, setReason] = useState("");
  const [isPermanent, setIsPermanent] = useState(true);
  const [banDays, setBanDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!gameId || !gameType || !reason) {
      setError("Please fill in all required fields");
      return;
    }

    setSubmitting(true);

    try {
      const res = await secureFetch("/api/bans/game-id", {
        method: "POST",
        body: JSON.stringify({
          game_id: gameId,
          game_type: gameType,
          reason,
          is_permanent: isPermanent,
          ban_duration_days: isPermanent ? undefined : banDays,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
      } else {
        setError(data.message || "Failed to ban game ID");
      }
    } catch {
      setError("Failed to ban game ID");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Ban Game ID">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <FormField
          label="Game ID"
          value={gameId}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGameId(e.target.value)}
          placeholder="Enter the player's game ID"
          required
        />

        <FormSelect
          label="Game"
          value={gameType}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGameType(e.target.value)}
          options={[
            { value: "", label: "Select game..." },
            { value: "freefire", label: "Free Fire" },
            { value: "pubg", label: "PUBG" },
            { value: "valorant", label: "Valorant" },
            { value: "codm", label: "COD Mobile" },
            { value: "bgmi", label: "BGMI" },
          ]}
          required
        />

        <FormTextArea
          label="Reason"
          value={reason}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
          placeholder="Why is this game ID being banned?"
          rows={3}
          required
        />

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={isPermanent}
              onChange={() => setIsPermanent(true)}
              className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Permanent</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={!isPermanent}
              onChange={() => setIsPermanent(false)}
              className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Temporary</span>
          </label>
        </div>

        {!isPermanent && (
          <FormField
            label="Ban Duration (days)"
            type="number"
            value={banDays.toString()}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBanDays(parseInt(e.target.value))}
          />
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition"
          >
            {submitting ? "Banning..." : "Ban Game ID"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
