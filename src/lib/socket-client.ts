/**
 * Socket.IO Client - Lazy Loaded for Bundle Optimization
 * 
 * The socket.io-client library (~40KB gzipped) is dynamically imported
 * only when needed, reducing initial bundle size for pages that don't
 * use real-time features.
 * 
 * Features:
 * - Lazy loading for bundle optimization
 * - Reconnection with exponential backoff
 * - Client-side event throttling
 * - Backpressure handling
 */

import type { Socket } from "socket.io-client";
import {
  throttle,
  BackpressureHandler,
  THROTTLE_TIMES,
} from "./socket-throttle";

let socket: Socket | null = null;
let socketIOModule: typeof import("socket.io-client") | null = null;

// Backpressure handler for client-side flow control
const backpressure = new BackpressureHandler({
  maxPending: 20,
  onPressure: () => {
    console.warn("⚠️ Socket backpressure: too many pending messages");
  },
  onRelease: () => {
    console.log("✅ Socket backpressure released");
  },
});

// Track pending message acknowledgements
let pendingAcks = 0;

/**
 * Lazy load socket.io-client module
 */
async function getSocketIO() {
  if (!socketIOModule) {
    socketIOModule = await import("socket.io-client");
  }
  return socketIOModule;
}

export interface ChatMessage {
  id: string;
  tournamentId: number | string;
  userId: number | string;
  username: string;
  message: string;
  timestamp: Date;
}

export interface UserEvent {
  userId: number | string;
  username: string;
  message: string;
}

/**
 * Get or create socket connection
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Initialize socket connection with authentication
 * Now async to support dynamic import of socket.io-client
 */
export async function initSocket(token: string): Promise<Socket> {
  if (socket?.connected) {
    return socket;
  }

  // Disconnect any existing socket
  if (socket) {
    socket.disconnect();
  }

  // Lazy load socket.io-client
  const { io } = await getSocketIO();

  // Socket server runs on port 3001 (separate from Next.js)
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || `${window.location.protocol}//${window.location.hostname}:3001`;

  console.log("Initializing socket connection to:", socketUrl);

  socket = io(socketUrl, {
    auth: { token },
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
    withCredentials: true,
  });

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket?.id);
  });

  socket.on("connect_error", (error) => {
    console.error("❌ Socket connection error:", error.message);
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
  });

  return socket;
}

/**
 * Disconnect socket
 */
export function disconnectSocket(): void {
  if (socket) {
    // Cancel any throttled operations
    throttledSendMessageInternal.cancel();
    throttledTypingInternal?.cancel();
    
    // Reset backpressure
    backpressure.reset();
    pendingAcks = 0;
    
    socket.disconnect();
    socket = null;
  }
}

// Throttled join to prevent rapid rejoin attempts
let lastJoinTime = 0;
const JOIN_THROTTLE_MS = THROTTLE_TIMES.ROOM_JOIN;

/**
 * Join tournament chat room (throttled)
 */
export function joinTournamentChat(
  tournamentId: number | string,
  registeredUsers: (number | string)[],
  endTime: string
): boolean {
  if (!socket?.connected) {
    console.error("Socket not connected");
    return false;
  }

  // Throttle rapid join attempts
  const now = Date.now();
  if (now - lastJoinTime < JOIN_THROTTLE_MS) {
    console.warn("Join throttled: too soon after last join");
    return false;
  }
  lastJoinTime = now;

  socket.emit("join-tournament-chat", {
    tournamentId,
    registeredUsers,
    endTime,
  });
  
  return true;
}

/**
 * Leave tournament chat room
 */
export function leaveTournamentChat(tournamentId: number | string): void {
  if (!socket?.connected) return;

  socket.emit("leave-tournament-chat", { tournamentId });
}

/**
 * Send message to tournament chat (raw, no throttling)
 * Use throttledSendMessage for UI-triggered sends
 */
function sendMessageRaw(tournamentId: number | string, message: string): boolean {
  if (!socket?.connected) {
    console.error("Socket not connected");
    return false;
  }

  // Check backpressure
  if (!backpressure.acquire()) {
    console.warn("Message dropped due to backpressure");
    return false;
  }

  pendingAcks++;

  socket.emit("send-message", { tournamentId, message }, () => {
    // Acknowledgement received
    pendingAcks--;
    backpressure.release();
  });

  // Release after timeout if no ack (server might not support acks)
  setTimeout(() => {
    if (pendingAcks > 0) {
      pendingAcks--;
      backpressure.release();
    }
  }, 5000);

  return true;
}

/**
 * Throttled message sender to prevent spam from rapid button clicks
 * Throttles to 1 message per 500ms from UI
 */
