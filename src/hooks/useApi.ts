"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { secureFetch, isAuthenticated } from "@/lib/api-client";

// ============ Types ============

interface UseApiState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

interface UseApiOptions<T> {
  /** Initial data to use before fetch */
  initialData?: T;
  /** Whether to fetch immediately on mount */
  immediate?: boolean;
  /** Cache key for deduplication */
  cacheKey?: string;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Transform response data */
  transform?: (data: unknown) => T;
  /** Callback on successful fetch */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** Require authentication */
  requireAuth?: boolean;
}

interface UseApiReturn<T> extends UseApiState<T> {
  /** Manually trigger the fetch */
  execute: () => Promise<T | null>;
  /** Reset state to initial */
  reset: () => void;
  /** Refetch with same parameters */
  refetch: () => Promise<T | null>;
  /** Mutate data locally */
  mutate: (data: T | ((prev: T | null) => T)) => void;
}

interface UseMutationState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

interface UseMutationOptions<T, V> {
  /** Callback on successful mutation */
  onSuccess?: (data: T, variables: V) => void;
  /** Callback on error */
  onError?: (error: string, variables: V) => void;
  /** Optimistic update function */
  optimisticUpdate?: (variables: V) => T;
  /** Rollback function for failed optimistic updates */
  rollback?: () => void;
}

// ============ Simple Cache ============

const cache = new Map<string, { data: unknown; timestamp: number }>();

function getCached<T>(key: string, ttl: number): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// ============ useApi Hook ============

/**
 * Custom hook for API data fetching with caching, loading states, and error handling
 * 
 * @example
 * const { data, isLoading, error, execute } = useApi<Tournament[]>('/api/tournaments');
 * 
 * @example
 * const { data: user } = useApi<User>('/api/auth/me', { immediate: true, requireAuth: true });
 */
