"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { secureFetch } from "@/lib/api-client";

interface User {
  id: number;
  username: string;
  email: string;
  phone_number?: string;
  in_game_ids?: Record<string, string>;
  is_host: boolean;
  avatar_url?: string;
  wallet_balance: number;
}

const GAME_TYPES = [
  { key: "freefire", label: "Free Fire", icon: "🔥" },
  { key: "pubg", label: "PUBG", icon: "🎯" },
  { key: "valorant", label: "Valorant", icon: "⚔️" },
  { key: "codm", label: "COD Mobile", icon: "🔫" },
];

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    username: "",
    phone_number: "",
    in_game_ids: {} as Record<string, string>,
  });

  useEffect(() => {
    secureFetch("/api/users/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUser(data.data.user);
          setForm({
            username: data.data.user.username || "",
            phone_number: data.data.user.phone_number || "",
            in_game_ids: data.data.user.in_game_ids || {},
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await secureFetch("/api/users/profile", {
        method: "PUT",
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Profile updated successfully!" });
        setUser(data.data.user);
      } else {
        setMessage({ type: "error", text: data.message || "Failed to update" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile Settings</h1>

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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Basic Information</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                placeholder="+91 XXXXXXXXXX"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Game IDs */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Game IDs</h2>
          <p className="text-sm text-gray-500 mb-4">
            Add your in-game IDs to participate in tournaments
          </p>

          <div className="space-y-4">
            {GAME_TYPES.map((game) => (
              <div key={game.key}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {game.icon} {game.label} ID
                </label>
                <input
                  type="text"
                  value={form.in_game_ids[game.key] || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      in_game_ids: {
                        ...form.in_game_ids,
                        [game.key]: e.target.value,
                      },
                    })
                  }
                  placeholder={`Enter your ${game.label} ID`}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Wallet */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">💰 Wallet Balance</h2>
            <Link
              href="/wallet"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Manage Wallet →
            </Link>
          </div>
          <p className="text-3xl font-bold text-green-600">
            ₹{user?.wallet_balance || 0}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Used for tournament entry fees
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 px-4 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
