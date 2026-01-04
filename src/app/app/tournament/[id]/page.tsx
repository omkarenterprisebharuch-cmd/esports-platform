"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { TournamentWithHost } from "@/types";
import { useRegistrationCache } from "@/hooks/useRegistrationCache";
import { secureFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import { GameBadge, StatusBadge } from "@/components/app/Badges";
import { StatCard } from "@/components/app/StatCard";
import { TabNav } from "@/components/app/TabNav";
import { LazyRoomCredentials } from "@/components/ui";
import { ShareButton } from "@/components/ui/ShareButtons";

// Lazy load chat components
const ChatButton = dynamic(() => import("@/components/chat/ChatButton"), {
  loading: () => <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />,
  ssr: false,
});

const TournamentChatRoom = dynamic(() => import("@/components/chat/TournamentChatRoom"), {
  loading: () => null,
  ssr: false,
});

const ChatProvider = dynamic(
  () => import("@/contexts/ChatContext").then(mod => ({ default: mod.ChatProvider })),
  { ssr: false }
);

interface Winners {
  first: string | null;
  second: string | null;
  third: string | null;
}

interface ChatParticipantsData {
  registeredUserIds: (number | string)[];
  tournamentEndDate: string;
}

/**
 * Tournament Details Page
 * 
 * Features:
 * - Full tournament information
 * - Registration flow (solo/team)
 * - Room credentials display
 * - Winners display
 * - Chat integration
 * - Social sharing
 */
export default function TournamentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;
  
  const { isRegistered, addRegistration } = useRegistrationCache();
  
  // Core data
  const [tournament, setTournament] = useState<TournamentWithHost | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Registration status
  const [serverRegistered, setServerRegistered] = useState<boolean | null>(null);
  const cacheRegistered = isRegistered(tournamentId);
  const isAlreadyRegistered = serverRegistered !== null ? serverRegistered : cacheRegistered;
  
  // Winners
  const [winners, setWinners] = useState<Winners | null>(null);
  const [winnersLoading, setWinnersLoading] = useState(false);
  
  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatParticipants, setChatParticipants] = useState<ChatParticipantsData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [chatDataLoading, setChatDataLoading] = useState(false);
  
  // Active tab
  const [activeTab, setActiveTab] = useState("details");

  // Fetch tournament data
  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const res = await secureFetch(`/api/tournaments/${tournamentId}`);
        const data = await res.json();
        
        if (data.success) {
          setTournament(data.data.tournament);
          if (typeof data.data.isRegistered === "boolean") {
            setServerRegistered(data.data.isRegistered);
            if (data.data.isRegistered) {
              addRegistration(tournamentId);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch tournament:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTournament();
  }, [tournamentId, addRegistration]);

  // Fetch winners when completed
  const fetchWinners = useCallback(async () => {
    if (winners || !tournament || tournament.status !== "completed") return;
    
    setWinnersLoading(true);
    try {
      const res = await secureFetch(`/api/tournaments/${tournamentId}/winners`);
      const data = await res.json();
      if (data.success && data.data?.winners) {
        setWinners(data.data.winners);
      }
    } catch {
      // Silently fail
    } finally {
      setWinnersLoading(false);
    }
  }, [tournamentId, winners, tournament]);

  useEffect(() => {
    if (tournament?.status === "completed") {
      fetchWinners();
    }
  }, [tournament?.status, fetchWinners]);

  // Fetch chat data on demand
  const fetchChatData = useCallback(async () => {
    if (chatParticipants && currentUserId) return;
    
    setChatDataLoading(true);
    try {
      const [participantsRes, userRes] = await Promise.all([
        secureFetch(`/api/tournaments/${tournamentId}/chat-participants`),
        secureFetch("/api/auth/me"),
      ]);
      
      const [participantsData, userData] = await Promise.all([
        participantsRes.json(),
        userRes.json(),
      ]);
      
      if (participantsData.success) {
        setChatParticipants({
          registeredUserIds: participantsData.data.registeredUserIds,
          tournamentEndDate: participantsData.data.tournamentEndDate,
        });
      }
      
      if (userData.success) {
        setCurrentUserId(userData.data.id);
      }
    } catch {
      // Silently fail
    } finally {
      setChatDataLoading(false);
    }
  }, [tournamentId, chatParticipants, currentUserId]);

  const handleOpenChat = async () => {
    await fetchChatData();
    setChatOpen(true);
  };

  // Handle registration
  const handleRegister = async () => {
    if (!tournament) return;

    // For team tournaments, redirect to team registration
    if (tournament.tournament_type !== "solo") {
      router.push(`/app/register/${tournament.id}`);
      return;
    }

    setRegistering(true);
    setMessage(null);

    try {
      const res = await secureFetch("/api/registrations/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournament_id: tournament.id }),
      });

      const data = await res.json();

      if (res.ok) {
        setServerRegistered(true);
        addRegistration(tournamentId);
        setMessage({ type: "success", text: data.message || "Successfully registered!" });
      } else {
        setMessage({ type: "error", text: data.message || "Registration failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to register. Please try again." });
    } finally {
      setRegistering(false);
    }
  };

  // Format date
  const formatDate = (dateString: string | Date) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Check registration status
  const canRegister = tournament && 
    tournament.status === "registration_open" && 
    !isAlreadyRegistered &&
    (tournament.current_teams || 0) < tournament.max_teams;

  const isFull = tournament && (tournament.current_teams || 0) >= tournament.max_teams;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <span className="text-5xl mb-4 block">😕</span>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Tournament Not Found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          The tournament you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link
          href="/app/tournaments"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition"
        >
          ← Browse Tournaments
        </Link>
      </div>
    );
  }

  const slotsPercentage = ((tournament.current_teams || 0) / tournament.max_teams) * 100;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tournament.tournament_name}
        backLink={{ href: "/app/tournaments", label: "Back to Tournaments" }}
        badge={<StatusBadge status={tournament.status} />}
        actions={
          <div className="flex items-center gap-3">
            <ShareButton 
              title={tournament.tournament_name}
              url={`${typeof window !== "undefined" ? window.location.origin : ""}/app/tournament/${tournament.id}`}
            />
            {isAlreadyRegistered && (
              <button
                onClick={handleOpenChat}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                💬 Chat
              </button>
            )}
          </div>
        }
      />

      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 md:p-8">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-500/20 to-pink-500/20 rounded-full blur-3xl" />
        
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <GameBadge game={tournament.game_type} size="lg" />
                <div>
                  <p className="text-gray-400 text-sm">
                    {tournament.tournament_type.toUpperCase()} Tournament
                  </p>
                  <p className="text-gray-400 text-sm">
                    Hosted by {tournament.host_name}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-gray-400 text-sm">Prize Pool</p>
                  <p className="text-2xl font-bold text-orange-400">
                    ₹{tournament.prize_pool.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Entry Fee</p>
                  <p className="text-2xl font-bold text-white">
                    {tournament.entry_fee === 0 ? "Free" : `₹${tournament.entry_fee}`}
                  </p>
                </div>
              </div>
              
              {/* Slots Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">
                    {tournament.current_teams || 0} / {tournament.max_teams} slots filled
                  </span>
                  {slotsPercentage >= 80 && !isFull && (
                    <span className="text-orange-400 font-medium">Filling up fast!</span>
                  )}
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      isFull ? "bg-red-500" : slotsPercentage >= 80 ? "bg-orange-500" : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(slotsPercentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Registration Action */}
            <div className="bg-white/10 backdrop-blur rounded-2xl p-5 min-w-[280px]">
              {isAlreadyRegistered ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">✓</span>
                  </div>
                  <p className="text-white font-semibold mb-2">You&apos;re Registered!</p>
                  <p className="text-gray-400 text-sm mb-4">
                    Check your registrations for room details
                  </p>
                  <Link
                    href="/app/registrations"
                    className="block w-full py-2.5 bg-white/10 text-white font-medium rounded-lg hover:bg-white/20 transition text-center"
                  >
                    View My Registrations
                  </Link>
                </div>
              ) : canRegister ? (
                <div>
                  <button
                    onClick={handleRegister}
                    disabled={registering}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-xl hover:opacity-90 transition disabled:opacity-50"
                  >
                    {registering ? "Registering..." : "Register Now"}
                  </button>
                  <p className="text-gray-400 text-xs text-center mt-3">
                    {tournament.entry_fee === 0 
                      ? "This is a free tournament" 
                      : `Entry fee: ₹${tournament.entry_fee}`
                    }
                  </p>
                </div>
              ) : isFull ? (
                <div className="text-center">
                  <p className="text-red-400 font-semibold mb-2">Tournament Full</p>
                  <p className="text-gray-400 text-sm">
                    This tournament has reached maximum capacity
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-400 font-medium">
                    Registration is {tournament.status === "upcoming" ? "not yet open" : "closed"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`
          px-4 py-3 rounded-xl
          ${message.type === "success" 
            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800" 
            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
          }
        `}>
          {message.text}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Start Date"
          value={new Date(tournament.tournament_start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          icon={<span className="text-xl">📅</span>}
        />
        <StatCard
          title="Game"
          value={tournament.game_type.toUpperCase()}
          icon={<GameBadge game={tournament.game_type} size="sm" />}
        />
        <StatCard
          title="Type"
          value={tournament.tournament_type.toUpperCase()}
          icon={<span className="text-xl">👥</span>}
        />
        <StatCard
          title="Map"
          value={tournament.map_name || "TBD"}
          icon={<span className="text-xl">🗺️</span>}
        />
      </div>

      {/* Tabs */}
      <TabNav
        tabs={[
          { id: "details", label: "Details", icon: "📋" },
          { id: "rules", label: "Rules", icon: "📜" },
          { id: "schedule", label: "Schedule", icon: "📅" },
          ...(tournament.status === "completed" ? [{ id: "winners", label: "Winners", icon: "🏆" }] : []),
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="underline"
      />

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        {activeTab === "details" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                About this Tournament
              </h3>
              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {tournament.description || "No description provided."}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Tournament Details</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>🎮 Game: {tournament.game_type.toUpperCase()}</li>
                  <li>👥 Type: {tournament.tournament_type.toUpperCase()}</li>
                  <li>🗺️ Map: {tournament.map_name || "TBD"}</li>
                  <li>💰 Entry Fee: {tournament.entry_fee === 0 ? "Free" : `₹${tournament.entry_fee}`}</li>
                  <li>🏆 Prize Pool: ₹{tournament.prize_pool.toLocaleString()}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Host Information</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>👤 Organized by: {tournament.host_name}</li>
                  <li>📊 Slots: {tournament.current_teams || 0} / {tournament.max_teams}</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === "rules" && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Match Rules
            </h3>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {tournament.match_rules || "Standard game rules apply. Please follow all game guidelines and community standards."}
              </p>
            </div>
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Tournament Schedule
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span>📝</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Registration Opens</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(tournament.registration_start_date)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span>⏰</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Registration Closes</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(tournament.registration_end_date)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span>🎮</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Tournament Starts</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(tournament.tournament_start_date)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "winners" && tournament.status === "completed" && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Tournament Winners
            </h3>
            {winnersLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : winners ? (
              <div className="space-y-3">
                {winners.first && (
                  <div className="flex items-center gap-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                    <span className="text-3xl">🥇</span>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{winners.first}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">1st Place</p>
                    </div>
                  </div>
                )}
                {winners.second && (
                  <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl">
                    <span className="text-3xl">🥈</span>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{winners.second}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">2nd Place</p>
                    </div>
                  </div>
                )}
                {winners.third && (
                  <div className="flex items-center gap-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
                    <span className="text-3xl">🥉</span>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{winners.third}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">3rd Place</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">Winners have not been announced yet.</p>
            )}
          </div>
        )}
      </div>

      {/* Chat Modal */}
      {chatOpen && chatParticipants && currentUserId && tournament && (
        <ChatProvider>
          <TournamentChatRoom
            tournamentId={tournament.id}
            tournamentName={tournament.tournament_name}
            currentUserId={currentUserId}
            registeredUserIds={chatParticipants.registeredUserIds}
            tournamentEndTime={chatParticipants.tournamentEndDate}
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
          />
        </ChatProvider>
      )}
    </div>
  );
}
