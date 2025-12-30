"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { secureFetch, clearCachedUser } from "@/lib/api-client";

// Default idle timeout: 30 minutes
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

// Activity events to track
const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

// Storage keys
const LAST_ACTIVITY_KEY = "last_activity_timestamp";
const SESSION_ACTIVE_KEY = "session_active";

/**
 * Hook to track user activity and auto-logout after idle timeout
 * 
 * @param options.enabled - Whether to enable idle tracking (default: true)
 * @param options.timeout - Idle timeout in milliseconds (default: 30 minutes)
 * @param options.onIdle - Callback when user becomes idle (before logout)
 * @param options.warningTime - Time before timeout to show warning (default: 2 minutes)
 * @param options.onWarning - Callback when warning should be shown
 */
export function useIdleTimeout(options: {
  enabled?: boolean;
  timeout?: number;
  onIdle?: () => void;
  warningTime?: number;
  onWarning?: (remainingMs: number) => void;
} = {}) {
  const {
    enabled = true,
    timeout = DEFAULT_IDLE_TIMEOUT_MS,
    onIdle,
    warningTime = 2 * 60 * 1000, // 2 minutes warning
    onWarning,
  } = options;

  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const isLoggingOut = useRef(false);

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    if (typeof window === "undefined") return;
    
    const now = Date.now();
    localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
    localStorage.setItem(SESSION_ACTIVE_KEY, "true");
  }, []);

  // Perform logout
  const performLogout = useCallback(async () => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;

    try {
      // Call onIdle callback
      onIdle?.();

      // Clear local storage
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      localStorage.removeItem(SESSION_ACTIVE_KEY);
      clearCachedUser();

      // Call logout API
      await secureFetch("/api/auth/logout", {
        method: "POST",
        skipRefresh: true,
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      isLoggingOut.current = false;
      // Redirect to login
      router.push("/login?reason=idle");
      router.refresh();
    }
  }, [onIdle, router]);

  // Check if session has expired (for cross-tab sync)
  const checkSessionExpiry = useCallback(() => {
    if (typeof window === "undefined") return false;

    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastActivity) return false;

    const elapsed = Date.now() - parseInt(lastActivity, 10);
    return elapsed >= timeout;
  }, [timeout]);

  // Reset the idle timer
  const resetTimer = useCallback(() => {
    if (!enabled) return;

    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    // Update activity timestamp
    updateActivity();

    // Set warning timer
    if (onWarning && warningTime < timeout) {
      warningRef.current = setTimeout(() => {
        const remaining = timeout - (timeout - warningTime);
        onWarning(remaining);
      }, timeout - warningTime);
    }

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      performLogout();
    }, timeout);
  }, [enabled, timeout, warningTime, onWarning, updateActivity, performLogout]);

  // Handle activity events
  const handleActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Handle storage events (cross-tab sync)
  const handleStorageChange = useCallback((event: StorageEvent) => {
    if (event.key === SESSION_ACTIVE_KEY && event.newValue === null) {
      // Another tab logged out
      clearCachedUser();
      router.push("/login?reason=logout");
      router.refresh();
    }
  }, [router]);

  // Check for expired session on mount
  useEffect(() => {
    if (!enabled) return;

    // Check if session already expired
    if (checkSessionExpiry()) {
      performLogout();
      return;
    }

    // Initialize activity tracking
    updateActivity();
  }, [enabled, checkSessionExpiry, performLogout, updateActivity]);

  // Set up event listeners
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // Add activity event listeners
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Add storage event listener for cross-tab sync
    window.addEventListener("storage", handleStorageChange);

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      window.removeEventListener("storage", handleStorageChange);
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [enabled, handleActivity, handleStorageChange, resetTimer]);

  return {
    resetTimer,
    updateActivity,
    checkSessionExpiry,
  };
}

/**
 * Get the remaining time before session expires
 */
export function getSessionRemainingTime(timeout = DEFAULT_IDLE_TIMEOUT_MS): number | null {
  if (typeof window === "undefined") return null;

  const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
  if (!lastActivity) return null;

  const elapsed = Date.now() - parseInt(lastActivity, 10);
  const remaining = timeout - elapsed;

  return remaining > 0 ? remaining : 0;
}

/**
 * Check if user has an active session
 */
export function hasActiveSession(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SESSION_ACTIVE_KEY) === "true";
}

/**
 * Clear session data (call on logout)
 */
export function clearSessionData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  localStorage.removeItem(SESSION_ACTIVE_KEY);
}
