"use client";

import { useState, useEffect, useCallback, createContext, useContext, ReactNode, useRef } from "react";
import { secureFetch, isAuthenticated } from "@/lib/api-client";
import {
  initRegistrationCache,
  syncWithServer,
  addToCache,
  removeFromCache,
  clearCache,
  getMemoryCache,
  needsRevalidation,
  isCacheInitialized,
  cleanupRegistrationCache,
} from "@/lib/registration-cache-db";

interface RegistrationCacheContextType {
  /** Set of tournament IDs the user is registered for */
  registeredIds: Set<number>;
  /** Whether the cache is currently loading */
  loading: boolean;
  /** Whether the cache has been fetched at least once */
  fetched: boolean;
  /** Check if user is registered for a specific tournament */
  isRegistered: (tournamentId: number) => boolean;
  /** Force refresh the registration cache */
  refresh: () => Promise<void>;
  /** Add a tournament ID to the cache (after successful registration) */
  addRegistration: (tournamentId: number) => void;
  /** Remove a tournament ID from the cache (after cancellation) */
  removeRegistration: (tournamentId: number) => void;
}

const RegistrationCacheContext = createContext<RegistrationCacheContextType | undefined>(undefined);

// Revalidation interval reference
let revalidationTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Fetch registration IDs from server
 */
async function fetchRegistrationIdsFromServer(): Promise<number[]> {
  const response = await secureFetch("/api/registrations/my-registrations?fields=tournament_id");
  const data = await response.json();
  
  if (data.success) {
    const registrations = data.data?.registrations || [];
    return registrations.map((reg: { tournament_id: number }) => reg.tournament_id);
  }
  
  return [];
}

/**
 * Provider that caches user's registered tournament IDs
 * 
 * Hybrid caching strategy:
 * - Layer 1: IndexedDB (Persistent) - Survives refresh, shared across tabs
 * - Layer 2: Memory Cache (Fast) - Instant access
 * - Layer 3: Server validation - Periodic revalidation every 10 minutes
 */
export function RegistrationCacheProvider({ children }: { children: ReactNode }) {
  const [registeredIds, setRegisteredIds] = useState<Set<number>>(() => getMemoryCache());
  const [loading, setLoading] = useState(!isCacheInitialized());
  const [fetched, setFetched] = useState(isCacheInitialized());
  const mountedRef = useRef(true);
  const initRef = useRef(false);

  // Initialize cache on mount
  useEffect(() => {
    mountedRef.current = true;
    
    async function init() {
      // Prevent double initialization in StrictMode
      if (initRef.current) return;
      initRef.current = true;

      if (!isAuthenticated()) {
        setRegisteredIds(new Set());
        setLoading(false);
        setFetched(true);
        return;
      }

      try {
        // Initialize from IndexedDB with timeout (prevent hanging)
        const INIT_TIMEOUT = 3000; // 3 second timeout
        
        const initPromise = initRegistrationCache((updatedIds) => {
          // Callback for cross-tab updates
          if (mountedRef.current) {
            setRegisteredIds(updatedIds);
          }
        });
        
        const timeoutPromise = new Promise<Set<number>>((_, reject) => 
          setTimeout(() => reject(new Error('IndexedDB timeout')), INIT_TIMEOUT)
        );
        
        let cachedIds: Set<number>;
        try {
          cachedIds = await Promise.race([initPromise, timeoutPromise]);
        } catch (timeoutError) {
          console.warn("IndexedDB init timed out, using empty cache:", timeoutError);
          cachedIds = new Set();
        }

        if (mountedRef.current) {
          setRegisteredIds(cachedIds);
          setLoading(false);
          setFetched(true);
        }

        // Check if we need to sync with server
        if (needsRevalidation()) {
          // Sync in background (non-blocking)
          syncWithServer(fetchRegistrationIdsFromServer).then((serverIds) => {
            if (mountedRef.current) {
              setRegisteredIds(serverIds);
            }
          });
        }

        // Set up periodic revalidation (every 10 minutes)
        if (!revalidationTimer) {
          revalidationTimer = setInterval(async () => {
            if (isAuthenticated() && mountedRef.current) {
              const serverIds = await syncWithServer(fetchRegistrationIdsFromServer);
              if (mountedRef.current) {
                setRegisteredIds(serverIds);
              }
            }
          }, 10 * 60 * 1000);
        }
      } catch (error) {
        console.error("Failed to initialize registration cache:", error);
        if (mountedRef.current) {
          setLoading(false);
          setFetched(true);
        }
      }
    }

    init();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRegistrationCache();
      if (revalidationTimer) {
        clearInterval(revalidationTimer);
        revalidationTimer = null;
      }
    };
  }, []);

  const isRegistered = useCallback((tournamentId: number) => {
    return registeredIds.has(tournamentId);
  }, [registeredIds]);

  const addRegistration = useCallback((tournamentId: number) => {
    // Optimistic update - instant UI feedback
    setRegisteredIds((prev) => {
      const newIds = new Set(prev);
      newIds.add(tournamentId);
      return newIds;
    });
    
    // Persist to IndexedDB (async, non-blocking)
    addToCache(tournamentId);
  }, []);

  const removeRegistration = useCallback((tournamentId: number) => {
    // Optimistic update - instant UI feedback
    setRegisteredIds((prev) => {
      const newIds = new Set(prev);
      newIds.delete(tournamentId);
      return newIds;
    });
    
    // Persist to IndexedDB (async, non-blocking)
    removeFromCache(tournamentId);
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated()) {
      setRegisteredIds(new Set());
      return;
    }

    setLoading(true);
    try {
      const serverIds = await syncWithServer(fetchRegistrationIdsFromServer);
      setRegisteredIds(serverIds);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <RegistrationCacheContext.Provider
      value={{
        registeredIds,
        loading,
        fetched,
        isRegistered,
        refresh,
        addRegistration,
        removeRegistration,
      }}
    >
      {children}
    </RegistrationCacheContext.Provider>
  );
}

/**
 * Hook to access the registration cache
 * Must be used within a RegistrationCacheProvider
 */
export function useRegistrationCache() {
  const context = useContext(RegistrationCacheContext);
  if (!context) {
    throw new Error("useRegistrationCache must be used within a RegistrationCacheProvider");
  }
  return context;
}

/**
 * Clear the registration cache (call on logout)
 * This clears both memory and IndexedDB cache
 */
export async function clearRegistrationCache(): Promise<void> {
  await clearCache();
}
