"use client";

import React, { useState, useEffect } from "react";
import {
  isPushSupported,
  getPermissionStatus,
  shouldAskPermission,
  isPermissionDenied,
  enablePushNotifications,
  registerServiceWorker,
  hasActiveSubscription,
} from "@/lib/push-notifications";

interface NotificationPromptProps {
  onClose?: () => void;
  showOnDenied?: boolean; // Show even if previously denied (for re-login)
}

export default function NotificationPrompt({
  onClose,
  showOnDenied = false,
}: NotificationPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    checkShouldShow();
  }, [showOnDenied]);

  const checkShouldShow = async () => {
    // Check if push is supported
    if (!isPushSupported()) {
      console.log("[Notification] Push not supported");
      return;
    }

    // Register service worker on load
    await registerServiceWorker();

    const status = getPermissionStatus();

    // If permission granted, check if we have active subscription
    if (status === "granted") {
      const hasSubscription = await hasActiveSubscription();
      if (hasSubscription) {
        // Already subscribed, don't show
        return;
      }
      // Permission granted but no subscription - show prompt to complete setup
      setIsVisible(true);
      return;
    }

    // If denied and showOnDenied is true (re-login), show with different message
    if (status === "denied" && showOnDenied) {
      setIsVisible(true);
      return;
    }

    // If never asked, show prompt
    if (shouldAskPermission()) {
      // Small delay to not show immediately on page load
      setTimeout(() => setIsVisible(true), 2000);
    }
  };

  const handleEnable = async () => {
    setIsLoading(true);
    setError(null);

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in to enable notifications");
      setIsLoading(false);
      return;
    }

    const result = await enablePushNotifications(token);

    if (result.success) {
      setSuccess(true);
      // Hide after showing success
      setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, 2000);
    } else if (result.isLocalHostIssue) {
      // On localhost, just dismiss gracefully since this is expected
      console.log('[Notifications] Localhost limitation - dismissing prompt');
      setIsVisible(false);
      onClose?.();
    } else {
      setError(result.error || "Failed to enable notifications");
    }

    setIsLoading(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Store dismissal in localStorage to avoid showing again this session
    localStorage.setItem("notification_prompt_dismissed", Date.now().toString());
    onClose?.();
  };

  if (!isVisible) return null;

  const isDenied = isPermissionDenied();

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 max-w-sm">
        {success ? (
          // Success state
          <div className="text-center py-2">
            <div className="text-4xl mb-2">✅</div>
            <p className="font-semibold text-gray-900">Notifications Enabled!</p>
            <p className="text-sm text-gray-600">
              You&apos;ll receive important updates
            </p>
          </div>
        ) : isDenied ? (
          // Denied state - show how to enable
          <>
            <div className="flex items-start gap-3 mb-4">
              <span className="text-3xl">🔔</span>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">
                  Notifications Blocked
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  You&apos;ve blocked notifications. To receive important updates 
                  like tournament room IDs and passwords:
                </p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-700">
              <p className="font-medium mb-2">How to enable:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-600">
                <li>Click the 🔒 icon in your browser address bar</li>
                <li>Find &quot;Notifications&quot; setting</li>
                <li>Change from &quot;Block&quot; to &quot;Allow&quot;</li>
                <li>Refresh this page</li>
              </ol>
            </div>
            <button
              onClick={handleDismiss}
              className="w-full py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              Got it
            </button>
          </>
        ) : (
          // Default prompt state
          <>
            <div className="flex items-start gap-3 mb-4">
              <span className="text-3xl">🔔</span>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">
                  Stay Updated!
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Get instant notifications for:
                </p>
              </div>
            </div>

            <ul className="space-y-2 mb-4 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Room ID & Password when published
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Tournament start reminders
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Important announcements
              </li>
            </ul>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleDismiss}
                className="flex-1 py-2.5 px-4 text-gray-600 hover:text-gray-800 font-medium rounded-lg hover:bg-gray-50 transition"
              >
                Maybe Later
              </button>
              <button
                onClick={handleEnable}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Enabling...
                  </>
                ) : (
                  "Enable"
                )}
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
