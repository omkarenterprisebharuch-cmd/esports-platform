"use client";

import { useState, useCallback } from "react";

/**
 * Error display info with error code
 */
export interface ApiErrorInfo {
  message: string;
  errorCode?: string;
}

/**
 * Hook for handling API errors with error codes
 * 
 * Usage:
 * const { error, setError, clearError, handleApiResponse } = useApiError();
 * 
 * const result = await api("/api/endpoint", { method: "POST" });
 * if (!handleApiResponse(result)) {
 *   return; // Error was set, component will show error
 * }
 */
export function useApiError() {
  const [error, setErrorState] = useState<ApiErrorInfo | null>(null);

  const setError = useCallback((message: string, errorCode?: string) => {
    setErrorState({ message, errorCode });
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  /**
   * Handle API response, returns true if successful, false if error
   * Automatically sets error state on failure
   */
  const handleApiResponse = useCallback(<T,>(response: { 
    success: boolean; 
    message?: string; 
    errorCode?: string;
    data?: T;
  }): response is { success: true; data: T; message?: string; errorCode?: string } => {
    if (!response.success) {
      setErrorState({
        message: response.message || "An unexpected error occurred",
        errorCode: response.errorCode,
      });
      return false;
    }
    clearError();
    return true;
  }, [clearError]);

  return {
    error,
    setError,
    clearError,
    handleApiResponse,
    hasError: error !== null,
  };
}

/**
 * Props for ApiErrorDisplay component
 */
interface ApiErrorDisplayProps {
  error: ApiErrorInfo | null;
  className?: string;
  onDismiss?: () => void;
  showCode?: boolean; // Default: true
}

/**
 * Component to display API errors with error codes
 * 
 * Usage:
 * <ApiErrorDisplay error={error} onDismiss={clearError} />
 */
export function ApiErrorDisplay({ 
  error, 
  className = "", 
  onDismiss,
  showCode = true 
}: ApiErrorDisplayProps) {
  if (!error) return null;

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <svg 
            className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path 
              fillRule="evenodd" 
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
              clipRule="evenodd" 
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-800">
              {error.message}
            </p>
            {showCode && error.errorCode && (
              <p className="text-xs text-red-600 mt-1">
                Error Code: <span className="font-mono font-semibold">{error.errorCode}</span>
              </p>
            )}
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-500 hover:text-red-700 transition-colors"
            aria-label="Dismiss error"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Inline error display for forms
 */
interface InlineErrorProps {
  error: ApiErrorInfo | null;
  className?: string;
}

export function InlineError({ error, className = "" }: InlineErrorProps) {
  if (!error) return null;

  return (
    <p className={`text-sm text-red-600 ${className}`}>
      {error.message}
      {error.errorCode && (
        <span className="ml-1 text-xs font-mono text-red-500">
          ({error.errorCode})
        </span>
      )}
    </p>
  );
}

/**
 * Toast-style error notification (for global errors)
 */
interface ErrorToastProps {
  error: ApiErrorInfo | null;
  onDismiss?: () => void;
  autoHide?: number; // Auto hide after ms (0 = no auto hide)
}

export function ErrorToast({ error, onDismiss, autoHide = 5000 }: ErrorToastProps) {
  if (!error) return null;

  // Auto dismiss effect would need useEffect
  
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-up">
      <div className="bg-red-600 text-white rounded-lg shadow-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium">{error.message}</p>
            {error.errorCode && (
              <p className="text-xs opacity-80 mt-1 font-mono">
                {error.errorCode}
              </p>
            )}
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="ml-3 text-white/80 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ApiErrorDisplay;
