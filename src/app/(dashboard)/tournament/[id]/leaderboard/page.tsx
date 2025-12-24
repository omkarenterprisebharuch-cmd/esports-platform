"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { LeaderboardEntry } from "@/types";

interface TournamentInfo {
  id: number;
  tournament_name: string;
  tournament_type: string;
  prize_pool: number;
  status: string;
}

export default function LeaderboardPage() {
  const params = useParams();
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    fetch(`/api/tournaments/${params.id}/leaderboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTournament(data.data.tournament);
          setLeaderboard(data.data.leaderboard);
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
      case 2:
        return "bg-gradient-to-r from-gray-300 to-gray-500 text-white";
      case 3:
        return "bg-gradient-to-r from-amber-600 to-amber-800 text-white";
      default:
        return "bg-gray-100 text-gray-700";
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Tournament not found</p>
        <Link href="/tournaments" className="text-gray-900 underline mt-2">
          Back to Tournaments
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/tournament/${params.id}`}
          className="text-gray-500 hover:text-gray-700 text-sm mb-2 inline-block"
        >
          ← Back to Tournament
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {tournament.tournament_name}
        </h1>
        <p className="text-gray-500">
          Leaderboard • {tournament.tournament_type.toUpperCase()} • Prize Pool: ₹
          {tournament.prize_pool}
        </p>
      </div>

      {/* Status Banner */}
      {tournament.status !== "completed" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-amber-700 text-center">
            🏆 Tournament is {tournament.status.replace("_", " ")}. Final results will be updated after completion.
          </p>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 ? (
        <div className="space-y-4">
          {/* Top 3 Winners - Special Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {leaderboard.slice(0, 3).map((entry) => (
              <div
                key={entry.id}
                className={`rounded-xl p-6 text-center ${getRankStyle(entry.rank)}`}
              >
                <div className="text-4xl mb-2">{getRankEmoji(entry.rank)}</div>
                <h3 className="font-bold text-lg">
                  {entry.team_name || entry.username || "Unknown"}
                </h3>
                {entry.kills !== undefined && entry.kills > 0 && (
                  <p className="text-sm opacity-80 mt-1">
                    {entry.kills} Kills
                  </p>
                )}
                {entry.points !== undefined && entry.points > 0 && (
                  <p className="text-sm opacity-80">
                    {entry.points} Points
                  </p>
                )}
                {entry.prize_amount !== undefined && entry.prize_amount > 0 && (
                  <p className="font-semibold mt-2">₹{entry.prize_amount}</p>
                )}
              </div>
            ))}
          </div>

          {/* Table for detailed view */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    {tournament.tournament_type === "solo" ? "Player" : "Team"}
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    Kills
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    Points
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Prize
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaderboard.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                          entry.rank <= 3
                            ? getRankStyle(entry.rank)
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {entry.team_name || entry.username || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {entry.kills || "-"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {entry.points || "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      {entry.prize_amount ? `₹${entry.prize_amount}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Results Yet
          </h3>
          <p className="text-gray-500">
            The tournament results will be announced once the tournament is
            completed and the host updates the winners.
          </p>
        </div>
      )}
    </div>
  );
}
