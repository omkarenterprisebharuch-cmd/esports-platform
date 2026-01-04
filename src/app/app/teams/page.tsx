"use client";

import { useEffect, useState, useCallback } from "react";
import { secureFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Modal } from "@/components/app/Modal";
import { FormField, FormSelect } from "@/components/app/FormComponents";
import { GameBadge, RoleBadge } from "@/components/app/Badges";

interface Team {
  id: number;
  team_name: string;
  team_code: string;
  invite_code: string;
  total_members: number;
  max_members: number;
  role: string;
  game_uid: string;
  game_name: string;
  captain_name: string;
  captain_id: number;
  is_captain: boolean;
  created_at: string;
}

interface TeamMember {
  id: number;
  user_id: number;
  role: string;
  game_uid: string;
  game_name: string;
  username: string;
  avatar_url: string | null;
  joined_at: string;
}

const GAME_TYPES = [
  { value: "freefire", label: "🔥 Free Fire" },
  { value: "pubg", label: "🎯 PUBG" },
  { value: "valorant", label: "⚔️ Valorant" },
  { value: "codm", label: "🔫 COD Mobile" },
];

/**
 * My Teams Page
 * 
 * Features:
 * - View all teams
 * - Create new team
 * - Join team via invite code
 * - Manage team members
 * - Leave/delete team
 */
