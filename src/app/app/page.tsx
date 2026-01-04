"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { TournamentWithHost } from "@/types";
import { useRegistrationCache } from "@/hooks/useRegistrationCache";
import { secureFetch } from "@/lib/api-client";
import { StatCard } from "@/components/app/StatCard";
import { TournamentCard } from "@/components/app/TournamentCard";
import { QuickAction } from "@/components/app/QuickAction";
import { EmptyState } from "@/components/app/EmptyState";
import { AdPlacement } from "@/components/ads";

// Types for recommendations
interface RecommendedTournament extends TournamentWithHost {
  recommendation_reason: string;
}

interface GamePreference {
  game: string;
  weight: number;
  rank: number;
}

interface UserStats {
  totalRegistrations: number;
  activeTournaments: number;
  teamsCount: number;
  walletBalance: number;
}

const FEATURED_GAMES = [
  { name: "Free Fire", key: "freefire", icon: "🔥", color: "from-orange-500 to-red-500" },
  { name: "PUBG", key: "pubg", icon: "🎯", color: "from-yellow-500 to-orange-500" },
  { name: "Valorant", key: "valorant", icon: "⚔️", color: "from-red-500 to-pink-500" },
  { name: "COD Mobile", key: "codm", icon: "🔫", color: "from-green-500 to-teal-500" },
];

/**
 * App Home Page - Main Dashboard for Authenticated Users
 * 
 * Features:
 * - Personalized tournament recommendations
 * - Quick stats overview
 * - Upcoming registered tournaments
 * - Quick actions
 * - Game-specific browsing
 */
export default function AppHomePage() {
  const [tournaments, setTournaments] = useState<TournamentWithHost[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedTournament[]>([]);
  const [gamePreferences, setGamePreferences] = useState<GamePreference[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalRegistrations: 0,
    activeTournaments: 0,
    teamsCount: 0,
    walletBalance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  
  const { registeredIds } = useRegistrationCache();

  // Fetch user stats
  const fetchStats = useCallback(async () => {
    try {
      const [walletRes, teamsRes] = await Promise.all([
        secureFetch("/api/wallet/balance"),
        secureFetch("/api/teams/my-teams"),
      ]);
      
      const [walletData, teamsData] = await Promise.all([
        walletRes.json(),
        teamsRes.json(),
      ]);
      
      setStats(prev => ({
        ...prev,
        walletBalance: walletData.success ? walletData.data.balance : 0,
        teamsCount: teamsData.success ? teamsData.data.teams?.length || 0 : 0,
        totalRegistrations: registeredIds.size,
      }));
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, [registeredIds.size]);

  // Fetch recommendations
  const fetchRecommendations = useCallback(async () => {
    setLoadingRecommendations(true);
    try {
      const res = await secureFetch("/api/tournaments/recommendations?limit=6");
      const data = await res.json();
      if (data.success) {
        setRecommendations(data.data.recommendations || []);
        setGamePreferences(data.data.preferences || []);
      }
    } catch {
      // Silently fail - recommendations are optional
    } finally {
      setLoadingRecommendations(false);
    }
  }, []);

  // Fetch upcoming tournaments
  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureFetch("/api/tournaments?filter=upcoming&limit=6");
      const data = await res.json();
      if (data.success) {
        setTournaments(data.data.tournaments || []);
        setStats(prev => ({
          ...prev,
          activeTournaments: data.data.tournaments?.filter(
            (t: TournamentWithHost) => registeredIds.has(String(t.id))
          ).length || 0,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch tournaments:", error);
    } finally {
      setLoading(false);
    }
  }, [registeredIds]);

  useEffect(() => {
    fetchStats();
    fetchRecommendations();
    fetchTournaments();
  }, [fetchStats, fetchRecommendations, fetchTournaments]);

  // Get the user's top game preference
  const topGame = gamePreferences[0];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 md:p-8">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-500/20 to-pink-500/20 rounded-full blur-3xl" />
        
        <div className="relative">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Welcome back! 👋
          </h1>
          <p className="text-gray-400 mb-6 max-w-lg">
            {recommendations.length > 0 
              ? `We found ${recommendations.length} tournaments just for you. Ready to compete?`
              : "Find exciting tournaments and start competing today!"}
          </p>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <p className="text-2xl font-bold text-white">{stats.totalRegistrations}</p>
              <p className="text-sm text-gray-400">Registrations</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <p className="text-2xl font-bold text-white">{stats.activeTournaments}</p>
              <p className="text-sm text-gray-400">Active</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <p className="text-2xl font-bold text-white">{stats.teamsCount}</p>
              <p className="text-sm text-gray-400">Teams</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <p className="text-2xl font-bold text-orange-400 font-mono">
                ₹{stats.walletBalance.toLocaleString()}
              </p>
              <p className="text-sm text-gray-400">Balance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickAction
          icon="🎮"
          label="Browse Tournaments"
          description="Find your next competition"
          href="/app/tournaments"
          color="primary"
        />
        <QuickAction
          icon="👥"
          label="My Teams"
          description={`${stats.teamsCount} teams`}
          href="/app/teams"
          color="success"
        />
        <QuickAction
          icon="📋"
          label="My Registrations"
          description={`${stats.totalRegistrations} registered`}
          href="/app/registrations"
          color="warning"
        />
        <QuickAction
          icon="💰"
          label="Wallet"
          description={`₹${stats.walletBalance.toLocaleString()}`}
          href="/app/wallet"
          color="default"
        />
      </div>

      {/* Featured Games */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Browse by Game
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FEATURED_GAMES.map((game) => (
            <Link
              key={game.key}
              href={`/app/tournaments?game=${game.key}`}
              className={`
                relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${game.color}
                group hover:scale-[1.02] hover:shadow-lg transition-all duration-200
              `}
            >
              <span className="text-3xl md:text-4xl">{game.icon}</span>
              <h3 className="text-lg font-bold text-white mt-2">{game.name}</h3>
              {topGame?.game === game.key && (
                <div className="absolute top-3 right-3 bg-white/20 backdrop-blur rounded-full px-2 py-1 text-xs text-white font-medium">
                  ⭐ Favorite
                </div>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* Recommendations Section */}
      {!loadingRecommendations && recommendations.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Recommended for You
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Based on your preferences and play history
              </p>
            </div>
            <Link
              href="/app/tournaments"
              className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline"
            >
              View All →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.slice(0, 3).map((tournament) => (
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
                recommendation={tournament.recommendation_reason}
                variant="featured"
              />
            ))}
          </div>
        </section>
      )}

      {/* Top Banner Ad */}
      <AdPlacement placementId="dashboard_top" className="my-6" />

      {/* Upcoming Tournaments */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Upcoming Tournaments
          </h2>
          <Link
            href="/app/tournaments?filter=upcoming"
            className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline"
          >
            View All →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 animate-pulse">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                  <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded-full" />
                </div>
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <EmptyState
            icon="🎮"
            title="No upcoming tournaments"
            description="Check back later for new tournaments or browse all available ones"
            action={{ label: "Browse All Tournaments", href: "/app/tournaments" }}
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
      </section>

      {/* My Registered Tournaments (if any) */}
      {registeredIds.size > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Your Upcoming Matches
            </h2>
            <Link
              href="/app/registrations"
              className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline"
            >
              View All →
            </Link>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <span className="text-2xl">✓</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  You&apos;re registered for {registeredIds.size} tournament{registeredIds.size !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Check your registrations for room credentials and match details
                </p>
              </div>
              <Link
                href="/app/registrations"
                className="ml-auto px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition text-sm"
              >
                View Details
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
