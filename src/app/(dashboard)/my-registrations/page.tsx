"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export default function MyRegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCredentials, setShowCredentials] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const token = localStorage.getItem("token");

    fetch("/api/registrations/my-registrations", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setRegistrations(data.data.registrations || []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  const getGameEmoji = (gameType: string) => {
    const emojis: Record<string, string> = {
      freefire: "🔥",
      pubg: "🎯",
      valorant: "⚔️",
      codm: "🔫",
    };
    return emojis[gameType] || "🎮";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        My Registrations
      </h1>

      {registrations.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-5xl mb-4">🎮</p>
          <p className="text-gray-500 mb-2">No tournament registrations yet</p>
          <p className="text-sm text-gray-400 mb-4">
            Browse tournaments and register to participate
          </p>
          <Link
            href="/tournaments"
            className="inline-block px-6 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition"
          >
            Browse Tournaments
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {registrations.map((reg) => (
            <div
              key={reg.registration_id}
              className="bg-white border border-gray-200 rounded-xl p-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">
                    {getGameEmoji(reg.game_type)}
                  </div>
                  <div>
                    <Link
                      href={`/tournament/${reg.tournament_id}`}
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      {reg.tournament_name}
                    </Link>
                    <p className="text-sm text-gray-500">
                      Slot #{reg.slot_number} • {reg.tournament_type.toUpperCase()}
                      {reg.team_name && ` • ${reg.team_name}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      📅 {formatDate(reg.tournament_start_date)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${getStatusStyle(reg.status)}`}
                  >
                    {reg.status.replace("_", " ")}
                  </span>

                  {/* Room Credentials (visible after registration ends) */}
                  {(reg.status === "ongoing" || reg.status === "completed" || reg.room_id) && (
                    <div className="text-right">
                      {!showCredentials[reg.registration_id] ? (
                        <button
                          onClick={() => setShowCredentials(prev => ({ ...prev, [reg.registration_id]: true }))}
                          className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition"
                        >
                          🔑 View ID/Password
                        </button>
                      ) : (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-left">
                          {reg.room_id ? (
                            <>
                              <p className="font-medium text-green-700">
                                Room ID: {reg.room_id}
                              </p>
                              {reg.room_password && (
                                <p className="text-green-600">
                                  Password: {reg.room_password}
                                </p>
                              )}
                              <button
                                onClick={() => setShowCredentials(prev => ({ ...prev, [reg.registration_id]: false }))}
                                className="text-xs text-gray-500 mt-2 underline"
                              >
                                Hide
                              </button>
                            </>
                          ) : (
                            <p className="text-amber-600">
                              ⏳ ID/Password will be available soon
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
