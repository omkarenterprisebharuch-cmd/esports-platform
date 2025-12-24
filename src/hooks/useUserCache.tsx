"use client";

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";

interface User {
  id: number;
  username: string;
  email: string;
  is_host: boolean;
  is_admin?: boolean;
  avatar_url?: string;
}

interface UserCacheContextType {
  user: User | null;
  loading: boolean;
  teamsCount: number;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
}

// Module-level cache to persist across component remounts
let cachedUser: User | null = null;
let cachedTeamsCount: number = 0;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const UserCacheContext = createContext<UserCacheContextType | undefined>(undefined);

/**
 * Provider that caches user data to prevent repeated API calls
 * User data is fetched once and cached for the session
 */
export function UserCacheProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);
  const [teamsCount, setTeamsCount] = useState(cachedTeamsCount);

  const fetchUser = useCallback(async (forceRefresh = false) => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Use cache if valid and not forcing refresh
    const now = Date.now();
    if (!forceRefresh && cachedUser && (now - cacheTimestamp) < CACHE_DURATION) {
      setUser(cachedUser);
      setTeamsCount(cachedTeamsCount);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Fetch user and teams in parallel
      const [userRes, teamsRes] = await Promise.all([
        fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/teams/my-teams", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [userData, teamsData] = await Promise.all([
        userRes.json(),
        teamsRes.json(),
      ]);

      if (userData.success) {
        cachedUser = userData.data;
        cacheTimestamp = Date.now();
        setUser(userData.data);
      } else {
        // Invalid token
        localStorage.removeItem("token");
        cachedUser = null;
        setUser(null);
      }

      if (teamsData.success) {
        const count = teamsData.data.teams?.length || 0;
        cachedTeamsCount = count;
        setTeamsCount(count);
      }
    } catch {
      localStorage.removeItem("token");
      cachedUser = null;
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    cachedUser = null;
    cachedTeamsCount = 0;
    cacheTimestamp = 0;
    setUser(null);
    setTeamsCount(0);
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <UserCacheContext.Provider
      value={{
        user,
        loading,
        teamsCount,
        isAuthenticated: !!user,
        refresh: () => fetchUser(true),
        logout,
      }}
    >
      {children}
    </UserCacheContext.Provider>
  );
}

export function useUserCache() {
  const context = useContext(UserCacheContext);
  if (!context) {
    throw new Error("useUserCache must be used within UserCacheProvider");
  }
  return context;
}
