"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { LoaderProvider, Loader, NavigationLoader } from "@/components/ui/Loader";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { RegistrationCacheProvider, clearRegistrationCache, useIdleTimeout, clearSessionData } from "@/hooks";
import { api, logout, isAuthenticated } from "@/lib/api-client";
import ThemeToggle from "@/components/ui/ThemeToggle";

// Lazy load notification prompt - not critical for initial render
const NotificationPrompt = dynamic(
  () => import("@/components/notifications/NotificationPrompt"),
  { ssr: false, loading: () => null }
);

// Lazy load notification center
const NotificationCenter = dynamic(
  () => import("@/components/notifications/NotificationCenter"),
  { ssr: false, loading: () => null }
);

interface User {
  id: number;
  username: string;
  email: string;
  is_host: boolean;
  is_admin?: boolean;
  role?: "player" | "organizer" | "owner";
  avatar_url?: string;
}

// Module-level cache for user data - persists across navigations
let cachedUser: User | null = null;
let cachedTeamsCount: number = 0;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const menuItems = [
  { icon: "🏠", label: "Dashboard", href: "/dashboard" },
  { icon: "👤", label: "Profile", href: "/profile" },
  { icon: "🏆", label: "Hall of Fame", href: "/hall-of-fame" },
  { icon: "👥", label: "My Teams", href: "/my-teams" },
  { icon: "👥", label: "My Registrations", href: "/my-registrations" },
  { icon: "💰", label: "Wallet", href: "/wallet", disabled: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teamsCount, setTeamsCount] = useState(cachedTeamsCount);
  const [initialLoading, setInitialLoading] = useState(!cachedUser);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const fetchedRef = useRef(false);

  // Idle timeout - auto-logout after 30 minutes of inactivity
  useIdleTimeout({
    enabled: !!user, // Only track when user is logged in
    timeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 2 * 60 * 1000, // Show warning 2 minutes before
    onWarning: () => {
      setShowIdleWarning(true);
    },
    onIdle: () => {
      // Clear caches before logout
      cachedUser = null;
      cachedTeamsCount = 0;
      cacheTimestamp = 0;
    },
  });

  const fetchUserData = useCallback(async (forceRefresh = false) => {
    // Check if user is authenticated via cookie
    if (!isAuthenticated()) {
      setInitialLoading(false);
      router.push("/login");
      return;
    }

    // Use cache if valid and not forcing refresh
    const now = Date.now();
    if (!forceRefresh && cachedUser && (now - cacheTimestamp) < CACHE_DURATION) {
      setUser(cachedUser);
      setTeamsCount(cachedTeamsCount);
      setInitialLoading(false);
      return;
    }

    try {
      // Fetch user and teams in parallel using secure API client
      const [userData, teamsData] = await Promise.all([
        api<User>("/api/auth/me"),
        api<{ teams: unknown[] }>("/api/teams/my-teams"),
      ]);

      if (userData.success && userData.data) {
        cachedUser = userData.data;
        cacheTimestamp = Date.now();
        setUser(userData.data);
      } else {
        cachedUser = null;
        router.push("/login");
        return;
      }

      if (teamsData.success && teamsData.data) {
        const count = teamsData.data.teams?.length || 0;
        cachedTeamsCount = count;
        setTeamsCount(count);
      }
    } catch {
      cachedUser = null;
      router.push("/login");
    } finally {
      setInitialLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Prevent duplicate fetches in development strict mode
    if (fetchedRef.current) {
      // Already fetched, just make sure loading is false
      if (cachedUser) {
        setInitialLoading(false);
        setUser(cachedUser);
        setTeamsCount(cachedTeamsCount);
      } else {
        // No cached user and already tried to fetch, stop loading
        setInitialLoading(false);
      }
      return;
    }
    fetchedRef.current = true;
    
    // Safety timeout - prevent infinite loading screen
    const safetyTimeout = setTimeout(() => {
      if (initialLoading) {
        console.warn("Dashboard loading timeout - redirecting to login");
        setInitialLoading(false);
        router.push("/login");
      }
    }, 10000); // 10 second max loading time
    
    fetchUserData().finally(() => {
      clearTimeout(safetyTimeout);
    });
    
    return () => clearTimeout(safetyTimeout);
  }, [fetchUserData, initialLoading, router]);

  const handleLogout = async () => {
    // Clear all caches
    cachedUser = null;
    cachedTeamsCount = 0;
    cacheTimestamp = 0;
    // Clear session data (idle timeout tracking)
    clearSessionData();
    // Clear registration cache (IndexedDB + memory)
    await clearRegistrationCache();
    // Use secure logout (clears httpOnly cookies server-side and redirects)
    await logout();
  };

  // Dismiss idle warning (user became active)
  const dismissIdleWarning = () => {
    setShowIdleWarning(false);
  };

  const isAdminOrHost = user?.is_admin === true || user?.is_host === true;

  // Show blob loader while loading - only on first load
  // Use initialLoading as the primary condition, user check is secondary
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <Loader message="Loading your dashboard..." />
      </div>
    );
  }

  // If not loading but no user, redirect is already in progress
  if (!user) {
    return null;
  }

  return (
    <LoaderProvider>
      <RegistrationCacheProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4 z-50 transform transition-transform lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <span className="text-lg font-bold text-gray-900 dark:text-white">Menu</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-xl hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded text-gray-900 dark:text-white"
          >
            ✕
          </button>
        </div>
        <nav className="space-y-1">
          {menuItems.map((item, idx) => (
            <Link
              key={idx}
              href={item.disabled ? "#" : item.href}
              onClick={() => !item.disabled && setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                pathname === item.href
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium"
                  : item.disabled
                    ? "opacity-50 cursor-not-allowed text-gray-500 dark:text-gray-400"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.label === "My Teams" && teamsCount > 0 && (
                <span className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-2 py-0.5 rounded-full">
                  {teamsCount}
                </span>
              )}
              {item.disabled && (
                <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs px-2 py-0.5 rounded-full">
                  Soon
                </span>
              )}
            </Link>
          ))}
          {isAdminOrHost && (
            <Link
              href="/admin"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 mt-4"
            >
              ⚙️ Admin Panel
            </Link>
          )}
          {user?.role === "owner" && (
            <Link
              href="/owner"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 mt-2"
            >
              👑 Owner Portal
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 w-full mt-4"
          >
            🚪 Logout
          </button>
        </nav>
      </div>

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4 hidden lg:flex flex-col">
        <div className="text-xl font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-2">
          Esports Platform
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-6 flex items-center gap-3">
          <Image
            src={`https://ui-avatars.com/api/?name=${user.username}&background=111827&color=fff`}
            alt={user.username}
            width={40}
            height={40}
            className="rounded-full"
            placeholder="blur"
            blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMxMTE4MjciLz48L3N2Zz4="
          />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isAdminOrHost ? "Host" : "Player"}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {menuItems.map((item, idx) => (
            <Link
              key={idx}
              href={item.disabled ? "#" : item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                pathname === item.href
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium"
                  : item.disabled
                    ? "opacity-50 cursor-not-allowed text-gray-500 dark:text-gray-400"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.label === "My Teams" && teamsCount > 0 && (
                <span className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-2 py-0.5 rounded-full">
                  {teamsCount}
                </span>
              )}
              {item.disabled && (
                <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs px-2 py-0.5 rounded-full">
                  Soon
                </span>
              )}
            </Link>
          ))}
        </nav>

        {isAdminOrHost && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 mb-2"
          >
            ⚙️ Admin Panel
          </Link>
        )}
        {user?.role === "owner" && (
          <Link
            href="/owner"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 mb-2"
          >
            👑 Owner Portal
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 w-full"
        >
          🚪 Logout
        </button>
      </aside>

      {/* Desktop Top Bar */}
      <div className="hidden lg:flex fixed top-0 right-0 left-64 h-14 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700 px-6 items-center justify-end gap-3 z-10">
        <ThemeToggle />
        <NotificationCenter />
      </div>

      {/* Main Content */}
      <main className="lg:ml-64 lg:pt-14 min-h-screen">
        {/* Mobile Header */}
        <header className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <svg
              className="w-6 h-6 text-gray-900 dark:text-gray-100"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Esports Platform
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationCenter />
          </div>
        </header>

        <div className="p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>

      {/* Notification Permission Prompt */}
      <NotificationPrompt showOnDenied />
      
      {/* Idle Warning Modal */}
      {showIdleWarning && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={dismissIdleWarning}
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Session Expiring Soon</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                You&apos;ve been inactive for a while. Your session will expire in 2 minutes.
              </p>
              <button
                onClick={dismissIdleWarning}
                className="w-full py-3 px-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition"
              >
                I&apos;m Still Here
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Navigation Loader - shows during page transitions */}
      <Suspense fallback={null}>
        <NavigationLoader />
      </Suspense>
      </div>
      </RegistrationCacheProvider>
    </LoaderProvider>
  );
}