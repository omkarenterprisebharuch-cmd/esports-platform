"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { secureFetch } from "@/lib/api-client";
import { useRegistrationCache } from "@/hooks";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { GameBadge, StatusBadge } from "@/components/app/Badges";
import { TabNav } from "@/components/app/TabNav";

interface Registration {
  registration_id: number;
  slot_number: number;
  registration_type: string;
  registration_status: string;
  tournament_id: number;
  tournament_name: string;
  game_type: string;
  tournament_type: string;
  prize_pool: number;
  entry_fee: number;
  tournament_start_date: string;
  room_id?: string;
  room_password?: string;
  status: string;
  team_name?: string;
  host_name: string;
}

/**
 * My Registrations Page
 * 
 * Features:
 * - View all registrations
 * - Filter by status (upcoming, ongoing, completed)
 * - View room credentials for active tournaments
 * - Quick access to tournament details
 */
export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [showCredentials, setShowCredentials] = useState<Record<number, boolean>>({});
  const { syncFromData } = useRegistrationCache();

  // Fetch registrations
  const fetchRegistrations = useCallback(async () => {
    try {
      const res = await secureFetch("/api/registrations/my-registrations");
      const data = await res.json();
      if (data.success) {
        const regs = data.data.registrations || [];
        setRegistrations(regs);
        // Sync registration cache
        syncFromData(regs.map((r: Registration) => r.tournament_id));
      }
    } catch (error) {
      console.error("Failed to fetch registrations:", error);
    } finally {
      setLoading(false);
    }
  }, [syncFromData]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  // Filter registrations
  const filteredRegistrations = registrations.filter((reg) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "upcoming") return reg.status === "upcoming" || reg.status === "registration_open";
    if (activeFilter === "ongoing") return reg.status === "ongoing";
    if (activeFilter === "completed") return reg.status === "completed";
    return true;
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleCredentials = (regId: number) => {
    setShowCredentials(prev => ({
      ...prev,
      [regId]: !prev[regId],
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Registrations"
        subtitle={`${registrations.length} tournament${registrations.length !== 1 ? "s" : ""}`}
      />

      {/* Filter Tabs */}
      <TabNav
        tabs={[
          { id: "all", label: "All", badge: registrations.length },
          { id: "upcoming", label: "Upcoming", badge: registrations.filter(r => r.status === "upcoming" || r.status === "registration_open").length || undefined },
          { id: "ongoing", label: "Live", badge: registrations.filter(r => r.status === "ongoing").length || undefined },
          { id: "completed", label: "Completed", badge: registrations.filter(r => r.status === "completed").length || undefined },
        ]}
        activeTab={activeFilter}
        onChange={setActiveFilter}
        variant="pills"
      />

      {/* Registrations List */}
      {filteredRegistrations.length === 0 ? (
        <EmptyState
          icon={activeFilter === "all" ? "🎮" : "📋"}
          title={activeFilter === "all" ? "No registrations yet" : `No ${activeFilter} tournaments`}
          description={activeFilter === "all" 
            ? "Browse tournaments and register to participate" 
            : `You don't have any ${activeFilter} tournament registrations`
          }
          action={activeFilter === "all" ? { label: "Browse Tournaments", href: "/app/tournaments" } : undefined}
          variant="card"
        />
      ) : (
        <div className="space-y-4">
          {filteredRegistrations.map((reg) => (
            <div
              key={reg.registration_id}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left - Tournament Info */}
                  <div className="flex items-start gap-4">
                    <GameBadge game={reg.game_type} size="lg" />
                    <div>
                      <Link
                        href={`/app/tournament/${reg.tournament_id}`}
                        className="font-bold text-lg text-gray-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 transition"
                      >
                        {reg.tournament_name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>Slot #{reg.slot_number}</span>
                        <span>•</span>
                        <span>{reg.tournament_type.toUpperCase()}</span>
                        {reg.team_name && (
                          <>
                            <span>•</span>
                            <span>{reg.team_name}</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        📅 {formatDate(reg.tournament_start_date)}
                      </p>
                    </div>
                  </div>

                  {/* Right - Status & Prize */}
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={reg.status} />
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      ₹{reg.prize_pool.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Room Credentials (for ongoing/completed tournaments) */}
                {(reg.status === "ongoing" || reg.status === "completed" || reg.room_id) && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    {!showCredentials[reg.registration_id] ? (
                      <button
                        onClick={() => toggleCredentials(reg.registration_id)}
                        className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline"
                      >
                        🔐 Show Room Credentials
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            Room Credentials
                          </span>
                          <button
                            onClick={() => toggleCredentials(reg.registration_id)}
                            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                          >
                            Hide
                          </button>
                        </div>
                        {reg.room_id ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Room ID</p>
                              <p className="font-mono font-semibold text-gray-900 dark:text-white">
                                {reg.room_id}
                              </p>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Password</p>
                              <p className="font-mono font-semibold text-gray-900 dark:text-white">
                                {reg.room_password || "N/A"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Room credentials will be shared by the host before the match starts.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Hosted by {reg.host_name}
                  </span>
                  <Link
                    href={`/app/tournament/${reg.tournament_id}`}
                    className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline"
                  >
                    View Tournament →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
