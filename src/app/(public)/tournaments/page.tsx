"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { isAuthenticated } from "@/lib/api-client";

interface Tournament {
  id: string;
  tournament_name: string;
  game_type: string;
  tournament_type: string;
  prize_pool: number;
  entry_fee: number;
  tournament_start_date: string;
  registration_end_date: string;
  status: string;
  computed_status: string;
  max_teams: number;
  current_teams: number;
  host_name?: string;
}

const GAME_OPTIONS = [
  { value: "", label: "All Games", icon: "🎮" },
  { value: "freefire", label: "Free Fire", icon: "🔥" },
  { value: "pubg", label: "PUBG", icon: "🎯" },
  { value: "valorant", label: "Valorant", icon: "⚔️" },
  { value: "codm", label: "COD Mobile", icon: "🔫" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "registration_open", label: "Registration Open" },
  { value: "upcoming", label: "Upcoming" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
];

// Loading fallback component
function TournamentsLoading() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading tournaments...</p>
      </div>
    </div>
  );
}

// Main page wrapper with Suspense
export default function PublicTournamentsPage() {
  return (
    <Suspense fallback={<TournamentsLoading />}>
      <TournamentsContent />
    </Suspense>
  );
}

// Actual content component that uses useSearchParams
function TournamentsContent() {
  const searchParams = useSearchParams();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Filter state
  const [gameFilter, setGameFilter] = useState(searchParams.get("game") || "");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTournaments = useCallback(() => {
    setLoading(true);
    
    const params = new URLSearchParams();
    if (gameFilter) params.set("game_type", gameFilter);
    if (statusFilter) params.set("filter", statusFilter);
    if (searchQuery) params.set("search", searchQuery);
    
    const queryString = params.toString();
    const url = `/api/tournaments${queryString ? `?${queryString}` : ""}`;
    
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTournaments(data.data.tournaments || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [gameFilter, statusFilter, searchQuery]);

  useEffect(() => {
    setIsLoggedIn(isAuthenticated());
    fetchTournaments();
  }, [fetchTournaments]);

  const getGameEmoji = (gameType: string) => {
    const game = GAME_OPTIONS.find(g => g.value === gameType);
    return game?.icon || "🎮";
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "TBD";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "TBD";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      registration_open: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      upcoming: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      ongoing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      completed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    };
    return styles[status] || styles.upcoming;
  };

  const getSlotsStatus = (registered: number | undefined, max: number) => {
    const safeRegistered = registered ?? 0;
    const percentage = (safeRegistered / max) * 100;
    if (percentage >= 100) return { text: "Full", color: "text-red-600" };
    if (percentage >= 80) return { text: "Almost Full", color: "text-orange-600" };
    if (percentage >= 50) return { text: "Filling Up", color: "text-yellow-600" };
    return { text: "Open", color: "text-green-600" };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Browse Tournaments
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Find and join esports tournaments. 
          {!isLoggedIn && (
            <Link href="/register" className="text-orange-600 dark:text-orange-400 hover:underline ml-1">
              Create an account
            </Link>
          )}
          {!isLoggedIn && " to participate."}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search tournaments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Game Filter */}
          <div>
            <select
              value={gameFilter}
              onChange={(e) => setGameFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              {GAME_OPTIONS.map((game) => (
                <option key={game.value} value={game.value}>
                  {game.icon} {game.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Showing {tournaments.length} tournament{tournaments.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Tournament Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 animate-pulse"
            >
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {tournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tournaments.map((tournament) => {
                const slotsStatus = getSlotsStatus(tournament.current_teams, tournament.max_teams);
                
                return (
                  <Link
                    key={tournament.id}
                    href={`/tournaments/${tournament.id}`}
                    className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-200 group overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{getGameEmoji(tournament.game_type)}</span>
                          <div>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(tournament.computed_status || tournament.status)}`}>
                              {(tournament.computed_status || tournament.status).replace("_", " ")}
                            </span>
                          </div>
                        </div>
                        <span className={`text-xs font-medium ${slotsStatus.color}`}>
                          {slotsStatus.text}
                        </span>
                      </div>

                      <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition line-clamp-2">
                        {tournament.tournament_name}
                      </h3>

                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        {tournament.tournament_type.charAt(0).toUpperCase() + tournament.tournament_type.slice(1)} Tournament
                        {tournament.host_name && ` • by ${tournament.host_name}`}
                      </p>

                      {/* Tournament Details */}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-2">
                            <span>🏆</span>
                            <span>Prize Pool</span>
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            ₹{tournament.prize_pool.toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-2">
                            <span>💳</span>
                            <span>Entry Fee</span>
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {tournament.entry_fee > 0 ? `₹${tournament.entry_fee}` : "Free"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-2">
                            <span>📅</span>
                            <span>Starts</span>
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white text-xs">
                            {formatDate(tournament.tournament_start_date)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-2">
                            <span>👥</span>
                            <span>Slots</span>
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {tournament.current_teams ?? 0}/{tournament.max_teams}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-sm font-medium text-orange-600 dark:text-orange-400 group-hover:underline flex items-center gap-1">
                        View Details
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="text-6xl mb-4 block">🎮</span>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                No Tournaments Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchQuery || gameFilter || statusFilter
                  ? "Try adjusting your filters to find more tournaments"
                  : "No tournaments are currently available. Check back soon!"}
              </p>
              {(searchQuery || gameFilter || statusFilter) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setGameFilter("");
                    setStatusFilter("");
                  }}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* CTA for guests */}
      {!isLoggedIn && tournaments.length > 0 && (
        <div className="mt-12 bg-gradient-to-r from-orange-500 to-pink-500 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">
            Ready to Compete?
          </h2>
          <p className="text-white/90 mb-6">
            Create a free account to register for tournaments and start winning!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="px-6 py-3 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition"
            >
              Create Account
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 bg-white/20 text-white font-bold rounded-xl hover:bg-white/30 transition"
            >
              Sign In
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
