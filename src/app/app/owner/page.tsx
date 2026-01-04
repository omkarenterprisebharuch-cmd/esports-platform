"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { secureFetch } from "@/lib/api-client";
import { UserRole } from "@/types";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { TabNav } from "@/components/app/TabNav";
import { RoleBadge } from "@/components/app/Badges";

interface User {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_host: boolean;
  is_verified: boolean;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  last_login_at: string | null;
}

interface Stats {
  users: {
    total: number;
    newThisWeek: number;
    activeToday: number;
  };
  tournaments: {
    total: number;
    upcoming: number;
    registrationOpen: number;
    ongoing: number;
    completed: number;
    newThisWeek: number;
  };
  registrations: {
    total: number;
    newThisWeek: number;
  };
  teams: {
    total: number;
    newThisWeek?: number;
  };
  recentUsers: User[];
  roleDistribution: { role: string; count: string }[];
}

interface Pagination {
  page: number;
  limit: number;
  totalUsers: number;
  totalPages: number;
}

/**
 * Owner Portal - Platform Management
 * 
 * Features:
 * - Platform statistics dashboard
 * - User management (search, filter, role assignment)
 * - Role distribution
 * - Recent signups
 * - Links to ads, deposits, monitoring
 */
export default function OwnerPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ role: UserRole; username: string } | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    totalUsers: 0,
    totalPages: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Auth check
  useEffect(() => {
    secureFetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.role === "owner") {
          setCurrentUser({ role: data.data.role, username: data.data.username });
        } else {
          router.push("/app");
        }
      })
      .catch(() => router.push("/app"))
      .finally(() => setLoading(false));
  }, [router]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await secureFetch("/api/owner/stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async (page = 1, search = "", role = "") => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (role) params.set("role", role);

      const res = await secureFetch(`/api/owner/users?${params}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchStats();
    }
  }, [currentUser, fetchStats]);

  useEffect(() => {
    if (activeTab === "users" && currentUser) {
      fetchUsers(1, searchQuery, roleFilter);
    }
  }, [activeTab, currentUser, fetchUsers, searchQuery, roleFilter]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingRole(userId);
    setMessage(null);

    try {
      const res = await secureFetch("/api/owner/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: "success", text: data.data.message });
        setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
        fetchStats();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to update role" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to update role" });
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleSearch = () => {
    fetchUsers(1, searchQuery, roleFilter);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="👑 Owner Portal"
        subtitle="Platform Management"
        badge={
          <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-semibold rounded-full">
            Owner
          </span>
        }
        actions={
          <div className="flex gap-3">
            <Link
              href="/app/owner/ads"
              className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              📢 Ads
            </Link>
            <Link
              href="/app/owner/deposits"
              className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              💰 Deposits
            </Link>
            <Link
              href="/app/owner/monitoring"
              className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              🔍 Monitoring
            </Link>
          </div>
        }
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

      {/* Tabs */}
      <TabNav
        tabs={[
          { id: "dashboard", label: "📊 Dashboard" },
          { id: "users", label: "👥 Users" },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="pills"
      />

      {/* Dashboard Tab */}
      {activeTab === "dashboard" && stats && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Users"
              value={stats.users.total}
              icon={<span className="text-xl">👥</span>}
              trend={{ value: stats.users.newThisWeek, label: "this week", isPositive: true }}
              variant="gradient"
            />
            <StatCard
              title="Tournaments"
              value={stats.tournaments.total}
              icon={<span className="text-xl">🏆</span>}
              trend={{ value: stats.tournaments.registrationOpen, label: "open" }}
              variant="gradient"
            />
            <StatCard
              title="Registrations"
              value={stats.registrations.total}
              icon={<span className="text-xl">📝</span>}
              trend={{ value: stats.registrations.newThisWeek, label: "this week", isPositive: true }}
              variant="gradient"
            />
            <StatCard
              title="Teams"
              value={stats.teams.total}
              icon={<span className="text-xl">👥</span>}
              variant="gradient"
            />
          </div>

          {/* Tournament Status */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Tournament Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Upcoming</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {stats.tournaments.upcoming}
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Registration Open</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.tournaments.registrationOpen}
                </p>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Ongoing</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {stats.tournaments.ongoing}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
                <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">
                  {stats.tournaments.completed}
                </p>
              </div>
            </div>
          </div>

          {/* Role Distribution & Recent Users */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Role Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Role Distribution</h2>
              <div className="space-y-3">
                {stats.roleDistribution.map((item) => (
                  <div key={item.role} className="flex items-center justify-between">
                    <RoleBadge role={item.role as UserRole} />
                    <span className="font-semibold text-gray-900 dark:text-white">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Signups */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Signups</h2>
              <div className="space-y-3">
                {stats.recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          user.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                    </div>
                    <RoleBadge role={user.role} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Users */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Active Users Today</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                {stats.users.activeToday}
              </span>
              <span className="text-lg text-gray-500 dark:text-gray-400">
                / {stats.users.total} total
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="space-y-6">
          {/* Search & Filter */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search by username or email..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
              >
                <option value="">All Roles</option>
                <option value="player">Player</option>
                <option value="organizer">Organizer</option>
                <option value="owner">Owner</option>
              </select>
              <button
                onClick={handleSearch}
                className="px-6 py-2.5 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition"
              >
                Search
              </button>
            </div>
          </div>

          {/* Users Table */}
          {usersLoading ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <span className="text-4xl mb-4 block">👥</span>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No users found</h3>
              <p className="text-gray-500 dark:text-gray-400">Try adjusting your search filters</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">User</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Email</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Role</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Joined</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                              ) : (
                                user.username.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">{user.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{user.email}</td>
                        <td className="px-6 py-4"><RoleBadge role={user.role} /></td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            user.is_active 
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" 
                              : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                          }`}>
                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(user.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                            disabled={updatingRole === user.id}
                            className={`px-3 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-purple-500 ${
                              updatingRole === user.id ? "opacity-50" : ""
                            }`}
                          >
                            <option value="player">Player</option>
                            <option value="organizer">Organizer</option>
                            <option value="owner">Owner</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.totalUsers)} of{" "}
                {pagination.totalUsers} users
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchUsers(pagination.page - 1, searchQuery, roleFilter)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-gray-500 dark:text-gray-400">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchUsers(pagination.page + 1, searchQuery, roleFilter)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
