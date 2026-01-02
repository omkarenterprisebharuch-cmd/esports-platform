"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api-client";

interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  category: "info" | "success" | "warning" | "error";
  tournament_id?: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

interface NotificationPreferences {
  email: Record<string, boolean>;
  push: Record<string, boolean>;
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  tournament_updates: "Tournament Updates",
  registration_confirmation: "Registration Confirmations",
  room_credentials: "Room Credentials",
  tournament_reminders: "Tournament Reminders",
  waitlist_updates: "Waitlist Updates",
  marketing: "Marketing & Promotions",
};

const CATEGORY_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  info: { bg: "bg-blue-50", border: "border-blue-200", icon: "ℹ️" },
  success: { bg: "bg-green-50", border: "border-green-200", icon: "✅" },
  warning: { bg: "bg-yellow-50", border: "border-yellow-200", icon: "⚠️" },
  error: { bg: "bg-red-50", border: "border-red-200", icon: "❌" },
};

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"notifications" | "preferences">("notifications");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasFetchedNotifications, setHasFetchedNotifications] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api<{
        notifications: Notification[];
        unread_count: number;
      }>("/api/notifications/history?limit=50");

      if (response.success && response.data) {
        setNotifications(response.data.notifications);
        setUnreadCount(response.data.unread_count);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    try {
      const response = await api<{ preferences: NotificationPreferences }>(
        "/api/notifications/preferences"
      );
      if (response.success && response.data) {
        setPreferences(response.data.preferences);
      }
    } catch (error) {
      console.error("Failed to fetch preferences:", error);
    }
  }, []);

  // Mark notification as read
  const markAsRead = async (notificationIds: string[]) => {
    try {
      await api("/api/notifications/history", {
        method: "PUT",
        body: JSON.stringify({ notification_ids: notificationIds }),
      });
      
      setNotifications((prev) =>
        prev.map((n) =>
          notificationIds.includes(n.id) ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - notificationIds.length));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await api("/api/notifications/history", {
        method: "POST",
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  // Update preferences
  const updatePreference = async (
    channel: "email" | "push",
    key: string,
    value: boolean
  ) => {
    if (!preferences) return;

    const newPreferences = {
      ...preferences,
      [channel]: {
        ...preferences[channel],
        [key]: value,
      },
    };
    setPreferences(newPreferences);

    try {
      setSaving(true);
      await api("/api/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify({ [channel]: { [key]: value } }),
      });
    } catch (error) {
      console.error("Failed to update preferences:", error);
      // Revert on error
      setPreferences(preferences);
    } finally {
      setSaving(false);
    }
  };

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Fetch data ONLY when user explicitly opens the notification panel (clicks bell icon)
  // This ensures no API calls are made until user interaction
  useEffect(() => {
    if (isOpen && !hasFetchedNotifications) {
      fetchNotifications();
      setHasFetchedNotifications(true);
      if (!preferences) {
        fetchPreferences();
      }
    }
  }, [isOpen, hasFetchedNotifications, fetchNotifications, fetchPreferences, preferences]);

  // Allow manual refresh when panel is reopened after being closed
  const handleRefresh = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="Notifications"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-h-[80vh] bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="border-b border-gray-200">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {activeTab === "notifications" && (
                  <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="text-sm text-gray-500 hover:text-gray-700 font-medium disabled:opacity-50"
                    title="Refresh notifications"
                  >
                    🔄
                  </button>
                )}
                {unreadCount > 0 && activeTab === "notifications" && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-violet-600 hover:text-violet-800 font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>
            {/* Tabs */}
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setActiveTab("notifications")}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "notifications"
                    ? "text-violet-600 border-b-2 border-violet-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setActiveTab("preferences")}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "preferences"
                    ? "text-violet-600 border-b-2 border-violet-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Preferences
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[60vh]">
            {activeTab === "notifications" ? (
              loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg
                    className="w-12 h-12 mx-auto mb-3 text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => {
                    const style = CATEGORY_STYLES[notification.category] || CATEGORY_STYLES.info;
                    return (
                      <div
                        key={notification.id}
                        onClick={() => {
                          if (!notification.is_read) {
                            markAsRead([notification.id]);
                          }
                          if (notification.action_url) {
                            window.location.href = notification.action_url;
                          }
                        }}
                        className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                          !notification.is_read ? "bg-violet-50/50" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-lg">{style.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium text-gray-900 ${
                                !notification.is_read ? "font-semibold" : ""
                              }`}>
                                {notification.title}
                              </p>
                              {!notification.is_read && (
                                <span className="w-2 h-2 bg-violet-600 rounded-full flex-shrink-0"></span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatTime(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Preferences Tab */
              <div className="p-4 space-y-6">
                {saving && (
                  <div className="text-sm text-violet-600 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-violet-600"></div>
                    Saving...
                  </div>
                )}

                {preferences && (
                  <>
                    {/* Email Preferences */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span>📧</span> Email Notifications
                      </h4>
                      <div className="space-y-3">
                        {Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, label]) => (
                          <label
                            key={`email-${key}`}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <span className="text-sm text-gray-700">{label}</span>
                            <button
                              type="button"
                              onClick={() =>
                                updatePreference("email", key, !preferences.email[key])
                              }
                              className={`relative w-11 h-6 rounded-full transition-colors ${
                                preferences.email[key] ? "bg-violet-600" : "bg-gray-300"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                  preferences.email[key] ? "translate-x-5" : "translate-x-0"
                                }`}
                              ></span>
                            </button>
                          </label>
                        ))}
                      </div>
                    </div>

                    <hr className="border-gray-200" />

                    {/* Push Preferences */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span>🔔</span> Push Notifications
                      </h4>
                      <div className="space-y-3">
                        {Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, label]) => (
                          <label
                            key={`push-${key}`}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <span className="text-sm text-gray-700">{label}</span>
                            <button
                              type="button"
                              onClick={() =>
                                updatePreference("push", key, !preferences.push[key])
                              }
                              className={`relative w-11 h-6 rounded-full transition-colors ${
                                preferences.push[key] ? "bg-violet-600" : "bg-gray-300"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                  preferences.push[key] ? "translate-x-5" : "translate-x-0"
                                }`}
                              ></span>
                            </button>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
