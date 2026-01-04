"use client";

import { useEffect, useState, use } from "react";
import { api } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { LeaderboardEntry } from "@/types";

interface TournamentInfo {
  id: number;
  tournament_name: string;
  tournament_type: string;
  prize_pool: number;
  status: string;
}

/**
 * Tournament Leaderboard Page
 * 
 * Features:
 * - Top 3 winners with special card display
 * - Full leaderboard table
 * - Rank/kills/points/prize columns
 * - Status banner for in-progress tournaments
 */
export default function LeaderboardPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await api<{
          tournament: TournamentInfo;
          leaderboard: LeaderboardEntry[];
        }>(`/api/tournaments/${resolvedParams.id}/leaderboard`);

        if (response.success && response.data) {
          setTournament(response.data.tournament);
          setLeaderboard(response.data.leaderboard);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [resolvedParams.id]);

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 text-white shadow-lg shadow-yellow-500/25";
      case 2:
        return "bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 text-white shadow-lg shadow-gray-400/25";
      case 3:
        return "bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 text-white shadow-lg shadow-amber-600/25";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300";
    }
  };

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return `#${rank}`;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Tournament Not Found"
          backLink={{ href: "/app", label: "Back to Home" }}
        />
        <EmptyState
          icon="🏆"
          title="Tournament not found"
          description="The tournament you're looking for doesn't exist."
          action={{ label: "View All Tournaments", onClick: () => window.location.href = "/app" }}
          variant="card"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Leaderboard"
        subtitle={`${tournament.tournament_name} • ${tournament.tournament_type.toUpperCase()} • Prize Pool: ₹${tournament.prize_pool}`}
        backLink={{ href: `/app/tournament/${resolvedParams.id}`, label: "Back to Tournament" }}
        badge={
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
            tournament.status === "completed" 
              ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" 
              : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
          }`}>
            {tournament.status.replace("_", " ")}
          </span>
        }
      />

      {/* Status Banner */}
      {tournament.status !== "completed" && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <p className="text-amber-700 dark:text-amber-400 text-center text-sm">
            🏆 Tournament is {tournament.status.replace("_", " ")}. Final results will be updated after completion.
          </p>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 ? (
        <div className="space-y-6">
          {/* Top 3 Winners - Special Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {leaderboard.slice(0, 3).map((entry) => (
              <div
                key={entry.id}
                className={`rounded-2xl p-6 text-center transform hover:scale-[1.02] transition-all ${getRankStyle(entry.rank)}`}
              >
                <div className="text-5xl mb-3">{getRankEmoji(entry.rank)}</div>
                <h3 className="font-bold text-lg mb-1">
                  {entry.team_name || entry.username || "Unknown"}
                </h3>
                <div className="flex items-center justify-center gap-4 text-sm opacity-90">
                  {entry.kills !== undefined && entry.kills > 0 && (
                    <span>⚔️ {entry.kills} Kills</span>
                  )}
                  {entry.points !== undefined && entry.points > 0 && (
                    <span>⭐ {entry.points} Pts</span>
                  )}
                </div>
                {entry.prize_amount !== undefined && entry.prize_amount > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <span className="font-bold text-lg">₹{entry.prize_amount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Full Leaderboard Table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {tournament.tournament_type === "solo" ? "Player" : "Team"}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Kills
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Points
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Prize
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {leaderboard.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                          entry.rank <= 3
                            ? getRankStyle(entry.rank)
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {entry.team_name || entry.username || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">
                      {entry.kills || "-"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">
                      {entry.points || "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">
                      {entry.prize_amount ? `₹${entry.prize_amount.toLocaleString()}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon="🏆"
          title="No Results Yet"
          description="The tournament results will be announced once the tournament is completed and the host updates the winners."
          variant="card"
        />
      )}
    </div>
  );
}
