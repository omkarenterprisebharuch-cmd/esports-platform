"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeUserCount, setActiveUserCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isChatClosed, setIsChatClosed] = useState(false);
  const [socketReady, setSocketReady] = useState(false);

  const connect = useCallback((token: string) => {
    const socket = initSocket(token);

    socket.on("connect", () => {
      setIsConnected(true);
      setSocketReady(true);
      setError(null);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
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
  }, []);

  const joinChat = useCallback(
    (tournamentId: number | string, registeredUsers: (number | string)[], endTime: string) => {
      if (!getSocket()?.connected) {
        setError("Not connected to chat server");
        return;
      }

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
        setMessages(data.messages);
      },
      onActiveUsers: (data) => {
        setActiveUserCount(data.count);
      },
      onError: (err) => {
        setError(err.message);
      },
      onChatClosed: (data) => {
        setIsChatClosed(true);
        setMessages([]);
        setActiveUserCount(0);
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
