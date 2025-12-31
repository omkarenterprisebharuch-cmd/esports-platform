-- =====================================================
-- Database Performance Indexes v2 - Deep Optimization
-- Run this migration to further optimize query performance
-- Focus: Complex joins, aggregations, and common query patterns
-- Date: December 31, 2025
-- =====================================================

-- =====================================================
-- HALL OF FAME OPTIMIZATION
-- These queries involve heavy joins between tournaments, 
-- tournament_leaderboard, users, and teams
-- =====================================================

-- Covering index for leaderboard position lookups
-- Covers: top players/teams by wins, podium finishes
CREATE INDEX IF NOT EXISTS idx_leaderboard_position_covering
ON tournament_leaderboard(tournament_id, final_rank, user_id, team_id, prize_amount, total_kills, total_points);

-- Index for leaderboard by user with tournament join optimization
CREATE INDEX IF NOT EXISTS idx_leaderboard_user_tournament
ON tournament_leaderboard(user_id, tournament_id) 
WHERE user_id IS NOT NULL;

-- Index for leaderboard by team with tournament join optimization
CREATE INDEX IF NOT EXISTS idx_leaderboard_team_tournament
ON tournament_leaderboard(team_id, tournament_id) 
WHERE team_id IS NOT NULL;

-- Index for podium positions (top 3 finishes)
CREATE INDEX IF NOT EXISTS idx_leaderboard_podium
ON tournament_leaderboard(tournament_id, final_rank)
WHERE final_rank <= 3;

-- =====================================================
-- TOURNAMENTS COMPLEX FILTERING OPTIMIZATION
-- Used in /api/tournaments with multiple filter combinations
-- =====================================================

-- Composite index for common tournament list query pattern
-- Covers: status filter + date range + pagination
CREATE INDEX IF NOT EXISTS idx_tournaments_list_filter
ON tournaments(status, registration_start_date, tournament_start_date)
WHERE is_template = FALSE OR is_template IS NULL;

-- Index for game type + date combination (recommendations, hall of fame)
CREATE INDEX IF NOT EXISTS idx_tournaments_game_status_date
ON tournaments(game_type, status, tournament_end_date DESC);

-- Index for prize pool range queries
CREATE INDEX IF NOT EXISTS idx_tournaments_prize_pool
ON tournaments(prize_pool DESC NULLS LAST)
WHERE status IN ('upcoming', 'registration_open', 'ongoing');

-- Index for completed tournaments (frequently queried in hall of fame)
CREATE INDEX IF NOT EXISTS idx_tournaments_completed
ON tournaments(id, game_type, tournament_end_date DESC, prize_pool)
WHERE status = 'completed';

-- Partial index for active registrations (open for registration)
CREATE INDEX IF NOT EXISTS idx_tournaments_registration_open
ON tournaments(registration_start_date, registration_end_date)
WHERE status IN ('upcoming', 'registration_open')
AND (is_template = FALSE OR is_template IS NULL);

-- =====================================================
-- TOURNAMENT REGISTRATIONS OPTIMIZATION
-- High-frequency table for registration counts, user lookups
-- =====================================================

-- Covering index for registration count queries
CREATE INDEX IF NOT EXISTS idx_registrations_count_by_tournament
ON tournament_registrations(tournament_id, status)
WHERE status != 'cancelled';

-- Index for quick user participation check (used in recommendations)
CREATE INDEX IF NOT EXISTS idx_registrations_user_tournament
ON tournament_registrations(user_id, tournament_id);

-- Composite index for game preference analysis (recommendations)
-- Requires join with tournaments, so create supporting index
CREATE INDEX IF NOT EXISTS idx_registrations_game_preference
ON tournament_registrations(user_id, registered_at DESC)
WHERE status != 'cancelled';

-- =====================================================
-- USER PROFILE OPTIMIZATION
-- Frequently accessed in joins and lookups
-- =====================================================

-- Partial index for active users (excludes deleted)
CREATE INDEX IF NOT EXISTS idx_users_active
ON users(id, username, email, profile_picture_url)
WHERE deleted_at IS NULL;

-- Index for host lookups (tournament creation/management)
CREATE INDEX IF NOT EXISTS idx_users_hosts
ON users(id, username)
WHERE is_host = TRUE;

-- Index for role-based access control
CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role) 
WHERE role IN ('organizer', 'owner');

-- =====================================================
-- TEAMS OPTIMIZATION
-- Team lookups by captain, team code, active status
-- =====================================================

-- Composite index for team with captain info
CREATE INDEX IF NOT EXISTS idx_teams_captain_lookup
ON teams(id, captain_id, team_name, is_active)
WHERE is_active = TRUE;