const throttledSendMessageInternal = throttle(
  (tournamentId: number | string, message: string) => {
    sendMessageRaw(tournamentId, message);
  },
  THROTTLE_TIMES.MESSAGE_SEND
);

/**
 * Send message to tournament chat (throttled for UI use)
 */
export function sendMessage(tournamentId: number | string, message: string): void {
  if (!socket?.connected) {
    console.error("Socket not connected");
    return;
  }

  throttledSendMessageInternal(tournamentId, message);
}

/**
 * Send message immediately without throttling (for programmatic use)
 */
export function sendMessageImmediate(tournamentId: number | string, message: string): boolean {
  return sendMessageRaw(tournamentId, message);
}

/**
 * Get backpressure status
 */
export function getBackpressureStatus(): { isUnderPressure: boolean; pending: number } {
  return {
    isUnderPressure: backpressure.isUnderPressure,
    pending: backpressure.pending,
  };
}

/**
 * Typing user info
 */
export interface TypingUser {
  userId: string;
  username: string;
}

/**
 * Subscribe to chat events
 */
export function subscribeToChatEvents(handlers: {
  onMessage?: (message: ChatMessage) => void;
  onHistory?: (data: { messages: ChatMessage[] }) => void;
  onActiveUsers?: (data: { count: number }) => void;
  onError?: (error: { message: string }) => void;
  onChatClosed?: (data: { message: string }) => void;
  onTyping?: (data: TypingUser) => void;
  onStoppedTyping?: (data: TypingUser) => void;
}): () => void {
  if (!socket) {
    console.error("Socket not initialized");
    return () => {};
  }

  if (handlers.onMessage) {
    socket.on("new-message", handlers.onMessage);
  }
  if (handlers.onHistory) {
    socket.on("chat-history", handlers.onHistory);
  }
  if (handlers.onActiveUsers) {
    socket.on("active-users", handlers.onActiveUsers);
  }
  if (handlers.onError) {
    socket.on("error", handlers.onError);
  }
  if (handlers.onChatClosed) {
    socket.on("chat-closed", handlers.onChatClosed);
  }
  if (handlers.onTyping) {
    socket.on("user-typing", handlers.onTyping);
  }
  if (handlers.onStoppedTyping) {
    socket.on("user-stopped-typing", handlers.onStoppedTyping);
  }

  // Return cleanup function
  return () => {
    if (!socket) return;
    
    if (handlers.onMessage) socket.off("new-message", handlers.onMessage);
    if (handlers.onHistory) socket.off("chat-history", handlers.onHistory);
    if (handlers.onActiveUsers) socket.off("active-users", handlers.onActiveUsers);
    if (handlers.onError) socket.off("error", handlers.onError);
    if (handlers.onChatClosed) socket.off("chat-closed", handlers.onChatClosed);
    if (handlers.onTyping) socket.off("user-typing", handlers.onTyping);
    if (handlers.onStoppedTyping) socket.off("user-stopped-typing", handlers.onStoppedTyping);
  };
}

/**
 * Fetch chat history from API (fallback if socket history fails)
 */
export async function fetchChatHistory(
  tournamentId: number | string,
  token: string
): Promise<ChatMessage[]> {
  try {
    const response = await fetch(`/api/tournaments/${tournamentId}/chat`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch chat history:", response.status);
      return [];
    }

    const data = await response.json();
    return data.data?.messages || [];
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return [];
  }
}

// Throttled typing indicator
let throttledTypingInternal: ReturnType<typeof throttle> | null = null;

/**
 * Send typing indicator (heavily throttled - 1 per second)
 */
export function sendTypingIndicator(tournamentId: number | string): void {
  if (!socket?.connected) return;

  if (!throttledTypingInternal) {
    throttledTypingInternal = throttle(
      (tid: number | string) => {
        socket?.emit("typing", { tournamentId: tid });
      },
      THROTTLE_TIMES.TYPING_INDICATOR
    );
  }

  throttledTypingInternal(tournamentId);
}

/**
 * Send stopped typing indicator
 */
export function sendStoppedTyping(tournamentId: number | string): void {
  if (!socket?.connected) return;
  
  // Cancel any pending throttled typing
  throttledTypingInternal?.cancel();
  
  socket.emit("stopped-typing", { tournamentId });
}

/**
 * Get connection health status
 */
export function getConnectionHealth(): {
  connected: boolean;
  backpressure: { isUnderPressure: boolean; pending: number };
  socketId: string | null;
} {
  return {
    connected: socket?.connected ?? false,
    backpressure: getBackpressureStatus(),
    socketId: socket?.id ?? null,
  };
}
