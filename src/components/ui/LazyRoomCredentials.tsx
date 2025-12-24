"use client";

import { useState } from "react";
import { useLazyReveal } from "@/hooks/useOnDemandFetch";

interface RoomCredentials {
  room_id: string | null;
  room_password: string | null;
  message?: string;
}

interface LazyRoomCredentialsProps {
  tournamentId: number | string;
  isRegistered: boolean;
}

/**
 * Room credentials are only fetched when user clicks "Show Credentials"
 * This saves an API call for users who just want to view tournament info
 */
export function LazyRoomCredentials({ tournamentId, isRegistered }: LazyRoomCredentialsProps) {
  const { data, loading, error, revealed, reveal, hide } = useLazyReveal<RoomCredentials>(
    `/api/registrations/room-credentials/${tournamentId}`
  );

  if (!isRegistered) return null;

  // Not revealed yet - show button to fetch
  if (!revealed) {
    return (
      <button
        onClick={reveal}
        disabled={loading}
        className="mt-4 w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full" />
            Loading...
          </>
        ) : (
          <>
            🔐 Show Room ID & Password
          </>
        )}
      </button>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-amber-700 text-sm">{error}</p>
      </div>
    );
  }

  // Data revealed
  if (data && data.room_id) {
    return (
      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-green-700">🎮 Room Credentials</p>
          <button
            onClick={hide}
            className="text-green-600 text-sm hover:underline"
          >
            Hide
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-green-100 rounded px-3 py-2">
            <span className="text-green-700 font-medium">Room ID:</span>
            <span className="text-green-800 font-mono text-lg">{data.room_id}</span>
          </div>
          {data.room_password && (
            <div className="flex items-center justify-between bg-green-100 rounded px-3 py-2">
              <span className="text-green-700 font-medium">Password:</span>
              <span className="text-green-800 font-mono text-lg">{data.room_password}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Room credentials not set yet
  if (data?.message) {
    return (
      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-amber-700 text-sm">{data.message}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <p className="text-gray-600 text-sm">Room credentials not available yet. Check back later.</p>
    </div>
  );
}
