"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import {
  initSocket,
  disconnectSocket,
  getSocket,
  joinTournamentChat,
  leaveTournamentChat,
  sendMessage,
  subscribeToChatEvents,
  ChatMessage,
} from "@/lib/socket-client";

interface ChatContextType {
  isConnected: boolean;
  messages: ChatMessage[];
  activeUserCount: number;
  error: string | null;
  isChatClosed: boolean;
  connect: (token: string) => void;
  disconnect: () => void;
  joinChat: (tournamentId: number | string, registeredUsers: (number | string)[], endTime: string) => void;
  leaveChat: (tournamentId: number | string) => void;
  send: (tournamentId: number | string, message: string) => void;
  clearError: () => void;
}

// Store last room info for reconnection
interface LastRoomInfo {
  tournamentId: number | string;
  registeredUsers: (number | string)[];
  endTime: string;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeUserCount, setActiveUserCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isChatClosed, setIsChatClosed] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  
  // Track last room for reconnection
  const lastRoomRef = useRef<LastRoomInfo | null>(null);
  const tokenRef = useRef<string | null>(null);
  const wasConnectedRef = useRef(false);

  const connect = useCallback((token: string) => {
    tokenRef.current = token;
    const socket = initSocket(token);

    socket.on("connect", () => {
      setIsConnected(true);
      setSocketReady(true);
      setError(null);
      
      // Auto-rejoin last room on reconnect
      if (wasConnectedRef.current && lastRoomRef.current) {
        const { tournamentId, registeredUsers, endTime } = lastRoomRef.current;
        console.log("🔄 Reconnecting to chat room:", tournamentId);
        // Small delay to ensure socket is fully ready
        setTimeout(() => {
          joinTournamentChat(tournamentId, registeredUsers, endTime);
        }, 100);
      }
      wasConnectedRef.current = true;
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      console.log("📡 Disconnected from chat:", reason);
      
      // Don't clear messages on temporary disconnects
      // This preserves chat history during reconnection attempts
      if (reason === "io server disconnect" || reason === "io client disconnect") {
        // Server or client initiated disconnect - clear everything
        setMessages([]);
        setActiveUserCount(0);
        lastRoomRef.current = null;
      }
      // For transport close/error, socket.io will auto-reconnect
    });

    socket.on("connect_error", (err) => {
      setError(`Connection failed: ${err.message}`);
      setIsConnected(false);
    });
  }, []);

  const disconnect = useCallback(() => {
    disconnectSocket();
    setIsConnected(false);
    setSocketReady(false);
    setMessages([]);
    setActiveUserCount(0);
    lastRoomRef.current = null;
    wasConnectedRef.current = false;
  }, []);

  const joinChat = useCallback(
    (tournamentId: number | string, registeredUsers: (number | string)[], endTime: string) => {
      if (!getSocket()?.connected) {
        setError("Not connected to chat server");
        return;
      }

      // Store room info for reconnection
      lastRoomRef.current = { tournamentId, registeredUsers, endTime };
      
      // Only clear messages if joining a different room
      setMessages([]);
      setActiveUserCount(0);
      setIsChatClosed(false);
      setError(null);

      joinTournamentChat(tournamentId, registeredUsers, endTime);
    },
    []
  );

  const leaveChat = useCallback((tournamentId: number | string) => {
    leaveTournamentChat(tournamentId);
    setMessages([]);
    setActiveUserCount(0);
    lastRoomRef.current = null;
  }, []);

  const send = useCallback((tournamentId: number | string, message: string) => {
    if (!message.trim()) return;
    sendMessage(tournamentId, message);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Subscribe to chat events AFTER socket is ready
  useEffect(() => {
    if (!socketReady) {
      return;
    }

    const cleanup = subscribeToChatEvents({
      onMessage: (message) => {
        setMessages((prev) => [...prev, message]);
      },
      onHistory: (data) => {
        // Merge history with existing messages to preserve any sent during reconnection
        setMessages((prev) => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMessages = data.messages.filter(m => !existingIds.has(m.id));
          // Combine and sort by timestamp
          const combined = [...newMessages, ...prev];
          combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          return combined;
        });
      },
      onActiveUsers: (data) => {
        setActiveUserCount(data.count);
      },
      onError: (err) => {
        setError(err.message);
      },
      onChatClosed: () => {
        setIsChatClosed(true);
        setMessages([]);
        setActiveUserCount(0);
        lastRoomRef.current = null;
      },
    });

    return cleanup;
  }, [socketReady]);

  return (
    <ChatContext.Provider
      value={{
        isConnected,
        messages,
        activeUserCount,
        error,
        isChatClosed,
        connect,
        disconnect,
        joinChat,
        leaveChat,
        send,
        clearError,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextType {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
