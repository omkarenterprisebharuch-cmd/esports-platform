"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { TournamentWithHost } from "@/types";
import ChatButton from "@/components/chat/ChatButton";
import TournamentChatRoom from "@/components/chat/TournamentChatRoom";
import { ChatProvider } from "@/contexts/ChatContext";

interface ChatParticipantsData {
  registeredUserIds: (number | string)[];
  tournamentEndDate: string;
}

interface RoomCredentials {
  room_id: string | null;
  room_password: string | null;
  message?: string;
}

interface Winners {
  first: string | null;
  second: string | null;
  third: string | null;
}

export default function TournamentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [tournament, setTournament] = useState<TournamentWithHost | null>(null);
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
  const [roomCredentials, setRoomCredentials] = useState<RoomCredentials | null>(null);
  const [winners, setWinners] = useState<Winners | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatParticipants, setChatParticipants] = useState<ChatParticipantsData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    Promise.all([
      fetch(`/api/tournaments/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => res.json()),
      fetch("/api/registrations/my-registrations", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => res.json()),
      fetch(`/api/tournaments/${params.id}/winners`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => res.json()),
    ])
      .then(([tournamentData, registrationsData, winnersData]) => {
        if (tournamentData.success) {
          setTournament(tournamentData.data.tournament);
        }
        // Check if user is registered for this tournament
        const registrations = registrationsData.data?.registrations || [];
        const isRegistered = registrations.some(
          (reg: { tournament_id: string | number }) => String(reg.tournament_id) === String(params.id)
        );
        setIsAlreadyRegistered(isRegistered);

        // Set winners data
        if (winnersData.success && winnersData.data?.winners) {
          setWinners(winnersData.data.winners);
        }

        // If registered, fetch room credentials
        if (isRegistered) {
          fetch(`/api/registrations/room-credentials/${params.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success) {
                setRoomCredentials(data.data);
              }
            })
            .catch(() => {
              // Silently fail - room credentials may not be available yet
            });

          // Fetch chat participants for authenticated chat
          fetch(`/api/tournaments/${params.id}/chat-participants`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success) {
                setChatParticipants({
                  registeredUserIds: data.data.registeredUserIds,
                  tournamentEndDate: data.data.tournamentEndDate,
                });
              }
            })
            .catch(() => {
              // Silently fail - chat may not be available
            });
        }

        // Fetch current user ID
        fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setCurrentUserId(data.data.id);
            }
          })
          .catch(() => {});
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleRegister = async () => {
    if (!tournament) return;

    // For non-solo tournaments, redirect to registration page
    if (tournament.tournament_type !== "solo") {
      router.push(`/register-tournament/${tournament.id}`);
      return;
    }

    // For solo tournaments, register directly
    setRegistering(true);
    setMessage(null);

    const token = localStorage.getItem("token");

    try {
      const res = await fetch("/api/registrations/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tournament_id: tournament.id }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: "success",
          text: `Successfully registered! Your slot number is #${data.data.slot_number}`,
        });
        // Refresh tournament data
        const refreshRes = await fetch(`/api/tournaments/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setTournament(refreshData.data.tournament);
        }
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch {
      setMessage({ type: "error", text: "Registration failed" });
    } finally {
      setRegistering(false);
    }
  };

  const formatDate = (dateString: Date | string) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Tournament not found</p>
        <Link href="/dashboard" className="text-gray-900 underline mt-2">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // Check registration timing
  const now = new Date();
  const regStart = new Date(tournament.registration_start_date);
  const regEnd = new Date(tournament.registration_end_date);
  const isRegistrationOpen = now >= regStart && now < regEnd;
  const hasSpots = tournament.current_teams < tournament.max_teams;
  const canRegister = isRegistrationOpen && hasSpots && !isAlreadyRegistered;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Banner */}
      <div className="relative h-64 md:h-80 bg-gray-100 rounded-xl overflow-hidden mb-6">
        {tournament.tournament_banner_url ? (
          <Image
            src={tournament.tournament_banner_url}
            alt={tournament.tournament_name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-8xl">
              {getGameEmoji(tournament.game_type)}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase mb-2 ${getStatusStyle(tournament.status)}`}
          >
            {tournament.status.replace("_", " ")}
          </span>
          <h1 className="text-2xl md:text-3xl font-bold">
            {tournament.tournament_name}
          </h1>
          <p className="text-white/80">by {tournament.host_name}</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-600"
              : "bg-red-50 border border-red-200 text-red-600"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500">Prize Pool</p>
          <p className="text-2xl font-bold text-green-600">
            ₹{tournament.prize_pool}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500">Entry Fee</p>
          <p className="text-2xl font-bold text-gray-900">
            {tournament.entry_fee > 0 ? `₹${tournament.entry_fee}` : "Free"}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500">Teams</p>
          <p className="text-2xl font-bold text-gray-900">
            {tournament.current_teams}/{tournament.max_teams}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500">Type</p>
          <p className="text-2xl font-bold text-gray-900 uppercase">
            {tournament.tournament_type}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Tournament Details</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Game</p>
              <p className="font-medium text-gray-900 uppercase">
                {getGameEmoji(tournament.game_type)} {tournament.game_type}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Map</p>
              <p className="font-medium text-gray-900">
                {tournament.map_name || "TBD"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Registration Opens</p>
              <p className="font-medium text-gray-900">
                {formatDate(tournament.registration_start_date)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Registration Closes</p>
              <p className="font-medium text-gray-900">
                {formatDate(tournament.registration_end_date)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tournament Start</p>
              <p className="font-medium text-gray-900">
                {formatDate(tournament.tournament_start_date)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tournament End</p>
              <p className="font-medium text-gray-900">
                {formatDate(tournament.tournament_end_date)}
              </p>
            </div>
          </div>

          {tournament.description && (
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-2">Description</p>
              <p className="text-gray-700 whitespace-pre-wrap">
                {tournament.description}
              </p>
            </div>
          )}

          {tournament.match_rules && (
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-2">Match Rules</p>
              <p className="text-gray-700 whitespace-pre-wrap">
                {tournament.match_rules}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Winners Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🏆</span>
          <h2 className="font-semibold text-gray-900">Tournament Winners</h2>
        </div>

        {winners && (winners.first || winners.second || winners.third) ? (
          <div className="space-y-3">
            {winners.first && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-300">
                <span className="text-3xl">🥇</span>
                <div>
                  <p className="font-semibold text-gray-900">{winners.first}</p>
                  <p className="text-sm text-gray-500">1st Place</p>
                </div>
              </div>
            )}
            {winners.second && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-300">
                <span className="text-3xl">🥈</span>
                <div>
                  <p className="font-semibold text-gray-900">{winners.second}</p>
                  <p className="text-sm text-gray-500">2nd Place</p>
                </div>
              </div>
            )}
            {winners.third && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300">
                <span className="text-3xl">🥉</span>
                <div>
                  <p className="font-semibold text-gray-900">{winners.third}</p>
                  <p className="text-sm text-gray-500">3rd Place</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-4xl mb-2">🏅</p>
            <p className="font-medium">Winners Not Announced Yet</p>
            <p className="text-sm mt-1">
              {tournament.status === "completed" || tournament.status === "ongoing"
                ? "Results will be updated by the host soon."
                : "Winners will be announced after the tournament ends."}
            </p>
          </div>
        )}
      </div>

      {/* Registration Status */}
      {isAlreadyRegistered ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center mb-6">
          <p className="text-blue-700 font-medium text-lg">
            ✓ You & your team is already registered for this tournament
          </p>
          <Link href="/my-registrations" className="text-blue-600 text-sm underline mt-2 inline-block">
            View My Registrations
          </Link>

          {/* Room Credentials */}
          {roomCredentials && roomCredentials.room_id ? (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-left">
              <p className="font-semibold text-green-700 mb-2">🎮 Room Credentials</p>
              <div className="space-y-1">
                <p className="text-green-700">
                  <span className="font-medium">Room ID:</span> {roomCredentials.room_id}
                </p>
                {roomCredentials.room_password && (
                  <p className="text-green-700">
                    <span className="font-medium">Password:</span> {roomCredentials.room_password}
                  </p>
                )}
              </div>
            </div>
          ) : roomCredentials?.message ? (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-700 text-sm">{roomCredentials.message}</p>
            </div>
          ) : null}

          {/* Chat Button */}
          <div className="mt-4">
            <ChatButton
              tournamentId={tournament.id}
              registrationStartDate={tournament.registration_start_date.toString()}
              tournamentEndDate={tournament.tournament_end_date.toString()}
              isRegistered={isAlreadyRegistered}
              onClick={() => setChatOpen(true)}
            />
          </div>
        </div>
      ) : canRegister ? (
        <button
          onClick={handleRegister}
          disabled={registering}
          className="w-full py-4 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 text-lg mb-6"
        >
          {registering
            ? "Registering..."
            : tournament.tournament_type === "solo"
              ? "Register Now"
              : "Register with Team"}
        </button>
      ) : now < regStart ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center mb-6">
          <p className="text-yellow-700">
            Registration opens on{" "}
            {formatDate(tournament.registration_start_date)}
          </p>
        </div>
      ) : !hasSpots ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center mb-6">
          <p className="text-red-700">This tournament is full</p>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center mb-6">
          <p className="text-gray-700">Registration is closed</p>
        </div>
      )}

      {/* Chat Modal */}
      {isAlreadyRegistered && chatParticipants && currentUserId && (
        <ChatProvider>
          <TournamentChatRoom
            tournamentId={tournament.id}
            tournamentName={tournament.tournament_name}
            registeredUserIds={chatParticipants.registeredUserIds}
            tournamentEndTime={chatParticipants.tournamentEndDate}
            currentUserId={currentUserId}
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
          />
        </ChatProvider>
      )}
    </div>
  );
}
