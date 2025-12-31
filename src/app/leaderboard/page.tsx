import Link from "next/link";
import { Metadata } from "next";
import { AdPlacement } from "@/components/ads";

// ISR - Revalidate every 15 minutes for fresh data
export const revalidate = 900; // 15 minutes

export const metadata: Metadata = {
  title: "Hall of Fame | Esports Platform",
  description: "Celebrate our top esports champions. View leaderboards, tournament winners, and platform statistics.",
  openGraph: {
    title: "Hall of Fame | Esports Platform",
    description: "Celebrate our top esports champions and tournament winners.",
    type: "website",
  },
};

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

interface PlatformStats {
  totalTournamentsCompleted: number;
  totalUniqueWinners: number;
  totalPrizeDistributed: number;
  totalKills: number;
}

interface GameStats {
  gameType: string;
  totalTournaments: number;
  uniqueWinners: number;
  totalPrizePool: number;
  totalKills: number;
}

interface HallOfFameData {
  topPlayers: TopPlayer[];
  topTeams: TopTeam[];
  gameStats: GameStats[];
  platformStats: PlatformStats;
}

const GAME_ICONS: Record<string, string> = {
  freefire: "🔥",
  pubg: "🎯",
  valorant: "⚔️",
  codm: "🎮",
};

const GAME_NAMES: Record<string, string> = {
  freefire: "Free Fire",
  pubg: "PUBG",
  valorant: "Valorant",
  codm: "COD Mobile",
};

// Fetch data at build time / on revalidation
async function getHallOfFameData(): Promise<HallOfFameData | null> {
  try {
    // Determine base URL for API calls during SSR/ISR
    // Priority: NEXT_PUBLIC_APP_URL > VERCEL_URL > localhost
    let baseUrl: string;
    if (process.env.NEXT_PUBLIC_APP_URL) {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = "http://localhost:3000";
    }
    
    const response = await fetch(`${baseUrl}/api/hall-of-fame?limit=10`, {
      next: { revalidate: 900 }, // 15 minutes
    });

    if (!response.ok) {
      console.error("Failed to fetch hall of fame data");
      return null;
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error fetching hall of fame:", error);
    return null;
  }
}

export default async function PublicHallOfFamePage() {
  const data = await getHallOfFameData();

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Hall of Fame</h1>
          <p className="text-gray-400">Unable to load hall of fame data. Please try again later.</p>
          <Link href="/" className="mt-4 inline-block text-orange-500 hover:text-orange-400">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const { topPlayers, topTeams, gameStats, platformStats } = data;

  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">🏆 Hall of Fame</h1>
          <p className="text-gray-400">Celebrating our top esports champions</p>
        </div>

        {/* Leaderboard Sidebar Ad */}
        <AdPlacement placementId="leaderboard_sidebar" className="mb-8" />

        {/* Platform Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-orange-500">{platformStats.totalTournamentsCompleted}</p>
            <p className="text-gray-400 text-sm">Tournaments</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-green-500">{platformStats.totalUniqueWinners}</p>
            <p className="text-gray-400 text-sm">Champions</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-yellow-500">₹{platformStats.totalPrizeDistributed.toLocaleString()}</p>
            <p className="text-gray-400 text-sm">Prize Distributed</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-red-500">{platformStats.totalKills.toLocaleString()}</p>
            <p className="text-gray-400 text-sm">Total Kills</p>
          </div>
        </div>

        {/* Game Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {gameStats.map((game) => (
            <div key={game.gameType} className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{GAME_ICONS[game.gameType] || "🎮"}</span>
                <span className="text-white font-semibold">{GAME_NAMES[game.gameType] || game.gameType}</span>
              </div>
              <p className="text-gray-400 text-sm">{game.totalTournaments} tournaments</p>
              <p className="text-gray-400 text-sm">₹{game.totalPrizePool.toLocaleString()} prizes</p>
            </div>
          ))}
        </div>

        {/* Top Players */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">👑 Top Players</h2>
          
          {/* Top 3 Spotlight */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {topPlayers.slice(0, 3).map((player, index) => (
              <div
                key={player.id}
                className={`rounded-lg p-6 text-center ${
                  index === 0
                    ? "bg-gradient-to-br from-yellow-600/20 to-yellow-900/20 border border-yellow-500/30"
                    : index === 1
                    ? "bg-gradient-to-br from-gray-400/20 to-gray-600/20 border border-gray-400/30"
                    : "bg-gradient-to-br from-orange-600/20 to-orange-900/20 border border-orange-500/30"
                }`}
              >
                <div className="text-4xl mb-2">
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{player.username}</h3>
                <p className="text-gray-400 text-sm mb-3">{player.totalPodiumFinishes} podium finishes</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-yellow-500 font-bold">{player.firstPlaceWins}</p>
                    <p className="text-gray-500">1st</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-bold">{player.secondPlaceWins}</p>
                    <p className="text-gray-500">2nd</p>
                  </div>
                  <div>
                    <p className="text-orange-500 font-bold">{player.thirdPlaceWins}</p>
                    <p className="text-gray-500">3rd</p>
                  </div>
                </div>
                <p className="mt-3 text-green-400 font-semibold">₹{player.totalEarnings.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Remaining Players */}
          {topPlayers.length > 3 && (
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-300">#</th>
                    <th className="px-4 py-3 text-left text-gray-300">Player</th>
                    <th className="px-4 py-3 text-center text-gray-300">Wins</th>
                    <th className="px-4 py-3 text-center text-gray-300">Kills</th>
                    <th className="px-4 py-3 text-right text-gray-300">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {topPlayers.slice(3).map((player) => (
                    <tr key={player.id} className="border-t border-gray-700">
                      <td className="px-4 py-3 text-gray-400">{player.rank}</td>
                      <td className="px-4 py-3 text-white">{player.username}</td>
                      <td className="px-4 py-3 text-center text-yellow-500">{player.firstPlaceWins}</td>
                      <td className="px-4 py-3 text-center text-red-400">{player.totalKills}</td>
                      <td className="px-4 py-3 text-right text-green-400">₹{player.totalEarnings.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Teams */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">🏅 Top Teams</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topTeams.slice(0, 6).map((team, index) => (
              <div key={team.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                  </span>
                  <h3 className="text-white font-semibold">{team.teamName}</h3>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                  <div className="text-center">
                    <p className="text-yellow-500 font-bold">{team.firstPlaceWins}</p>
                    <p className="text-gray-500">1st</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 font-bold">{team.secondPlaceWins}</p>
                    <p className="text-gray-500">2nd</p>
                  </div>
                  <div className="text-center">
                    <p className="text-orange-500 font-bold">{team.thirdPlaceWins}</p>
                    <p className="text-gray-500">3rd</p>
                  </div>
                </div>
                <p className="text-green-400 font-semibold">₹{team.totalEarnings.toLocaleString()} earned</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-gradient-to-r from-orange-600/20 to-red-600/20 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-2">Ready to compete?</h2>
          <p className="text-gray-400 mb-6">Join our platform and become the next champion!</p>
          <div className="flex justify-center gap-4">
            <Link
              href="/login"
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
            >
              Browse Tournaments
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-700 flex justify-between">
          <Link href="/" className="text-orange-500 hover:text-orange-400 transition-colors">
            ← Back to Home
          </Link>
          <div className="text-gray-500 text-sm">
            Data updates every 15 minutes
          </div>
        </div>
      </div>
    </div>
  );
}
