"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/api-client";

interface Tournament {
  id: string;
  tournament_name: string;
  game_type: string;
  tournament_type: string;
  prize_pool: number;
  entry_fee: number;
  tournament_start_date: string;
  status: string;
  computed_status: string;
  max_teams: number;
  current_teams: number;
  host_name?: string;
}

const FEATURED_GAMES = [
  { name: "Free Fire", key: "freefire", icon: "🔥", color: "from-orange-500 to-red-500" },
  { name: "PUBG", key: "pubg", icon: "🎯", color: "from-yellow-500 to-orange-500" },
  { name: "Valorant", key: "valorant", icon: "⚔️", color: "from-red-500 to-pink-500" },
  { name: "COD Mobile", key: "codm", icon: "🔫", color: "from-green-500 to-teal-500" },
];

/**
 * Root Page - Public Dashboard
 * 
 * Visible to ALL users (logged in and guests)
 * Shows tournament listings with option to browse and register
 * Non-logged-in users are redirected to login when trying to register
 */
export default function HomePage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(isAuthenticated());
    
    // Fetch public tournaments
    fetch("/api/tournaments?limit=12")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTournaments(data.data.tournaments || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getGameEmoji = (gameType: string) => {
    const emojis: Record<string, string> = {
      freefire: "🔥",
      pubg: "🎯",
      valorant: "⚔️",
      codm: "🔫",
    };
    return emojis[gameType] || "🎮";
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-gray-900 dark:text-white">
              <span className="text-2xl">🎮</span>
              <span>Esports Platform</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/tournaments" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition">
                Browse All
              </Link>
              <Link href="/leaderboard" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition">
                Leaderboard
              </Link>
              <Link href="/hall-of-fame" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition">
                Hall of Fame
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-medium rounded-lg hover:opacity-90 transition"
                >
                  My Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-medium rounded-lg hover:opacity-90 transition"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"></div>
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Compete. <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">Win.</span> Dominate.
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-6">
              Join thousands of gamers in epic esports tournaments. Play your favorite games and win prizes.
            </p>
            
            {!isLoggedIn && (
              <div className="flex justify-center gap-4">
                <Link
                  href="/register"
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-xl hover:opacity-90 transition"
                >
                  Start Competing
                </Link>
                <Link
                  href="/tournaments"
                  className="px-6 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition border border-white/20"
                >
                  Browse Tournaments
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Featured Games */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Featured Games</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FEATURED_GAMES.map((game) => (
            <Link
              key={game.key}
              href={`/tournaments?game=${game.key}`}
              className={`bg-gradient-to-br ${game.color} rounded-xl p-6 text-white hover:scale-105 transition-transform`}
            >
              <span className="text-4xl mb-2 block">{game.icon}</span>
              <span className="font-bold">{game.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Tournament Listings */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Upcoming Tournaments</h2>
          <Link
            href="/tournaments"
            className="text-orange-600 dark:text-orange-400 hover:underline font-medium"
          >
            View All →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-4xl mb-4 block">🏆</span>
            <p className="text-gray-600 dark:text-gray-400">No tournaments available right now. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((tournament) => {
              const status = tournament.computed_status || tournament.status;
              const canRegister = status === "registration_open" && (tournament.current_teams ?? 0) < tournament.max_teams;
              
              return (
                <div
                  key={tournament.id}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition group"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{getGameEmoji(tournament.game_type)}</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(status)}`}>
                          {status.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 line-clamp-2">
                      {tournament.tournament_name}
                    </h3>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      {tournament.tournament_type.charAt(0).toUpperCase() + tournament.tournament_type.slice(1)} Tournament
                      {tournament.host_name && ` • by ${tournament.host_name}`}
                    </p>

                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>🏆 Prize Pool</span>
                        <span className="font-semibold text-gray-900 dark:text-white">₹{tournament.prize_pool.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>💳 Entry Fee</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {tournament.entry_fee > 0 ? `₹${tournament.entry_fee}` : "Free"}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>📅 Starts</span>
                        <span className="text-gray-900 dark:text-white text-xs">{formatDate(tournament.tournament_start_date)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>👥 Slots</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {tournament.current_teams ?? 0}/{tournament.max_teams}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/tournaments/${tournament.id}`}
                        className="flex-1 px-4 py-2 text-center text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm font-medium"
                      >
                        View Details
                      </Link>
                      {canRegister && (
                        <Link
                          href={isLoggedIn ? `/register-tournament/${tournament.id}` : `/login?redirect=/register-tournament/${tournament.id}&reason=registration`}
                          className="flex-1 px-4 py-2 text-center text-white bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg hover:opacity-90 transition text-sm font-medium"
                        >
                          Register
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Features Section */}
      <section className="bg-gray-100 dark:bg-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-12">Why Join Us?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🏆</span>
              </div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Win Prizes</h3>
              <p className="text-gray-600 dark:text-gray-400">Compete for real money prizes in tournaments across multiple games.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">👥</span>
              </div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Build Teams</h3>
              <p className="text-gray-600 dark:text-gray-400">Create or join teams to compete together in squad tournaments.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📊</span>
              </div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Track Stats</h3>
              <p className="text-gray-600 dark:text-gray-400">Monitor your progress and climb the global leaderboards.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section for guests */}
      {!isLoggedIn && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 md:p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to Compete?</h2>
            <p className="text-gray-300 mb-6 max-w-xl mx-auto">
              Create your free account and start participating in tournaments today.
            </p>
            <Link
              href="/register"
              className="inline-block px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-xl hover:opacity-90 transition"
            >
              Create Free Account
            </Link>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link href="/" className="flex items-center gap-2 font-bold text-xl text-gray-900 dark:text-white mb-4">
                <span className="text-2xl">🎮</span>
                <span>Esports Platform</span>
              </Link>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                The ultimate destination for competitive gaming.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link href="/tournaments" className="hover:text-gray-900 dark:hover:text-white">Tournaments</Link></li>
                <li><Link href="/leaderboard" className="hover:text-gray-900 dark:hover:text-white">Leaderboard</Link></li>
                <li><Link href="/hall-of-fame" className="hover:text-gray-900 dark:hover:text-white">Hall of Fame</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link href="/privacy-policy" className="hover:text-gray-900 dark:hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-gray-900 dark:hover:text-white">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-4">Account</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                {isLoggedIn ? (
                  <>
                    <li><Link href="/dashboard" className="hover:text-gray-900 dark:hover:text-white">Dashboard</Link></li>
                    <li><Link href="/profile" className="hover:text-gray-900 dark:hover:text-white">Profile</Link></li>
                  </>
                ) : (
                  <>
                    <li><Link href="/login" className="hover:text-gray-900 dark:hover:text-white">Sign In</Link></li>
                    <li><Link href="/register" className="hover:text-gray-900 dark:hover:text-white">Create Account</Link></li>
                  </>
                )}
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-800 pt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            © {new Date().getFullYear()} Esports Platform. All rights reserved | Vaibhav Lohiya .
          </div>
        </div>
      </footer>
    </div>
  );
}
