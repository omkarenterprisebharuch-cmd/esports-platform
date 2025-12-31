import { NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import {
  successResponse,
  forbiddenResponse,
  serverErrorResponse,
} from "@/lib/api-response";
import { gzipSync, brotliCompressSync, constants } from "zlib";

/**
 * GET /api/owner/compression-stats
 * Get compression statistics for API responses (Owner only)
 * 
 * Returns:
 * - Current compression configuration
 * - Sample compression ratios for typical responses
 * - Bandwidth savings estimates
 */
export async function GET(request: NextRequest) {
  try {
    const user = requireOwner(request);
    if (!user) {
      return forbiddenResponse("Owner access required");
    }

    // Sample data representing typical API response sizes
    const sampleData = {
      // Typical tournament list response (~50 tournaments)
      tournamentList: JSON.stringify({
        tournaments: Array(50).fill(null).map((_, i) => ({
          id: `tournament-${i}`,
          title: `Tournament ${i} - Battle Royale Championship`,
          description: "Join the ultimate gaming competition with players from around the world.",
          game_type: ["freefire", "pubg", "valorant", "codm"][i % 4],
          prize_pool: 1000 + (i * 100),
          status: ["upcoming", "registration_open", "ongoing"][i % 3],
          start_date: new Date().toISOString(),
          registration_deadline: new Date().toISOString(),
          team_size: [1, 2, 4][i % 3],
          max_teams: 50 + (i * 2),
          host_name: `Organizer${i}`,
        })),
        total: 50,
        page: 1,
        limit: 50,
      }),

      // Hall of fame response
      hallOfFame: JSON.stringify({
        topPlayers: Array(20).fill(null).map((_, i) => ({
          user_id: `user-${i}`,
          username: `Champion${i}`,
          wins: 50 - i,
          podiums: 100 - i,
          total_kills: 5000 - (i * 100),
          total_earnings: 50000 - (i * 1000),
        })),
        topTeams: Array(10).fill(null).map((_, i) => ({
          team_id: `team-${i}`,
          team_name: `Elite Squad ${i}`,
          wins: 30 - i,
          total_earnings: 100000 - (i * 5000),
        })),
        recentWinners: Array(10).fill(null).map((_, i) => ({
          tournament_id: `t-${i}`,
          tournament_title: `Tournament ${i}`,
          winner: `Player${i}`,
          prize_amount: 10000 + (i * 1000),
        })),
        platformStats: {
          totalTournaments: 500,
          totalPlayers: 10000,
          totalPrizeDistributed: 5000000,
        },
      }),

      // User profile response
      userProfile: JSON.stringify({
        id: "user-123",
        username: "ProGamer",
        email: "progamer@example.com",
        avatar_url: "https://res.cloudinary.com/example/avatar.jpg",
        role: "player",
        stats: {
          tournaments_played: 50,
          tournaments_won: 15,
          total_kills: 2500,
          total_earnings: 75000,
        },
        teams: Array(3).fill(null).map((_, i) => ({
          id: `team-${i}`,
          name: `My Team ${i}`,
          role: i === 0 ? "captain" : "member",
        })),
      }),
    };

    // Calculate compression for each sample
    const compressionStats = Object.entries(sampleData).map(([name, data]) => {
      const original = Buffer.from(data);
      const gzipped = gzipSync(original, { level: 9 });
      const brotli = brotliCompressSync(original, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
        },
      });

      return {
        name,
        originalSize: original.length,
        gzipSize: gzipped.length,
        brotliSize: brotli.length,
        gzipRatio: Number((gzipped.length / original.length).toFixed(3)),
        brotliRatio: Number((brotli.length / original.length).toFixed(3)),
        gzipSavings: `${((1 - gzipped.length / original.length) * 100).toFixed(1)}%`,
        brotliSavings: `${((1 - brotli.length / original.length) * 100).toFixed(1)}%`,
      };
    });

    // Calculate totals
    const totals = compressionStats.reduce(
      (acc, stat) => ({
        originalSize: acc.originalSize + stat.originalSize,
        gzipSize: acc.gzipSize + stat.gzipSize,
        brotliSize: acc.brotliSize + stat.brotliSize,
      }),
      { originalSize: 0, gzipSize: 0, brotliSize: 0 }
    );

    return successResponse({
      configuration: {
        compressionEnabled: true,
        method: "gzip (Next.js built-in)",
        note: "Brotli compression is typically handled by CDN/reverse proxy (Vercel, Cloudflare, etc.)",
      },
      sampleCompressionRatios: compressionStats,
      totals: {
        ...totals,
        overallGzipRatio: Number((totals.gzipSize / totals.originalSize).toFixed(3)),
        overallBrotliRatio: Number((totals.brotliSize / totals.originalSize).toFixed(3)),
        gzipSavings: `${((1 - totals.gzipSize / totals.originalSize) * 100).toFixed(1)}%`,
        brotliSavings: `${((1 - totals.brotliSize / totals.originalSize) * 100).toFixed(1)}%`,
      },
      recommendations: [
        "Gzip compression is enabled via next.config.ts compress: true",
        "For Brotli support, deploy to Vercel or use nginx with brotli module",
        "JSON responses typically achieve 70-85% compression",
        "Use Cache-Control headers to reduce repeat requests",
      ],
      verificationCommand: "npx tsx scripts/verify-compression.ts",
    });
  } catch (error) {
    console.error("Compression stats error:", error);
    return serverErrorResponse(error);
  }
}
