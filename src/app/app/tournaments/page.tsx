"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TournamentWithHost } from "@/types";
import { useRegistrationCache } from "@/hooks/useRegistrationCache";
import { secureFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import { TournamentCard } from "@/components/app/TournamentCard";
import { EmptyState } from "@/components/app/EmptyState";
import { TabNav } from "@/components/app/TabNav";
import { FormSelect } from "@/components/app/FormComponents";

// Filter options
const GAME_OPTIONS = [
  { value: "", label: "All Games" },
  { value: "freefire", label: "🔥 Free Fire" },
  { value: "pubg", label: "🎯 PUBG" },
  { value: "valorant", label: "⚔️ Valorant" },
  { value: "codm", label: "🔫 COD Mobile" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "solo", label: "Solo" },
  { value: "duo", label: "Duo" },
  { value: "squad", label: "Squad" },
];

const SORT_OPTIONS = [
  { value: "date_asc", label: "Date (Earliest)" },
  { value: "date_desc", label: "Date (Latest)" },
  { value: "prize_desc", label: "Prize (High to Low)" },
  { value: "prize_asc", label: "Prize (Low to High)" },
  { value: "popularity", label: "Most Popular" },
];

const PRIZE_OPTIONS = [
  { value: "", label: "Any Prize" },
  { value: "0-500", label: "₹0 - ₹500" },
  { value: "500-1000", label: "₹500 - ₹1,000" },
  { value: "1000-5000", label: "₹1,000 - ₹5,000" },
  { value: "5000-10000", label: "₹5,000 - ₹10,000" },
  { value: "10000+", label: "₹10,000+" },
];

interface FilterState {
  status: string;
  gameType: string;
  tournamentType: string;
  prizeRange: string;
  sort: string;
  search: string;
}

const STATUS_TABS = [
  { id: "all", label: "All", icon: "📋" },
  { id: "registration_open", label: "Open", icon: "✅" },
  { id: "upcoming", label: "Upcoming", icon: "📅" },
  { id: "ongoing", label: "Live", icon: "🔴" },
  { id: "registered", label: "Registered", icon: "🎮" },
];

/**
 * Tournaments Explorer Page
 * 
 * Features:
 * - Advanced filtering (game, type, prize, status)
 * - Multiple sort options
 * - Responsive grid layout
 * - URL-based state for shareable links
 */
export default function TournamentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [tournaments, setTournaments] = useState<TournamentWithHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  const { registeredIds } = useRegistrationCache();

  // Initialize filters from URL params
  const [filters, setFilters] = useState<FilterState>({
    status: searchParams.get("status") || "all",
    gameType: searchParams.get("game") || "",
    tournamentType: searchParams.get("type") || "",
    prizeRange: searchParams.get("prize") || "",
    sort: searchParams.get("sort") || "date_asc",
    search: searchParams.get("search") || "",
  });

  // Update URL when filters change
  const updateURL = useCallback((newFilters: FilterState) => {
    const params = new URLSearchParams();
    if (newFilters.status !== "all") params.set("status", newFilters.status);
    if (newFilters.gameType) params.set("game", newFilters.gameType);
    if (newFilters.tournamentType) params.set("type", newFilters.tournamentType);
    if (newFilters.prizeRange) params.set("prize", newFilters.prizeRange);
    if (newFilters.sort !== "date_asc") params.set("sort", newFilters.sort);
    if (newFilters.search) params.set("search", newFilters.search);
    
    const queryString = params.toString();
    router.push(`/app/tournaments${queryString ? `?${queryString}` : ""}`, { scroll: false });
  }, [router]);

  // Build API query string
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    
    if (filters.status !== "all" && filters.status !== "registered") {
      params.set("filter", filters.status);
    }
    if (filters.gameType) params.set("game_type", filters.gameType);
    if (filters.tournamentType) params.set("tournament_type", filters.tournamentType);
    if (filters.sort !== "date_asc") params.set("sort", filters.sort);
    if (filters.search) params.set("search", filters.search);
    
    // Handle prize range
    if (filters.prizeRange) {
      if (filters.prizeRange.endsWith("+")) {
        params.set("min_prize", filters.prizeRange.replace("+", ""));
      } else {
        const [min, max] = filters.prizeRange.split("-");
        if (min) params.set("min_prize", min);
        if (max) params.set("max_prize", max);
      }
    }
    
    return params.toString();
  }, [filters]);

  // Fetch tournaments
  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    try {
      const queryString = buildQueryString();
      const res = await secureFetch(`/api/tournaments${queryString ? `?${queryString}` : ""}`);
      const data = await res.json();
      
      if (data.success) {
        let results = data.data.tournaments || [];
        
        // Handle "registered" filter client-side
        if (filters.status === "registered") {
          results = results.filter((t: TournamentWithHost) => 
            registeredIds.has(String(t.id))
          );
        }
        
        setTournaments(results);
      } else {
        setTournaments([]);
      }
    } catch (error) {
      console.error("Failed to fetch tournaments:", error);
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }, [buildQueryString, filters.status, registeredIds]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  // Handle filter changes
  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    updateURL(newFilters);
  };

  // Clear all filters
  const clearFilters = () => {
    const defaultFilters: FilterState = {
      status: "all",
      gameType: "",
      tournamentType: "",
      prizeRange: "",
      sort: "date_asc",
      search: "",
    };
    setFilters(defaultFilters);
    router.push("/app/tournaments");
  };

  const hasActiveFilters = 
    filters.gameType || 
    filters.tournamentType || 
    filters.prizeRange || 
    filters.sort !== "date_asc" ||
    filters.search;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tournaments"
        subtitle="Find and join exciting esports competitions"
        actions={
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition
              ${showFilters || hasActiveFilters
                ? "bg-orange-500 text-white"
                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="bg-white text-orange-500 rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">
                !
              </span>
            )}
          </button>
        }
      />

      {/* Status Tabs */}
      <TabNav
        tabs={STATUS_TABS}
        activeTab={filters.status}
        onChange={(id) => handleFilterChange("status", id)}
        variant="pills"
      />

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FormSelect
              label="Game"
              value={filters.gameType}
              onChange={(e) => handleFilterChange("gameType", e.target.value)}
              options={GAME_OPTIONS}
            />
            <FormSelect
              label="Tournament Type"
              value={filters.tournamentType}
              onChange={(e) => handleFilterChange("tournamentType", e.target.value)}
              options={TYPE_OPTIONS}
            />
            <FormSelect
              label="Prize Pool"
              value={filters.prizeRange}
              onChange={(e) => handleFilterChange("prizeRange", e.target.value)}
              options={PRIZE_OPTIONS}
            />
            <FormSelect
              label="Sort By"
              value={filters.sort}
              onChange={(e) => handleFilterChange("sort", e.target.value)}
              options={SORT_OPTIONS}
            />
          </div>
          
          {hasActiveFilters && (
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? "Loading..." : `${tournaments.length} tournament${tournaments.length !== 1 ? "s" : ""} found`}
        </p>
      </div>

      {/* Tournament Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 animate-pulse border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded-full" />
              </div>
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <EmptyState
          icon={filters.status === "registered" ? "📋" : "🔍"}
          title={filters.status === "registered" ? "No registered tournaments" : "No tournaments found"}
          description={
            filters.status === "registered" 
              ? "You haven't registered for any tournaments yet"
              : hasActiveFilters 
                ? "Try adjusting your filters to find more tournaments"
                : "Check back later for new tournaments"
          }
          action={
            filters.status === "registered"
              ? { label: "Browse Tournaments", onClick: () => handleFilterChange("status", "all") }
              : hasActiveFilters
                ? { label: "Clear Filters", onClick: clearFilters }
                : undefined
          }
          variant="card"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              id={tournament.id}
              name={tournament.tournament_name}
              gameType={tournament.game_type}
              tournamentType={tournament.tournament_type}
              prizePool={tournament.prize_pool}
              entryFee={tournament.entry_fee}
              startDate={tournament.tournament_start_date}
              status={tournament.status}
              maxTeams={tournament.max_teams}
              registeredCount={tournament.current_teams || 0}
              hostName={tournament.host_name}
              isRegistered={registeredIds.has(String(tournament.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
