"use client";

import React, { useState, useEffect } from "react";
import { secureFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { TabNav } from "@/components/app/TabNav";
import { Modal } from "@/components/app/Modal";
import { FormSelect, FormTextArea } from "@/components/app/FormComponents";
import { EmptyState } from "@/components/app/EmptyState";
import { GameBadge } from "@/components/app/Badges";

interface Report {
  id: number;
  reporter_id: number;
  reporter_username: string;
  reported_user_id: number | null;
  reported_username: string | null;
  reported_game_id: string;
  reported_game_type: string;
  tournament_id: number | null;
  tournament_name: string | null;
  category_id: number;
  category_name: string;
  subcategory_id: number | null;
  subcategory_name: string | null;
  description: string;
  evidence_urls: string[];
  status: string;
  priority: string;
  action_taken: string | null;
  resolution_notes: string | null;
  reviewer_username: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_MAP: Record<string, "warning" | "info" | "success" | "default" | "error"> = {
  pending: "warning",
  under_review: "info",
  resolved: "success",
  dismissed: "default",
  escalated: "error",
};

const PRIORITY_MAP: Record<string, "default" | "info" | "warning" | "error"> = {
  low: "default",
  normal: "info",
  high: "warning",
  critical: "error",
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under Review" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
  { value: "escalated", label: "Escalated" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All Priorities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

const GAME_OPTIONS = [
  { value: "", label: "All Games" },
  { value: "freefire", label: "Free Fire" },
  { value: "pubg", label: "PUBG" },
  { value: "valorant", label: "Valorant" },
  { value: "codm", label: "COD Mobile" },
  { value: "bgmi", label: "BGMI" },
];

/**
 * Admin Reports Management Page
 * 
 * Features:
 * - View all player reports
 * - Filter by status, priority, game type
 * - Review and take action on reports
 * - Ban game IDs directly from reports
 */
export default function ReportsManagementPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [gameTypeFilter, setGameTypeFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchReports();
  }, [statusFilter, priorityFilter, gameTypeFilter, page]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (gameTypeFilter) params.set("game_type", gameTypeFilter);

      const res = await secureFetch(`/api/reports?${params}`);
      const data = await res.json();

      if (data.success) {
        setReports(data.data.reports);
        setPagination(data.data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = (report: Report) => {
    setSelectedReport(report);
    setShowActionModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const clearFilters = () => {
    setStatusFilter("");
    setPriorityFilter("");
    setGameTypeFilter("");
    setPage(1);
  };

  // Calculate stats from current page (ideally would be from total)
  const pendingCount = reports.filter((r) => r.status === "pending").length;
  const underReviewCount = reports.filter((r) => r.status === "under_review").length;
  const highPriorityCount = reports.filter((r) => r.priority === "high" || r.priority === "critical").length;
  const resolvedCount = reports.filter((r) => r.status === "resolved").length;

  const tabs = [
    { id: "", label: "📋 All Reports" },
    { id: "pending", label: `⏳ Pending (${pendingCount})` },
    { id: "under_review", label: `🔍 Under Review (${underReviewCount})` },
    { id: "resolved", label: "✅ Resolved" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Player Reports"
        subtitle="Review and take action on player reports"
        backLink={{ href: "/app/admin", label: "Back to Admin" }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="⏳" title="Pending" value={pendingCount.toString()} color="warning" />
        <StatCard icon="🔍" title="Under Review" value={underReviewCount.toString()} color="primary" />
        <StatCard icon="🚨" title="High Priority" value={highPriorityCount.toString()} color="danger" />
        <StatCard icon="✅" title="Resolved" value={resolvedCount.toString()} color="success" />
      </div>

      {/* Tabs */}
      <TabNav
        tabs={tabs}
        activeTab={statusFilter}
        onChange={(tab: string) => { setStatusFilter(tab); setPage(1); }}
      />

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormSelect
            label="Priority"
            value={priorityFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setPriorityFilter(e.target.value); setPage(1); }}
            options={PRIORITY_OPTIONS}
          />
          <FormSelect
            label="Game"
            value={gameTypeFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setGameTypeFilter(e.target.value); setPage(1); }}
            options={GAME_OPTIONS}
          />
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2.5 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Clear Filters
            </button>
          </div>
          {pagination && (
            <div className="flex items-end justify-end text-sm text-gray-500 dark:text-gray-400 py-2">
              {pagination.total} reports found
            </div>
          )}
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-gray-900 dark:border-white border-t-transparent rounded-full" />
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon="🚨"
            title="No reports found"
            description="Reports will appear here when players submit them."
            variant="card"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Reported Player
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Game
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                        #{report.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {report.reported_username || "Unknown"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {report.reported_game_id}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900 dark:text-white">
                          {report.category_name}
                        </div>
                        {report.subcategory_name && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {report.subcategory_name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <GameBadge game={report.reported_game_type} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          report.priority === 'critical' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
                          report.priority === 'high' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' :
                          report.priority === 'normal' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                          'bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-400'
                        }`}>
                          {report.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          report.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                          report.status === 'under_review' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                          report.status === 'resolved' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                          report.status === 'escalated' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
                          'bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-400'
                        }`}>
                          {report.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {formatDate(report.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleViewReport(report)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition"
                        >
                          View Details
                        </button>
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

      {/* Action Modal */}
      {showActionModal && selectedReport && (
        <ReportActionModal
          report={selectedReport}
          onClose={() => {
            setShowActionModal(false);
            setSelectedReport(null);
          }}
          onUpdate={fetchReports}
        />
      )}
    </div>
  );
}

// Report Action Modal Component
interface ReportActionModalProps {
  report: Report;
  onClose: () => void;
  onUpdate: () => void;
}

function ReportActionModal({ report, onClose, onUpdate }: ReportActionModalProps) {
  const [status, setStatus] = useState(report.status);
  const [priority, setPriority] = useState(report.priority);
  const [actionTaken, setActionTaken] = useState<string>("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await secureFetch(`/api/reports/${report.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status,
          priority,
          action_taken: actionTaken || undefined,
          resolution_notes: resolutionNotes || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onUpdate();
        onClose();
      } else {
        setError(data.message || "Failed to update report");
      }
    } catch {
      setError("Failed to update report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Report #${report.id}`} size="lg">
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Report Details */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400">Reported Player</label>
            <p className="font-medium text-gray-900 dark:text-white">
              {report.reported_username || "Unknown"}
            </p>
            <p className="text-sm text-gray-500 font-mono">{report.reported_game_id}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400">Game</label>
            <p className="font-medium text-gray-900 dark:text-white">
              <GameBadge game={report.reported_game_type} />
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400">Category</label>
            <p className="font-medium text-gray-900 dark:text-white">
              {report.category_name}
              {report.subcategory_name && ` → ${report.subcategory_name}`}
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400">Reporter</label>
            <p className="font-medium text-gray-900 dark:text-white">
              {report.reporter_username}
            </p>
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-500 dark:text-gray-400">Description</label>
          <p className="mt-1 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-gray-900 dark:text-white text-sm">
            {report.description}
          </p>
        </div>

        {report.evidence_urls && report.evidence_urls.length > 0 && (
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400">Evidence ({report.evidence_urls.length})</label>
            <div className="mt-1 space-y-2">
              {report.evidence_urls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline truncate text-sm"
                >
                  📎 {url}
                </a>
              ))}
            </div>
          </div>
        )}

        <hr className="border-gray-200 dark:border-gray-700" />

        {/* Action Form */}
        <div className="grid grid-cols-2 gap-4">
          <FormSelect
            label="Status"
            value={status}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value)}
            options={[
              { value: "pending", label: "Pending" },
              { value: "under_review", label: "Under Review" },
              { value: "resolved", label: "Resolved" },
              { value: "dismissed", label: "Dismissed" },
              { value: "escalated", label: "Escalated" },
            ]}
          />
          <FormSelect
            label="Priority"
            value={priority}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPriority(e.target.value)}
            options={[
              { value: "low", label: "Low" },
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
              { value: "critical", label: "Critical" },
            ]}
          />
        </div>

        <div>
          <FormSelect
            label="Action Taken"
            value={actionTaken}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setActionTaken(e.target.value)}
            options={[
              { value: "", label: "No Action Yet" },
              { value: "none", label: "Reviewed - No Action Needed" },
              { value: "warning", label: "Warning Issued" },
              { value: "temp_ban", label: "Temporary Ban" },
              { value: "permanent_ban", label: "Permanent Account Ban" },
              { value: "game_id_ban", label: "🚫 Ban Game ID (Cannot Play Again)" },
            ]}
          />
          {actionTaken === "game_id_ban" && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              ⚠️ This will permanently ban the game ID &quot;{report.reported_game_id}&quot; from playing on the platform.
            </p>
          )}
        </div>

        <FormTextArea
          label="Resolution Notes"
          value={resolutionNotes}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setResolutionNotes(e.target.value)}
          placeholder="Add notes about your decision..."
          rows={3}
        />

        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 transition"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
