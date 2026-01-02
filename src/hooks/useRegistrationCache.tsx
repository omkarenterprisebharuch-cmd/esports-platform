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
  registeredIds: Set<string>;
  /** Whether the cache is currently loading */
  loading: boolean;
  /** Whether the cache has been fetched at least once */
  fetched: boolean;
  /** Check if user is registered for a specific tournament */
  isRegistered: (tournamentId: string | number) => boolean;
  /** Force refresh the registration cache from server (makes API call) */
  refresh: () => Promise<void>;
  /** Sync cache from already-fetched data (no API call) */
  syncFromData: (tournamentIds: (string | number)[]) => void;
  /** Add a tournament ID to the cache (after successful registration) */
  addRegistration: (tournamentId: string | number) => void;
  /** Remove a tournament ID from the cache (after cancellation) */
  removeRegistration: (tournamentId: string | number) => void;
}

const RegistrationCacheContext = createContext<RegistrationCacheContextType | undefined>(undefined);

/**
 * Fetch registration IDs from server
 */
async function fetchRegistrationIdsFromServer(): Promise<string[]> {
  const response = await secureFetch("/api/registrations/my-registrations?fields=tournament_id");
  const data = await response.json();
  
  if (data.success) {
    const registrations = data.data?.registrations || [];
    return registrations.map((reg: { tournament_id: string }) => String(reg.tournament_id));
  }
  
  return [];
}

/**
 * Provider that caches user's registered tournament IDs
 * 
 * IMPORTANT: This provider NEVER makes API calls on mount.
 * It only loads cached data from IndexedDB.
 * 
 * API calls to /api/registrations/my-registrations are ONLY made:
 * 1. When user visits /my-registrations page (the page itself fetches)
 * 2. When refresh() is explicitly called
 * 
 * Hybrid caching strategy:
 * - Layer 1: IndexedDB (Persistent) - Survives refresh, shared across tabs
 * - Layer 2: Memory Cache (Fast) - Instant access
 * - Layer 3: Server validation - Only on explicit refresh()
 */
export function RegistrationCacheProvider({ children }: { children: ReactNode }) {
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(() => getMemoryCache());
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
        
        const timeoutPromise = new Promise<Set<string>>((_, reject) => 
          setTimeout(() => reject(new Error('IndexedDB timeout')), INIT_TIMEOUT)
        );
        
        let cachedIds: Set<string>;
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

        // On-demand sync: Server sync only happens when user explicitly calls refresh()
        // This saves database calls - IndexedDB cache is used as primary source
        // Sync will be triggered when user visits My Registrations page
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
    };
  }, []);

  const isRegistered = useCallback((tournamentId: string | number) => {
    return registeredIds.has(String(tournamentId));
  }, [registeredIds]);

  const addRegistration = useCallback((tournamentId: string | number) => {
    const id = String(tournamentId);
    // Optimistic update - instant UI feedback
    setRegisteredIds((prev) => {
      const newIds = new Set(prev);
      newIds.add(id);
      return newIds;
    });
    
    // Persist to IndexedDB (async, non-blocking)
    addToCache(id);
  }, []);

  const removeRegistration = useCallback((tournamentId: string | number) => {
    const id = String(tournamentId);
    // Optimistic update - instant UI feedback
    setRegisteredIds((prev) => {
      const newIds = new Set(prev);
      newIds.delete(id);
      return newIds;
    });
    
    // Persist to IndexedDB (async, non-blocking)
    removeFromCache(id);
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

  // Sync cache from already-fetched data (avoids duplicate API calls)
  const syncFromData = useCallback((tournamentIds: (string | number)[]) => {
    const ids = tournamentIds.map(id => String(id));
    const newSet = new Set(ids);
    setRegisteredIds(newSet);
    
    // Update IndexedDB cache in background
    syncWithServer(() => Promise.resolve(ids));
  }, []);

  return (
    <RegistrationCacheContext.Provider
      value={{
        registeredIds,
        loading,
        fetched,
        isRegistered,
        refresh,
        syncFromData,
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
