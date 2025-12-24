import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key";

interface TokenPayload {
  id: number | string;
  email: string;
  username: string;
  is_host: boolean;
}

interface ChatMessage {
  id: string;
  tournamentId: number | string;
  userId: number | string;
  username: string;
  message: string;
  timestamp: Date;
}

interface TournamentRoom {
  tournamentId: number | string;
  messages: ChatMessage[];
  registeredUsers: Set<string>;
  endTime: Date;
}

// In-memory storage for tournament chat rooms
// Messages are ephemeral and will be cleared after tournament ends
const tournamentRooms = new Map<string, TournamentRoom>();

// Cleanup interval reference
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Initialize Socket.io server
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/api/socket",
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    console.log(`User connected: ${socket.data.user.username} (${socket.data.user.id})`);

    // Join tournament chat room
    socket.on("join-tournament-chat", async (data: { 
      tournamentId: number | string; 
      registeredUsers: (number | string)[];
      endTime: string;
    }) => {
      const { tournamentId, registeredUsers, endTime } = data;
      const roomKey = String(tournamentId);
      const userId = String(socket.data.user.id);

      // Verify user is registered for this tournament
      const registeredUserStrings = registeredUsers.map(id => String(id));
      if (!registeredUserStrings.includes(userId)) {
        socket.emit("error", { message: "You must be registered for this tournament to join the chat" });
        return;
      }

      // Check if tournament has ended
      const tournamentEndTime = new Date(endTime);
      if (new Date() > tournamentEndTime) {
        socket.emit("error", { message: "Tournament has ended. Chat is no longer available." });
        return;
      }

      // Create room if it doesn't exist
      if (!tournamentRooms.has(roomKey)) {
        tournamentRooms.set(roomKey, {
          tournamentId,
          messages: [],
          registeredUsers: new Set(registeredUserStrings),
          endTime: tournamentEndTime,
        });
      } else {
        // Update registered users list
        const room = tournamentRooms.get(roomKey)!;
        registeredUserStrings.forEach(id => room.registeredUsers.add(id));
      }

      const roomName = `tournament-${roomKey}`;
      socket.join(roomName);

      // Send existing messages to the user
      const room = tournamentRooms.get(roomKey)!;
      socket.emit("chat-history", { messages: room.messages });

      // Notify room about new user
      io.to(roomName).emit("user-joined", {
        userId,
        username: socket.data.user.username,
        message: `${socket.data.user.username} joined the chat`,
      });

      console.log(`${socket.data.user.username} joined tournament-${roomKey} chat`);
    });

    // Leave tournament chat room
    socket.on("leave-tournament-chat", (data: { tournamentId: number | string }) => {
      const roomKey = String(data.tournamentId);
      const roomName = `tournament-${roomKey}`;
      socket.leave(roomName);

      io.to(roomName).emit("user-left", {
        userId: String(socket.data.user.id),
        username: socket.data.user.username,
        message: `${socket.data.user.username} left the chat`,
      });
    });

    // Send message to tournament chat
    socket.on("send-message", (data: { tournamentId: number | string; message: string }) => {
      const { tournamentId, message } = data;
      const roomKey = String(tournamentId);
      const userId = String(socket.data.user.id);
      const username = socket.data.user.username;

      // Validate room exists and user is registered
      const room = tournamentRooms.get(roomKey);
      if (!room) {
        socket.emit("error", { message: "Chat room not found" });
        return;
      }

      if (!room.registeredUsers.has(userId)) {
        socket.emit("error", { message: "You are not authorized to send messages in this chat" });
        return;
      }

      // Check if tournament has ended
      if (new Date() > room.endTime) {
        socket.emit("error", { message: "Tournament has ended. Chat is no longer available." });
        return;
      }

      // Create chat message
      const chatMessage: ChatMessage = {
        id: `${Date.now()}-${userId}`,
        tournamentId,
        userId,
        username,
        message: message.trim().substring(0, 500), // Limit message length
        timestamp: new Date(),
      };

      // Store message in memory
      room.messages.push(chatMessage);

      // Limit stored messages to last 200
      if (room.messages.length > 200) {
        room.messages = room.messages.slice(-200);
      }

      // Broadcast message to all users in the room
      const roomName = `tournament-${roomKey}`;
      io.to(roomName).emit("new-message", chatMessage);
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.data.user.username}`);
    });
  });

  // Start cleanup interval for expired tournament chats
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      const now = new Date();
      
      tournamentRooms.forEach((room, tournamentId) => {
        if (now > room.endTime) {
          // Clear messages and remove room
          console.log(`Cleaning up chat for tournament ${tournamentId}`);
          tournamentRooms.delete(tournamentId);
          
          // Notify any remaining users in the room
          io.to(`tournament-${tournamentId}`).emit("chat-closed", {
            message: "Tournament has ended. Chat history has been cleared.",
          });
        }
      });
    }, 60000); // Check every minute
  }

  return io;
}

/**
 * Get chat room info
 */
export function getChatRoom(tournamentId: number | string): TournamentRoom | undefined {
  return tournamentRooms.get(String(tournamentId));
}

/**
 * Check if user is registered for tournament chat
 */
export function isUserRegisteredForChat(tournamentId: number | string, userId: number | string): boolean {
  const room = tournamentRooms.get(String(tournamentId));
  return room ? room.registeredUsers.has(String(userId)) : false;
}
