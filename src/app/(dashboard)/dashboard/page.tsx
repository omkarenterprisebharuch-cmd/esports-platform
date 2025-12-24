"use client";

import { useEffect, useState, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { TournamentWithHost } from "@/types";
import { SkeletonTournamentGrid } from "@/components/ui/Skeleton";

export default function DashboardPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<TournamentWithHost[]>([]);
  const [registeredTournamentIds, setRegisteredTournamentIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    // Fetch tournaments and registrations in parallel
    Promise.all([
      fetch("/api/tournaments", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => res.json()),
      fetch("/api/registrations/my-registrations", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => res.json()),
    ])
      .then(([tournamentsData, registrationsData]) => {
        setTournaments(tournamentsData.data?.tournaments || []);
        
        // Extract registered tournament IDs
        const registrations = registrationsData.data?.registrations || [];
        const registeredIds = new Set<number>(
          registrations.map((reg: { tournament_id: number }) => reg.tournament_id)
        );
        setRegisteredTournamentIds(registeredIds);
      })
      .finally(() => setLoading(false));
  }, []);

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

  const TournamentCard = ({
    tournament,
  }: {
    tournament: TournamentWithHost;
  }) => {
    // Check if user is already registered
    const isAlreadyRegistered = registeredTournamentIds.has(tournament.id);
    
    // Check if registration is currently open
    const now = new Date();
    const regStart = new Date(tournament.registration_start_date);
    const regEnd = new Date(tournament.registration_end_date);
    const isRegistrationOpen = now >= regStart && now < regEnd;
    const hasSpots = tournament.current_teams < tournament.max_teams;
    const canRegister = isRegistrationOpen && hasSpots && !isAlreadyRegistered;

    // Determine button state
    const getRegisterButtonState = () => {
      if (isAlreadyRegistered) return { text: "Already Registered", disabled: true, isRegistered: true };
      if (now < regStart) return { text: "Coming Soon", disabled: true, isRegistered: false };
      if (now >= regEnd) return { text: "Closed", disabled: true, isRegistered: false };
      if (!hasSpots) return { text: "Full", disabled: true, isRegistered: false };
      return { text: "Register Now", disabled: false, isRegistered: false };
    };

    const buttonState = getRegisterButtonState();

    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
        <div className="relative h-40 bg-gray-100 flex items-center justify-center">
          {tournament.tournament_banner_url ? (
            <Image
              src={tournament.tournament_banner_url}
              alt={tournament.tournament_name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              loading="lazy"
              className="object-cover"
            />
          ) : (
            <span className="text-5xl">{getGameEmoji(tournament.game_type)}</span>
          )}
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
              <p className="text-xs text-gray-500">Prize Pool</p>
              <p className="font-bold text-green-600">
                ₹{tournament.prize_pool}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-xs text-gray-500">Entry</p>
              <p className="font-bold text-gray-900">
                {tournament.entry_fee > 0 ? `₹${tournament.entry_fee}` : "Free"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
            <span>
              {tournament.current_teams}/{tournament.max_teams} {tournament.tournament_type === "solo" ? "Players" : "Teams"}
            </span>
            <span className="uppercase text-xs font-medium text-gray-600">
              {tournament.tournament_type}
            </span>
          </div>

          <div className="text-xs text-gray-500 mb-3">
            📅 Starts: {formatDate(tournament.tournament_start_date)}
          </div>

          {/* Action Buttons - Always show both Register and View Details */}
          <div className="flex gap-2 pt-3 border-t border-gray-100">
            {isAlreadyRegistered ? (
              <div className="flex-1 py-2 bg-blue-100 text-blue-700 font-medium rounded-lg text-sm text-center">
                ✓ Already Registered
              </div>
            ) : canRegister ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/register-tournament/${tournament.id}`);
                }}
                className="flex-1 py-2 bg-green-600 text-white font-medium rounded-lg text-sm hover:bg-green-700 transition"
              >
                {buttonState.text}
              </button>
            ) : (
              <button
                disabled
                className="flex-1 py-2 bg-gray-300 text-gray-500 font-medium rounded-lg text-sm cursor-not-allowed"
              >
                {buttonState.text}
              </button>
            )}
            <Link href={`/tournament/${tournament.id}`} className="flex-1">
              <button className="w-full py-2 bg-gray-100 text-gray-700 font-medium rounded-lg text-sm hover:bg-gray-200 transition">
                View Details
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  };

  // Skeleton loading for better perceived performance
  if (loading) {
    return (
      <div className="space-y-8">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              🎮 Tournaments
            </h2>
            <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
          </div>
          <SkeletonTournamentGrid count={6} />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* All Tournaments Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            🎮 Tournaments
          </h2>
          <Link
            href="/tournaments"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            View all →
          </Link>
        </div>

        {tournaments.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <p className="text-gray-500 mb-2">
              No tournaments available
            </p>
            <p className="text-sm text-gray-400">
              Check back later for new tournaments
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournaments.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
