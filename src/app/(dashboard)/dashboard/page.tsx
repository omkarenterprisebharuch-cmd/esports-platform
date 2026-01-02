"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TournamentWithHost } from "@/types";
import { useRegistrationCache } from "@/hooks/useRegistrationCache";
import { secureFetch } from "@/lib/api-client";
import { AdPlacement } from "@/components/ads";

// Filter state interface
interface FilterState {
  status: string;
  gameType: string;
  minPrize: string;
  maxPrize: string;
  startDate: string;
  endDate: string;
  sort: string;
}

const GAME_OPTIONS = [
  { value: "", label: "All Games" },
  { value: "freefire", label: "Free Fire" },
  { value: "pubg", label: "PUBG" },
  { value: "valorant", label: "Valorant" },
  { value: "codm", label: "COD Mobile" },
];

const SORT_OPTIONS = [
  { value: "date_asc", label: "Date (Earliest)" },
  { value: "date_desc", label: "Date (Latest)" },
  { value: "prize_desc", label: "Prize (High to Low)" },
  { value: "prize_asc", label: "Prize (Low to High)" },
  { value: "popularity", label: "Popularity" },
];

const PRIZE_RANGES = [
  { value: "", label: "Any" },
  { value: "0-500", label: "₹0 - ₹500" },
  { value: "500-1000", label: "₹500 - ₹1,000" },
  { value: "1000-5000", label: "₹1,000 - ₹5,000" },
  { value: "5000-10000", label: "₹5,000 - ₹10,000" },
  { value: "10000+", label: "₹10,000+" },
];

// Recommendation type
interface RecommendedTournament extends TournamentWithHost {
  recommendation_reason: string;
}

