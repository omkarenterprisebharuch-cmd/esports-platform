"use client";

/**
 * Secure API client with automatic CSRF token handling and token refresh
 * - All mutations (POST, PUT, DELETE, PATCH) automatically include CSRF token
 * - Automatic token refresh on 401 errors
 */

// Get CSRF token from cookie
function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  if (!match) return null;
  
  // Decode URL-encoded value (cookie values may contain %XX encoding)
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

// Track if we're currently refreshing to prevent multiple refresh calls
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// Store user data (non-sensitive, for UI only)
let cachedUser: { id: string; username: string; email: string; is_host: boolean } | null = null;

export function getCachedUser() {
  return cachedUser;
}

export function setCachedUser(user: typeof cachedUser) {
  cachedUser = user;
}

export function clearCachedUser() {
  cachedUser = null;
}

interface FetchOptions extends RequestInit {
  skipCsrf?: boolean;
  skipRefresh?: boolean; // Skip auto-refresh (for refresh endpoint itself)
}

/**
 * Attempt to refresh the access token using the refresh token
 * Returns true if refresh was successful
 */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    if (data.success && data.data?.user) {
      setCachedUser(data.data.user);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get or create a refresh promise (prevents multiple simultaneous refresh calls)
 */
function getRefreshPromise(): Promise<boolean> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = refreshAccessToken().finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  }
  return refreshPromise!;
}

/**
 * Secure fetch wrapper that:
 * 1. Includes credentials (cookies) automatically
 * 2. Adds CSRF token header for mutations
 * 3. Sets proper content-type for JSON
 * 4. Auto-refreshes token on 401 and retries
 */
export async function secureFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { skipCsrf = false, skipRefresh = false, ...fetchOptions } = options;
  
  const headers = new Headers(fetchOptions.headers);
  
  // Set JSON content type if body is present and not FormData
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  // Add CSRF token for mutation requests
  const method = (fetchOptions.method || "GET").toUpperCase();
  if (!skipCsrf && ["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: "include", // Always send cookies
  });

  // If 401 and not skipping refresh, try to refresh and retry
  if (response.status === 401 && !skipRefresh) {
    const refreshed = await getRefreshPromise();
    
    if (refreshed) {
      // Retry the original request with new tokens
      // Need to update CSRF token header since it was refreshed
      const retryHeaders = new Headers(fetchOptions.headers);
      if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
        if (!retryHeaders.has("Content-Type")) {
          retryHeaders.set("Content-Type", "application/json");
        }
      }
      if (!skipCsrf && ["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
        const newCsrfToken = getCsrfToken();
        if (newCsrfToken) {
          retryHeaders.set("X-CSRF-Token", newCsrfToken);
        }
      }

      return fetch(url, {
        ...fetchOptions,
        headers: retryHeaders,
        credentials: "include",
      });
    }
  }

  return response;
}

/**
 * JSON API helper with automatic parsing and error code handling
 */
export async function api<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<{ success: boolean; data?: T; message?: string; errorCode?: string }> {
  try {
    const response = await secureFetch(url, options);
    const data = await response.json();
    
    // Handle auth errors (after refresh attempt failed)
    if (response.status === 401) {
      clearCachedUser();
      // Redirect to login if not already there
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    
    return data;
  } catch (error) {
    console.error("API error:", error);
    return { success: false, message: "Network error" };
  }
}

/**
 * Logout and clear all auth state
 */
export async function logout(): Promise<void> {
  try {
    await secureFetch("/api/auth/logout", { method: "POST", skipRefresh: true });
  } catch {
    // Ignore errors during logout
  }
  
  clearCachedUser();
  
  // Clear any old localStorage tokens (cleanup from old system)
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
  
  // Redirect to login
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

/**
 * Check if user is authenticated (has refresh_token cookie)
 * Note: This is a client-side check only, server validates the actual token
 * We check for csrf_token because auth cookies are httpOnly (not accessible via JS)
 */
export function isAuthenticated(): boolean {
  if (typeof document === "undefined") return false;
  // Check for csrf_token which is set alongside auth cookies during login
  // and is readable by JavaScript (httpOnly: false)
  return document.cookie.includes("csrf_token=");
}
