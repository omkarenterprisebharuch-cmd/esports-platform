"use client";

import { useState, useCallback } from "react";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  fetched: boolean;
}

interface UseOnDemandFetchOptions {
  /** Cache the result and don't refetch if already fetched */
  cache?: boolean;
}

/**
 * Hook for on-demand data fetching - only fetches when user explicitly requests
 * This prevents unnecessary API calls and server load
 */
export function useOnDemandFetch<T>(
  url: string,
  options: UseOnDemandFetchOptions = { cache: true }
) {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: false,
    error: null,
    fetched: false,
  });

  const fetch = useCallback(async (forceRefresh = false) => {
    // If already fetched and caching is enabled, don't refetch
    if (state.fetched && options.cache && !forceRefresh) {
      return state.data;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
      const response = await window.fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      const result = await response.json();
      
      if (result.success) {
        setState({
          data: result.data,
          loading: false,
          error: null,
          fetched: true,
        });
        return result.data;
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: result.message || "Failed to fetch",
          fetched: true,
        }));
        return null;
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to fetch",
        fetched: true,
      }));
      return null;
    }
  }, [url, options.cache, state.fetched, state.data]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      fetched: false,
    });
  }, []);

  return {
    ...state,
    fetch,
    reset,
  };
}

/**
 * Hook for lazy loading data with a reveal button
 * Perfect for sensitive data like room credentials
 */
export function useLazyReveal<T>(url: string) {
  const { data, loading, error, fetched, fetch, reset } = useOnDemandFetch<T>(url);
  const [revealed, setRevealed] = useState(false);

  const reveal = useCallback(async () => {
    if (!fetched) {
      await fetch();
    }
    setRevealed(true);
  }, [fetch, fetched]);

  const hide = useCallback(() => {
    setRevealed(false);
  }, []);

  return {
    data,
    loading,
    error,
    revealed,
    reveal,
    hide,
    reset,
  };
}