interface GamePreference {
  game: string;
  weight: number;
  rank: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<TournamentWithHost[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedTournament[]>([]);
  const [gamePreferences, setGamePreferences] = useState<GamePreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: "all",
    gameType: "",
    minPrize: "",
    maxPrize: "",
    startDate: "",
    endDate: "",
    sort: "date_asc",
  });
  
  // Use cached registration IDs instead of fetching on every page load
  const { registeredIds } = useRegistrationCache();

  // Fetch recommendations
  const fetchRecommendations = useCallback(() => {
    setLoadingRecommendations(true);
    secureFetch("/api/tournaments/recommendations?limit=6")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setRecommendations(data.data.recommendations || []);
          setGamePreferences(data.data.preferences || []);
        }
      })
      .catch(() => {
        // Silently fail - recommendations are optional
      })
      .finally(() => setLoadingRecommendations(false));
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    
    // Add status filter
    if (filter !== "all" && filter !== "registered") {
      params.set("filter", filter);
    }
    
    // Add game type
    if (filters.gameType) {
      params.set("game_type", filters.gameType);
    }
    
    // Add prize range
    if (filters.minPrize) {
      params.set("min_prize", filters.minPrize);
    }
    if (filters.maxPrize) {
      params.set("max_prize", filters.maxPrize);
    }
    
    // Add date range
    if (filters.startDate) {
      params.set("start_date", filters.startDate);
    }
    if (filters.endDate) {
      params.set("end_date", filters.endDate);
    }
    
    // Add sorting
    if (filters.sort && filters.sort !== "date_asc") {
      params.set("sort", filters.sort);
    }
    
    const queryString = params.toString();
    return queryString ? `?${queryString}` : "";
  }, [filter, filters]);

  const fetchTournaments = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    
    const queryString = buildQueryString();

    // Handle "registered" filter client-side using cached data
    if (filter === "registered") {
      secureFetch(`/api/tournaments${queryString}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            const allTournaments = data.data.tournaments || [];
            const registered = allTournaments.filter((t: TournamentWithHost) => 
              registeredIds.has(String(t.id))
            );
            setTournaments(registered);
          } else {
            console.error("Failed to fetch tournaments:", data.message);
            setFetchError(data.message || "Failed to load tournaments");
            setTournaments([]);
          }
        })
        .catch((err) => {
          console.error("Fetch tournaments error:", err);
          setFetchError("Network error. Please try again.");
          setTournaments([]);
        })
        .finally(() => setLoading(false));
      return;
    }

    secureFetch(`/api/tournaments${queryString}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTournaments(data.data.tournaments || []);
        } else {
          console.error("Failed to fetch tournaments:", data.message);
          setFetchError(data.message || "Failed to load tournaments");
          setTournaments([]);
        }
      })
      .catch((err) => {
        console.error("Fetch tournaments error:", err);
        setFetchError("Network error. Please try again.");
        setTournaments([]);
      })
      .finally(() => setLoading(false));
  }, [filter, buildQueryString, registeredIds]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const handlePrizeRangeChange = (value: string) => {
    if (!value) {
      setFilters(prev => ({ ...prev, minPrize: "", maxPrize: "" }));
    } else if (value.endsWith("+")) {
      const min = value.replace("+", "");
      setFilters(prev => ({ ...prev, minPrize: min, maxPrize: "" }));
    } else {
      const [min, max] = value.split("-");
      setFilters(prev => ({ ...prev, minPrize: min, maxPrize: max }));
    }
  };

  const getCurrentPrizeRange = () => {
    if (!filters.minPrize && !filters.maxPrize) return "";
    if (filters.minPrize && !filters.maxPrize) return `${filters.minPrize}+`;
    return `${filters.minPrize}-${filters.maxPrize}`;
  };

  const clearFilters = () => {
    setFilters({
      status: "all",
      gameType: "",
      minPrize: "",
      maxPrize: "",
      startDate: "",
      endDate: "",
      sort: "date_asc",
    });
    setFilter("all");
  };

  const hasActiveFilters = 
    filters.gameType || 
    filters.minPrize || 
    filters.maxPrize || 
    filters.startDate || 
    filters.endDate || 
    filters.sort !== "date_asc";

  const formatDate = (dateString: Date | string) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getGameEmoji = (gameType: string) => {
    const emojis: Record<string, string> = {
      freefire: "🔥",
      pubg: "🎯",
      valorant: "⚔️",
      codm: "🔫",
    };
    return emojis[gameType] || "🎮";
  };

  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      upcoming: "bg-indigo-100 text-indigo-700",
      registration_open: "bg-green-100 text-green-700",
      ongoing: "bg-yellow-100 text-yellow-700",
      completed: "bg-gray-100 text-gray-700",
    };
    return styles[status] || styles.upcoming;
  };

  return (
    <div>
      {/* Top Banner Ad */}
      <AdPlacement placementId="dashboard_top" className="mb-6" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">All Tournaments</h1>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter buttons */}
          {[
            { value: "all", label: "All" },
            { value: "registered", label: "Registered" },
            { value: "live", label: "Live" },
            { value: "upcoming", label: "Upcoming" },
            { value: "ongoing", label: "Ongoing" },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === item.value
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {item.label}
            </button>
          ))}
          
          {/* Toggle advanced filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              showFilters || hasActiveFilters
                ? "bg-orange-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="bg-white text-orange-500 rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">
                !
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Game Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Game
              </label>
              <select
                value={filters.gameType}
                onChange={(e) => setFilters(prev => ({ ...prev, gameType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                {GAME_OPTIONS.map((game) => (
                  <option key={game.value} value={game.value}>
                    {game.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Prize Pool Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prize Pool
              </label>
              <select
                value={getCurrentPrizeRange()}
                onChange={(e) => handlePrizeRangeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                {PRIZE_RANGES.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* End Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active filters summary */}
      {hasActiveFilters && !showFilters && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-sm text-gray-500">Active filters:</span>
          {filters.gameType && (
            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-medium">
              {GAME_OPTIONS.find(g => g.value === filters.gameType)?.label}
            </span>
          )}
          {(filters.minPrize || filters.maxPrize) && (
            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-medium">
              {PRIZE_RANGES.find(r => r.value === getCurrentPrizeRange())?.label || `₹${filters.minPrize}+`}
            </span>
          )}
          {filters.startDate && (
            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-medium">
              From: {filters.startDate}
            </span>
          )}
          {filters.endDate && (
            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-medium">
              To: {filters.endDate}
            </span>
          )}
          {filters.sort !== "date_asc" && (
            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-medium">
              {SORT_OPTIONS.find(s => s.value === filters.sort)?.label}
            </span>
          )}
          <button
            onClick={clearFilters}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Recommendations Section */}
      {filter === "all" && !hasActiveFilters && recommendations.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="text-xl">✨</span>
                Tournaments You Might Like
              </h2>
              {gamePreferences.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Based on your {gamePreferences.map(g => g.game.toUpperCase()).join(", ")} tournaments
                </p>
              )}
            </div>
          </div>

          {loadingRecommendations ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendations.map((tournament) => (
                <Link key={tournament.id} href={`/tournament/${tournament.id}`}>
                  <div className="bg-gradient-to-br from-orange-50 to-white border-2 border-orange-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:scale-[1.02] transition cursor-pointer h-full relative">
                    {/* Recommendation badge */}
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-orange-500 to-orange-400 text-white text-xs py-1 px-3 flex items-center gap-1">
                      <span>💡</span>
                      <span className="truncate">{tournament.recommendation_reason}</span>
                    </div>

                    <div className="relative h-32 bg-gray-100 flex items-center justify-center mt-6">
                      <span className="text-4xl">
                        {getGameEmoji(tournament.game_type)}
                      </span>
                      <span
                        className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold uppercase ${getStatusStyle(tournament.status)}`}
                      >
                        {tournament.status.replace("_", " ")}
                      </span>
                      <span className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded-full text-xs uppercase">
                        {tournament.game_type}
                      </span>
                    </div>

                    <div className="p-3">
                      <h3 className="font-semibold text-gray-900 truncate text-sm mb-1">
                        {tournament.tournament_name}
                      </h3>

                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-green-600 font-bold">₹{tournament.prize_pool}</span>
                        <span className="text-gray-500">
                          {tournament.entry_fee > 0 ? `₹${tournament.entry_fee} entry` : "Free"}
                        </span>
                      </div>

                      <div className="text-xs text-gray-500">
                        📅 {formatDate(tournament.tournament_start_date)}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Tournaments Header */}
      {filter === "all" && !hasActiveFilters && recommendations.length > 0 && (
        <h2 className="text-lg font-semibold text-gray-900 mb-4">All Tournaments</h2>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full"></div>
        </div>
      ) : fetchError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-12 text-center">
          <p className="text-red-600 font-medium mb-2">Failed to load tournaments</p>
          <p className="text-red-500 text-sm mb-4">{fetchError}</p>
          <button
            onClick={fetchTournaments}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Try Again
          </button>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-500">No tournaments found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tournaments.map((tournament) => (
            <Link key={tournament.id} href={`/tournament/${tournament.id}`}>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:scale-[1.02] transition cursor-pointer h-full">
                <div className="relative h-40 bg-gray-100 flex items-center justify-center">
                  <span className="text-5xl">
                    {getGameEmoji(tournament.game_type)}
                  </span>
                  <span
                    className={`absolute top-3 right-3 px-2 py-1 rounded text-xs font-semibold uppercase ${getStatusStyle(tournament.status)}`}
                  >
                    {tournament.status.replace("_", " ")}
                  </span>
                  <span className="absolute top-3 left-3 bg-black/60 text-white px-2 py-1 rounded-full text-xs uppercase">
                    {tournament.game_type}
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 truncate mb-1">
                    {tournament.tournament_name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-3">
                    by {tournament.host_name}
                  </p>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-500">Prize</p>
                      <p className="font-bold text-green-600">
                        ₹{tournament.prize_pool}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-500">Entry</p>
                      <p className="font-bold text-gray-900">
                        {tournament.entry_fee > 0
                          ? `₹${tournament.entry_fee}`
                          : "Free"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>
                      {tournament.current_teams}/{tournament.max_teams} Teams
                    </span>
                    <span>📅 {formatDate(tournament.tournament_start_date)}</span>
                  </div>

                  {/* Registration Status */}
                  {registeredIds.has(String(tournament.id)) ? (
                    <div className="py-2 bg-blue-100 text-blue-700 font-medium rounded-lg text-sm text-center">
                      Registered
                    </div>
                  ) : (() => {
                    const now = Date.now();
                    // Parse dates properly - ensure they're treated as proper timestamps
                    const regStartStr = tournament.registration_start_date?.toString() || '';
                    const regEndStr = tournament.registration_end_date?.toString() || '';
                    const regStart = new Date(regStartStr).getTime();
                    const regEnd = new Date(regEndStr).getTime();
                    // Check if dates are valid
                    const hasValidDates = !isNaN(regStart) && !isNaN(regEnd);
                    const isOpen = hasValidDates && now >= regStart && now < regEnd;
                    const hasSpots = tournament.current_teams < tournament.max_teams;
                    
                    if (isOpen && hasSpots) {
                      return (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(`/register-tournament/${tournament.id}`);
                          }}
                          className="w-full py-2 bg-green-600 text-white font-medium rounded-lg text-sm hover:bg-green-700 transition"
                        >
                          Register Now
                        </button>
                      );
                    } else if (hasValidDates && now < regStart) {
                      return (
                        <div className="py-2 bg-gray-100 text-gray-500 font-medium rounded-lg text-sm text-center">
                          Coming Soon
                        </div>
                      );
                    } else if (!hasSpots) {
                      return (
                        <div className="py-2 bg-gray-100 text-gray-500 font-medium rounded-lg text-sm text-center">
                          Full
                        </div>
                      );
                    } else {
                      return (
                        <div className="py-2 bg-gray-100 text-gray-500 font-medium rounded-lg text-sm text-center">
                          Closed
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
