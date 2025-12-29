"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TournamentWithHost, Team, TeamMemberWithUser } from "@/types";
import { useRegistrationCache } from "@/hooks/useRegistrationCache";
import { secureFetch } from "@/lib/api-client";

interface TeamWithMembers extends Team {
  members?: TeamMemberWithUser[];
}

export default function RegisterTournamentPage() {
  const params = useParams();
  const router = useRouter();
  
  // Use cached registration data
  const { isRegistered, addRegistration } = useRegistrationCache();
  const isAlreadyRegistered = isRegistered(Number(params.id));
  
  const [tournament, setTournament] = useState<TournamentWithHost | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberWithUser[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");

    // Only fetch tournament and teams - registration status from cache
    Promise.all([
      fetch(`/api/tournaments/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => res.json()),
      fetch("/api/teams/my-teams", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => res.json()),
    ])
      .then(([tournamentData, teamsData]) => {
        if (tournamentData.success) {
          setTournament(tournamentData.data.tournament);
        }
        if (teamsData.success) {
          setTeams(teamsData.data.teams || []);
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  // Fetch team members when a team is selected
  const fetchTeamMembers = useCallback(async (teamId: number) => {
    setLoadingMembers(true);
    setTeamMembers([]);
    setSelectedPlayers([]);
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      if (data.success && data.data.team.members) {
        setTeamMembers(data.data.team.members);
      }
    } catch (err) {
      console.error("Failed to fetch team members:", err);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  // Handle team selection
  const handleTeamSelect = (teamId: number) => {
    setSelectedTeamId(teamId);
    if (tournament?.tournament_type === "squad") {
      fetchTeamMembers(teamId);
    }
  };

  // Toggle player selection
  const togglePlayerSelection = (userId: number) => {
    setSelectedPlayers((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      // For squad, max 4 players
      if (tournament?.tournament_type === "squad" && prev.length >= 4) {
        return prev;
      }
      // For duo, max 2 players
      if (tournament?.tournament_type === "duo" && prev.length >= 2) {
        return prev;
      }
      return [...prev, userId];
    });
  };

  const handleRegister = async () => {
    if (!tournament) return;

    // Solo tournaments don't need a team
    if (tournament.tournament_type !== "solo" && !selectedTeamId) {
      setError("Please select a team");
      return;
    }

    // For squad tournaments, validate player selection
    if (tournament.tournament_type === "squad") {
      if (selectedPlayers.length !== 4) {
        setError("Please select exactly 4 players for the squad match");
        return;
      }
    }

    // For duo tournaments, validate player selection
    if (tournament.tournament_type === "duo") {
      if (selectedPlayers.length !== 2) {
        setError("Please select exactly 2 players for the duo match");
        return;
      }
    }

    setRegistering(true);
    setError("");
    setSuccess("");

    try {
      // Calculate backup players (team members not selected)
      const backupPlayers = tournament.tournament_type !== "solo" 
        ? teamMembers
            .filter((m) => !selectedPlayers.includes(m.user_id))
            .map((m) => m.user_id)
        : [];

      const res = await secureFetch("/api/registrations/register", {
        method: "POST",
        body: JSON.stringify({
          tournament_id: tournament.id,
          team_id: selectedTeamId,
          selected_players: selectedPlayers.length > 0 ? selectedPlayers : undefined,
          backup_players: backupPlayers.length > 0 ? backupPlayers : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Update the registration cache
        addRegistration(tournament.id);
        
        setSuccess(
          `Successfully registered! Your slot number is #${data.data.slot_number}`
        );
        setTimeout(() => {
          router.push("/my-registrations");
        }, 2000);
      } else {
        setError(data.message);
      }
    } catch {
      setError("Registration failed. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  const getTeamSizeRequirement = () => {
    if (!tournament) return "";
    switch (tournament.tournament_type) {
      case "duo":
        return "at least 2 members";
      case "squad":
        return "4-5 members (4 players + 1 optional backup)";
      default:
        return "";
    }
  };

  const getRequiredMemberCount = () => {
    if (!tournament) return { min: 0, max: 0 };
    switch (tournament.tournament_type) {
      case "duo":
        return { min: 2, max: 2 };
      case "squad":
        return { min: 4, max: 5 }; // 4 required + 1 optional backup
      default:
        return { min: 0, max: 0 };
    }
  };

  const isTeamEligible = (team: Team) => {
    if (!tournament) return false;

    const memberCount = team.member_count || team.total_members || 0;
    const { min, max } = getRequiredMemberCount();

    // Team must have between min and max members
    return memberCount >= min && memberCount <= max;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Tournament not found</p>
      </div>
    );
  }

  // If already registered, show message instead of form
  if (isAlreadyRegistered) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Register for Tournament
        </h1>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-xl font-semibold text-blue-700 mb-2">
            You & your team is already registered
          </h2>
          <p className="text-blue-600 mb-4">
            You have already registered for {tournament.tournament_name}
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/my-registrations"
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
            >
              View My Registrations
            </Link>
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Register for Tournament
      </h1>

      {/* Tournament Info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 text-lg mb-4">
          {tournament.tournament_name}
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Game</p>
            <p className="font-medium text-gray-900 uppercase">
              {tournament.game_type}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Type</p>
            <p className="font-medium text-gray-900 uppercase">
              {tournament.tournament_type}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Entry Fee</p>
            <p className="font-medium text-gray-900">
              {tournament.entry_fee > 0 ? `₹${tournament.entry_fee}` : "Free"}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Prize Pool</p>
            <p className="font-medium text-green-600">₹{tournament.prize_pool}</p>
          </div>
        </div>
      </div>

      {/* Team Selection for non-solo */}
      {tournament.tournament_type !== "solo" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-2">Select Your Team</h2>
          <p className="text-sm text-gray-500 mb-4">
            This is a <span className="font-medium uppercase">{tournament.tournament_type}</span> tournament. Your team must
            have {getTeamSizeRequirement()} to register.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-700">
              ⚠️ <strong>Requirement:</strong> Your team must have {getTeamSizeRequirement()} to participate in this {tournament.tournament_type} tournament.
              {tournament.tournament_type === "squad" && " You will select 4 players to compete, and the 5th member (if any) will be the backup."}
            </p>
          </div>

          {teams.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500 mb-3">You don&apos;t have any teams yet</p>
              <button
                onClick={() => router.push("/my-teams")}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 transition"
              >
                Create a Team
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => {
                const memberCount = team.member_count || team.total_members || 0;
                const eligible = isTeamEligible(team);

                return (
                  <div
                    key={team.id}
                    onClick={() => eligible && handleTeamSelect(team.id)}
                    className={`border rounded-lg p-4 cursor-pointer transition ${
                      selectedTeamId === team.id
                        ? "border-green-500 bg-green-50"
                        : eligible
                          ? "border-gray-200 hover:border-gray-400"
                          : "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{team.team_name}</p>
                        <p className="text-sm text-gray-500">
                          {memberCount} member(s) {eligible ? "✓" : `(Need ${getRequiredMemberCount().min}-${getRequiredMemberCount().max})`}
                        </p>
                      </div>

                      {selectedTeamId === team.id && (
                        <span className="text-green-600 text-xl">✓</span>
                      )}

                      {!eligible && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                          Needs {getRequiredMemberCount().min}-{getRequiredMemberCount().max} members
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {teams.filter(isTeamEligible).length === 0 && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    ❌ None of your teams have {getTeamSizeRequirement()}. Please invite members to your team or create a new team with the required size.
                  </p>
                  <button
                    onClick={() => router.push("/my-teams")}
                    className="mt-3 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 transition"
                  >
                    Manage Teams
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Player Selection for Squad/Duo tournaments */}
      {selectedTeamId && tournament.tournament_type !== "solo" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-2">
            Select Players {tournament.tournament_type === "squad" ? "(4 Required)" : "(2 Required)"}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {tournament.tournament_type === "squad" 
              ? "Select exactly 4 players who will compete. The unselected player will be the backup."
              : "Select exactly 2 players who will compete."}
          </p>

          {loadingMembers ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin w-6 h-6 border-4 border-gray-900 border-t-transparent rounded-full"></div>
            </div>
          ) : teamMembers.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No team members found</p>
          ) : (
            <>
              <div className="space-y-3">
                {teamMembers.map((member) => {
                  const isSelected = selectedPlayers.includes(member.user_id);
                  const maxSelected = tournament.tournament_type === "squad" ? 4 : 2;
                  const canSelect = isSelected || selectedPlayers.length < maxSelected;

                  return (
                    <div
                      key={member.id}
                      onClick={() => canSelect && togglePlayerSelection(member.user_id)}
                      className={`border rounded-lg p-4 cursor-pointer transition ${
                        isSelected
                          ? "border-green-500 bg-green-50"
                          : canSelect
                            ? "border-gray-200 hover:border-gray-400"
                            : "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt={member.username} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-gray-500 font-medium">
                                {member.username?.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {member.username}
                              {member.role === "captain" && (
                                <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                                  Captain
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-gray-500">
                              {member.game_name || "No game name set"}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <span className="text-green-600 text-xl">✓</span>
                          ) : !canSelect ? (
                            <span className="text-xs text-gray-400">Max selected</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Selected: <span className="font-medium">{selectedPlayers.length}</span> / {tournament.tournament_type === "squad" ? 4 : 2} players
                  {tournament.tournament_type === "squad" && teamMembers.length > 4 && (
                    <span className="ml-2 text-amber-600">
                      ({teamMembers.length - selectedPlayers.length} backup)
                    </span>
                  )}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-600">
          {success}
        </div>
      )}

      {/* Register Button */}
      <button
        onClick={handleRegister}
        disabled={
          registering ||
          (tournament.tournament_type !== "solo" && !selectedTeamId) ||
          (tournament.tournament_type === "squad" && selectedPlayers.length !== 4) ||
          (tournament.tournament_type === "duo" && selectedPlayers.length !== 2)
        }
        className="w-full py-4 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 text-lg"
      >
        {registering ? "Registering..." : "Confirm Registration"}
      </button>

      {/* Show helper text if players not selected yet */}
      {tournament.tournament_type !== "solo" && selectedTeamId && (
        (tournament.tournament_type === "squad" && selectedPlayers.length !== 4) ||
        (tournament.tournament_type === "duo" && selectedPlayers.length !== 2)
      ) && (
        <p className="text-center text-sm text-amber-600 mt-2">
          Please select {tournament.tournament_type === "squad" ? 4 : 2} players to continue
        </p>
      )}

      <p className="text-center text-sm text-gray-500 mt-4">
        By registering, you agree to the tournament rules and terms.
      </p>
    </div>
  );
}