export function useApi<T>(
  url: string,
  options: UseApiOptions<T> = {}
): UseApiReturn<T> {
  const {
    initialData = null,
    immediate = false,
    cacheKey,
    cacheTTL = 5 * 60 * 1000, // 5 minutes default
    transform,
    onSuccess,
    onError,
    requireAuth = false,
  } = options;

  const [state, setState] = useState<UseApiState<T>>({
    data: initialData,
    error: null,
    isLoading: immediate,
    isSuccess: false,
    isError: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const execute = useCallback(async (): Promise<T | null> => {
    // Check auth if required
    if (requireAuth && !isAuthenticated()) {
      const errorMsg = "Authentication required";
      setState((prev) => ({
        ...prev,
        error: errorMsg,
        isLoading: false,
        isError: true,
      }));
      onError?.(errorMsg);
      return null;
    }

    // Check cache
    const effectiveCacheKey = cacheKey || url;
    const cached = getCached<T>(effectiveCacheKey, cacheTTL);
    if (cached) {
      setState({
        data: cached,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
      });
      onSuccess?.(cached);
      return cached;
    }

    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await secureFetch(url, {
        signal: abortControllerRef.current.signal,
      });

      if (!mountedRef.current) return null;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed: ${response.status}`);
      }

      const json = await response.json();
      let data = json.data ?? json;

      if (transform) {
        data = transform(data);
      }

      // Cache the result
      setCache(effectiveCacheKey, data);

      setState({
        data,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
      });

      onSuccess?.(data);
      return data;
    } catch (error) {
      if (!mountedRef.current) return null;

      // Ignore abort errors
      if (error instanceof Error && error.name === "AbortError") {
        return null;
      }

      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setState({
        data: null,
        error: errorMsg,
        isLoading: false,
        isSuccess: false,
        isError: true,
      });

      onError?.(errorMsg);
      return null;
    }
  }, [url, cacheKey, cacheTTL, transform, onSuccess, onError, requireAuth]);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setState({
      data: initialData,
      error: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
    });
  }, [initialData]);

  const mutate = useCallback((newData: T | ((prev: T | null) => T)) => {
    setState((prev) => ({
      ...prev,
      data: typeof newData === "function" 
        ? (newData as (prev: T | null) => T)(prev.data)
        : newData,
    }));
  }, []);

  // Immediate fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    if (immediate) {
      execute();
    }
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, [immediate, execute]);

  return {
    ...state,
    execute,
    reset,
    refetch: execute,
    mutate,
  };
}

// ============ useMutation Hook ============

/**
 * Custom hook for API mutations (POST, PUT, DELETE) with loading states
 * 
 * @example
 * const { mutate, isLoading } = useMutation<Team, CreateTeamInput>(
 *   (data) => secureFetch('/api/teams', { method: 'POST', body: JSON.stringify(data) })
 * );
 * 
 * const handleSubmit = async (formData: CreateTeamInput) => {
 *   const result = await mutate(formData);
 *   if (result) router.push('/my-teams');
 * };
 */
export function useMutation<T, V = void>(
  mutationFn: (variables: V) => Promise<Response>,
  options: UseMutationOptions<T, V> = {}
): {
  mutate: (variables: V) => Promise<T | null>;
  reset: () => void;
} & UseMutationState<T> {
  const { onSuccess, onError, optimisticUpdate, rollback } = options;

  const [state, setState] = useState<UseMutationState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  });

  const mutate = useCallback(
    async (variables: V): Promise<T | null> => {
      setState({
        data: null,
        error: null,
        isLoading: true,
        isSuccess: false,
        isError: false,
      });

      // Apply optimistic update
      let optimisticData: T | undefined;
      if (optimisticUpdate) {
        optimisticData = optimisticUpdate(variables);
        setState((prev) => ({ ...prev, data: optimisticData! }));
      }

      try {
        const response = await mutationFn(variables);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Request failed: ${response.status}`);
        }

        const json = await response.json();
        const data = (json.data ?? json) as T;

        setState({
          data,
          error: null,
          isLoading: false,
          isSuccess: true,
          isError: false,
        });

        onSuccess?.(data, variables);
        return data;
      } catch (error) {
        // Rollback optimistic update
        if (rollback && optimisticData !== undefined) {
          rollback();
        }

        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        setState({
          data: null,
          error: errorMsg,
          isLoading: false,
          isSuccess: false,
          isError: true,
        });

        onError?.(errorMsg, variables);
        return null;
      }
    },
    [mutationFn, onSuccess, onError, optimisticUpdate, rollback]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
    });
  }, []);

  return {
    ...state,
    mutate,
    reset,
  };
}

// ============ useInfiniteApi Hook ============

interface UseInfiniteApiOptions<T> {
  /** Items per page */
  pageSize?: number;
  /** Get next page cursor from response */
  getNextPageParam?: (lastPage: T[], allPages: T[][]) => number | null;
}

/**
 * Hook for paginated/infinite scroll data fetching
 */
export function useInfiniteApi<T>(
  urlFn: (page: number) => string,
  options: UseInfiniteApiOptions<T> = {}
): {
  data: T[];
  pages: T[][];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reset: () => void;
} {
  const { pageSize = 20, getNextPageParam } = options;

  const [pages, setPages] = useState<T[][]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore) return;

    const isFirstPage = currentPage === 0;
    if (isFirstPage) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const response = await secureFetch(urlFn(currentPage));
      
      if (!response.ok) {
        throw new Error("Failed to load data");
      }

      const json = await response.json();
      const newData = (json.data ?? json) as T[];

      setPages((prev) => [...prev, newData]);
      setCurrentPage((prev) => prev + 1);

      // Determine if there are more pages
      if (getNextPageParam) {
        const nextPage = getNextPageParam(newData, [...pages, newData]);
        setHasMore(nextPage !== null);
      } else {
        setHasMore(newData.length >= pageSize);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [currentPage, isLoading, isLoadingMore, hasMore, urlFn, pages, pageSize, getNextPageParam]);

  const reset = useCallback(() => {
    setPages([]);
    setCurrentPage(0);
    setIsLoading(false);
    setIsLoadingMore(false);
    setError(null);
    setHasMore(true);
  }, []);

  // Flatten all pages into single array
  const data = pages.flat();

  return {
    data,
    pages,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    reset,
  };
}
