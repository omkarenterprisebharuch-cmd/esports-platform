"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { isAuthenticated } from "@/lib/api-client";

/**
 * Public Layout - For pages accessible without authentication
 * Includes a minimal header with login/register buttons for guests
 * and a link to dashboard for authenticated users
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsLoggedIn(isAuthenticated());
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Public Header */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🎮</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Esports Platform
              </span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/tournaments"
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
              >
                Tournaments
              </Link>
              <Link
                href="/leaderboard"
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
              >
                Leaderboard
              </Link>
              <Link
                href="/hall-of-fame"
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
              >
                Hall of Fame
              </Link>
            </nav>

            {/* Auth Actions */}
            <div className="flex items-center gap-3">
              <ThemeToggle />
              
              {mounted && (
                isLoggedIn ? (
                  <Link
                    href="/app"
                    className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition text-sm"
                  >
                    Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:text-gray-900 dark:hover:text-white transition text-sm"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/register"
                      className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition text-sm"
                    >
                      Get Started
                    </Link>
                  </>
                )
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
