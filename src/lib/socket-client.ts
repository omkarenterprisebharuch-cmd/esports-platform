import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

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
 */
export function initSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  // Disconnect any existing socket
  if (socket) {
    socket.disconnect();
  }

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
    socket.disconnect();
    socket = null;
  }
}

/**
 * Join tournament chat room
 */
export function joinTournamentChat(
  tournamentId: number | string,
  registeredUsers: (number | string)[],
  endTime: string
): void {
  if (!socket?.connected) {
    console.error("Socket not connected");
    return;
  }

  socket.emit("join-tournament-chat", {
    tournamentId,
    registeredUsers,
    endTime,
  });
}

/**
 * Leave tournament chat room
 */
export function leaveTournamentChat(tournamentId: number | string): void {
  if (!socket?.connected) return;

  socket.emit("leave-tournament-chat", { tournamentId });
}

/**
 * Send message to tournament chat
 */
export function sendMessage(tournamentId: number | string, message: string): void {
  if (!socket?.connected) {
    console.error("Socket not connected");
    return;
  }

  socket.emit("send-message", { tournamentId, message });
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

  // Return cleanup function
  return () => {
    if (!socket) return;
    
    if (handlers.onMessage) socket.off("new-message", handlers.onMessage);
    if (handlers.onHistory) socket.off("chat-history", handlers.onHistory);
    if (handlers.onActiveUsers) socket.off("active-users", handlers.onActiveUsers);
    if (handlers.onError) socket.off("error", handlers.onError);
    if (handlers.onChatClosed) socket.off("chat-closed", handlers.onChatClosed);
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
