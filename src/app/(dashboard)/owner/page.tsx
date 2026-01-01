"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { secureFetch } from "@/lib/api-client";
import { UserRole } from "@/types";

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

export default function OwnerPortal() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ role: UserRole; username: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "users">("dashboard");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  
  // Users tab state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, totalUsers: 0, totalPages: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check if user is owner
  useEffect(() => {
    secureFetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.role === "owner") {
          setCurrentUser({ role: data.data.role, username: data.data.username });
        } else {
          router.push("/dashboard");
        }
      })
      .catch(() => router.push("/dashboard"))
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
        // Update user in list
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        // Refresh stats
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
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case "owner": return "bg-purple-100 text-purple-700";
      case "organizer": return "bg-blue-100 text-blue-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-2xl">👑</span>
            <div>
              <h1 className="text-xl font-bold text-white">Owner Portal</h1>
              <p className="text-sm text-gray-400">Platform Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400">Welcome, {currentUser.username}</span>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1">
            {[
              { id: "dashboard" as const, label: "📊 Dashboard", icon: "📊" },
              { id: "users" as const, label: "👥 User Management", icon: "👥" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "text-purple-400 border-b-2 border-purple-400"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
            {/* Ads Management - External Link */}
            <button
              onClick={() => router.push("/owner/ads")}
              className="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition"
            >
              📢 Ads Management
            </button>
            {/* Deposits - External Link */}
            <button
              onClick={() => router.push("/owner/deposits")}
              className="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition"
            >
              💰 Deposits
            </button>
            {/* Monitoring - External Link */}
            <button
              onClick={() => router.push("/owner/monitoring")}
              className="px-4 py-3 text-sm font-medium text-gray-400 hover:text-white transition"
            >
              🔍 Monitoring
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
          }`}>
            {message.text}
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && stats && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Users"
                value={stats.users.total}
                subtext={`+${stats.users.newThisWeek} this week`}
                icon="👥"
                color="purple"
              />
              <StatCard
                title="Tournaments"
                value={stats.tournaments.total}
                subtext={`${stats.tournaments.registrationOpen} open for registration`}
                icon="🏆"
                color="blue"
              />
              <StatCard
                title="Registrations"
                value={stats.registrations.total}
                subtext={`+${stats.registrations.newThisWeek} this week`}
                icon="📝"
                color="green"
              />
              <StatCard
                title="Teams"
                value={stats.teams.total}
                subtext={stats.teams.newThisWeek !== undefined ? `+${stats.teams.newThisWeek} this week` : ""}
                icon="👥"
                color="yellow"
              />
            </div>

            {/* Tournament Status */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-4">Tournament Status</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Upcoming</p>
                  <p className="text-2xl font-bold text-indigo-400">{stats.tournaments.upcoming}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Registration Open</p>
                  <p className="text-2xl font-bold text-green-400">{stats.tournaments.registrationOpen}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Ongoing</p>
                  <p className="text-2xl font-bold text-yellow-400">{stats.tournaments.ongoing}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Completed</p>
                  <p className="text-2xl font-bold text-gray-400">{stats.tournaments.completed}</p>
                </div>
              </div>
            </div>

            {/* Role Distribution & Recent Users */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Role Distribution */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h2 className="text-lg font-semibold text-white mb-4">Role Distribution</h2>
                <div className="space-y-3">
                  {stats.roleDistribution.map((item) => (
                    <div key={item.role} className="flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(item.role as UserRole)}`}>
                        {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
                      </span>
                      <span className="text-white font-semibold">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Users */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h2 className="text-lg font-semibold text-white mb-4">Recent Signups</h2>
                <div className="space-y-3">
                  {stats.recentUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white text-sm">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            user.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{user.username}</p>
                          <p className="text-gray-500 text-xs">{user.email}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Active Users */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-2">Active Users</h2>
              <p className="text-gray-400 mb-4">Users who logged in today</p>
              <div className="text-4xl font-bold text-purple-400">
                {stats.users.activeToday}
                <span className="text-lg text-gray-500 ml-2">/ {stats.users.total}</span>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {/* Search & Filter */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search by username or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
                  className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">All Roles</option>
                  <option value="player">Player</option>
                  <option value="organizer">Organizer</option>
                  <option value="owner">Owner</option>
                </select>
                <button
                  onClick={handleSearch}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              {usersLoading ? (
                <div className="p-8 text-center text-gray-400">Loading users...</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-700/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Joined</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Last Login</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {users.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-700/30">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white text-sm">
                                  {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                                  ) : (
                                    user.username.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <span className="text-white font-medium">{user.username}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-400">{user.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                user.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                              }`}>
                                {user.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-sm">
                              {formatDate(user.created_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-sm">
                              {formatDate(user.last_login_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <select
                                value={user.role}
                                onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                                disabled={updatingRole === user.id || user.id === currentUser?.username}
                                className={`px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500 ${
                                  updatingRole === user.id ? "opacity-50 cursor-wait" : ""
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

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="px-6 py-4 bg-gray-700/30 flex items-center justify-between">
                      <p className="text-gray-400 text-sm">
                        Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                        {Math.min(pagination.page * pagination.limit, pagination.totalUsers)} of{" "}
                        {pagination.totalUsers} users
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => fetchUsers(pagination.page - 1, searchQuery, roleFilter)}
                          disabled={pagination.page === 1}
                          className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-1 text-gray-400">
                          Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <button
                          onClick={() => fetchUsers(pagination.page + 1, searchQuery, roleFilter)}
                          disabled={pagination.page === pagination.totalPages}
                          className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, subtext, icon, color }: {
  title: string;
  value: number;
  subtext: string;
  icon: string;
  color: "purple" | "blue" | "green" | "yellow";
}) {
  const colorClasses = {
    purple: "from-purple-500/20 to-purple-600/20 border-purple-500/30",
    blue: "from-blue-500/20 to-blue-600/20 border-blue-500/30",
    green: "from-green-500/20 to-green-600/20 border-green-500/30",
    yellow: "from-yellow-500/20 to-yellow-600/20 border-yellow-500/30",
  };

  const valueColorClasses = {
    purple: "text-purple-400",
    blue: "text-blue-400",
    green: "text-green-400",
    yellow: "text-yellow-400",
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-6 border`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-gray-400 text-sm">{title}</p>
      <p className={`text-3xl font-bold ${valueColorClasses[color]} mb-1`}>{value.toLocaleString()}</p>
      <p className="text-gray-500 text-sm">{subtext}</p>
    </div>
  );
}
