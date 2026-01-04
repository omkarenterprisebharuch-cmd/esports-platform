"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { LoaderProvider, Loader } from "@/components/ui/Loader";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { RegistrationCacheProvider, clearRegistrationCache, useIdleTimeout, clearSessionData } from "@/hooks";
import { api, logout, isAuthenticated } from "@/lib/api-client";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppHeader } from "@/components/app/AppHeader";

// Lazy load notification prompt - not critical for initial render
const NotificationPrompt = dynamic(
  () => import("@/components/notifications/NotificationPrompt"),
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
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * New App Layout for Authenticated Users
 * 
 * This is a completely new layout that:
 * - Uses modern design consistent with the guest UI
 * - Maintains all security features (auth, role-based access)
 * - Optimizes for performance with caching and lazy loading
 * - Provides excellent UX with responsive design
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!cachedUser);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const fetchedRef = useRef(false);

  // Idle timeout - auto-logout after 30 minutes of inactivity
  useIdleTimeout({
    enabled: !!user,
    timeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 2 * 60 * 1000, // Show warning 2 minutes before
    onWarning: () => setShowIdleWarning(true),
    onIdle: () => {
      cachedUser = null;
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
      setInitialLoading(false);
      return;
    }

    try {
      const userData = await api<User>("/api/auth/me");

      if (userData.success && userData.data) {
        cachedUser = userData.data;
        cacheTimestamp = Date.now();
        setUser(userData.data);
      } else {
        cachedUser = null;
        router.push("/login");
        return;
      }
    } catch {
      cachedUser = null;
      router.push("/login");
    } finally {
      setInitialLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (fetchedRef.current) {
      if (cachedUser) {
        setInitialLoading(false);
        setUser(cachedUser);
      } else {
        setInitialLoading(false);
      }
      return;
    }
    fetchedRef.current = true;
    
    // Safety timeout - prevent infinite loading screen
    const safetyTimeout = setTimeout(() => {
      if (initialLoading) {
        console.warn("App loading timeout - redirecting to login");
        setInitialLoading(false);
        router.push("/login");
      }
    }, 10000);
    
    fetchUserData().finally(() => clearTimeout(safetyTimeout));
    
    return () => clearTimeout(safetyTimeout);
  }, [fetchUserData, initialLoading, router]);

  const handleLogout = async () => {
    cachedUser = null;
    cacheTimestamp = 0;
    clearSessionData();
    await clearRegistrationCache();
    await logout();
  };

  const dismissIdleWarning = () => setShowIdleWarning(false);

  // Loading state
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <Loader message="Loading your dashboard..." />
      </div>
    );
  }

  // Redirect in progress
  if (!user) {
    return null;
  }

  return (
    <LoaderProvider>
      <RegistrationCacheProvider>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
          {/* Sidebar */}
          <AppSidebar 
            user={user} 
            onLogout={handleLogout}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          {/* Header */}
          <AppHeader 
            user={user}
            onMenuClick={() => setSidebarOpen(true)}
          />

          {/* Main Content */}
          <main className="lg:ml-72 lg:pt-16 min-h-screen">
            <div className="p-4 md:p-6 lg:p-8">
              <ErrorBoundary>
                <Suspense fallback={
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin w-8 h-8 border-4 border-gray-900 dark:border-white border-t-transparent dark:border-t-transparent rounded-full" />
                  </div>
                }>
                  {children}
                </Suspense>
              </ErrorBoundary>
            </div>
          </main>

          {/* Notification Permission Prompt */}
          <NotificationPrompt showOnDenied />
          
          {/* Idle Warning Modal */}
          {showIdleWarning && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
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
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Session Expiring Soon
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    You&apos;ve been inactive for a while. Your session will expire in 2 minutes.
                  </p>
                  <button
                    onClick={dismissIdleWarning}
                    className="w-full py-3 px-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition"
                  >
                    I&apos;m Still Here
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </RegistrationCacheProvider>
    </LoaderProvider>
  );
}
