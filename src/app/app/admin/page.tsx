"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TournamentWithHost } from "@/types";
import { secureFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import { TabNav } from "@/components/app/TabNav";
import { EmptyState } from "@/components/app/EmptyState";
import { Modal } from "@/components/app/Modal";
import { FormField, FormSelect, FormTextArea } from "@/components/app/FormComponents";
import { GameBadge, StatusBadge } from "@/components/app/Badges";

interface Registration {
  registration_id: number;
  slot_number: number;
  registration_type: string;
  status: string;
  team_id: number | null;
  user_id: number;
  team_name: string | null;
  username: string;
}

const GAME_TYPES = [
  { value: "freefire", label: "🔥 Free Fire" },
  { value: "pubg", label: "🎯 PUBG" },
  { value: "valorant", label: "⚔️ Valorant" },
  { value: "codm", label: "🔫 COD Mobile" },
];

const TOURNAMENT_TYPES = [
  { value: "solo", label: "Solo (48 players)" },
  { value: "duo", label: "Duo (24 teams)" },
  { value: "squad", label: "Squad (12 teams)" },
];

const FREEFIRE_MAPS = [
  { value: "Bermuda", label: "Bermuda" },
  { value: "Purgatory", label: "Purgatory" },
  { value: "Kalahari", label: "Kalahari" },
  { value: "Nextera", label: "Nextera" },
  { value: "Alpine", label: "Alpine" },
];

/**
 * Admin Panel - Tournament Host Management
 * 
 * Features:
 * - View hosted tournaments
 * - Create new tournaments
 * - Edit tournaments
 * - Manage room credentials
 * - Submit results/winners
 * - Scheduled tournament templates
 */
export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; is_host: boolean; is_admin: boolean } | null>(null);
  const [tournaments, setTournaments] = useState<TournamentWithHost[]>([]);
  const [scheduledTemplates, setScheduledTemplates] = useState<TournamentWithHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tournaments");

  // Create/Edit state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTournament, setEditingTournament] = useState<TournamentWithHost | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Room credentials modal
  const [roomModal, setRoomModal] = useState<{ show: boolean; tournament: TournamentWithHost | null }>({
    show: false,
    tournament: null,
  });
  const [roomCredentials, setRoomCredentials] = useState({ room_id: "", room_password: "" });

  // Results modal
  const [resultsModal, setResultsModal] = useState<{ show: boolean; tournament: TournamentWithHost | null }>({
    show: false,
    tournament: null,
  });
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [winners, setWinners] = useState({ winner_1: "", winner_2: "", winner_3: "" });

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const getDefaultForm = () => ({
    tournament_name: "",
    game_type: "freefire",
    tournament_type: "solo",
    entry_fee: 0,
    prize_pool: 0,
    max_teams: 48,
    map_name: "Bermuda",
    description: "",
    match_rules: "",
    registration_start_date: "",
    registration_end_date: "",
    tournament_start_date: "",
    tournament_end_date: "",
    schedule_type: "once" as "once" | "everyday",
    publish_time: "",
  });

  const [form, setForm] = useState(getDefaultForm());

  const getMaxTeamsForType = (type: string) => {
    switch (type) {
      case "solo": return 48;
      case "duo": return 24;
      case "squad": return 12;
      default: return 48;
    }
  };

  // Auth check
  useEffect(() => {
    secureFetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const userData = data.data;
          if (!userData.is_host && !userData.is_admin) {
            router.push("/app");
          } else {
            setUser(userData);
            fetchTournaments();
            fetchScheduledTemplates();
          }
        } else {
          router.push("/login");
        }
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const fetchTournaments = useCallback(async () => {
    try {
      const res = await secureFetch("/api/tournaments?hosted=true");
      const data = await res.json();
      if (data.success) {
        setTournaments(data.data.tournaments || []);
      }
    } catch (error) {
      console.error("Failed to fetch tournaments:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchScheduledTemplates = useCallback(async () => {
    try {
      const res = await secureFetch("/api/tournaments?hosted=true&templates=true");
      const data = await res.json();
      if (data.success) {
        setScheduledTemplates(data.data.tournaments || []);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    }
  }, []);

  // Create tournament
  const handleCreate = async () => {
    if (!form.tournament_name || !form.prize_pool || !form.registration_start_date) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    // Validate dates
    const regStart = new Date(form.registration_start_date);
    const regEnd = new Date(form.registration_end_date);
    const tournamentStart = new Date(form.tournament_start_date);

    if (regStart >= regEnd) {
      setMessage({ type: "error", text: "Registration start must be before registration end" });
      return;
    }

    if (regEnd >= tournamentStart) {
      setMessage({ type: "error", text: "Registration must end before tournament starts" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await secureFetch("/api/tournaments", {
        method: "POST",
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Tournament created successfully!" });
        setShowCreateModal(false);
        setForm(getDefaultForm());
        fetchTournaments();
        fetchScheduledTemplates();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to create tournament" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to create tournament" });
    } finally {
      setSubmitting(false);
    }
  };

  // Edit tournament
  const handleEdit = (tournament: TournamentWithHost) => {
    setEditingTournament(tournament);
    setForm({
      tournament_name: tournament.tournament_name,
      game_type: tournament.game_type,
      tournament_type: tournament.tournament_type,
      entry_fee: tournament.entry_fee,
      prize_pool: tournament.prize_pool,
      max_teams: tournament.max_teams,
      map_name: tournament.map_name || "Bermuda",
      description: tournament.description || "",
      match_rules: tournament.match_rules || "",
      registration_start_date: formatDateTimeForInput(tournament.registration_start_date),
      registration_end_date: formatDateTimeForInput(tournament.registration_end_date),
      tournament_start_date: formatDateTimeForInput(tournament.tournament_start_date),
      tournament_end_date: formatDateTimeForInput(tournament.tournament_end_date),
      schedule_type: tournament.schedule_type || "once",
      publish_time: tournament.publish_time || "",
    });
    setShowCreateModal(true);
  };

  const handleUpdate = async () => {
    if (!editingTournament) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const { entry_fee, prize_pool, publish_time, ...updateData } = form;

      const res = await secureFetch(`/api/tournaments/${editingTournament.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...updateData,
          publish_time: publish_time || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Tournament updated successfully!" });
        setShowCreateModal(false);
        setEditingTournament(null);
        setForm(getDefaultForm());
        fetchTournaments();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to update tournament" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to update tournament" });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete tournament
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this tournament?")) return;

    try {
      const res = await secureFetch(`/api/tournaments/${id}`, { method: "DELETE" });

      if (res.ok) {
        setTournaments((prev) => prev.filter((t) => t.id !== id));
        setMessage({ type: "success", text: "Tournament deleted" });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.message || "Failed to delete" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to delete tournament" });
    }
  };

  // Room credentials
  const openRoomModal = (tournament: TournamentWithHost) => {
    setRoomModal({ show: true, tournament });
    setRoomCredentials({
      room_id: tournament.room_id || "",
      room_password: tournament.room_password || "",
    });
  };

  const handleSaveRoomCredentials = async () => {
    if (!roomModal.tournament) return;

    try {
      const res = await secureFetch(`/api/registrations/room-credentials/${roomModal.tournament.id}`, {
        method: "PUT",
        body: JSON.stringify(roomCredentials),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Room credentials shared!" });
        setRoomModal({ show: false, tournament: null });
        fetchTournaments();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.message || "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save credentials" });
    }
  };

  // Results management
  const openResultsModal = async (tournament: TournamentWithHost) => {
    setResultsModal({ show: true, tournament });

    try {
      // Fetch registrations
      const regRes = await secureFetch(`/api/tournaments/${tournament.id}/registrations`);
      const regData = await regRes.json();
      if (regData.success) {
        setRegistrations(regData.data.registrations || []);
      }

      // Fetch existing winners
      const winnersRes = await secureFetch(`/api/tournaments/${tournament.id}/winners`);
      const winnersData = await winnersRes.json();
      if (winnersData.success && winnersData.data.winners) {
        setWinners({
          winner_1: winnersData.data.winners.first || "",
          winner_2: winnersData.data.winners.second || "",
          winner_3: winnersData.data.winners.third || "",
        });
      } else {
        setWinners({ winner_1: "", winner_2: "", winner_3: "" });
      }
    } catch (error) {
      console.error("Failed to load tournament data:", error);
    }
  };

  const handleSaveResults = async () => {
    if (!resultsModal.tournament) return;

    if (!winners.winner_1) {
      setMessage({ type: "error", text: "At least 1st place must be selected" });
      return;
    }

    try {
      const res = await secureFetch(`/api/tournaments/${resultsModal.tournament.id}/winners`, {
        method: "POST",
        body: JSON.stringify(winners),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Winners saved!" });
        setResultsModal({ show: false, tournament: null });
      } else {
        setMessage({ type: "error", text: data.message || "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save results" });
    }
  };

  const formatDateTimeForInput = (dateString: Date | string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const formatDate = (dateString: Date | string) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canEdit = (t: TournamentWithHost) => new Date() < new Date(t.tournament_start_date);
  const canShareRoom = (t: TournamentWithHost) => new Date() >= new Date(t.tournament_start_date);
  const canUpdateResults = (t: TournamentWithHost) => new Date() >= new Date(t.tournament_start_date);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Panel"
        subtitle={`Welcome, ${user.username}`}
        actions={
          <div className="flex gap-3">
            <Link
              href="/app/admin/wallet"
              className="px-4 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition flex items-center gap-2"
            >
              💰 Wallet
            </Link>
            <button
              onClick={() => {
                setEditingTournament(null);
                setForm(getDefaultForm());
                setShowCreateModal(true);
              }}
              className="px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition"
            >
              ✨ Create Tournament
            </button>
          </div>
        }
      />

      {/* Message */}
      {message && (
        <div className={`
          px-4 py-3 rounded-xl
          ${message.type === "success" 
            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800" 
            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
          }
        `}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <TabNav
        tabs={[
          { id: "tournaments", label: "My Tournaments", badge: tournaments.length },
          { id: "scheduled", label: "🗓️ Scheduled", badge: scheduledTemplates.length || undefined },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="pills"
      />

      {/* Tournaments List */}
      {activeTab === "tournaments" && (
        <>
          {tournaments.length === 0 ? (
            <EmptyState
              icon="🏆"
              title="No tournaments yet"
              description="Create your first tournament to start hosting"
              action={{ label: "Create Tournament", onClick: () => setShowCreateModal(true) }}
              variant="card"
            />
          ) : (
            <div className="space-y-4">
              {tournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <GameBadge game={tournament.game_type} size="lg" />
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                          {tournament.tournament_name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {tournament.tournament_type.toUpperCase()} • {tournament.map_name}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={tournament.status} />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Slots</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {tournament.current_teams}/{tournament.max_teams}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Prize</p>
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        ₹{tournament.prize_pool.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Entry</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {tournament.entry_fee > 0 ? `₹${tournament.entry_fee}` : "Free"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Start</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {formatDate(tournament.tournament_start_date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Link
                      href={`/app/tournament/${tournament.id}`}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      View
                    </Link>
                    {canEdit(tournament) && (
                      <button
                        onClick={() => handleEdit(tournament)}
                        className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm hover:bg-blue-200 dark:hover:bg-blue-900/50 transition"
                      >
                        Edit
                      </button>
                    )}
                    {canShareRoom(tournament) && (
                      <button
                        onClick={() => openRoomModal(tournament)}
                        className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm hover:bg-green-200 dark:hover:bg-green-900/50 transition"
                      >
                        🔐 Room Credentials
                      </button>
                    )}
                    {canUpdateResults(tournament) && (
                      <button
                        onClick={() => openResultsModal(tournament)}
                        className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-sm hover:bg-purple-200 dark:hover:bg-purple-900/50 transition"
                      >
                        🏆 Results
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(tournament.id)}
                      className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Scheduled Templates */}
      {activeTab === "scheduled" && (
        <>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              🗓️ Scheduled tournaments are automatically published every day at their set time.
            </p>
          </div>

          {scheduledTemplates.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No scheduled tournaments"
              description="Create a recurring tournament that auto-publishes daily"
              action={{ label: "Create Scheduled", onClick: () => setShowCreateModal(true) }}
              variant="card"
            />
          ) : (
            <div className="space-y-4">
              {scheduledTemplates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 dark:text-white">
                          {template.tournament_name}
                        </h3>
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full">
                          Daily
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {template.game_type.toUpperCase()} • {template.tournament_type.toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Publishes at</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {template.publish_time || "Not set"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Max Slots</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{template.max_teams}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Prize</p>
                      <p className="font-semibold text-green-600 dark:text-green-400">₹{template.prize_pool}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Entry</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {template.entry_fee > 0 ? `₹${template.entry_fee}` : "Free"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                    >
                      Stop & Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create/Edit Tournament Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingTournament(null);
          setForm(getDefaultForm());
        }}
        title={editingTournament ? "Edit Tournament" : "Create Tournament"}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowCreateModal(false);
                setEditingTournament(null);
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={editingTournament ? handleUpdate : handleCreate}
              disabled={submitting}
              className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50"
            >
              {submitting ? "Saving..." : editingTournament ? "Update" : "Create"}
            </button>
          </div>
        }
      >
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          {editingTournament && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                ✏️ Entry Fee and Prize Pool cannot be changed after creation.
              </p>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Basic Information</h3>
            <FormField
              label="Tournament Name"
              value={form.tournament_name}
              onChange={(e) => setForm({ ...form, tournament_name: e.target.value })}
              placeholder="Enter tournament name"
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <FormSelect
                label="Game"
                value={form.game_type}
                onChange={(e) => setForm({ 
                  ...form, 
                  game_type: e.target.value,
                  map_name: e.target.value === "freefire" ? "Bermuda" : "",
                })}
                options={GAME_TYPES}
              />
              <FormSelect
                label="Type"
                value={form.tournament_type}
                onChange={(e) => setForm({ 
                  ...form, 
                  tournament_type: e.target.value,
                  max_teams: getMaxTeamsForType(e.target.value),
                })}
                options={TOURNAMENT_TYPES}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Entry Fee (₹)"
                type="number"
                value={String(form.entry_fee || "")}
                onChange={(e) => setForm({ ...form, entry_fee: parseInt(e.target.value) || 0 })}
                placeholder="0 for free"
                disabled={!!editingTournament}
              />
              <FormField
                label="Prize Pool (₹)"
                type="number"
                value={String(form.prize_pool || "")}
                onChange={(e) => setForm({ ...form, prize_pool: parseInt(e.target.value) || 0 })}
                placeholder="Total prize money"
                required
                disabled={!!editingTournament}
              />
            </div>
            {form.game_type === "freefire" ? (
              <FormSelect
                label="Map"
                value={form.map_name}
                onChange={(e) => setForm({ ...form, map_name: e.target.value })}
                options={FREEFIRE_MAPS}
              />
            ) : (
              <FormField
                label="Map Name"
                value={form.map_name}
                onChange={(e) => setForm({ ...form, map_name: e.target.value })}
                placeholder="e.g., Erangel, Haven"
              />
            )}
          </div>

          {/* Schedule */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Schedule</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Registration Start"
                type="datetime-local"
                value={form.registration_start_date}
                onChange={(e) => setForm({ ...form, registration_start_date: e.target.value })}
                required
              />
              <FormField
                label="Registration End"
                type="datetime-local"
                value={form.registration_end_date}
                onChange={(e) => setForm({ ...form, registration_end_date: e.target.value })}
                required
              />
              <FormField
                label="Tournament Start"
                type="datetime-local"
                value={form.tournament_start_date}
                onChange={(e) => setForm({ ...form, tournament_start_date: e.target.value })}
                required
              />
              <FormField
                label="Tournament End"
                type="datetime-local"
                value={form.tournament_end_date}
                onChange={(e) => setForm({ ...form, tournament_end_date: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Description & Rules */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Description & Rules</h3>
            <FormTextArea
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe your tournament..."
              rows={3}
            />
            <FormTextArea
              label="Match Rules"
              value={form.match_rules}
              onChange={(e) => setForm({ ...form, match_rules: e.target.value })}
              placeholder="List tournament rules..."
              rows={4}
            />
          </div>

          {/* Auto-Scheduling */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">🗓️ Auto-Scheduling</h3>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="schedule_type"
                  checked={form.schedule_type === "once"}
                  onChange={() => setForm({ ...form, schedule_type: "once", publish_time: "" })}
                  className="w-4 h-4"
                />
                <span className="text-gray-700 dark:text-gray-300">Once</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="schedule_type"
                  checked={form.schedule_type === "everyday"}
                  onChange={() => setForm({ ...form, schedule_type: "everyday" })}
                  className="w-4 h-4"
                />
                <span className="text-gray-700 dark:text-gray-300">Everyday</span>
              </label>
            </div>
            {form.schedule_type === "everyday" && (
              <FormField
                label="Publish Time (Daily)"
                type="time"
                value={form.publish_time}
                onChange={(e) => setForm({ ...form, publish_time: e.target.value })}
                required
                hint="Tournament will auto-publish at this time every day"
              />
            )}
          </div>
        </div>
      </Modal>

      {/* Room Credentials Modal */}
      <Modal
        isOpen={roomModal.show}
        onClose={() => setRoomModal({ show: false, tournament: null })}
        title="Share Room Credentials"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setRoomModal({ show: false, tournament: null })}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRoomCredentials}
              className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
            >
              Share with Players
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            These credentials will be visible to all registered players.
          </p>
          <FormField
            label="Room ID"
            value={roomCredentials.room_id}
            onChange={(e) => setRoomCredentials({ ...roomCredentials, room_id: e.target.value })}
            placeholder="Enter room ID"
          />
          <FormField
            label="Room Password"
            value={roomCredentials.room_password}
            onChange={(e) => setRoomCredentials({ ...roomCredentials, room_password: e.target.value })}
            placeholder="Enter room password"
          />
        </div>
      </Modal>

      {/* Results Modal */}
      <Modal
        isOpen={resultsModal.show}
        onClose={() => setResultsModal({ show: false, tournament: null })}
        title="🏆 Manage Results"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setResultsModal({ show: false, tournament: null })}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveResults}
              className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition"
            >
              Save Winners
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select winners from the registered players/teams.
          </p>
          <FormSelect
            label="🥇 1st Place"
            value={winners.winner_1}
            onChange={(e) => setWinners({ ...winners, winner_1: e.target.value })}
            options={[
              { value: "", label: "Select winner..." },
              ...registrations.map((r) => ({
                value: r.team_name || r.username,
                label: `${r.team_name || r.username} (Slot #${r.slot_number})`,
              })),
            ]}
            required
          />
          <FormSelect
            label="🥈 2nd Place"
            value={winners.winner_2}
            onChange={(e) => setWinners({ ...winners, winner_2: e.target.value })}
            options={[
              { value: "", label: "Select winner..." },
              ...registrations.map((r) => ({
                value: r.team_name || r.username,
                label: `${r.team_name || r.username} (Slot #${r.slot_number})`,
              })),
            ]}
          />
          <FormSelect
            label="🥉 3rd Place"
            value={winners.winner_3}
            onChange={(e) => setWinners({ ...winners, winner_3: e.target.value })}
            options={[
              { value: "", label: "Select winner..." },
              ...registrations.map((r) => ({
                value: r.team_name || r.username,
                label: `${r.team_name || r.username} (Slot #${r.slot_number})`,
              })),
            ]}
          />
        </div>
      </Modal>
    </div>
  );
}
