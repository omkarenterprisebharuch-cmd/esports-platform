# Real-time Tournament Chat Feature

This feature provides real-time chat functionality for registered tournament participants using Socket.io.

## Phase 1 (MVP) - Database Persistence

**Architecture:** Single PostgreSQL table + Socket.io for real-time delivery

### Key Features
- ✅ Messages persisted to `chat_messages` table
- ✅ Real-time delivery via Socket.io
- ✅ Rate limiting (20 messages/minute per user)
- ✅ Profanity filtering (auto-replaces with asterisks)
- ✅ Message validation (max 500 chars, spam detection)
- ✅ Automatic cleanup via daily cron job (7 days after tournament ends)
- ✅ Tournament-specific chat rooms
- ✅ Registration-based access control
- ✅ JWT authentication

## Features

- **Tournament-specific chat rooms**: Each tournament has its own isolated chat room
- **Registration-based access**: Only registered players can view and send messages
- **Time-restricted access**: Chat is available from registration start until tournament end
- **Persistent messages**: Messages stored in database, available for 7 days after tournament ends
- **Real-time updates**: Messages are instantly broadcast to all participants
- **Authentication**: JWT-based authentication for secure chat access
- **Rate Limiting**: Prevents spam (20 messages per minute per user)
- **Profanity Filter**: Auto-replaces inappropriate words with asterisks

## Architecture

### Server-side
- `socket-server.ts` - Socket.io server with DB persistence, rate limiting, profanity filter
- `src/lib/chat-utils.ts` - Rate limiting, profanity filter, message validation utilities
- `src/app/api/tournaments/[id]/chat/route.ts` - REST API for fetching chat history
- `src/app/api/tournaments/[id]/chat-participants/route.ts` - API to fetch registered user IDs
- `scripts/cleanup-chat.ts` - Daily cron job to delete old messages
- `migrations/create_chat_messages.sql` - Database table schema

### Client-side
- `src/lib/socket-client.ts` - Socket.io client utilities
- `src/contexts/ChatContext.tsx` - React context for chat state management
- `src/components/chat/TournamentChatRoom.tsx` - Chat room modal component
- `src/components/chat/ChatButton.tsx` - Chat access button with time validation

## Running the Application

### Development Mode

Start the socket server (runs on port 3002):
```bash
npx tsx socket-server.ts
```

In another terminal, start Next.js:
```bash
npm run dev:next
```

Or use the combined dev script (if available):
```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm run start
```

### Database Migration

Run the chat messages migration:
```bash
psql -U postgres -d esports_platform -f migrations/create_chat_messages.sql
```

### Cleanup Cron Job

Set up a daily cron job to clean old messages (e.g., at 3 AM):
```bash
# Add to crontab
0 3 * * * cd /path/to/esports-nextjs && npx tsx scripts/cleanup-chat.ts >> /var/log/chat-cleanup.log 2>&1
```

Or run manually:
```bash
npx tsx scripts/cleanup-chat.ts
```

## Chat Flow

```
1. User Opens Tournament Page
   ↓
2. Frontend connects to Socket.io (port 3002)
   ↓
3. Socket.io joins room: "tournament:123"
   ↓
4. Server loads last 50 messages from DB → sends to user
   ↓
5. User sends message
   ↓
6. Backend receives via Socket.io
   ↓
7. Validate message:
   - Rate limit check (20/min)
   - Profanity filter
   - Length & spam check
   ↓
8. Save to chat_messages table
   ↓
9. Broadcast to all users in room
   ↓
10. Other users receive instantly!
   ↓
11. Tournament ends → room closes
   ↓
12. Cron job (daily): DELETE messages for tournaments ended 7+ days ago
```

## How It Works

1. **User registers for a tournament**: They become eligible for the chat room

2. **Chat availability check**: 
   - Chat button appears on tournament detail page for registered users
   - Chat is only accessible between `registration_start_date` and `tournament_end_date`

3. **Joining chat**:
   - User clicks "Chat Now" button
   - Client connects to Socket.io server with JWT token
   - Server validates token and checks if user is registered
   - User joins the tournament-specific room

4. **Sending messages**:
   - Messages are validated on server
   - Broadcast to all users in the room
   - Stored in memory (not database)

5. **Automatic cleanup**:
   - Server runs cleanup every minute
   - Removes rooms for ended tournaments
   - Notifies connected users that chat is closed

## Security

- All socket connections require valid JWT authentication
- Server verifies user is registered before allowing room access
- Messages are validated and limited to 500 characters
- Rate limiting: 20 messages per minute per user
- Profanity filter replaces inappropriate words
- Spam detection (repeated characters, excessive caps)

## Database Schema

```sql
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    username VARCHAR(100) NOT NULL,
    message TEXT NOT NULL CHECK (char_length(message) <= 500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_chat_messages_tournament_created ON chat_messages(tournament_id, created_at DESC);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
```

## Environment Variables

Add to your `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3002
JWT_SECRET=your_super_secret_jwt_key
SOCKET_PORT=3002

# Database (for socket server)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=esports_platform
DB_USER=postgres
DB_PASSWORD=your_password
```

## Message Format

```typescript
interface ChatMessage {
  id: string;           // Unique message ID
  tournamentId: number; // Tournament ID
  userId: number;       // Sender's user ID
  username: string;     // Sender's username
  message: string;      // Message content (max 500 chars)
  timestamp: Date;      // Message timestamp
}
```

## Events

### Client -> Server
- `join-tournament-chat` - Join a tournament chat room
- `leave-tournament-chat` - Leave a tournament chat room
- `send-message` - Send a message to the room

### Server -> Client
- `chat-history` - Previous messages when joining
- `new-message` - New message broadcast
- `user-joined` - Notification when user joins
- `user-left` - Notification when user leaves
- `error` - Error messages
- `chat-closed` - Tournament ended notification
