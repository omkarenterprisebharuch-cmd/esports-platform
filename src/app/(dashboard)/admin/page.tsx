"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TournamentWithHost, User } from "@/types";
import { secureFetch } from "@/lib/api-client";

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

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tournaments, setTournaments] = useState<TournamentWithHost[]>([]);
  const [scheduledTemplates, setScheduledTemplates] = useState<TournamentWithHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tournaments" | "scheduled" | "create" | "edit" | "results">("tournaments");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Results management state (simplified - just names)
  const [resultsTournament, setResultsTournament] = useState<TournamentWithHost | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [winner1, setWinner1] = useState("");
  const [winner2, setWinner2] = useState("");
  const [winner3, setWinner3] = useState("");
  const [savingResults, setSavingResults] = useState(false);

  const getMaxTeamsForType = (type: string) => {
    switch (type) {
      case "solo": return 48;
      case "duo": return 24;
      case "squad": return 12;
      default: return 48;
    }
  };

  const freeFireMaps = ["Bermuda", "Purgatory", "Kalahari", "Nextera", "Alpine"];

  const [form, setForm] = useState({
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
    // Auto-scheduling fields
    schedule_type: "once" as "once" | "everyday",
    publish_time: "", // HH:MM format
  });

  // Room credentials modal state
  const [roomCredentialsModal, setRoomCredentialsModal] = useState<{
    show: boolean;
    tournamentId: number | null;
    tournamentName: string;
    roomId: string;
    roomPassword: string;
  }>({
    show: false,
    tournamentId: null,
    tournamentName: "",
    roomId: "",
    roomPassword: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");

    // Get current user
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const userData = data.data;
          // Check is_host or is_admin flags (not role)
          if (!userData.is_host && !userData.is_admin) {
            router.push("/dashboard");
          } else {
            setUser(userData);
            fetchMyTournaments(token);
            fetchScheduledTemplates(token);
          }
        }
      });
  }, [router]);

  const fetchMyTournaments = (token: string | null) => {
    fetch("/api/tournaments?hosted=true", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTournaments(data.data.tournaments || []);
        }
      })
      .finally(() => setLoading(false));
  };

  const fetchScheduledTemplates = (token: string | null) => {
    fetch("/api/tournaments?hosted=true&templates=true", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setScheduledTemplates(data.data.tournaments || []);
        }
      });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validate registration dates are before tournament start
    const regStart = new Date(form.registration_start_date);
    const regEnd = new Date(form.registration_end_date);
    const tournamentStart = new Date(form.tournament_start_date);

    if (regStart >= tournamentStart) {
      setMessage({ type: "error", text: "Registration start must be before tournament start" });
      return;
    }

    if (regEnd >= tournamentStart) {
      setMessage({ type: "error", text: "Registration end must be before tournament start" });
      return;
    }

    if (regStart >= regEnd) {
      setMessage({ type: "error", text: "Registration start must be before registration end" });
      return;
    }

    setCreating(true);
    const token = localStorage.getItem("token");

    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message || "Tournament created successfully!" });
        const wasScheduled = form.schedule_type === "everyday";
        setForm({
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
          schedule_type: "once",
          publish_time: "",
        });
        fetchMyTournaments(token);
        fetchScheduledTemplates(token);
        // Navigate to appropriate tab based on schedule type
        setActiveTab(wasScheduled ? "scheduled" : "tournaments");
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to create tournament" });
    } finally {
      setCreating(false);
    }
  };

  const canEditTournament = (tournament: TournamentWithHost) => {
    const now = new Date();
    const startDate = new Date(tournament.tournament_start_date);
    return now < startDate;
  };

  const formatDateTimeForInput = (dateString: Date | string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    // Format in local timezone for datetime-local input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleEdit = (tournament: TournamentWithHost) => {
    setEditingId(tournament.id);
    setForm({
      tournament_name: tournament.tournament_name,
      game_type: tournament.game_type,
      tournament_type: tournament.tournament_type,
      entry_fee: tournament.entry_fee,
      prize_pool: tournament.prize_pool,
      max_teams: tournament.max_teams,
      map_name: tournament.map_name || (tournament.game_type === "freefire" ? "Bermuda" : ""),
      description: tournament.description || "",
      match_rules: tournament.match_rules || "",
      registration_start_date: formatDateTimeForInput(tournament.registration_start_date),
      registration_end_date: formatDateTimeForInput(tournament.registration_end_date),
      tournament_start_date: formatDateTimeForInput(tournament.tournament_start_date),
      tournament_end_date: formatDateTimeForInput(tournament.tournament_end_date),
      schedule_type: "once",
      publish_time: "",
    });
    setActiveTab("edit");
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validate registration dates are before tournament start
    const regStart = new Date(form.registration_start_date);
    const regEnd = new Date(form.registration_end_date);
    const tournamentStart = new Date(form.tournament_start_date);

    if (regStart >= tournamentStart) {
      setMessage({ type: "error", text: "Registration start must be before tournament start" });
      return;
    }

    if (regEnd >= tournamentStart) {
      setMessage({ type: "error", text: "Registration end must be before tournament start" });
      return;
    }

    if (regStart >= regEnd) {
      setMessage({ type: "error", text: "Registration start must be before registration end" });
      return;
    }

    setCreating(true);
    const token = localStorage.getItem("token");

    try {
      // Don't send entry_fee and prize_pool in update (they can't be changed)
      const { entry_fee, prize_pool, ...updateData } = form;
      
      const res = await fetch(`/api/tournaments/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Tournament updated successfully!" });
        setEditingId(null);
        setForm({
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
          schedule_type: "once",
          publish_time: "",
        });
        fetchMyTournaments(token);
        setActiveTab("tournaments");
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to update tournament" });
    } finally {
      setCreating(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({
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
      schedule_type: "once",
      publish_time: "",
    });
    setActiveTab("tournaments");
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this tournament?")) return;

    try {
      const res = await secureFetch(`/api/tournaments/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setTournaments((prev) => prev.filter((t) => t.id !== id));
        setMessage({ type: "success", text: "Tournament deleted" });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.message || "Failed to delete tournament" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to delete tournament" });
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm("Are you sure you want to stop and delete this scheduled tournament template? This will stop future auto-publishing.")) return;

    try {
      const res = await secureFetch(`/api/tournaments/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setScheduledTemplates((prev) => prev.filter((t) => t.id !== id));
        setMessage({ type: "success", text: "Scheduled template deleted. No more tournaments will be auto-published from it." });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.message || "Failed to delete scheduled template" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to delete scheduled template" });
    }
  };

  // Check if tournament has started (for showing room credentials button)
  const canShareRoomCredentials = (tournament: TournamentWithHost) => {
    const now = new Date();
    const startDate = new Date(tournament.tournament_start_date);
    return now >= startDate;
  };

  // Open room credentials modal
  const openRoomCredentialsModal = (tournament: TournamentWithHost) => {
    setRoomCredentialsModal({
      show: true,
      tournamentId: tournament.id,
      tournamentName: tournament.tournament_name,
      roomId: tournament.room_id || "",
      roomPassword: tournament.room_password || "",
    });
  };

  // Save room credentials
  const handleSaveRoomCredentials = async () => {
    if (!roomCredentialsModal.tournamentId) return;

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`/api/registrations/room-credentials/${roomCredentialsModal.tournamentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          room_id: roomCredentialsModal.roomId,
          room_password: roomCredentialsModal.roomPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Room credentials shared successfully!" });
        setRoomCredentialsModal({ show: false, tournamentId: null, tournamentName: "", roomId: "", roomPassword: "" });
        fetchMyTournaments(token);
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to share room credentials" });
    }
  };

  // Check if tournament can have results updated
  const canUpdateResults = (tournament: TournamentWithHost) => {
    const now = new Date();
    const startDate = new Date(tournament.tournament_start_date);
    return now >= startDate; // Can update results after tournament starts
  };

  // Open results management for a tournament
  const openResultsManagement = async (tournament: TournamentWithHost) => {
    setResultsTournament(tournament);
    setActiveTab("results");
    setMessage(null);

    const token = localStorage.getItem("token");

    try {
      // Fetch registrations for the tournament
      const regRes = await fetch(`/api/tournaments/${tournament.id}/registrations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const regData = await regRes.json();

      if (regData.success) {
        setRegistrations(regData.data.registrations);
      }

      // Fetch existing winners
      const winnersRes = await fetch(`/api/tournaments/${tournament.id}/winners`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const winnersData = await winnersRes.json();

      if (winnersData.success && winnersData.data.winners) {
        setWinner1(winnersData.data.winners.first || "");
        setWinner2(winnersData.data.winners.second || "");
        setWinner3(winnersData.data.winners.third || "");
      } else {
        // Reset winners
        setWinner1("");
        setWinner2("");
        setWinner3("");
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load tournament data" });
    }
  };

  // Save results
  const handleSaveResults = async () => {
    if (!resultsTournament) return;

    // Validate that at least 1st place is selected
    if (!winner1) {
      setMessage({ type: "error", text: "At least 1st place winner must be selected" });
      return;
    }

    // Check for duplicate selections
    const winners = [winner1, winner2, winner3].filter(Boolean);
    if (new Set(winners).size !== winners.length) {
      setMessage({ type: "error", text: "Same team/player cannot be selected for multiple ranks" });
      return;
    }

    setSavingResults(true);
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`/api/tournaments/${resultsTournament.id}/winners`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          winner_1: winner1,
          winner_2: winner2,
          winner_3: winner3,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Winners saved successfully!" });
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save winners" });
    } finally {
      setSavingResults(false);
    }
  };

  // Cancel results editing
  const cancelResultsEdit = () => {
    setResultsTournament(null);
    setRegistrations([]);
    setWinner1("");
    setWinner2("");
    setWinner3("");
    setActiveTab("tournaments");
  };

  const formatDate = (dateString: Date | string) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-500">Welcome, {user?.username}</p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-600"
              : "bg-red-50 border border-red-200 text-red-600"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab("tournaments")}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === "tournaments"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          My Tournaments
        </button>
        <button
          onClick={() => setActiveTab("scheduled")}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === "scheduled"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          🗓️ Scheduled
          {scheduledTemplates.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
              {scheduledTemplates.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("create")}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === "create"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Create Tournament
        </button>
      </div>

      {activeTab === "tournaments" && (
        <div className="space-y-4">
          {tournaments.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <p className="text-gray-500 mb-4">
                You haven&apos;t created any tournaments yet
              </p>
              <button
                onClick={() => setActiveTab("create")}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition"
              >
                Create Your First Tournament
              </button>
            </div>
          ) : (
            tournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="bg-white border border-gray-200 rounded-xl p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {tournament.tournament_name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {tournament.game_type.toUpperCase()} •{" "}
                      {tournament.tournament_type.toUpperCase()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                      tournament.status === "ongoing"
                        ? "bg-yellow-100 text-yellow-700"
                        : tournament.status === "completed"
                          ? "bg-gray-100 text-gray-700"
                          : "bg-green-100 text-green-700"
                    }`}
                  >
                    {tournament.status.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                  <div>
                    <p className="text-gray-500">Teams</p>
                    <p className="font-medium">
                      {tournament.current_teams}/{tournament.max_teams}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Prize</p>
                    <p className="font-medium text-green-600">
                      ₹{tournament.prize_pool}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Entry</p>
                    <p className="font-medium">
                      {tournament.entry_fee > 0
                        ? `₹${tournament.entry_fee}`
                        : "Free"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Start Date</p>
                    <p className="font-medium">
                      {formatDate(tournament.tournament_start_date)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => router.push(`/tournament/${tournament.id}`)}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition"
                  >
                    View
                  </button>
                  {canEditTournament(tournament) && (
                    <button
                      onClick={() => handleEdit(tournament)}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition"
                    >
                      Edit
                    </button>
                  )}
                  {canShareRoomCredentials(tournament) && (
                    <button
                      onClick={() => openRoomCredentialsModal(tournament)}
                      className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition"
                    >
                      Share Room Credentials
                    </button>
                  )}
                  {canUpdateResults(tournament) && (
                    <button
                      onClick={() => openResultsManagement(tournament)}
                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm hover:bg-purple-200 transition"
                    >
                      🏆 Manage Results
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(tournament.id)}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "scheduled" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-blue-500 text-xl">🗓️</span>
              <div>
                <h3 className="font-semibold text-blue-800">Scheduled Tournament Templates</h3>
                <p className="text-sm text-blue-600">
                  These tournaments auto-publish every day at their scheduled time. 
                  Users can register until the registration end time.
                </p>
              </div>
            </div>
          </div>

          {scheduledTemplates.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <p className="text-gray-500 mb-4">
                You haven&apos;t created any scheduled recurring tournaments yet
              </p>
              <button
                onClick={() => setActiveTab("create")}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition"
              >
                Create Scheduled Tournament
              </button>
            </div>
          ) : (
            scheduledTemplates.map((template) => (
              <div
                key={template.id}
                className="bg-white border border-gray-200 rounded-xl p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {template.tournament_name}
                      </h3>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                        Daily
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {template.game_type.toUpperCase()} •{" "}
                      {template.tournament_type.toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">
                      Publishes at
                    </p>
                    <p className="text-lg font-bold text-blue-600">
                      {template.publish_time || "Not set"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                  <div>
                    <p className="text-gray-500">Max {template.tournament_type === "solo" ? "Players" : "Teams"}</p>
                    <p className="font-medium">{template.max_teams}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Prize</p>
                    <p className="font-medium text-green-600">
                      ₹{template.prize_pool}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Entry</p>
                    <p className="font-medium">
                      {template.entry_fee > 0
                        ? `₹${template.entry_fee}`
                        : "Free"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Last Published</p>
                    <p className="font-medium">
                      {template.last_published_at
                        ? formatDate(template.last_published_at)
                        : "Never"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition"
                  >
                    Stop & Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "create" && (
        <form onSubmit={handleCreate} className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Basic Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tournament Name *
                </label>
                <input
                  type="text"
                  value={form.tournament_name}
                  onChange={(e) =>
                    setForm({ ...form, tournament_name: e.target.value })
                  }
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Game *
                </label>
                <select
                  value={form.game_type}
                  onChange={(e) => {
                    const newGame = e.target.value;
                    setForm({ 
                      ...form, 
                      game_type: newGame,
                      map_name: newGame === "freefire" ? "Bermuda" : ""
                    });
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="freefire">Free Fire</option>
                  <option value="pubg">PUBG</option>
                  <option value="valorant">Valorant</option>
                  <option value="codm">Call of Duty Mobile</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tournament Type *
                </label>
                <select
                  value={form.tournament_type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setForm({ 
                      ...form, 
                      tournament_type: newType,
                      max_teams: getMaxTeamsForType(newType)
                    });
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="solo">Solo (Max 48 players)</option>
                  <option value="duo">Duo (Max 24 teams)</option>
                  <option value="squad">Squad (Max 12 teams)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entry Fee (₹)
                </label>
                <input
                  type="number"
                  value={form.entry_fee || ""}
                  onChange={(e) =>
                    setForm({ ...form, entry_fee: parseInt(e.target.value) || 0 })
                  }
                  min="0"
                  placeholder="0"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prize Pool (₹) *
                </label>
                <input
                  type="number"
                  value={form.prize_pool || ""}
                  onChange={(e) =>
                    setForm({ ...form, prize_pool: parseInt(e.target.value) || 0 })
                  }
                  min="0"
                  placeholder="0"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max {form.tournament_type === "solo" ? "Players" : "Teams"} *
                </label>
                <input
                  type="number"
                  value={form.max_teams}
                  readOnly
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Auto-set based on tournament type</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Map Name
                </label>
                {form.game_type === "freefire" ? (
                  <select
                    value={form.map_name}
                    onChange={(e) => setForm({ ...form, map_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  >
                    {freeFireMaps.map((map) => (
                      <option key={map} value={map}>{map}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.map_name}
                    onChange={(e) => setForm({ ...form, map_name: e.target.value })}
                    placeholder="e.g., Erangel, Haven"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Schedule</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Registration Start *
                </label>
                <input
                  type="datetime-local"
                  value={form.registration_start_date}
                  onChange={(e) =>
                    setForm({ ...form, registration_start_date: e.target.value })
                  }
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Registration End *
                </label>
                <input
                  type="datetime-local"
                  value={form.registration_end_date}
                  onChange={(e) =>
                    setForm({ ...form, registration_end_date: e.target.value })
                  }
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tournament Start *
                </label>
                <input
                  type="datetime-local"
                  value={form.tournament_start_date}
                  onChange={(e) =>
                    setForm({ ...form, tournament_start_date: e.target.value })
                  }
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tournament End *
                </label>
                <input
                  type="datetime-local"
                  value={form.tournament_end_date}
                  onChange={(e) =>
                    setForm({ ...form, tournament_end_date: e.target.value })
                  }
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Description & Rules
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  placeholder="Describe your tournament..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Match Rules
                </label>
                <textarea
                  value={form.match_rules}
                  onChange={(e) =>
                    setForm({ ...form, match_rules: e.target.value })
                  }
                  rows={4}
                  placeholder="List your tournament rules..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Auto-Scheduling Section */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              🗓️ Auto-Scheduling
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Choose how often this tournament should be published
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Type *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="schedule_type_create"
                      value="once"
                      checked={form.schedule_type === "once"}
                      onChange={(e) => setForm({ ...form, schedule_type: e.target.value as "once" | "everyday", publish_time: "" })}
                      className="w-4 h-4 text-gray-900 focus:ring-gray-900"
                    />
                    <span className="text-gray-700">Once</span>
                    <span className="text-xs text-gray-500">(One-time tournament)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="schedule_type_create"
                      value="everyday"
                      checked={form.schedule_type === "everyday"}
                      onChange={(e) => setForm({ ...form, schedule_type: e.target.value as "once" | "everyday" })}
                      className="w-4 h-4 text-gray-900 focus:ring-gray-900"
                    />
                    <span className="text-gray-700">Everyday</span>
                    <span className="text-xs text-gray-500">(Auto-publish daily)</span>
                  </label>
                </div>
              </div>

              {form.schedule_type === "everyday" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-blue-500 text-xl">⏰</span>
                    <div className="flex-1">
                      <p className="text-blue-700 text-sm font-medium mb-3">
                        Daily Auto-Publish Settings
                      </p>
                      <p className="text-blue-600 text-xs mb-4">
                        Tournament will be automatically created and published every day at the specified time with the same details. 
                        Users can register until the registration end time.
                      </p>
                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-1">
                          Publish Time (Registration Start Time) *
                        </label>
                        <input
                          type="time"
                          value={form.publish_time}
                          onChange={(e) => setForm({ ...form, publish_time: e.target.value })}
                          required={form.schedule_type === "everyday"}
                          className="w-full max-w-xs px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        />
                        <p className="text-xs text-blue-500 mt-2">
                          Example: If you set 10:00 AM, tournament will go live at 10:00 AM every day
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full py-4 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 text-lg"
          >
            {creating ? "Creating..." : "Create Tournament"}
          </button>
        </form>
      )}

      {activeTab === "edit" && editingId && (
        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <p className="text-blue-700 text-sm">
              ✏️ Editing tournament. Note: Entry Fee and Prize Pool cannot be changed.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Basic Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tournament Name *
                </label>
                <input
                  type="text"
                  value={form.tournament_name}
                  onChange={(e) =>
                    setForm({ ...form, tournament_name: e.target.value })
                  }
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Game *
                </label>
                <select
                  value={form.game_type}
                  onChange={(e) => {
                    const newGame = e.target.value;
                    setForm({ 
                      ...form, 
                      game_type: newGame,
                      map_name: newGame === "freefire" ? "Bermuda" : ""
                    });
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="freefire">Free Fire</option>
                  <option value="pubg">PUBG</option>
                  <option value="valorant">Valorant</option>
                  <option value="codm">Call of Duty Mobile</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tournament Type *
                </label>
                <select
                  value={form.tournament_type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setForm({ 
                      ...form, 
                      tournament_type: newType,
                      max_teams: getMaxTeamsForType(newType)
                    });
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="solo">Solo (Max 48 players)</option>
                  <option value="duo">Duo (Max 24 teams)</option>
                  <option value="squad">Squad (Max 12 teams)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entry Fee (₹) 🔒
                </label>
                <input
                  type="number"
                  value={form.entry_fee}
                  readOnly
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Cannot be changed after creation</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prize Pool (₹) 🔒
                </label>
                <input
                  type="number"
                  value={form.prize_pool}
                  readOnly
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Cannot be changed after creation</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max {form.tournament_type === "solo" ? "Players" : "Teams"} *
                </label>
                <input
                  type="number"
                  value={form.max_teams}
                  readOnly
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Auto-set based on tournament type</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Map Name
                </label>
                {form.game_type === "freefire" ? (
                  <select
                    value={form.map_name}
                    onChange={(e) => setForm({ ...form, map_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  >
                    {freeFireMaps.map((map) => (
                      <option key={map} value={map}>{map}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.map_name}
                    onChange={(e) => setForm({ ...form, map_name: e.target.value })}
                    placeholder="e.g., Erangel, Haven"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Schedule</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Registration Start *
                </label>
                <input
                  type="datetime-local"
                  value={form.registration_start_date}
                  onChange={(e) =>
                    setForm({ ...form, registration_start_date: e.target.value })
                  }
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Registration End *
                </label>
                <input
                  type="datetime-local"
                  value={form.registration_end_date}
                  onChange={(e) =>
                    setForm({ ...form, registration_end_date: e.target.value })
                  }
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tournament Start *
                </label>
                <input
                  type="datetime-local"
                  value={form.tournament_start_date}
                  onChange={(e) =>
                    setForm({ ...form, tournament_start_date: e.target.value })
                  }
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tournament End *
                </label>
                <input
                  type="datetime-local"
                  value={form.tournament_end_date}
                  onChange={(e) =>
                    setForm({ ...form, tournament_end_date: e.target.value })
                  }
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Description & Rules
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  placeholder="Describe your tournament..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Match Rules
                </label>
                <textarea
                  value={form.match_rules}
                  onChange={(e) =>
                    setForm({ ...form, match_rules: e.target.value })
                  }
                  rows={4}
                  placeholder="List your tournament rules..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={cancelEdit}
              className="flex-1 py-4 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition text-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-50 text-lg"
            >
              {creating ? "Updating..." : "Update Tournament"}
            </button>
          </div>
        </form>
      )}

      {/* Results Management Tab */}
      {activeTab === "results" && resultsTournament && (
        <div className="space-y-6">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-purple-900">
                  🏆 Managing Results: {resultsTournament.tournament_name}
                </h2>
                <p className="text-sm text-purple-700 mt-1">
                  {resultsTournament.tournament_type.toUpperCase()} • {registrations.length} registered {resultsTournament.tournament_type === "solo" ? "players" : "teams"}
                </p>
              </div>
              <button
                onClick={cancelResultsEdit}
                className="text-purple-600 hover:text-purple-800 text-sm underline"
              >
                ← Back to Tournaments
              </button>
            </div>
          </div>

          {registrations.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <p className="text-gray-500">No registrations found for this tournament.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Select Winners (Top 3)</h3>
              <p className="text-sm text-gray-500 mb-6">
                Select the winning {resultsTournament.tournament_type === "solo" ? "players" : "teams"} from the registered participants.
              </p>

              <div className="space-y-4">
                {/* 1st Place */}
                <div className="p-4 rounded-xl bg-yellow-50 border-2 border-yellow-300">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">🥇</span>
                    <span className="font-semibold text-gray-900">1st Place</span>
                  </div>
                  <select
                    value={winner1}
                    onChange={(e) => setWinner1(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select {resultsTournament.tournament_type === "solo" ? "player" : "team"}...</option>
                    {registrations.map((reg) => (
                      <option
                        key={reg.registration_id}
                        value={reg.team_name || reg.username}
                      >
                        #{reg.slot_number} - {reg.team_name || reg.username}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2nd Place */}
                <div className="p-4 rounded-xl bg-gray-50 border-2 border-gray-300">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">🥈</span>
                    <span className="font-semibold text-gray-900">2nd Place</span>
                  </div>
                  <select
                    value={winner2}
                    onChange={(e) => setWinner2(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select {resultsTournament.tournament_type === "solo" ? "player" : "team"}...</option>
                    {registrations.map((reg) => (
                      <option
                        key={reg.registration_id}
                        value={reg.team_name || reg.username}
                      >
                        #{reg.slot_number} - {reg.team_name || reg.username}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3rd Place */}
                <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">🥉</span>
                    <span className="font-semibold text-gray-900">3rd Place</span>
                  </div>
                  <select
                    value={winner3}
                    onChange={(e) => setWinner3(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select {resultsTournament.tournament_type === "solo" ? "player" : "team"}...</option>
                    {registrations.map((reg) => (
                      <option
                        key={reg.registration_id}
                        value={reg.team_name || reg.username}
                      >
                        #{reg.slot_number} - {reg.team_name || reg.username}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={cancelResultsEdit}
                  className="flex-1 py-4 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition text-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveResults}
                  disabled={savingResults || !winner1}
                  className="flex-1 py-4 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition disabled:opacity-50 text-lg"
                >
                  {savingResults ? "Saving..." : "Save Winners"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Room Credentials Modal */}
      {roomCredentialsModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Share Room Credentials
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Tournament: <span className="font-medium">{roomCredentialsModal.tournamentName}</span>
            </p>
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg mb-4">
              ⚠️ These credentials will be shared with all registered participants.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room ID *
                </label>
                <input
                  type="text"
                  value={roomCredentialsModal.roomId}
                  onChange={(e) =>
                    setRoomCredentialsModal({ ...roomCredentialsModal, roomId: e.target.value })
                  }
                  placeholder="Enter room ID"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Password *
                </label>
                <input
                  type="text"
                  value={roomCredentialsModal.roomPassword}
                  onChange={(e) =>
                    setRoomCredentialsModal({ ...roomCredentialsModal, roomPassword: e.target.value })
                  }
                  placeholder="Enter room password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setRoomCredentialsModal({ show: false, tournamentId: null, tournamentName: "", roomId: "", roomPassword: "" })}
                className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoomCredentials}
                disabled={!roomCredentialsModal.roomId || !roomCredentialsModal.roomPassword}
                className="flex-1 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                Share Credentials
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
