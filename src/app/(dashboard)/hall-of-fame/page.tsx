"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TopPlayer {
  rank: number;
  id: string;
  username: string;
  avatarUrl: string | null;
  firstPlaceWins: number;
  secondPlaceWins: number;
  thirdPlaceWins: number;
  totalPodiumFinishes: number;
  totalEarnings: number;
  totalKills: number;
  totalPoints: number;
}

interface TopTeam {
  rank: number;
  id: string;
  teamName: string;
  logoUrl?: string | null;
  firstPlaceWins: number;
  secondPlaceWins: number;
  thirdPlaceWins: number;
  totalPodiumFinishes: number;
  totalEarnings: number;
  totalKills: number;
}

interface TournamentWinner {
  position: number;
  username: string | null;
  user_id: string | null;
  avatar_url: string | null;
  team_name: string | null;
  team_id: string | null;
  prize_amount: number;
  kills: number;
  points: number;
}

interface RecentTournament {
  tournamentId: string;
  tournamentName: string;
  gameType: string;
  prizePool: number;
  endDate: string;
  bannerUrl: string | null;
  winners: TournamentWinner[];
}

interface GameStats {
  gameType: string;
  totalTournaments: number;
  uniqueWinners: number;
  totalPrizePool: number;
  totalKills: number;
}

interface PlatformStats {
  totalTournamentsCompleted: number;
  totalUniqueWinners: number;
  totalPrizeDistributed: number;
  totalKills: number;
}

interface HallOfFameData {
  topPlayers: TopPlayer[];
  topTeams: TopTeam[];
  recentTournaments: RecentTournament[];
  gameStats: GameStats[];
  platformStats: PlatformStats;
}

const GAME_ICONS: Record<string, string> = {
  freefire: "🔥",
  pubg: "🎯",
  valorant: "⚔️",
  codm: "🔫",
};

