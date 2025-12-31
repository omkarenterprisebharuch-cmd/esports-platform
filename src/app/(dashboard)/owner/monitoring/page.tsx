"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

interface SystemHealth {
  status: "healthy" | "degraded" | "critical";
  score: number;
  issues: string[];
}

interface MonitoringData {
  timestamp: string;
  cached?: boolean;
  health: SystemHealth;
  database: {
    pool: {
      total: number;
      active: number;
      idle: number;
      waiting: number;
      utilizationPercent: number;
    };
    performance: {
      avgQueryTimeMs: number;
      slowQueries: number;
      connections24h: number;
    };
    storage: {
      databaseSizeMB: number;
      largestTables: Array<{ table: string; sizeMB: number; rows: number }>;
    };
  };
  cache: {
    connected: boolean;
    memoryUsedMB: number;
    memoryMaxMB: number;
    utilizationPercent: number;
    hitRate: number;
    keys: number;
  };
  serverless: {
    instanceAge: number;
    requestCount: number;
    coldStarts: {
      total: number;
      avgDurationMs: number;
      last24h: number;
    };
  };
  email: {
    pending: number;
    failed: number;
    sent24h: number;
    rateLimitStatus: string;
  };
  storage: {
    mediaCount: number;
    mediaSizeEstimateMB: number;
  };
  platform: {
    users: {
      total: number;
      active24h: number;
      newThisWeek: number;
    };
    tournaments: {
      total: number;
      active: number;
      completedThisWeek: number;
    };
    registrations24h: number;
  };
  cleanup: {
    pendingItems: number;
    lastRunAt: string | null;
    archivedTournaments: number;
  };
}

const healthColors = {
  healthy: "text-green-500",
  degraded: "text-yellow-500",
  critical: "text-red-500",
};

const healthBgColors = {
  healthy: "bg-green-500/10 border-green-500/30",
  degraded: "bg-yellow-500/10 border-yellow-500/30",
  critical: "bg-red-500/10 border-red-500/30",
};

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatTimeAgo(isoDate: string | null): string {
  if (!isoDate) return "Never";
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function ProgressBar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
      <div 
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon,
  trend,
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: string;
  trend?: { value: number; label: string };
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        {trend && (
          <span className={`text-xs ${trend.value >= 0 ? "text-green-400" : "text-red-400"}`}>
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)} {trend.label}
          </span>
        )}
      </div>
      <div className="mt-2">
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-sm text-gray-400">{title}</div>
        {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
      </div>
    </div>
  );
}

function MetricSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function MonitoringDashboard() {
  const router = useRouter();
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async (fresh = false) => {
    try {
      setLoading(true);
      const response = await api<MonitoringData>(`/api/owner/monitoring${fresh ? "?fresh=true" : ""}`);
      if (response.success && response.data) {
        setData(response.data);
        setLastRefresh(new Date());
        setError(null);
      } else {
        if (response.message?.includes("unauthorized") || response.message?.includes("Owner")) {
          router.push("/dashboard");
          return;
        }
        setError(response.message || "Failed to fetch monitoring data");
      }
    } catch (err) {
      setError("Failed to connect to monitoring API");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg">{error}</p>
          <button 
            onClick={() => fetchData()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">📊 System Monitoring</h1>
          <p className="text-gray-400 text-sm">
            Real-time platform health and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <span className="text-xs text-gray-500">
            {lastRefresh && `Updated ${formatTimeAgo(lastRefresh.toISOString())}`}
            {data.cached && " (cached)"}
          </span>
        </div>
      </div>

      {/* Health Status Banner */}
      <div className={`rounded-lg p-4 border mb-6 ${healthBgColors[data.health.status]}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">
              {data.health.status === "healthy" ? "✅" : data.health.status === "degraded" ? "⚠️" : "🚨"}
            </span>
            <div>
              <h2 className={`text-xl font-bold ${healthColors[data.health.status]}`}>
                System {data.health.status.charAt(0).toUpperCase() + data.health.status.slice(1)}
              </h2>
              <p className="text-sm text-gray-300">Health Score: {data.health.score}/100</p>
            </div>
          </div>
          {data.health.issues.length > 0 && (
            <div className="text-sm">
              <p className="text-gray-300 font-medium">Active Issues:</p>
              <ul className="text-gray-400 list-disc list-inside">
                {data.health.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon="👥"
          title="Total Users"
          value={data.platform.users.total.toLocaleString()}
          subtitle={`${data.platform.users.active24h} active today`}
          trend={{ value: data.platform.users.newThisWeek, label: "this week" }}
        />
        <StatCard
          icon="🏆"
          title="Tournaments"
          value={data.platform.tournaments.total.toLocaleString()}
          subtitle={`${data.platform.tournaments.active} active`}
          trend={{ value: data.platform.tournaments.completedThisWeek, label: "completed" }}
        />
        <StatCard
          icon="📝"
          title="Registrations (24h)"
          value={data.platform.registrations24h.toLocaleString()}
        />
        <StatCard
          icon="🗄️"
          title="Database Size"
          value={formatBytes(data.database.storage.databaseSizeMB)}
          subtitle={`${data.cleanup.archivedTournaments} archived`}
        />
      </div>

      {/* Detailed Metrics Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Database */}
        <MetricSection title="🗃️ Database">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Connection Pool</span>
                <span className="text-white">{data.database.pool.active}/{data.database.pool.total}</span>
              </div>
              <ProgressBar 
                value={data.database.pool.active} 
                max={data.database.pool.total}
                color={data.database.pool.utilizationPercent > 80 ? "bg-red-500" : "bg-blue-500"}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{data.database.pool.idle} idle</span>
                <span>{data.database.pool.waiting} waiting</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-gray-400 text-xs">Avg Query Time</div>
                <div className="text-white font-medium">{data.database.performance.avgQueryTimeMs.toFixed(1)}ms</div>
              </div>
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-gray-400 text-xs">Slow Queries</div>
                <div className={`font-medium ${data.database.performance.slowQueries > 0 ? "text-yellow-400" : "text-white"}`}>
                  {data.database.performance.slowQueries}
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400 mb-2">Largest Tables</div>
              {data.database.storage.largestTables.slice(0, 3).map((table) => (
                <div key={table.table} className="flex justify-between text-xs py-1 border-b border-gray-700">
                  <span className="text-gray-300 font-mono">{table.table}</span>
                  <span className="text-gray-400">{table.rows.toLocaleString()} rows • {table.sizeMB}MB</span>
                </div>
              ))}
            </div>
          </div>
        </MetricSection>

        {/* Cache */}
        <MetricSection title="🔴 Redis Cache">
          {data.cache.connected ? (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Memory Usage</span>
                  <span className="text-white">
                    {data.cache.memoryUsedMB}MB / {data.cache.memoryMaxMB || "∞"}MB
                  </span>
                </div>
                <ProgressBar 
                  value={data.cache.memoryUsedMB} 
                  max={data.cache.memoryMaxMB || data.cache.memoryUsedMB * 2}
                  color={data.cache.utilizationPercent > 90 ? "bg-red-500" : "bg-green-500"}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-700/50 rounded p-2">
                  <div className="text-gray-400 text-xs">Hit Rate</div>
                  <div className={`font-medium ${data.cache.hitRate > 80 ? "text-green-400" : "text-yellow-400"}`}>
                    {data.cache.hitRate}%
                  </div>
                </div>
                <div className="bg-gray-700/50 rounded p-2">
                  <div className="text-gray-400 text-xs">Cached Keys</div>
                  <div className="text-white font-medium">{data.cache.keys.toLocaleString()}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <span className="text-4xl">⚠️</span>
              <p className="text-yellow-400 mt-2">Redis Not Connected</p>
              <p className="text-gray-500 text-sm">Caching disabled, using direct DB queries</p>
            </div>
          )}
        </MetricSection>

        {/* Serverless */}
        <MetricSection title="☁️ Serverless">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-gray-400 text-xs">Instance Uptime</div>
                <div className="text-white font-medium">{formatUptime(data.serverless.instanceAge)}</div>
              </div>
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-gray-400 text-xs">Requests</div>
                <div className="text-white font-medium">{data.serverless.requestCount}</div>
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-400 mb-2">Cold Starts</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-700/50 rounded p-2">
                  <div className="text-xl font-bold text-white">{data.serverless.coldStarts.total}</div>
                  <div className="text-xs text-gray-400">Total</div>
                </div>
                <div className="bg-gray-700/50 rounded p-2">
                  <div className="text-xl font-bold text-white">{data.serverless.coldStarts.last24h}</div>
                  <div className="text-xs text-gray-400">Last 24h</div>
                </div>
                <div className="bg-gray-700/50 rounded p-2">
                  <div className={`text-xl font-bold ${data.serverless.coldStarts.avgDurationMs > 2000 ? "text-yellow-400" : "text-white"}`}>
                    {formatDuration(data.serverless.coldStarts.avgDurationMs)}
                  </div>
                  <div className="text-xs text-gray-400">Avg Duration</div>
                </div>
              </div>
            </div>
          </div>
        </MetricSection>

        {/* Email */}
        <MetricSection title="📧 Email Queue">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-xl font-bold text-white">{data.email.pending}</div>
                <div className="text-xs text-gray-400">Pending</div>
              </div>
              <div className="bg-gray-700/50 rounded p-2">
                <div className={`text-xl font-bold ${data.email.failed > 0 ? "text-red-400" : "text-white"}`}>
                  {data.email.failed}
                </div>
                <div className="text-xs text-gray-400">Failed</div>
              </div>
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-xl font-bold text-green-400">{data.email.sent24h}</div>
                <div className="text-xs text-gray-400">Sent (24h)</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${data.email.rateLimitStatus === "ok" ? "bg-green-500" : "bg-yellow-500"}`}></span>
              <span className="text-gray-400">
                Rate Limit: {data.email.rateLimitStatus === "ok" ? "Normal" : "Throttled"}
              </span>
            </div>
          </div>
        </MetricSection>

        {/* Storage */}
        <MetricSection title="📁 Media Storage">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-xl font-bold text-white">{data.storage.mediaCount.toLocaleString()}</div>
                <div className="text-xs text-gray-400">Total Files</div>
              </div>
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-xl font-bold text-white">{formatBytes(data.storage.mediaSizeEstimateMB)}</div>
                <div className="text-xs text-gray-400">Est. Size</div>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Stored in Cloudinary. Size is estimated based on average file sizes.
            </p>
          </div>
        </MetricSection>

        {/* Cleanup */}
        <MetricSection title="🧹 Cleanup Status">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-gray-700/50 rounded p-2">
                <div className={`text-xl font-bold ${data.cleanup.pendingItems > 100 ? "text-yellow-400" : "text-white"}`}>
                  {data.cleanup.pendingItems.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">Pending Items</div>
              </div>
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-xl font-bold text-white">{data.cleanup.archivedTournaments}</div>
                <div className="text-xs text-gray-400">Archived</div>
              </div>
            </div>
            
            <div className="text-sm">
              <span className="text-gray-400">Last Cleanup: </span>
              <span className="text-white">{formatTimeAgo(data.cleanup.lastRunAt)}</span>
            </div>
          </div>
        </MetricSection>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-500">
        <p>Data collected at {new Date(data.timestamp).toLocaleString()}</p>
        <p className="mt-1">
          Quick links: 
          <a href="/api/owner/db-stats" target="_blank" className="text-blue-400 hover:underline ml-2">DB Stats</a>
          <a href="/api/owner/cache-stats" target="_blank" className="text-blue-400 hover:underline ml-2">Cache Stats</a>
          <a href="/api/owner/serverless-stats" target="_blank" className="text-blue-400 hover:underline ml-2">Serverless Stats</a>
          <a href="/api/owner/cleanup" target="_blank" className="text-blue-400 hover:underline ml-2">Cleanup Stats</a>
        </p>
      </div>
    </div>
  );
}
