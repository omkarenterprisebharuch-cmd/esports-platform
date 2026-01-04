"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { secureFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { GameBadge, StatusBadge, RoleBadge } from "@/components/app/Badges";
import { StatCard } from "@/components/app/StatCard";

interface Tournament {
  id: string;
  tournament_name: string;
  game_type: string;
  tournament_type: string;
  entry_fee: string | number;
  status: string;
  current_teams: number;
  max_teams: number;
  prize_pool: string | number;
  registration_start_date: string;
  registration_end_date: string;
  tournament_start_date: string;
}

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
}

interface TeamMember {
  id: number;
  user_id: number;
  role: string;
  game_uid: string;
  game_name: string;
  username: string;
  avatar_url: string | null;
}

/**
 * Team Registration Page
 * 
 * For Duo/Squad tournaments, allows users to:
 * 1. Select a team to register with
 * 2. Select players for the tournament
 * 3. Complete registration
 */
export default function TeamRegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;

  // Data states
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [eligibleTeams, setEligibleTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  
  // Message state
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch tournament and teams
  const fetchData = useCallback(async () => {
    try {
      const [tournamentRes, teamsRes] = await Promise.all([
        secureFetch(`/api/tournaments/${tournamentId}`),
        secureFetch("/api/teams/my-teams"),
      ]);

      const tournamentData = await tournamentRes.json();
      const teamsData = await teamsRes.json();

      if (tournamentData.success) {
        const t = tournamentData.data.tournament;
        setTournament(t);

        // Filter teams that match the tournament's game type
        if (teamsData.success && teamsData.data.teams) {
          setTeams(teamsData.data.teams);
          // Match game type (case insensitive)
          const filtered = teamsData.data.teams.filter((team: Team) => {
            // Teams don't have game_type directly, but we can infer from game_name
            // For now, show all teams and let registration API validate
            return true;
          });
          setEligibleTeams(filtered);
        }
      } else {
        setMessage({ type: "error", text: "Tournament not found" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load data" });
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch team members when a team is selected
  const handleTeamSelect = async (team: Team) => {
    setSelectedTeam(team);
    setSelectedPlayers([]);
    setMembersLoading(true);

    try {
      const res = await secureFetch(`/api/teams/${team.id}`);
      const data = await res.json();

      if (data.success && data.data.team?.members) {
        setTeamMembers(data.data.team.members);
        // Auto-select all members by default
        setSelectedPlayers(data.data.team.members.map((m: TeamMember) => m.user_id));
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load team members" });
    } finally {
      setMembersLoading(false);
    }
  };

  // Toggle player selection
  const togglePlayer = (userId: number) => {
    setSelectedPlayers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      }
      return [...prev, userId];
    });
  };

  // Get required player count based on tournament type
  const getRequiredPlayers = () => {
    if (!tournament) return { min: 1, max: 4 };
    switch (tournament.tournament_type.toLowerCase()) {
      case "duo":
        return { min: 2, max: 2 };
      case "squad":
        return { min: 4, max: 4 };
      default:
        return { min: 1, max: 4 };
    }
  };

  // Handle registration
  const handleRegister = async () => {
    if (!selectedTeam) {
      setMessage({ type: "error", text: "Please select a team" });
      return;
    }

    const required = getRequiredPlayers();
    if (selectedPlayers.length < required.min || selectedPlayers.length > required.max) {
      setMessage({ 
        type: "error", 
        text: `Please select exactly ${required.min === required.max ? required.min : `${required.min}-${required.max}`} players` 
      });
      return;
    }

    setRegistering(true);
    setMessage(null);

    try {
      const res = await secureFetch("/api/registrations/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournament_id: tournamentId,
          team_id: selectedTeam.id,
          selected_players: selectedPlayers,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message || "Successfully registered!" });
        // Redirect to tournament page after success
        setTimeout(() => {
          router.push(`/app/tournament/${tournamentId}`);
        }, 1500);
      } else {
        setMessage({ type: "error", text: data.message || "Registration failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to register. Please try again." });
    } finally {
      setRegistering(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tournament Not Found" />
        <EmptyState
          icon="🎮"
          title="Tournament not found"
          description="The tournament you're looking for doesn't exist or has been removed."
          action={{ label: "Browse Tournaments", onClick: () => router.push("/app/tournaments") }}
          variant="card"
        />
      </div>
    );
  }

  const required = getRequiredPlayers();

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Team Registration"
        subtitle={`Register for ${tournament.tournament_name}`}
        backLink={{ href: `/app/tournament/${tournamentId}`, label: "Back to Tournament" }}
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

      {/* Tournament Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
              {tournament.tournament_name}
            </h2>
            <div className="flex items-center gap-2">
              <GameBadge game={tournament.game_type} />
              <StatusBadge status={tournament.status} />
              <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                {tournament.tournament_type}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ₹{Number(tournament.entry_fee || 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Entry Fee</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {tournament.current_teams}/{tournament.max_teams}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Slots Filled</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              ₹{Number(tournament.prize_pool || 0).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Prize Pool</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {required.min === required.max ? required.min : `${required.min}-${required.max}`}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Players Needed</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDate(tournament.tournament_start_date)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Start Time</div>
          </div>
        </div>
      </div>

      {/* Step 1: Team Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="w-6 h-6 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-sm flex items-center justify-center">1</span>
          Select Team
        </h3>

        {eligibleTeams.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No teams available"
            description="Create a team or join one to register for this tournament"
            action={{ label: "Create Team", onClick: () => router.push("/app/teams") }}
            secondaryAction={{ label: "My Teams", onClick: () => router.push("/app/teams") }}
            variant="minimal"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {eligibleTeams.map((team) => (
              <button
                key={team.id}
                onClick={() => handleTeamSelect(team)}
                className={`
                  p-4 rounded-xl border-2 text-left transition-all
                  ${selectedTeam?.id === team.id
                    ? "border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-700"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">{team.team_name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Captain: {team.captain_name}
                    </div>
                  </div>
                  <RoleBadge role={team.is_captain ? "captain" : "member"} />
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <span>👥 {team.total_members}/{team.max_members}</span>
                  <span>🆔 {team.team_code}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Player Selection */}
      {selectedTeam && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-sm flex items-center justify-center">2</span>
            Select Players
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({selectedPlayers.length}/{required.min === required.max ? required.min : `${required.min}-${required.max}`} selected)
            </span>
          </h3>

          {membersLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : teamMembers.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No members found in this team</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {teamMembers.map((member) => (
                <button
                  key={member.user_id}
                  onClick={() => togglePlayer(member.user_id)}
                  className={`
                    p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3
                    ${selectedPlayers.includes(member.user_id)
                      ? "border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-700"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }
                  `}
                >
                  <div className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center
                    ${selectedPlayers.includes(member.user_id)
                      ? "border-gray-900 dark:border-white bg-gray-900 dark:bg-white"
                      : "border-gray-300 dark:border-gray-600"
                    }
                  `}>
                    {selectedPlayers.includes(member.user_id) && (
                      <svg className="w-3 h-3 text-white dark:text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      {member.username}
                      <RoleBadge role={member.role} />
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {member.game_name} • {member.game_uid}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Confirm Registration */}
      {selectedTeam && selectedPlayers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-sm flex items-center justify-center">3</span>
            Confirm Registration
          </h3>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 dark:text-gray-400">Team</span>
              <span className="font-medium text-gray-900 dark:text-white">{selectedTeam.team_name}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600 dark:text-gray-400">Players</span>
              <span className="font-medium text-gray-900 dark:text-white">{selectedPlayers.length} selected</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Entry Fee</span>
              <span className="font-bold text-lg text-gray-900 dark:text-white">₹{Number(tournament.entry_fee || 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              href={`/app/tournament/${tournamentId}`}
              className="flex-1 py-3 text-center border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </Link>
            <button
              onClick={handleRegister}
              disabled={registering || selectedPlayers.length < required.min}
              className="flex-1 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {registering ? "Registering..." : "Confirm Registration"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