const GAME_NAMES: Record<string, string> = {
  freefire: "Free Fire",
  pubg: "PUBG",
  valorant: "Valorant",
  codm: "COD Mobile",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getMedalEmoji(position: number): string {
  switch (position) {
    case 1:
      return "🥇";
    case 2:
      return "🥈";
    case 3:
      return "🥉";
    default:
      return `#${position}`;
  }
}

export default function HallOfFamePage() {
  const [data, setData] = useState<HallOfFameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"players" | "teams" | "tournaments">("players");

  useEffect(() => {
    fetchData();
  }, [selectedGame, selectedPeriod]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedGame) params.set("game_type", selectedGame);
      if (selectedPeriod) params.set("period", selectedPeriod);
      params.set("limit", "20");

      const res = await fetch(`/api/hall-of-fame?${params}`);
      const json = await res.json();

      if (json.success) {
        setData(json.data);
      } else {
        setError(json.message || "Failed to load hall of fame");
      }
    } catch {
      setError("Failed to load hall of fame data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <span className="text-6xl mb-4">🏆</span>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Hall of Fame</h2>
        <p className="text-gray-500 dark:text-gray-400">{error || "No data available yet"}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
          🏆 Hall of Fame
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Celebrating our champions and legendary players
        </p>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl p-5 text-white text-center">
          <div className="text-3xl font-bold">{data.platformStats.totalTournamentsCompleted}</div>
          <div className="text-sm opacity-90">Tournaments Completed</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-5 text-white text-center">
          <div className="text-3xl font-bold">{data.platformStats.totalUniqueWinners}</div>
          <div className="text-sm opacity-90">Unique Champions</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white text-center">
          <div className="text-3xl font-bold">{formatCurrency(data.platformStats.totalPrizeDistributed)}</div>
          <div className="text-sm opacity-90">Prize Distributed</div>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-5 text-white text-center">
          <div className="text-3xl font-bold">{data.platformStats.totalKills.toLocaleString()}</div>
          <div className="text-sm opacity-90">Total Kills</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8">
        <select
          value={selectedGame}
          onChange={(e) => setSelectedGame(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">All Games</option>
          <option value="freefire">🔥 Free Fire</option>
          <option value="pubg">🎯 PUBG</option>
          <option value="valorant">⚔️ Valorant</option>
          <option value="codm">🔫 COD Mobile</option>
        </select>

        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">All Time</option>
          <option value="month">This Month</option>
          <option value="week">This Week</option>
        </select>
      </div>

      {/* Game Stats Cards */}
      {data.gameStats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {data.gameStats.map((game) => (
            <div
              key={game.gameType}
              onClick={() => setSelectedGame(game.gameType === selectedGame ? "" : game.gameType)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedGame === game.gameType
                  ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="text-2xl mb-2">{GAME_ICONS[game.gameType] || "🎮"}</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {GAME_NAMES[game.gameType] || game.gameType}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {game.totalTournaments} tournaments • {game.uniqueWinners} champions
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("players")}
          className={`px-6 py-3 font-medium transition-all ${
            activeTab === "players"
              ? "text-yellow-600 border-b-2 border-yellow-500"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          👤 Top Players
        </button>
        <button
          onClick={() => setActiveTab("teams")}
          className={`px-6 py-3 font-medium transition-all ${
            activeTab === "teams"
              ? "text-yellow-600 border-b-2 border-yellow-500"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          👥 Top Teams
        </button>
        <button
          onClick={() => setActiveTab("tournaments")}
          className={`px-6 py-3 font-medium transition-all ${
            activeTab === "tournaments"
              ? "text-yellow-600 border-b-2 border-yellow-500"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          🏆 Recent Winners
        </button>
      </div>

      {/* Top Players Tab */}
      {activeTab === "players" && (
        <div className="space-y-4">
          {data.topPlayers.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <span className="text-5xl block mb-4">🎮</span>
              <p>No champions yet. Be the first to claim victory!</p>
            </div>
          ) : (
            <>
              {/* Top 3 Spotlight */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {data.topPlayers.slice(0, 3).map((player, idx) => (
                  <div
                    key={player.id}
                    className={`relative rounded-2xl p-6 text-center ${
                      idx === 0
                        ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white order-2 md:order-1 transform md:scale-110 z-10"
                        : idx === 1
                        ? "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800 order-1 md:order-0"
                        : "bg-gradient-to-br from-amber-600 to-orange-700 text-white order-3"
                    }`}
                  >
                    <div className="text-4xl mb-3">{getMedalEmoji(idx + 1)}</div>
                    <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                      {player.avatarUrl ? (
                        <img
                          src={player.avatarUrl}
                          alt={player.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl">👤</span>
                      )}
                    </div>
                    <h3 className="font-bold text-xl mb-1">{player.username}</h3>
                    <div className="flex justify-center gap-3 text-sm mb-3">
                      <span>🥇 {player.firstPlaceWins}</span>
                      <span>🥈 {player.secondPlaceWins}</span>
                      <span>🥉 {player.thirdPlaceWins}</span>
                    </div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(player.totalEarnings)}
                    </div>
                    <div className="text-sm opacity-80">
                      {player.totalKills.toLocaleString()} kills
                    </div>
                  </div>
                ))}
              </div>

              {/* Leaderboard Table */}
              {data.topPlayers.length > 3 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">
                          Rank
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600 dark:text-gray-300">
                          Player
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600 dark:text-gray-300">
                          Wins
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600 dark:text-gray-300">
                          Podiums
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-300">
                          Earnings
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {data.topPlayers.slice(3).map((player) => (
                        <tr
                          key={player.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            #{player.rank}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden">
                                {player.avatarUrl ? (
                                  <img
                                    src={player.avatarUrl}
                                    alt={player.username}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>👤</span>
                                )}
                              </div>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {player.username}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-yellow-600 dark:text-yellow-400 font-semibold">
                              {player.firstPlaceWins}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                            {player.totalPodiumFinishes}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(player.totalEarnings)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Top Teams Tab */}
      {activeTab === "teams" && (
        <div className="space-y-4">
          {data.topTeams.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <span className="text-5xl block mb-4">👥</span>
              <p>No team champions yet. Form a team and conquer!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.topTeams.map((team) => (
                <div
                  key={team.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center overflow-hidden">
                      {team.logoUrl ? (
                        <img
                          src={team.logoUrl}
                          alt={team.teamName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">👥</span>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-lg text-gray-900 dark:text-white">
                        {team.teamName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Rank #{team.rank}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2">
                      <div className="text-xl">🥇</div>
                      <div className="font-bold text-yellow-600 dark:text-yellow-400">
                        {team.firstPlaceWins}
                      </div>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-2">
                      <div className="text-xl">🥈</div>
                      <div className="font-bold text-gray-600 dark:text-gray-300">
                        {team.secondPlaceWins}
                      </div>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
                      <div className="text-xl">🥉</div>
                      <div className="font-bold text-amber-600 dark:text-amber-400">
                        {team.thirdPlaceWins}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {team.totalKills.toLocaleString()} kills
                    </span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(team.totalEarnings)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Tournaments Tab */}
      {activeTab === "tournaments" && (
        <div className="space-y-6">
          {data.recentTournaments.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <span className="text-5xl block mb-4">🏆</span>
              <p>No completed tournaments yet. Stay tuned for upcoming events!</p>
            </div>
          ) : (
            data.recentTournaments.map((tournament) => (
              <div
                key={tournament.tournamentId}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{GAME_ICONS[tournament.gameType] || "🎮"}</span>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">
                          {GAME_NAMES[tournament.gameType] || tournament.gameType}
                        </span>
                      </div>
                      <Link
                        href={`/tournament/${tournament.tournamentId}`}
                        className="text-xl font-bold text-gray-900 dark:text-white hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors"
                      >
                        {tournament.tournamentName}
                      </Link>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(tournament.prizePool)}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(tournament.endDate)}
                      </div>
                    </div>
                  </div>

                  {/* Winners */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {tournament.winners.map((winner) => (
                      <div
                        key={winner.position}
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          winner.position === 1
                            ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                            : winner.position === 2
                            ? "bg-gray-50 dark:bg-gray-700/50"
                            : "bg-amber-50 dark:bg-amber-900/10"
                        }`}
                      >
                        <span className="text-2xl">{getMedalEmoji(winner.position)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white truncate">
                            {winner.team_name || winner.username || "Unknown"}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {winner.kills} kills • {winner.points} pts
                          </div>
                        </div>
                        <div className="text-right text-sm font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(winner.prize_amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
