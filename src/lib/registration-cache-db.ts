"use client";

import { openDB, DBSchema, IDBPDatabase } from "idb";

/**
 * Hybrid Registration Cache using IndexedDB
 * 
 * Layer 1: IndexedDB (Persistent) - Survives page refresh, shared across tabs
 * Layer 2: Memory Cache (Fast) - In-memory Set for instant access
 * Layer 3: Server-side validation - Always verify on critical actions
 */

// Database schema
interface RegistrationCacheDB extends DBSchema {
  registrations: {
    key: number;
    value: {
      tournamentId: number;
      registeredAt: number;
    };
  };
  metadata: {
    key: string;
    value: {
      key: string;
      value: number | string;
    };
  };
}

// Constants
const DB_NAME = "esports-registration-cache";
const DB_VERSION = 1;
const REVALIDATION_INTERVAL = 10 * 60 * 1000; // 10 minutes
const BROADCAST_CHANNEL_NAME = "registration-cache-sync";

// Memory cache (Layer 2)
let memoryCache: Set<number> = new Set();
let memoryCacheTimestamp = 0;
let isInitialized = false;

// BroadcastChannel for cross-tab sync
let broadcastChannel: BroadcastChannel | null = null;

// Database instance
let dbPromise: Promise<IDBPDatabase<RegistrationCacheDB>> | null = null;

// Database initialization timeout
const DB_INIT_TIMEOUT = 2000; // 2 seconds

/**
 * Initialize the IndexedDB database with timeout
 */
function getDB(): Promise<IDBPDatabase<RegistrationCacheDB>> {
  if (!dbPromise) {
    const openPromise = openDB<RegistrationCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create registrations store
        if (!db.objectStoreNames.contains("registrations")) {
          db.createObjectStore("registrations", { keyPath: "tournamentId" });
        }
        // Create metadata store for timestamps, user info, etc.
        if (!db.objectStoreNames.contains("metadata")) {
          db.createObjectStore("metadata", { keyPath: "key" });
        }
      },
    });
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('IndexedDB open timeout')), DB_INIT_TIMEOUT)
    );
    
    dbPromise = Promise.race([openPromise, timeoutPromise]).catch((err) => {
      console.error("IndexedDB failed to open:", err);
      dbPromise = null; // Reset so we can retry
      throw err;
    });
  }
  return dbPromise;
}

/**
 * Initialize BroadcastChannel for cross-tab synchronization
 */
function initBroadcastChannel(onUpdate: (ids: Set<number>) => void): void {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  
  if (broadcastChannel) {
    broadcastChannel.close();
  }

  broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  
  broadcastChannel.onmessage = (event) => {
    const { type, data } = event.data;
    
    switch (type) {
      case "SYNC":
        // Another tab synced with server, update our cache
        memoryCache = new Set(data.ids);
        memoryCacheTimestamp = data.timestamp;
        onUpdate(memoryCache);
        break;
      case "ADD":
        // Another tab added a registration
        memoryCache.add(data.tournamentId);
        onUpdate(new Set(memoryCache));
        break;
      case "REMOVE":
        // Another tab removed a registration
        memoryCache.delete(data.tournamentId);
        onUpdate(new Set(memoryCache));
        break;
      case "CLEAR":
        // Another tab cleared the cache (logout)
        memoryCache = new Set();
        memoryCacheTimestamp = 0;
        onUpdate(memoryCache);
        break;
    }
  };
}

/**
 * Broadcast cache updates to other tabs
 */
function broadcast(type: string, data?: Record<string, unknown>): void {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type, data });
    } catch {
      // BroadcastChannel may fail in some contexts
    }
  }
}

/**
 * Load registration IDs from IndexedDB into memory cache
 */
export async function loadFromIndexedDB(): Promise<Set<number>> {
  try {
    const db = await getDB();
    const registrations = await db.getAll("registrations");
    const ids = new Set(registrations.map((r) => r.tournamentId));
    
    // Load timestamp
    const meta = await db.get("metadata", "lastSync");
    if (meta) {
      memoryCacheTimestamp = meta.value as number;
    }
    
    memoryCache = ids;
    isInitialized = true;
    
    return ids;
  } catch (error) {
    console.error("Failed to load from IndexedDB:", error);
    return new Set();
  }
}

