-- Chat Messages Table for Tournament Chat Feature (Phase 1 MVP)
-- This table stores real-time chat messages for tournament participants

-- Create chat_messages table if not exists
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL, -- Denormalized for performance
    message TEXT NOT NULL CHECK (char_length(message) <= 500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fetching messages by tournament (most common query)
CREATE INDEX IF NOT EXISTS idx_chat_messages_tournament_id 
    ON chat_messages(tournament_id);

-- Index for fetching messages by tournament sorted by time
CREATE INDEX IF NOT EXISTS idx_chat_messages_tournament_created 
    ON chat_messages(tournament_id, created_at DESC);

-- Index for cleanup job (finding old messages by tournament status)
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at 
    ON chat_messages(created_at);

-- Index for rate limiting checks (user + recent time)
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_rate_limit 
    ON chat_messages(user_id, tournament_id, created_at DESC);

-- Comment on table
COMMENT ON TABLE chat_messages IS 'Ephemeral chat messages for tournament participants. Cleaned up 7 days after tournament ends.';
