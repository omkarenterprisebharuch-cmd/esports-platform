-- =====================================================
-- Database Performance Indexes
-- Run this migration to optimize query performance
-- =====================================================

-- Tournament Registrations Indexes
-- Critical for fetching registrations by tournament or user
CREATE INDEX IF NOT EXISTS idx_registrations_tournament_id 
ON tournament_registrations(tournament_id);

CREATE INDEX IF NOT EXISTS idx_registrations_user_id 
ON tournament_registrations(user_id);

CREATE INDEX IF NOT EXISTS idx_registrations_team_id 
ON tournament_registrations(team_id) 
WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registrations_status 
ON tournament_registrations(status);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_registrations_tournament_status 
ON tournament_registrations(tournament_id, status);

CREATE INDEX IF NOT EXISTS idx_registrations_user_status 
ON tournament_registrations(user_id, status);

-- =====================================================
-- Tournaments Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_tournaments_status 
ON tournaments(status);

CREATE INDEX IF NOT EXISTS idx_tournaments_host_id 
ON tournaments(host_id);

CREATE INDEX IF NOT EXISTS idx_tournaments_game_type 
ON tournaments(game_type);

CREATE INDEX IF NOT EXISTS idx_tournaments_start_date 
ON tournaments(start_date);

-- Composite for listing upcoming tournaments
CREATE INDEX IF NOT EXISTS idx_tournaments_status_start_date 
ON tournaments(status, start_date);

-- =====================================================
-- Teams Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_teams_captain_id 
ON teams(captain_id);

CREATE INDEX IF NOT EXISTS idx_teams_team_code 
ON teams(team_code);

CREATE INDEX IF NOT EXISTS idx_teams_is_active 
ON teams(is_active);

-- =====================================================
-- Team Members Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_team_members_team_id 
ON team_members(team_id);

CREATE INDEX IF NOT EXISTS idx_team_members_user_id 
ON team_members(user_id);

-- Composite for finding active memberships
CREATE INDEX IF NOT EXISTS idx_team_members_user_active 
ON team_members(user_id, left_at) 
WHERE left_at IS NULL;

-- =====================================================
-- Push Subscriptions Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
ON push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active 
ON push_subscriptions(is_active) 
WHERE is_active = TRUE;

-- =====================================================
-- Chat Messages Indexes (if table exists)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_chat_messages_tournament_id 
ON chat_messages(tournament_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id 
ON chat_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at 
ON chat_messages(created_at DESC);

-- Composite for fetching tournament chat history
CREATE INDEX IF NOT EXISTS idx_chat_messages_tournament_created 
ON chat_messages(tournament_id, created_at DESC);

-- =====================================================
-- Tournament Leaderboard Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_leaderboard_tournament_id 
ON tournament_leaderboard(tournament_id);

CREATE INDEX IF NOT EXISTS idx_leaderboard_user_id 
ON tournament_leaderboard(user_id) 
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leaderboard_team_id 
ON tournament_leaderboard(team_id) 
WHERE team_id IS NOT NULL;

-- Composite for ranking queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_tournament_position 
ON tournament_leaderboard(tournament_id, "position");

-- =====================================================
-- Users Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_username 
ON users(username);

CREATE INDEX IF NOT EXISTS idx_users_is_host 
ON users(is_host) 
WHERE is_host = TRUE;

-- =====================================================
-- Analyze tables to update statistics
-- =====================================================
ANALYZE tournament_registrations;
ANALYZE tournaments;
ANALYZE teams;
ANALYZE team_members;
ANALYZE push_subscriptions;
ANALYZE chat_messages;
ANALYZE tournament_leaderboard;
ANALYZE users;

-- =====================================================
-- Display index info (run manually to verify)
-- =====================================================
-- SELECT 
--     tablename,
--     indexname,
--     indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;
