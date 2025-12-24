import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";

// JWT_SECRET is read at runtime to ensure env is loaded
function getJwtSecret(): string {
  return process.env.JWT_SECRET || "your_super_secret_jwt_key";
}

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

// Singleton pattern for Socket.io server
let io: SocketIOServer | null = null;
const tournamentRooms = new Map<string, TournamentRoom>();

export function getIO(): SocketIOServer | null {
  return io;
}

export function initializeSocketServer(server: any): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(server, {
    cors: {
      origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
    allowEIO3: true,
  });

  console.log("🔌 Socket.io server initialized");

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    console.log("🔑 Auth attempt - Token received:", token ? `${token.substring(0, 20)}...` : "none");

    if (!token) {
      console.log("❌ Auth failed: No token provided");
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload;
      socket.data.user = decoded;
      console.log(`✅ Auth success: ${decoded.username} (ID: ${decoded.id})`);
      next();
    } catch (err: any) {
      console.log("❌ Auth failed: Invalid token -", err.message);
      console.log("🔐 JWT_SECRET being used:", getJwtSecret().substring(0, 10) + "...");
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

      const registeredUserStrings = registeredUsers.map((id) => String(id));
      if (!registeredUserStrings.includes(userId)) {
        socket.emit("error", {
          message: "You must be registered for this tournament to join the chat",
        });
        return;
      }

      const tournamentEndTime = new Date(endTime);
      if (new Date() > tournamentEndTime) {
        socket.emit("error", {
          message: "Tournament has ended. Chat is no longer available.",
        });
        return;
      }

      if (!tournamentRooms.has(roomKey)) {
        tournamentRooms.set(roomKey, {
          tournamentId,
          messages: [],
          registeredUsers: new Set(registeredUserStrings),
          endTime: tournamentEndTime,
        });
      } else {
        const room = tournamentRooms.get(roomKey)!;
        registeredUserStrings.forEach((id) => room.registeredUsers.add(id));
      }

      const roomName = `tournament-${roomKey}`;
      socket.join(roomName);

      const room = tournamentRooms.get(roomKey)!;
      socket.emit("chat-history", { messages: room.messages });

      io!.to(roomName).emit("user-joined", {
        userId,
        username: socket.data.user.username,
        message: `${socket.data.user.username} joined the chat`,
      });

      console.log(`✅ ${socket.data.user.username} joined ${roomName}`);
    });

    socket.on("leave-tournament-chat", (data: { tournamentId: number | string }) => {
      const roomKey = String(data.tournamentId);
      const roomName = `tournament-${roomKey}`;
      socket.leave(roomName);

      io!.to(roomName).emit("user-left", {
        userId: String(socket.data.user.id),
        username: socket.data.user.username,
        message: `${socket.data.user.username} left the chat`,
      });
    });

    socket.on("send-message", (data: { tournamentId: number | string; message: string }) => {
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

      const chatMessage: ChatMessage = {
        id: `${Date.now()}-${userId}`,
        tournamentId,
        userId,
        username,
        message: message.trim().substring(0, 500),
        timestamp: new Date(),
      };

      room.messages.push(chatMessage);

      if (room.messages.length > 200) {
        room.messages = room.messages.slice(-200);
      }

      io!.to(`tournament-${roomKey}`).emit("new-message", chatMessage);
    });

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.data.user.username}`);
    });
  });

  // Cleanup interval
  setInterval(() => {
    const now = new Date();
    tournamentRooms.forEach((room, tournamentId) => {
      if (now > room.endTime) {
        console.log(`🧹 Cleaning up chat for tournament ${tournamentId}`);
        tournamentRooms.delete(tournamentId);
        io!.to(`tournament-${tournamentId}`).emit("chat-closed", {
          message: "Tournament has ended. Chat history has been cleared.",
        });
      }
    });
  }, 60000);

  return io;
}