export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<Record<number, TeamMember[]>>({});
  const [membersLoading, setMembersLoading] = useState<number | null>(null);
  
  // Forms
  const [createForm, setCreateForm] = useState({
    team_name: "",
    game_type: "freefire",
    game_uid: "",
    game_name: "",
  });
  const [joinForm, setJoinForm] = useState({
    invite_code: "",
    game_uid: "",
    game_name: "",
  });
  
  // States
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch teams
  const fetchTeams = useCallback(async () => {
    try {
      const res = await secureFetch("/api/teams/my-teams");
      const data = await res.json();
      if (data.success) {
        setTeams(data.data.teams || []);
      }
    } catch (error) {
      console.error("Failed to fetch teams:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch current user
  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await secureFetch("/api/auth/me");
      const data = await res.json();
      if (data.success) {
        setCurrentUserId(data.data.id);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
    fetchCurrentUser();
  }, [fetchTeams, fetchCurrentUser]);

  // Fetch team members
  const fetchTeamMembers = async (teamId: number) => {
    if (teamMembers[teamId]) {
      setExpandedTeam(expandedTeam === teamId ? null : teamId);
      return;
    }

    setMembersLoading(teamId);
    try {
      const res = await secureFetch(`/api/teams/${teamId}`);
      const data = await res.json();
      if (data.success) {
        setTeamMembers(prev => ({
          ...prev,
          [teamId]: data.data.team?.members || [],
        }));
        setExpandedTeam(teamId);
      }
    } catch (error) {
      console.error("Failed to fetch team members:", error);
    } finally {
      setMembersLoading(null);
    }
  };

  // Create team
  const handleCreateTeam = async () => {
    if (!createForm.team_name || !createForm.game_uid || !createForm.game_name) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await secureFetch("/api/teams", {
        method: "POST",
        body: JSON.stringify(createForm),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Team created successfully!" });
        setShowCreateModal(false);
        setCreateForm({ team_name: "", game_type: "freefire", game_uid: "", game_name: "" });
        fetchTeams();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to create team" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to create team" });
    } finally {
      setSubmitting(false);
    }
  };

  // Join team
  const handleJoinTeam = async () => {
    if (!joinForm.invite_code || !joinForm.game_uid || !joinForm.game_name) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await secureFetch("/api/teams/join", {
        method: "POST",
        body: JSON.stringify(joinForm),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Successfully joined team!" });
        setShowJoinModal(false);
        setJoinForm({ invite_code: "", game_uid: "", game_name: "" });
        fetchTeams();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to join team" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to join team" });
    } finally {
      setSubmitting(false);
    }
  };

  // Leave team
  const handleLeaveTeam = async (teamId: number) => {
    if (!confirm("Are you sure you want to leave this team?")) return;

    setActionLoading(teamId);
    try {
      const res = await secureFetch(`/api/teams/${teamId}/leave`, {
        method: "POST",
      });

      if (res.ok) {
        fetchTeams();
        setExpandedTeam(null);
      }
    } catch (error) {
      console.error("Failed to leave team:", error);
    } finally {
      setActionLoading(null);
    }
  };

  // Copy invite code
  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setMessage({ type: "success", text: "Invite code copied!" });
    setTimeout(() => setMessage(null), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Teams"
        subtitle={`${teams.length} team${teams.length !== 1 ? "s" : ""}`}
        actions={
          <div className="flex gap-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Join Team
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition"
            >
              Create Team
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

      {/* Teams Grid */}
      {teams.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No teams yet"
          description="Create a team or join one using an invite code"
          action={{ label: "Create Team", onClick: () => setShowCreateModal(true) }}
          secondaryAction={{ label: "Join Team", onClick: () => setShowJoinModal(true) }}
          variant="card"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((team) => (
            <div
              key={team.id}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                      {team.team_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Captain: {team.captain_name}
                    </p>
                  </div>
                  <RoleBadge role={team.is_captain ? "captain" : "member"} />
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <span>👥 {team.total_members}/{team.max_members}</span>
                  <span>🆔 {team.team_code}</span>
                </div>

                {/* Invite Code */}
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Invite:</span>
                  <code className="flex-1 font-mono text-sm text-gray-900 dark:text-white">
                    {team.invite_code}
                  </code>
                  <button
                    onClick={() => copyInviteCode(team.invite_code)}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    📋
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchTeamMembers(team.id)}
                    className="flex-1 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  >
                    {membersLoading === team.id ? "Loading..." : expandedTeam === team.id ? "Hide Members" : "View Members"}
                  </button>
                  {!team.is_captain && (
                    <button
                      onClick={() => handleLeaveTeam(team.id)}
                      disabled={actionLoading === team.id}
                      className="py-2 px-4 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition disabled:opacity-50"
                    >
                      {actionLoading === team.id ? "..." : "Leave"}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Members */}
              {expandedTeam === team.id && teamMembers[team.id] && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Team Members
                  </h4>
                  <div className="space-y-2">
                    {teamMembers[team.id].map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-2 bg-white dark:bg-gray-700 rounded-lg"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm">
                          {member.username[0].toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {member.username}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {member.game_name} ({member.game_uid})
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          member.role === "captain" 
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" 
                            : "bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                        }`}>
                          {member.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Team"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTeam}
              disabled={submitting}
              className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Team"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField
            label="Team Name"
            value={createForm.team_name}
            onChange={(e) => setCreateForm({ ...createForm, team_name: e.target.value })}
            placeholder="Enter team name"
            required
          />
          <FormSelect
            label="Game"
            value={createForm.game_type}
            onChange={(e) => setCreateForm({ ...createForm, game_type: e.target.value })}
            options={GAME_TYPES}
            required
          />
          <FormField
            label="Your In-Game UID"
            value={createForm.game_uid}
            onChange={(e) => setCreateForm({ ...createForm, game_uid: e.target.value })}
            placeholder="Your player ID in the game"
            required
          />
          <FormField
            label="Your In-Game Name"
            value={createForm.game_name}
            onChange={(e) => setCreateForm({ ...createForm, game_name: e.target.value })}
            placeholder="Your display name in the game"
            required
          />
        </div>
      </Modal>

      {/* Join Team Modal */}
      <Modal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        title="Join Team"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowJoinModal(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleJoinTeam}
              disabled={submitting}
              className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50"
            >
              {submitting ? "Joining..." : "Join Team"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField
            label="Invite Code"
            value={joinForm.invite_code}
            onChange={(e) => setJoinForm({ ...joinForm, invite_code: e.target.value })}
            placeholder="Enter team invite code"
            required
          />
          <FormField
            label="Your In-Game UID"
            value={joinForm.game_uid}
            onChange={(e) => setJoinForm({ ...joinForm, game_uid: e.target.value })}
            placeholder="Your player ID in the game"
            required
          />
          <FormField
            label="Your In-Game Name"
            value={joinForm.game_name}
            onChange={(e) => setJoinForm({ ...joinForm, game_name: e.target.value })}
            placeholder="Your display name in the game"
            required
          />
        </div>
      </Modal>
    </div>
  );
}