-- =====================================================
-- NOTIFICATIONS OPTIMIZATION
-- High-volume table with frequent user + read status queries
-- =====================================================

-- Index for unread notification count (badge display)
CREATE INDEX IF NOT EXISTS idx_notifications_unread_count
ON notifications(user_id)
WHERE is_read = FALSE;

-- Index for notification list pagination
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_read
ON notifications(user_id, created_at DESC, is_read);

-- Partial index for unexpired notifications (where expires_at is null = never expires)
CREATE INDEX IF NOT EXISTS idx_notifications_active
ON notifications(user_id, created_at DESC)
WHERE expires_at IS NULL;

-- =====================================================
-- REFRESH TOKENS OPTIMIZATION
-- Session management and token validation
-- =====================================================

-- Index for active session lookup (user's devices)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_sessions
ON refresh_tokens(user_id, created_at DESC, expires_at)
WHERE revoked = FALSE;

-- =====================================================
-- PLAYER REPORTS OPTIMIZATION
-- Admin dashboard queries with filtering
-- =====================================================

-- Composite index for report listing with filters
CREATE INDEX IF NOT EXISTS idx_reports_admin_list
ON player_reports(status, created_at DESC, category_id);

-- Index for pending reports count
CREATE INDEX IF NOT EXISTS idx_reports_pending
ON player_reports(status)
WHERE status IN ('pending', 'under_review');

-- Index for reports by tournament (match context)
CREATE INDEX IF NOT EXISTS idx_reports_tournament_context
ON player_reports(tournament_id, created_at DESC)
WHERE tournament_id IS NOT NULL;

-- =====================================================
-- BANNED GAME IDS OPTIMIZATION
-- Critical for registration blocking
-- =====================================================

-- Index for ban check during registration (most frequent use case)
CREATE INDEX IF NOT EXISTS idx_banned_ids_active_check
ON banned_game_ids(LOWER(game_id), game_type)
WHERE is_active = TRUE;

-- =====================================================
-- EXPRESSIONS INDEX FOR CASE-INSENSITIVE LOOKUPS
-- =====================================================

-- Case-insensitive email lookup
CREATE INDEX IF NOT EXISTS idx_users_email_lower
ON users(LOWER(email));

-- Case-insensitive username lookup
CREATE INDEX IF NOT EXISTS idx_users_username_lower
ON users(LOWER(username));

-- Case-insensitive team code lookup
CREATE INDEX IF NOT EXISTS idx_teams_code_lower
ON teams(LOWER(team_code));

-- =====================================================
-- BAN APPEALS INDEX
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_ban_appeals_pending
ON ban_appeals(status, created_at DESC)
WHERE status IN ('pending', 'under_review');

-- =====================================================
-- CONSENT HISTORY INDEX (GDPR)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_consent_history_audit
ON user_consent_history(user_id, consent_type, created_at DESC);

-- =====================================================
-- ANALYZE ALL AFFECTED TABLES
-- Update statistics for query planner
-- =====================================================
ANALYZE tournaments;
ANALYZE tournament_registrations;
ANALYZE tournament_leaderboard;
ANALYZE users;
ANALYZE teams;
ANALYZE team_members;
ANALYZE notifications;
ANALYZE player_reports;
ANALYZE banned_game_ids;
ANALYZE refresh_tokens;
ANALYZE login_history;
ANALYZE known_user_ips;

-- =====================================================
-- DOCUMENTATION: Index Usage Monitoring Query
-- Run this query to check which indexes are being used
-- =====================================================
/*
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
*/

-- =====================================================
-- DOCUMENTATION: Find Unused Indexes
-- Run periodically to identify indexes to remove
-- =====================================================
/*
SELECT
    schemaname || '.' || relname AS table,
    indexrelname AS index,
    pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
    idx_scan as times_used
FROM pg_stat_user_indexes ui
JOIN pg_index i ON ui.indexrelid = i.indexrelid
WHERE NOT indisunique
AND idx_scan < 50  -- Used less than 50 times
ORDER BY pg_relation_size(i.indexrelid) DESC;
*/

-- =====================================================
-- DOCUMENTATION: Find Missing Indexes (Slow Queries)
-- Tables with high sequential scans vs index scans
-- =====================================================
/*
SELECT 
    schemaname,
    relname,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    CASE WHEN seq_scan > 0 
        THEN round(100.0 * idx_scan / (seq_scan + idx_scan), 2) 
        ELSE 100 
    END as index_usage_percent
FROM pg_stat_user_tables
WHERE seq_scan > 100  -- Tables with significant seq scans
ORDER BY seq_tup_read DESC;
*/

