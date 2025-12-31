import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import pool from "@/lib/db";

// ISR - Revalidate every 2 minutes for active tournaments
export const revalidate = 120;

// Pre-generate pages for recent/popular tournaments at build time
export async function generateStaticParams(): Promise<{ id: string }[]> {
  try {
    // Get recent active tournaments to pre-render
    const result = await pool.query(
      `SELECT id FROM tournaments 
       WHERE tournament_end_date > NOW() - INTERVAL '7 days'
       ORDER BY current_teams DESC, created_at DESC
       LIMIT 20`
    );
    return result.rows.map((row) => ({ id: String(row.id) }));
  } catch (error) {
    console.error("generateStaticParams error:", error);
    return [];
  }
}

interface TournamentData {
  id: number;
  tournament_name: string;
  tournament_banner_url: string | null;
  game_type: string;
  prize_pool: number;
  max_teams: number;
  current_teams: number;
  tournament_type: "solo" | "duo" | "squad";
  registration_start_date: string;
  registration_end_date: string;
  tournament_start_date: string;
  tournament_end_date: string;
  match_rules: string | null;
  host_name: string;
  status: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
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

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  upcoming: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Upcoming" },
  registration_open: { bg: "bg-green-100", text: "text-green-700", label: "Registration Open" },
  ongoing: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Ongoing" },
  completed: { bg: "bg-gray-100", text: "text-gray-700", label: "Completed" },
};

