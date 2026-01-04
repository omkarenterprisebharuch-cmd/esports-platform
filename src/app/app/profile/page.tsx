"use client";

import { useEffect, useState } from "react";
import { secureFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/app/PageHeader";
import { TabNav } from "@/components/app/TabNav";
import { FormField } from "@/components/app/FormComponents";
import { StatCard } from "@/components/app/StatCard";

interface User {
  id: number;
  username: string;
  email: string;
  phone_number?: string;
  in_game_ids?: Record<string, string>;
  is_host: boolean;
  avatar_url?: string;
  wallet_balance: number;
  created_at: string;
}

const GAME_TYPES = [
  { key: "freefire", label: "Free Fire", icon: "🔥" },
  { key: "pubg", label: "PUBG", icon: "🎯" },
  { key: "valorant", label: "Valorant", icon: "⚔️" },
  { key: "codm", label: "COD Mobile", icon: "🔫" },
];

/**
 * Profile Page
 * 
 * Features:
 * - View and edit profile information
 * - Manage game IDs
 * - Account settings
 */
export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
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

  const updateGameId = (game: string, value: string) => {
    setForm(prev => ({
      ...prev,
      in_game_ids: { ...prev.in_game_ids, [game]: value },
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Profile Settings"
        subtitle="Manage your account and gaming profiles"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          title="Member Since"
          value={user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "N/A"}
          icon={<span className="text-xl">📅</span>}
        />
        <StatCard
          title="Wallet Balance"
          value={`₹${user?.wallet_balance?.toLocaleString() || 0}`}
          icon={<span className="text-xl">💰</span>}
          href="/app/wallet"
        />
      </div>

      {/* Tabs */}
      <TabNav
        tabs={[
          { id: "profile", label: "Profile", icon: "👤" },
          { id: "game-ids", label: "Game IDs", icon: "🎮" },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="underline"
      />

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

      <form onSubmit={handleSubmit}>
        {activeTab === "profile" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
            <FormField
              label="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="Your display name"
            />

            <FormField
              label="Email"
              value={user?.email || ""}
              disabled
              hint="Email cannot be changed"
            />

            <FormField
              label="Phone Number"
              type="tel"
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              placeholder="+91 XXXXXXXXXX"
              hint="Used for important tournament notifications"
            />
          </div>
        )}

        {activeTab === "game-ids" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Add your in-game IDs to auto-fill during tournament registration.
            </p>
            <div className="space-y-5">
              {GAME_TYPES.map((game) => (
                <div key={game.key} className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">{game.icon}</span>
                  </div>
                  <div className="flex-1">
                    <FormField
                      label={game.label}
                      value={form.in_game_ids[game.key] || ""}
                      onChange={(e) => updateGameId(game.key, e.target.value)}
                      placeholder={`Enter your ${game.label} ID`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-6">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
