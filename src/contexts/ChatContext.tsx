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

// Constants for memory management
const MAX_MESSAGES_IN_MEMORY = 100; // Keep only last 100 messages in memory
const MESSAGES_PER_PAGE = 50; // Fetch 50 messages per page when loading history

interface ChatContextType {
  isConnected: boolean;
  messages: ChatMessage[];
  activeUserCount: number;
  error: string | null;
  isChatClosed: boolean;
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
  connect: (token: string) => Promise<void>;
  disconnect: () => void;
  joinChat: (tournamentId: number | string, registeredUsers: (number | string)[], endTime: string) => void;
  leaveChat: (tournamentId: number | string) => void;
  send: (tournamentId: number | string, message: string) => void;
  loadMoreMessages: () => Promise<void>;
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
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Track last room for reconnection
  const lastRoomRef = useRef<LastRoomInfo | null>(null);
  const tokenRef = useRef<string | null>(null);
  const wasConnectedRef = useRef(false);
  const oldestMessageIdRef = useRef<string | null>(null);

  // Trim messages to prevent memory leak
  const trimMessages = useCallback((msgs: ChatMessage[]): ChatMessage[] => {
    if (msgs.length <= MAX_MESSAGES_IN_MEMORY) {
      return msgs;
    }
    // Keep only the most recent messages, but track that there are more
    const trimmed = msgs.slice(-MAX_MESSAGES_IN_MEMORY);
    return trimmed;
  }, []);

  const connect = useCallback(async (token: string) => {
    tokenRef.current = token;
    const socket = await initSocket(token);

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
        oldestMessageIdRef.current = null;
        setHasMoreMessages(false);
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
    oldestMessageIdRef.current = null;
    setHasMoreMessages(false);
  }, []);

  const joinChat = useCallback(
    (tournamentId: number | string, registeredUsers: (number | string)[], endTime: string) => {
      if (!getSocket()?.connected) {
        setError("Not connected to chat server");
        return;
      }

      // Store room info for reconnection
      lastRoomRef.current = { tournamentId, registeredUsers, endTime };
      
      // Clear state for new room
      setMessages([]);
      setActiveUserCount(0);
      setIsChatClosed(false);
      setError(null);
      oldestMessageIdRef.current = null;
      setHasMoreMessages(false);

      joinTournamentChat(tournamentId, registeredUsers, endTime);
    },
    []
  );

  const leaveChat = useCallback((tournamentId: number | string) => {
    leaveTournamentChat(tournamentId);
    setMessages([]);
    setActiveUserCount(0);
    lastRoomRef.current = null;
    oldestMessageIdRef.current = null;
    setHasMoreMessages(false);
  }, []);

  const send = useCallback((tournamentId: number | string, message: string) => {
    if (!message.trim()) return;
    sendMessage(tournamentId, message);
  }, []);

  const loadMoreMessages = useCallback(async () => {
    if (!lastRoomRef.current || isLoadingMore || !hasMoreMessages) return;
    
    const { tournamentId } = lastRoomRef.current;
    const token = tokenRef.current;
    
    if (!token || !oldestMessageIdRef.current) return;

    setIsLoadingMore(true);
    
    try {
      const response = await fetch(
        `/api/tournaments/${tournamentId}/chat?before=${oldestMessageIdRef.current}&limit=${MESSAGES_PER_PAGE}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const olderMessages: ChatMessage[] = data.data?.messages || [];
        
        if (olderMessages.length > 0) {
          // Update oldest message reference
          oldestMessageIdRef.current = olderMessages[0].id;
          
          setMessages((prev) => {
            // Prepend older messages
            const combined = [...olderMessages, ...prev];
            // Trim if needed (remove from middle to keep oldest and newest)
            if (combined.length > MAX_MESSAGES_IN_MEMORY * 1.5) {
              // Keep oldest 25 + newest 75 messages for context
              const oldest = combined.slice(0, 25);
              const newest = combined.slice(-75);
              return [...oldest, ...newest];
            }
            return combined;
          });
          
          setHasMoreMessages(olderMessages.length >= MESSAGES_PER_PAGE);
        } else {
          setHasMoreMessages(false);
        }
      }
    } catch (err) {
      console.error("Failed to load more messages:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreMessages]);

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
        setMessages((prev) => {
          const updated = [...prev, message];
          // Trim to prevent memory leak
          return trimMessages(updated);
        });
      },
      onHistory: (data) => {
        // Initial history load from server
        const historyMessages = data.messages || [];
        
        if (historyMessages.length > 0) {
          // Track oldest message for pagination
          oldestMessageIdRef.current = historyMessages[0].id;
          // Server may have more messages
          setHasMoreMessages(historyMessages.length >= MESSAGES_PER_PAGE);
        }
        
        setMessages((prev) => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMessages = historyMessages.filter((m: ChatMessage) => !existingIds.has(m.id));
          // Combine and sort by timestamp
          const combined = [...newMessages, ...prev];
          combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          // Trim to max size
          return trimMessages(combined);
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
        oldestMessageIdRef.current = null;
        setHasMoreMessages(false);
      },
    });

    return cleanup;
  }, [socketReady, trimMessages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setMessages([]);
      oldestMessageIdRef.current = null;
    };
  }, []);

  return (
    <ChatContext.Provider
      value={{
        isConnected,
        messages,
        activeUserCount,
        error,
        isChatClosed,
        hasMoreMessages,
        isLoadingMore,
        connect,
        disconnect,
        joinChat,
        leaveChat,
        send,
        loadMoreMessages,
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