async function getTournament(id: string): Promise<TournamentData | null> {
  try {
    const result = await pool.query(
      `SELECT 
        t.id,
        t.tournament_name,
        t.tournament_banner_url,
        t.game_type,
        t.prize_pool,
        t.max_teams,
        t.current_teams,
        t.tournament_type,
        t.registration_start_date,
        t.registration_end_date,
        t.tournament_start_date,
        t.tournament_end_date,
        t.match_rules,
        u.username as host_name,
        CASE
          WHEN t.tournament_end_date <= NOW() THEN 'completed'
          WHEN t.tournament_start_date <= NOW() THEN 'ongoing'
          WHEN t.registration_end_date <= NOW() THEN 'upcoming'
          WHEN t.registration_start_date <= NOW() THEN 'registration_open'
          ELSE 'upcoming'
        END as status
      FROM tournaments t
      JOIN users u ON t.host_id = u.id
      WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error("Error fetching tournament:", error);
    return null;
  }
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const tournament = await getTournament(id);

  if (!tournament) {
    return {
      title: "Tournament Not Found | Esports Platform",
    };
  }

  const gameName = GAME_NAMES[tournament.game_type] || tournament.game_type;
  const statusInfo = STATUS_STYLES[tournament.status] || STATUS_STYLES.upcoming;

  return {
    title: `${tournament.tournament_name} | ${gameName} Tournament`,
    description: `Join ${tournament.tournament_name} - a ${tournament.tournament_type} ${gameName} tournament with ₹${tournament.prize_pool.toLocaleString()} prize pool. ${statusInfo.label}. Hosted by ${tournament.host_name}.`,
    openGraph: {
      title: `${tournament.tournament_name} | ${gameName} Tournament`,
      description: `₹${tournament.prize_pool.toLocaleString()} prize pool • ${tournament.tournament_type.toUpperCase()} • ${statusInfo.label}`,
      type: "website",
      images: tournament.tournament_banner_url
        ? [{ url: tournament.tournament_banner_url, width: 1200, height: 630 }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: tournament.tournament_name,
      description: `₹${tournament.prize_pool.toLocaleString()} prize pool • ${gameName}`,
      images: tournament.tournament_banner_url ? [tournament.tournament_banner_url] : undefined,
    },
  };
}

function formatDate(dateString: string): string {
  if (!dateString) return "TBD";
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PublicTournamentPage({ params }: PageProps) {
  const { id } = await params;
  const tournament = await getTournament(id);

  if (!tournament) {
    notFound();
  }

  const gameName = GAME_NAMES[tournament.game_type] || tournament.game_type;
  const gameIcon = GAME_ICONS[tournament.game_type] || "🎮";
  const statusInfo = STATUS_STYLES[tournament.status] || STATUS_STYLES.upcoming;

  const now = Date.now();
  const regStart = new Date(tournament.registration_start_date).getTime();
  const regEnd = new Date(tournament.registration_end_date).getTime();
  const hasValidDates = !isNaN(regStart) && !isNaN(regEnd);
  const isRegistrationOpen = hasValidDates && now >= regStart && now < regEnd;
  const hasSpots = tournament.current_teams < tournament.max_teams;
  const spotsLeft = tournament.max_teams - tournament.current_teams;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Banner */}
      <div className="relative h-64 md:h-80 bg-gray-800">
        {tournament.tournament_banner_url ? (
          <Image
            src={tournament.tournament_banner_url}
            alt={tournament.tournament_name}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-8xl">{gameIcon}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent" />
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bg} ${statusInfo.text}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-16 relative z-10 pb-12">
        {/* Title Card */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <span>{gameIcon}</span>
                <span>{gameName}</span>
                <span>•</span>
                <span className="capitalize">{tournament.tournament_type}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                {tournament.tournament_name}
              </h1>
              <p className="text-gray-400">Hosted by {tournament.host_name}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-green-400">
                ₹{tournament.prize_pool.toLocaleString()}
              </p>
              <p className="text-gray-400 text-sm">Prize Pool</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-white">{tournament.current_teams}</p>
            <p className="text-gray-400 text-sm">/ {tournament.max_teams} Teams</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-orange-400">{spotsLeft}</p>
            <p className="text-gray-400 text-sm">Spots Left</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-white capitalize">{tournament.tournament_type}</p>
            <p className="text-gray-400 text-sm">Format</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-white">{gameName}</p>
            <p className="text-gray-400 text-sm">Game</p>
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">📅 Schedule</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <p className="text-gray-400 text-sm">Registration Opens</p>
                <p className="text-white">{formatDate(tournament.registration_start_date)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Registration Closes</p>
                <p className="text-white">{formatDate(tournament.registration_end_date)}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-gray-400 text-sm">Tournament Starts</p>
                <p className="text-white">{formatDate(tournament.tournament_start_date)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Tournament Ends</p>
                <p className="text-white">{formatDate(tournament.tournament_end_date)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rules */}
        {tournament.match_rules && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">📋 Rules & Guidelines</h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-gray-300 whitespace-pre-wrap">{tournament.match_rules}</p>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/30 rounded-xl p-6 text-center">
          {tournament.status === "completed" ? (
            <>
              <h2 className="text-xl font-bold text-white mb-2">🏆 Tournament Completed</h2>
              <p className="text-gray-400 mb-4">This tournament has ended. Check the leaderboard for results!</p>
              <Link
                href={`/dashboard/tournament/${tournament.id}/leaderboard`}
                className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
              >
                View Results
              </Link>
            </>
          ) : isRegistrationOpen && hasSpots ? (
            <>
              <h2 className="text-xl font-bold text-white mb-2">🎮 Registration Open!</h2>
              <p className="text-gray-400 mb-4">
                {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} remaining. Sign in to register!
              </p>
              <Link
                href={`/login?redirect=/dashboard/tournament/${tournament.id}`}
                className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
              >
                Sign In to Register
              </Link>
            </>
          ) : !hasSpots ? (
            <>
              <h2 className="text-xl font-bold text-white mb-2">Tournament Full</h2>
              <p className="text-gray-400 mb-4">All spots have been filled. Check back for future tournaments!</p>
              <Link
                href="/dashboard"
                className="inline-block px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-500 transition-colors"
              >
                Browse Tournaments
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-2">Registration Coming Soon</h2>
              <p className="text-gray-400 mb-4">
                Registration opens on {formatDate(tournament.registration_start_date)}
              </p>
              <Link
                href="/login"
                className="inline-block px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-500 transition-colors"
              >
                Sign In to Get Notified
              </Link>
            </>
          )}
        </div>

        {/* Footer Links */}
        <div className="mt-8 flex justify-between items-center text-sm">
          <Link href="/dashboard" className="text-orange-500 hover:text-orange-400 transition-colors">
            ← Browse All Tournaments
          </Link>
          <Link href="/leaderboard" className="text-orange-500 hover:text-orange-400 transition-colors">
            Hall of Fame →
          </Link>
        </div>

        {/* Data freshness note */}
        <p className="mt-4 text-center text-gray-600 text-xs">
          Page updates every 2 minutes • Sign in for real-time updates
        </p>
      </div>
    </div>
  );
}
