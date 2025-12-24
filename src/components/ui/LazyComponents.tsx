"use client";

import dynamic from "next/dynamic";

// Lazy load heavy components - only loaded when needed
export const LazyChatButton = dynamic(
  () => import("@/components/chat/ChatButton"),
  { 
    loading: () => <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />,
    ssr: false 
  }
);

export const LazyChatRoom = dynamic(
  () => import("@/components/chat/TournamentChatRoom"),
  { 
    loading: () => null,
    ssr: false 
  }
);

export const LazyChatProvider = dynamic(
  () => import("@/contexts/ChatContext").then(mod => ({ default: mod.ChatProvider })),
  { 
    loading: () => null,
    ssr: false 
  }
);

// Lazy load notification prompt - not needed on initial render
export const LazyNotificationPrompt = dynamic(
  () => import("@/components/notifications/NotificationPrompt"),
  { 
    loading: () => null,
    ssr: false 
  }
);