/**
 * Save registration IDs to IndexedDB
 */
export async function saveToIndexedDB(ids: Set<number>): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(["registrations", "metadata"], "readwrite");
    const store = tx.objectStore("registrations");
    const metaStore = tx.objectStore("metadata");
    
    // Clear existing registrations
    await store.clear();
    
    // Add all current registrations
    const now = Date.now();
    for (const tournamentId of ids) {
      await store.put({ tournamentId, registeredAt: now });
    }
    
    // Update sync timestamp
    await metaStore.put({ key: "lastSync", value: now });
    
    await tx.done;
    
    memoryCacheTimestamp = now;
  } catch (error) {
    console.error("Failed to save to IndexedDB:", error);
  }
}

/**
 * Add a single registration to the cache
 */
export async function addToCache(tournamentId: number): Promise<void> {
  memoryCache.add(tournamentId);
  
  try {
    const db = await getDB();
    await db.put("registrations", { tournamentId, registeredAt: Date.now() });
    broadcast("ADD", { tournamentId });
  } catch (error) {
    console.error("Failed to add to IndexedDB:", error);
  }
}

/**
 * Remove a single registration from the cache
 */
export async function removeFromCache(tournamentId: number): Promise<void> {
  memoryCache.delete(tournamentId);
  
  try {
    const db = await getDB();
    await db.delete("registrations", tournamentId);
    broadcast("REMOVE", { tournamentId });
  } catch (error) {
    console.error("Failed to remove from IndexedDB:", error);
  }
}

/**
 * Clear the entire cache (for logout)
 */
export async function clearCache(): Promise<void> {
  memoryCache = new Set();
  memoryCacheTimestamp = 0;
  
  try {
    const db = await getDB();
    const tx = db.transaction(["registrations", "metadata"], "readwrite");
    await tx.objectStore("registrations").clear();
    await tx.objectStore("metadata").clear();
    await tx.done;
    broadcast("CLEAR");
  } catch (error) {
    console.error("Failed to clear IndexedDB:", error);
  }
}

/**
 * Get memory cache (fast, synchronous access)
 */
export function getMemoryCache(): Set<number> {
  return new Set(memoryCache);
}

/**
 * Check if cache needs revalidation from server
 */
export function needsRevalidation(): boolean {
  if (!isInitialized) return true;
  return Date.now() - memoryCacheTimestamp > REVALIDATION_INTERVAL;
}

/**
 * Check if cache is initialized
 */
export function isCacheInitialized(): boolean {
  return isInitialized;
}

/**
 * Get last sync timestamp
 */
export function getLastSyncTime(): number {
  return memoryCacheTimestamp;
}

/**
 * Initialize the registration cache system
 * Call this on app mount
 */
export async function initRegistrationCache(
  onUpdate: (ids: Set<number>) => void
): Promise<Set<number>> {
  // Initialize BroadcastChannel for cross-tab sync
  initBroadcastChannel(onUpdate);
  
  // Load from IndexedDB
  const ids = await loadFromIndexedDB();
  
  return ids;
}

/**
 * Sync with server and update cache
 * Returns the updated set of registration IDs
 */
export async function syncWithServer(
  fetchFn: () => Promise<number[]>
): Promise<Set<number>> {
  try {
    const serverIds = await fetchFn();
    const ids = new Set(serverIds);
    
    // Update memory cache
    memoryCache = ids;
    
    // Persist to IndexedDB
    await saveToIndexedDB(ids);
    
    // Broadcast to other tabs
    broadcast("SYNC", { ids: Array.from(ids), timestamp: memoryCacheTimestamp });
    
    return ids;
  } catch (error) {
    console.error("Failed to sync with server:", error);
    // Return memory cache on failure
    return memoryCache;
  }
}

/**
 * Cleanup function (call on unmount)
 */
export function cleanupRegistrationCache(): void {
  if (broadcastChannel) {
    broadcastChannel.close();
    broadcastChannel = null;
  }
}
