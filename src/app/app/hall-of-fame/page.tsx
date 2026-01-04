"use client";

import { useEffect, useState, useCallback } from "react";
import { secureFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import { GameBadge } from "@/components/app/Badges";
import { TabNav } from "@/components/app/TabNav";
import { EmptyState } from "@/components/app/EmptyState";

interface Champion {
  id: number;
  username: string;
  team_name?: string;
  tournament_name: string;
  tournament_id: number;
  game_type: string;
  tournament_type: string;
  prize_pool: number;
  position: number;
  won_at: string;
}

interface LeaderboardEntry {
  user_id: number;
  username: string;
  wins: number;
  total_prize: number;
  tournaments_played: number;
}

/**
 * Hall of Fame Page
 * 
 * Features:
 * - Recent tournament winners
 * - All-time leaderboard
 * - Filter by game
 */
export default function HallOfFamePage() {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("recent");
  const [gameFilter, setGameFilter] = useState("all");

  // Fetch champions
  const fetchChampions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (gameFilter !== "all") {
        params.set("game", gameFilter);
      }
      
      const res = await secureFetch(`/api/leaderboard/champions?${params}`);
      const data = await res.json();
      if (data.success) {
        setChampions(data.data.champions || []);
      }
    } catch (error) {
      console.error("Failed to fetch champions:", error);
    }
  }, [gameFilter]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (gameFilter !== "all") {
        params.set("game", gameFilter);
      }
      
      const res = await secureFetch(`/api/leaderboard?${params}`);
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.data.leaderboard || []);
      }
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    }
  }, [gameFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchChampions(), fetchLeaderboard()])
      .finally(() => setLoading(false));
  }, [fetchChampions, fetchLeaderboard]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getPositionEmoji = (position: number) => {
    switch (position) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return `#${position}`;
    }
  };

  const getPositionStyle = (position: number) => {
    switch (position) {
      case 1: return "bg-gradient-to-r from-amber-400 to-yellow-500 text-white";
      case 2: return "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800";
      case 3: return "bg-gradient-to-r from-amber-600 to-amber-700 text-white";
      default: return "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="🏆 Hall of Fame"
        subtitle="Celebrating our champions"
      />

      {/* Game Filter */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "All Games" },
          { value: "freefire", label: "🔥 Free Fire" },
          { value: "pubg", label: "🎯 PUBG" },
          { value: "valorant", label: "⚔️ Valorant" },
          { value: "codm", label: "🔫 COD Mobile" },
        ].map((game) => (
          <button
            key={game.value}
            onClick={() => setGameFilter(game.value)}
            className={`
              px-4 py-2 rounded-xl font-medium transition
              ${gameFilter === game.value
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }
            `}
          >
            {game.label}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <TabNav
        tabs={[
          { id: "recent", label: "Recent Champions", badge: champions.length || undefined },
          { id: "leaderboard", label: "All-Time Leaderboard", badge: leaderboard.length || undefined },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="underline"
      />

      {/* Recent Champions */}
      {activeTab === "recent" && (
        <>
          {champions.length === 0 ? (
            <EmptyState
              icon="🏆"
              title="No champions yet"
              description="Winners will appear here once tournaments are completed"
              variant="card"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {champions.map((champion, index) => (
                <div
                  key={`${champion.tournament_id}-${champion.position}-${index}`}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Position Banner */}
                  <div className={`px-4 py-3 ${getPositionStyle(champion.position)}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{getPositionEmoji(champion.position)}</span>
                      <span className="text-sm font-medium opacity-90">
                        {champion.position === 1 ? "Champion" : champion.position === 2 ? "Runner-up" : "3rd Place"}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    {/* Winner Info */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xl font-bold">
                        {(champion.team_name || champion.username).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">
                          {champion.team_name || champion.username}
                        </h3>
                        {champion.team_name && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Captain: {champion.username}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Tournament Info */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <GameBadge game={champion.game_type} size="sm" />
                        <span className="text-gray-500 dark:text-gray-400">
                          {champion.tournament_type.toUpperCase()}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {champion.tournament_name}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500 dark:text-gray-400">
                          {formatDate(champion.won_at)}
                        </span>
                        <span className="font-bold text-green-600 dark:text-green-400">
                          ₹{champion.prize_pool.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* All-Time Leaderboard */}
      {activeTab === "leaderboard" && (
        <>
          {leaderboard.length === 0 ? (
            <EmptyState
              icon="📊"
              title="No leaderboard data"
              description="Leaderboard will populate as tournaments are played"
              variant="card"
            />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Rank</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Player</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">Wins</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">Played</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">Total Prize</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {leaderboard.map((entry, index) => (
                      <tr 
                        key={entry.user_id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition"
                      >
                        <td className="px-6 py-4">
                          <span className={`
                            inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm
                            ${index === 0 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                              index === 1 ? "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300" :
                              index === 2 ? "bg-amber-200 dark:bg-amber-900/20 text-amber-800 dark:text-amber-500" :
                              "text-gray-500 dark:text-gray-400"
                            }
                          `}>
                            {index < 3 ? getPositionEmoji(index + 1) : index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center font-bold text-sm">
                              {entry.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {entry.username}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-semibold">
                            🏆 {entry.wins}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-400">
                          {entry.tournaments_played}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-bold text-green-600 dark:text-green-400">
                            ₹{entry.total_prize.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
