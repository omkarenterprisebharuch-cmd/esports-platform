import { Server as SocketIOServer } from "socket.io";
import { createServer } from "http";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import dotenv from "dotenv";
import {
  isRateLimited,
  validateMessage,
  clearTournamentRateLimits,
  ChatMessageSocket,
} from "./src/lib/chat-utils";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key";
const SOCKET_PORT = parseInt(process.env.SOCKET_PORT || "3002", 10);

// Database connection pool for chat persistence
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "esports_platform",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  ssl:
    process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test database connection
pool.query("SELECT NOW()")
  .then(() => console.log("✅ Socket server: Database connected"))
  .catch((err) => console.error("❌ Socket server: Database connection failed:", err.message));

interface TokenPayload {
  id: number | string;
  email: string;
  username: string;
  is_host: boolean;
}

interface TournamentRoom {
  tournamentId: number | string;
  registeredUsers: Set<string>;
  activeUsers: Set<string>; // Currently connected users
  endTime: Date;
}

// In-memory tracking for rooms (messages now stored in DB)
const tournamentRooms = new Map<string, TournamentRoom>();

// Helper to get active user count for a room
function getActiveUserCount(roomName: string): number {
  const room = io.sockets.adapter.rooms.get(roomName);
  return room ? room.size : 0;
}

// Broadcast active user count to room
function broadcastActiveCount(roomName: string): void {
  const count = getActiveUserCount(roomName);
  io.to(roomName).emit("active-users", { count });
}

// Create HTTP server for Socket.io
const httpServer = createServer((req, res) => {
  // Health check endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", rooms: tournamentRooms.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

// Initialize Socket.io
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
});

// Authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    console.log("Auth failed: No token provided");
    return next(new Error("Authentication required"));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    socket.data.user = decoded;
    console.log(`Auth success: ${decoded.username}`);
    next();
  } catch (err) {
    console.log("Auth failed: Invalid token", err);
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.data.user.username} (${socket.data.user.id})`);

  // Join tournament chat room
  socket.on("join-tournament-chat", async (data: {
    tournamentId: number | string;
    registeredUsers: (number | string)[];
    endTime: string;
  }) => {
    const { tournamentId, registeredUsers, endTime } = data;
    const roomKey = String(tournamentId);
    const userId = String(socket.data.user.id);

    console.log(`📥 Join request: User ${socket.data.user.username} -> Tournament ${roomKey}`);
    console.log(`   Registered users: ${registeredUsers.length}`);

    // Verify user is registered for this tournament
    const registeredUserStrings = registeredUsers.map((id) => String(id));
    if (!registeredUserStrings.includes(userId)) {
      console.log(`❌ User ${userId} not in registered users list`);
      socket.emit("error", {
        message: "You must be registered for this tournament to join the chat",
      });
      return;
    }

    // Check if tournament has ended
    const tournamentEndTime = new Date(endTime);
    if (new Date() > tournamentEndTime) {
      socket.emit("error", {
        message: "Tournament has ended. Chat is no longer available.",
      });
      return;
    }

    // Create room if it doesn't exist
    if (!tournamentRooms.has(roomKey)) {
      tournamentRooms.set(roomKey, {
        tournamentId,
        registeredUsers: new Set(registeredUserStrings),
        activeUsers: new Set(),
        endTime: tournamentEndTime,
      });
      console.log(`🆕 Created new room for tournament ${roomKey}`);
    } else {
      const room = tournamentRooms.get(roomKey)!;
      registeredUserStrings.forEach((id) => room.registeredUsers.add(id));
    }

    // Track active user
    const room = tournamentRooms.get(roomKey)!;
    room.activeUsers.add(userId);

    const roomName = `tournament-${roomKey}`;
    socket.join(roomName);

    // Load last 50 messages from database and send to user
    try {
      const result = await pool.query(
        `SELECT id, tournament_id, user_id, username, message, created_at
         FROM chat_messages
         WHERE tournament_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [tournamentId]
      );

      const messages: ChatMessageSocket[] = result.rows
        .map((row: { id: number; tournament_id: number; user_id: number; username: string; message: string; created_at: Date }) => ({
          id: String(row.id),
          tournamentId: row.tournament_id,
          userId: row.user_id,
          username: row.username,
          message: row.message,
          timestamp: row.created_at,
        }))
        .reverse(); // Chronological order

      socket.emit("chat-history", { messages });
    } catch (err) {
      console.error("Failed to load chat history:", err);
      socket.emit("chat-history", { messages: [] });
    }

    // Broadcast updated active user count (with small delay to ensure socket joined room)
    setTimeout(() => broadcastActiveCount(roomName), 100);

    console.log(`✅ ${socket.data.user.username} joined ${roomName}`);
  });

  // Leave tournament chat room
  socket.on("leave-tournament-chat", (data: { tournamentId: number | string }) => {
    const roomKey = String(data.tournamentId);
    const roomName = `tournament-${roomKey}`;
    const userId = String(socket.data.user.id);

    // Remove from active users
    const room = tournamentRooms.get(roomKey);
    if (room) {
      room.activeUsers.delete(userId);
    }

    socket.leave(roomName);

    // Broadcast updated count
    broadcastActiveCount(roomName);

    console.log(`👋 ${socket.data.user.username} left ${roomName}`);
  });

  // Send message to tournament chat
  socket.on("send-message", async (data: { tournamentId: number | string; message: string }) => {
    const { tournamentId, message } = data;
    const roomKey = String(tournamentId);
    const userId = String(socket.data.user.id);
    const username = socket.data.user.username;

    const room = tournamentRooms.get(roomKey);
    if (!room) {
      socket.emit("error", { message: "Chat room not found" });
      return;
    }

    if (!room.registeredUsers.has(userId)) {
      socket.emit("error", {
        message: "You are not authorized to send messages in this chat",
      });
      return;
    }

    if (new Date() > room.endTime) {
      socket.emit("error", {
        message: "Tournament has ended. Chat is no longer available.",
      });
      return;
    }

    // Rate limiting check
    if (isRateLimited(tournamentId, userId)) {
      socket.emit("error", {
        message: "You're sending messages too fast. Please wait a moment.",
      });
      return;
    }

    // Validate and sanitize message
    const validation = validateMessage(message);
    if (!validation.valid) {
      socket.emit("error", { message: validation.error });
      return;
    }

    const sanitizedMessage = validation.sanitized!;

    // Save message to database
    try {
      const result = await pool.query(
        `INSERT INTO chat_messages (tournament_id, user_id, username, message)
         VALUES ($1, $2, $3, $4)
         RETURNING id, created_at`,
        [tournamentId, userId, username, sanitizedMessage]
      );

      const chatMessage: ChatMessageSocket = {
        id: String(result.rows[0].id),
        tournamentId,
        userId,
        username,
        message: sanitizedMessage,
        timestamp: result.rows[0].created_at,
      };

      const roomName = `tournament-${roomKey}`;
      io.to(roomName).emit("new-message", chatMessage);

      console.log(`💬 Message in ${roomName}: ${username}: ${sanitizedMessage.substring(0, 50)}...`);
    } catch (err) {
      console.error("Failed to save message:", err);
      socket.emit("error", { message: "Failed to send message. Please try again." });
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.data.user.username}`);
  });
});

// Cleanup interval for expired tournament chats
setInterval(() => {
  const now = new Date();
  tournamentRooms.forEach((room, tournamentId) => {
    if (now > room.endTime) {
      console.log(`🧹 Cleaning up chat room for tournament ${tournamentId}`);
      tournamentRooms.delete(tournamentId);
      
      // Clear rate limits for this tournament
      clearTournamentRateLimits(tournamentId);
      
      io.to(`tournament-${tournamentId}`).emit("chat-closed", {
        message: "Tournament has ended. Chat is now closed.",
      });
    }
  });
}, 60000);

// Start the server
httpServer.listen(SOCKET_PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Socket.io server running on http://localhost:${SOCKET_PORT}`);
  console.log(`   Health check: http://localhost:${SOCKET_PORT}/health\n`);
});

// Keep the process alive and handle errors
httpServer.on("error", (err) => {
  console.error("Server error:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
